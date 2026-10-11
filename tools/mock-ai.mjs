#!/usr/bin/env node
/**
 * tools/mock-ai.mjs — 本地 OpenAI 兼容假服务器（node 零依赖，docs/AI助手接入方案.md §七/§八）
 *
 * 用途：AI 助手验收与设置区「连接测试」，验收绝不连真实 API。
 * 启动：node tools/mock-ai.mjs [--port 18700]
 * 连接：baseURL 填 http://127.0.0.1:18700/v1，API Key 随意（以 -401/-429/-402 结尾则模拟对应错误）。
 *
 * 行为：
 *   POST /v1/chat/completions（也兼容无 /v1 前缀的 /chat/completions）
 *     stream:true  → SSE：固定脚本按片输出 → usage → data: [DONE]
 *     stream:false → 一次性 chat.completion JSON（同样带 usage）
 *   usage 的 token 数按字符数估算，仅保证字段存在与数量级合理
 *
 * 测试钩子（仅本 mock 识别，勿发给真实服务商）：
 *   请求体带 mock_reply（字符串）        → 覆盖固定回复文本
 *   system 消息含【任务：××】标记       → 返回该任务的固定结构化 JSON（四能力 / 自由问答，
 *                                          供 ai-verify.mjs 走「固定 JSON → 卡片渲染 → 应用」全链路）
 *   请求体带 mock_nonstream（真值）      → 强制走非流式 JSON（curl 直测用）
 *   请求头 x-mock-nonstream: 1          → 同上（供 provider extraHeaders 透传验收容错分支）
 *   API Key 以 -401 / -429 / -402 结尾 → 分别返回 401 鉴权失败 / 429 限流 / 402 余额不足
 */
import http from 'node:http'

const argv = process.argv.slice(2)
const portIdx = argv.indexOf('--port')
const portArg = portIdx >= 0 ? Number(argv[portIdx + 1]) : NaN
const PORT = Number.isInteger(portArg) && portArg > 0 ? portArg : 18700
const FIXED_REPLY = process.env.MOCK_AI_REPLY || '（Mock）山雨初歇，檐角滴水。少年攥紧剑柄，官道尽头的灯一盏一盏亮了起来。'
const CHUNK_CHARS = 8 // 每片字符数
const CHUNK_DELAY = 25 // 片间隔 ms，模拟真实流式节奏

function readJsonBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('请求体不是合法 JSON'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(obj))
}

const errorPayload = (message, type) => ({ error: { message, type, code: null } })

/** token 数估算：CJK 约每 2 字符 1 token，够验收断言用 */
const estimateTokens = (s) => Math.max(1, Math.ceil((s || '').length / 2))

const replyFor = (body) => (typeof body.mock_reply === 'string' ? body.mock_reply : scriptedReply(body) || FIXED_REPLY)

/* ---------- 四能力任务脚本化回复（system 消息【任务：××】标记 → 固定结构化 JSON） ----------
 * 供 tools/ai-verify.mjs 验证「mock 返回固定 JSON → 卡片渲染 → 应用落库」全链路；
 * 内容与 AI 验证书（AI 验证书种子）呼应：人物 林昭/沈青梧、铜符信物、三章短文。 */
