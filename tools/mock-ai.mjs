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
      title: '铜符之约', strategy: 'steady', evidence: [],
      summary: '沈青梧道出铜符来历，林昭决意连夜探界脊。',
      tension: '驿站掌柜为何知晓星图缺角',
      characters: ['沈青梧', '林昭'],
      opening: '山雨初歇，檐角滴水。\n林昭把半枚铜符按进掌心，刻痕硌得生疼。他望向界脊的方向，灯一盏一盏亮了起来。\n「三日后梆子响三声，暗渠开。」沈青梧的话还在耳边回响。' + '他沿着湿润的石阶慢慢走下去，脚下的水光摇晃着。夜风吹过衣袖，他停下来，仔细想了想铜符上的纹路。远处的灯火始终没有熄灭，仿佛在等待一个迟迟未到的答复。' .repeat(2),
      impact: { foreshadow: '呼应第一章铜镜星图缺角的伏笔。', characters: '林昭决意探查', outline: '推进主线' }, consistency: '沿用已有设定'
    },
    {
      title: '更夫引路', strategy: 'escalate', evidence: [],
      summary: '更夫三响梆子引林昭走暗渠入界脊。',
      tension: '更夫的真实身份成谜',
      characters: ['林昭'],
      opening: '梆子三响。\n巷口的老更夫朝林昭招了招手，灯影把两个人的影子拉得很长。\n林昭攥紧铜符，跟了上去。' + '雨后的路很窄，两侧的院门都已关闭。每走几步，他便回头看一次，记住来路上的灯影和屋檐。手里的铜符越来越凉，他不敢松开，也不敢让更夫离开自己的视线。' .repeat(3),
      impact: { foreshadow: '为后续暗渠支线埋线。', characters: '林昭进一步调查', outline: '展开支线' }, consistency: '沿用已有设定'
    }
  ]
})
const OUTLINE_REPLY = JSON.stringify({
  plans: [
    {
      name: '界脊之心', positioning: '推进主线',
      idea: '三章之内抵达界脊之心。',
      nodes: [
        { title: '驿站夜谈', points: '从铜符来历切入', purpose: '推进冲突', edge: 'cause' },
        { title: '暗渠入口', points: '更夫引路走暗渠', purpose: '埋设伏笔', edge: 'foreshadow' },
        { title: '星图归位', points: '合符见全图', purpose: '推进冲突', edge: 'conflict' }
      ]
    },
    {
      name: '雾都疑云', positioning: '调查支线',
      idea: '先解星图缺角之谜。',
      nodes: [
        { title: '铜镜密语', points: '镜中显现旧主手书', purpose: '埋设伏笔', edge: 'foreshadow' },
        { title: '旧主遗府', points: '寻府得铜符另一半', purpose: '推进冲突', edge: 'cause' }
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
    { name: '沈青梧', label: '同行', basis: '已有出场人物' }
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
  const user = (body.messages || []).filter(m => m.role === 'user').at(-1)?.content || ''
  let data = {}
  try { data = JSON.parse(user) } catch {}
  if (s.includes('【任务：知识库提取】')) {
    const text = data.text || '', quote = text.split(/(?<=[。！？])|\n/)[0] || text
    const names = (data.characters || []).filter(c => text.includes(c.name)).map(c => c.name)
    const foreshadows = []
    if (text.includes('埋下铜符')) foreshadows.push({action:'set',content:'铜符之谜',target:'石门',ref:'',evidence:quote})
    if ((text.includes('铜符发光') || text.includes('铜符打开石门')) && data.active?.length) foreshadows.push({action:text.includes('打开石门')?'payoff':'progress',content:'铜符之谜',target:'石门',ref:data.active[0].id,evidence:quote})
    return JSON.stringify({ events: text ? [{summary:quote,characters:names,conflict:'',result:quote,evidence:quote}] : [], foreshadows, charstates: names.length ? [{name:names[0],dimension:'能力',change:'继续调查',evidence:quote}] : [], lore_terms: text.includes('铜符') ? [{name:'铜符',category:'物品',desc:'正文中的铜符',evidence:quote}] : [], new_entities: text.includes('夜行客') ? [{name:'夜行客',type:'人物',hint:'未登记人物',evidence:quote}] : [] })
  }
  if (s.includes('【任务：记忆聚合】')) return JSON.stringify({summary:(data.items||[]).map(x=>x.summary).join('；').slice(0,500),sourceIds:(data.items||[]).map(x=>x.id)})
  if (s.includes('【任务：文风分析】')) return JSON.stringify({profile:{视角:'第三人称',句段节奏:'短句，分段清晰',对白:'克制',描写密度:'适中',措辞:'具体',禁忌:data.taboos||''},notes:'依据所选样本'})
  if (s.includes('【任务：正文改稿】')) {
    const original = (data.text || '').split('\n')[0]
    return JSON.stringify({patches:original?[{original,replacement:original+' 风声渐起。',reason:'补充节奏停顿',evidence:[]}]:[]})
  }
  if (s.includes('【任务：一致性审稿】')) return JSON.stringify({issues:[{category:'人物状态',severity:'medium',finding:'需要核对当前人物状态与档案：'+data.chapterId,suggestion:'核对后再决定修改',evidence:data.text?[{sourceType:'chapter',sourceId:data.chapterId,quote:data.text.split('\n')[0]}]:[]}]})
  if (s.includes('【任务：结果复核】')) return JSON.stringify({warnings:[],summary:'已核对提供的来源'})
  if (s.includes('【任务：自由问答】') && user.includes('工具测试') && !user.includes('【工具')) return JSON.stringify({tool:'search_chapters',args:{query:'林昭'}})
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

const requests = []
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
  if (u.pathname === '/__requests') { sendJson(res, 200, requests); return }
  if (u.pathname === '/__reset') { requests.length = 0; sendJson(res, 200, {ok:true}); return }
  const isEmbedding = req.method === 'POST' && u.pathname.endsWith('/embeddings')
  const isChat = req.method === 'POST' && u.pathname.replace(/\/+$/, '').endsWith('/chat/completions')
  if (!isChat && !isEmbedding) {
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

  requests.push({ path: u.pathname, body })
  // Preset dialogue acceptance fixtures. No real provider or author data is used.
  if (String(body.model).startsWith('preset-')) {
    if(body.model==='preset-prefill'&&body.messages.at(-1)?.role==='assistant'){sendJson(res,400,errorPayload('assistant prefill unsupported'));return}
    if(body.model==='preset-param-reject'&&body.seed!=null){sendJson(res,400,errorPayload('Unsupported parameter: seed'));return}
    if (body.model === 'preset-no-tools' && body.tools?.length) { sendJson(res,400,errorPayload('tools unsupported'));return }
    const question = body.messages.filter(m=>m.role==='user').at(-1)?.content || ''
    const combined = JSON.stringify(body.messages)
    const followup = body.messages.some(m=>m.role==='tool')
    if (body.model === 'preset-draft-fail' && followup) { sendJson(res,503,errorPayload('followup failed'));return }
    let calls=[]
    if (!followup && body.tools?.length && body.tool_choice!=='none' && /生成草稿|继续上一条/.test(question)) calls=[{id:'call-draft',type:'function',function:{name:'submit_draft',arguments:JSON.stringify({title:'雾中来客',text:/继续/.test(question)?'\n来客放下灯，露出铜符上的刻痕。':'林昭推开窗，雾气漫入屋内。\n远处的一盏灯逐渐逼近。',summary:'雾中的悬念场景'})}}]
    if (!followup && body.tools?.length && /只读检索/.test(question)) calls=[{id:'call-read',type:'function',function:{name:'search_chapters',arguments:'{"query":"林昭","limit":2}'}}]
    const reply=followup?'已生成草稿，等待作者确认。':combined.includes('短句测试')?'门开了。风停了。':'林昭望向石门，夜色沉静而绵长。'
    const finish=body.model==='preset-length'?'length':calls.length?'tool_calls':'stop'
    if(body.model==='preset-native-json'||body.stream===false) {sendJson(res,200,{choices:[{message:{content:calls.length?null:reply,tool_calls:calls,...(body.model==='preset-reasoning'?{reasoning_content:'思考铜符的来历。'}:{})},finish_reason:finish}]});return}
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'})
    const frame=(delta,finish_reason=null)=>'data: '+JSON.stringify({choices:[{index:0,delta,finish_reason}]})+'\n\n'
    const frames=[]
    if(calls.length) for(const call of calls) {const a=call.function.arguments,half=Math.floor(a.length/2);frames.push(frame({tool_calls:[{index:0,id:call.id,type:'function',function:{name:call.function.name,arguments:a.slice(0,half)}}]}));frames.push(frame({tool_calls:[{index:0,function:{arguments:a.slice(half)}}]}))}
    else for(const content of splitChunks(reply,6))frames.push(frame({content}))
    frames.push(frame({},finish),'data: [DONE]\n\n')
    let index=0;const timer=setInterval(()=>{if(res.destroyed){clearInterval(timer);return}if(index<frames.length)res.write(frames[index++]);else{clearInterval(timer);res.end()}},body.model==='preset-slow'?400:15)
    res.on('close',()=>clearInterval(timer));return
  }
  if (isEmbedding) {
    if (body.model === 'missing') { sendJson(res,404,errorPayload('not found')); return }
    sendJson(res,200,{data:body.input.map((text,index)=>({index,embedding:[1,text.length%11,(text.charCodeAt(0)||0)%7,0.5]})),usage:{prompt_tokens:body.input.join('').length,total_tokens:body.input.join('').length}})
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