const PLOT_REPLY = JSON.stringify({
  lines: [
    {
      title: '铜符之约',
      summary: '沈青梧道出铜符来历，林昭决意连夜探界脊。',
      tension: '驿站掌柜为何知晓星图缺角',
      characters: ['沈青梧', '林昭'],
      opening: '山雨初歇，檐角滴水。\n林昭把半枚铜符按进掌心，刻痕硌得生疼。他望向界脊的方向，灯一盏一盏亮了起来。\n「三日后梆子响三声，暗渠开。」沈青梧的话还在耳边回响。',
      impact: '呼应第一章铜镜星图缺角的伏笔。'
    },
    {
      title: '更夫引路',
      summary: '更夫三响梆子引林昭走暗渠入界脊。',
      tension: '更夫的真实身份成谜',
      characters: ['林昭'],
      opening: '梆子三响。\n巷口的老更夫朝林昭招了招手，灯影把两个人的影子拉得很长。\n林昭攥紧铜符，跟了上去。',
      impact: '为后续暗渠支线埋线。'
    }
  ]
})
const OUTLINE_REPLY = JSON.stringify({
  plans: [
    {
      name: '界脊之心',
      idea: '三章之内抵达界脊之心。',
      nodes: [
        { title: '驿站夜谈', points: '从铜符来历切入', edge: 'cause' },
        { title: '暗渠入口', points: '更夫引路走暗渠', edge: 'foreshadow' },
        { title: '星图归位', points: '合符见全图', edge: 'conflict' }
      ]
    },
    {
      name: '雾都疑云',
      idea: '先解星图缺角之谜。',
      nodes: [
        { title: '铜镜密语', points: '镜中显现旧主手书', edge: 'foreshadow' },
        { title: '旧主遗府', points: '寻府得铜符另一半', edge: 'cause' }
      ]
    }
  ]
})
const LORE_REPLY = JSON.stringify({
  mode: 'add',
  tree: { text: '铜符谱系', children: [{ text: '铜符成对，合拢可见星图。' }, { text: '铸于前朝界脊工坊。' }] },
  revised: '',
  note: '围绕界脊信物的新增条目草案'
})
const CHARACTER_REPLY = JSON.stringify({
  fields: { 师承: '雾都星匠遗脉' },
  bio: '林昭，雾都少年，凝气三层。\n佩半枚铜符，性情沉毅，重诺。',
  aliases: ['小昭'],
  relations: [
    { name: '老更夫', label: '引路人' },
    { name: '巡夜人', label: '旧识' }
  ]
})
const CHAT_REPLY = JSON.stringify({ answer: '（Mock）依据装配的上下文：主角是林昭，目前止步于铜符之谜。', writeHint: '' })

const TASK_REPLIES = [
  ['【任务：正文发展】', PLOT_REPLY],
  ['【任务：大纲规划】', OUTLINE_REPLY],
  ['【任务：设定扩展】', LORE_REPLY],
  ['【任务：人物丰富】', CHARACTER_REPLY],
  ['【任务：自由问答】', CHAT_REPLY]
]

/** system 消息的任务标记唯一决定任务类型，据此返回固定 JSON（无标记 → 固定纯文本回复） */
function scriptedReply(body) {
  const sys = (body.messages || []).find((m) => m && m.role === 'system')
  const s = typeof sys?.content === 'string' ? sys.content : JSON.stringify(sys?.content ?? '')
  for (const [marker, reply] of TASK_REPLIES) {
    if (s.includes(marker)) return reply
  }
  return null
}

function splitChunks(text, size) {
  const out = []
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size))
  return out
}

function handleStream(res, body, promptTokens) {
  const model = body.model || 'mock-model'
  const reply = replyFor(body)
  const completionTokens = estimateTokens(reply)
  const usage = { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens }
  const includeUsage = !!body.stream_options?.include_usage

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  })

  const id = 'chatcmpl-mock-' + Date.now().toString(36)
  const created = Math.floor(Date.now() / 1000)
  const chunk = (delta, finish = null, extra = {}) =>
    'data: ' +
    JSON.stringify({ id, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta, finish_reason: finish }], ...extra }) +
    '\n\n'
  const usageChunk = () => 'data: ' + JSON.stringify({ id, object: 'chat.completion.chunk', created, model, choices: [], usage }) + '\n\n'

  // 事件帧序列：角色帧 → 内容片 → 结束帧（usage 按 OpenAI 语义：include_usage 时为空 choices 独立帧）
  const frames = [chunk({ role: 'assistant', content: '' })]
  for (const piece of splitChunks(reply, CHUNK_CHARS)) frames.push(chunk({ content: piece }))
  if (includeUsage) {
    frames.push(chunk({}, 'stop'))
    frames.push(usageChunk())
  } else {
    frames.push(chunk({}, 'stop', { usage }))
  }
  frames.push('data: [DONE]\n\n')

  let i = 0
  const timer = setInterval(() => {
    // 只看 res（响应侧）判中止：请求体读完 req.destroyed 即变 true（Node ≥18），不能作为连接断开依据
    if (res.destroyed) {
      clearInterval(timer)
      return
    }
    if (i < frames.length) res.write(frames[i++])
    else {
      clearInterval(timer)
      res.end()
    }
  }, CHUNK_DELAY)
  // res 的 'close' 在连接断开/客户端中止时触发，兜底清定时器
  res.on('close', () => clearInterval(timer))
}

function handleNonStream(res, body, promptTokens) {
  const model = body.model || 'mock-model'
  const reply = replyFor(body)
  const completionTokens = estimateTokens(reply)
  sendJson(res, 200, {
    id: 'chatcmpl-mock-' + Date.now().toString(36),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message: { role: 'assistant', content: reply }, logprobs: null, finish_reason: 'stop' }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens }
  })
}

function log(req, u, body, status, key) {
  const t = new Date().toISOString().slice(11, 19)
  console.log(`[mock-ai] ${t} ${req.method} ${u.pathname} stream=${body.stream ? 1 : 0} model=${body.model || '-'} key=${key ? key.slice(0, 10) + '…' : '(无)'} → ${status}`)
}

const server = http.createServer(async (req, res) => {
  // CORS：dev 渲染层（http://127.0.0.1:5173）与 app://local 直连需要
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const u = new URL(req.url, `http://127.0.0.1:${PORT}`)
  const isChat = req.method === 'POST' && u.pathname.replace(/\/+$/, '').endsWith('/chat/completions')
  if (!isChat) {
    sendJson(res, 404, errorPayload(`未知路径 ${req.method} ${u.pathname}；本 mock 仅支持 POST /v1/chat/completions`, 'invalid_request_error'))
    return
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch (err) {
    sendJson(res, 400, errorPayload('请求体解析失败：' + err.message, 'invalid_request_error'))
    return
  }

  // 错误模拟：按 API Key 后缀返回对应 HTTP 错误，供错误分类验收
  const key = String(req.headers['authorization'] || '').replace(/^Bearer\s*/i, '').trim()
  const failBySuffix = {
    '-401': [401, 'Incorrect API key provided. （mock 模拟鉴权失败）', 'invalid_request_error'],
    '-429': [429, 'Rate limit reached for requests. （mock 模拟限流）', 'rate_limit_exceeded'],
    '-402': [402, 'Insufficient Balance. （mock 模拟余额不足）', 'insufficient_quota']
  }
  for (const [suffix, [status, msg, type]] of Object.entries(failBySuffix)) {
    if (key.endsWith(suffix)) {
      log(req, u, body, status, key)
      sendJson(res, status, errorPayload(msg, type))
      return
    }
  }

  const promptTokens = (body.messages || []).reduce(
    (s, m) => s + estimateTokens(typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '')),
    0
  )
  log(req, u, body, 200, key)
  if (body.stream && !body.mock_nonstream && !req.headers['x-mock-nonstream']) handleStream(res, body, promptTokens)
  else handleNonStream(res, body, promptTokens)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-ai] OpenAI 兼容假服务器已启动：http://127.0.0.1:${PORT}/v1/chat/completions`)
  console.log(`[mock-ai] 连接配置：baseURL=http://127.0.0.1:${PORT}/v1，API Key 任意（-401/-429/-402 结尾模拟对应错误）`)
  console.log('[mock-ai] Ctrl+C 停止')
})

process.on('SIGINT', () => server.close(() => process.exit(0)))
