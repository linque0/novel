import { assembleContext, DEFAULT_BUDGET } from './context'
import { chatStream } from './provider'
import { systemPromptFor, userMessageFor, TASK_PROMPTS } from './prompts'
import { getChapterSummary } from './summarize'
import { useWorkStore } from '../../stores/work'
import { collectExportChapters } from '../../db/repo'
import { stripTags } from '../wordcount'
import { uid } from '../../db/database'

/**
 * services/ai/agent.js — 任务编排（方案 §五 交互流 / §七）：
 * - 四大能力（plot/outline/lore/character）：context.js 装配 → provider.js 流式调用 →
 *   严格 JSON 解析为卡片数据；解析失败把错误回喂重试 1 次，仍失败降级为纯文本结果。
 * - 自由问答（chat）：小工具循环，仅暴露只读工具（search_chapters / get_character /
 *   get_outline_subtree / get_lore_subtree / list_recent_chapters）；模型表达写入意图时
 *   返回提示改用对应能力卡片。
 * - 写入红线（方案 §一/§六）：本层产出的所有写入数据都只是「提案」卡片，由调用方
 *   （stores/ai.js → 卡片组件 → store/work.js 动作）在用户确认后写入，agent 自身绝不落库。
 *
 * provider 形态约定：调用方传入解析后的 OpenAI 兼容参数
 *   opts = { baseURL, apiKey, model, temperature?, timeout?, signal? }
 * （与 services/ai/provider.js 的 chatStream opts 一致，由 stores/ai.js 从设置构建）。
 */

/** chat 工具循环可用的只读工具名单（方案 §五.5） */
export const CHAT_TOOLS = ['search_chapters', 'get_character', 'get_outline_subtree', 'get_lore_subtree', 'list_recent_chapters']

/** 写入意图提示 → 对应能力任务键（模型在 writeHint 里填中文能力名） */
export const WRITE_HINT_TASKS = {
  正文发展: 'plot',
  大纲规划: 'outline',
  设定扩展: 'lore',
  人物丰富: 'character'
}

/** 卡片解析失败（JSON 语法或 schema 不符）——与网络类错误区分，走「回喂重试」路径 */
class JsonParseError extends Error {
  constructor(message) {
    super(message)
    this.name = 'JsonParseError'
  }
}

/* ---------- provider 适配 ---------- */

/**
 * 摘要生成用 provider 适配器（context.js / summarize.js 约定形态：({ system, user }) => string）。
 * 走 provider.chatStream（非流式回调），usage 经 onUsage 上抛计入用量统计。
 */
export function makeSummaryAdapter(opts, onUsage = null) {
  return async ({ system, user }) => {
    const r = await chatStream(
      { ...opts, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0 },
      null
    )
    if (r.usage && onUsage) onUsage(r.usage)
    return r.text
  }
}

/** 一次调用：流式（增量经 onDelta 上抛）+ usage 聚合，返回 { text, finishReason } */
async function callOnce(opts, messages, { onDelta = null, onUsage = null } = {}) {
  let text = ''
  const r = await chatStream({ ...opts, messages }, (d) => {
    text += d
    onDelta?.(d)
  })
  if (r.usage && onUsage) onUsage(r.usage)
  return { text, finishReason: r.finishReason }
}

/* ---------- 严格 JSON 解析 ---------- */

/** 从模型输出中提取第一个 JSON 对象：容忍 ```json 围栏与前后杂讯；无对象/语法错误抛 JsonParseError */
function extractJsonObject(raw) {
  const s = String(raw || '').replace(/^\uFEFF/, '').trim()
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = (fenced ? fenced[1] : s).trim()
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) throw new JsonParseError('输出中没有找到 JSON 对象')
  let obj
  try {
    obj = JSON.parse(body.slice(start, end + 1))
  } catch (e) {
    throw new JsonParseError(`JSON 语法错误：${String(e?.message || e)}`)
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new JsonParseError('顶层必须是 JSON 对象（非数组）')
  return obj
}

const asStr = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' || typeof v === 'boolean' ? String(v).slice(0, max) : '')

/** 设定子树草案归一化：{ text, children: [...] }，限深 8 层、限节点 200 个，剔除空树 */
function normalizeTree(node, depth = 0, budget = { left: 200 }) {
  if (!node || typeof node !== 'object' || depth > 8 || budget.left <= 0) return null
  const text = asStr(node.text ?? node.title, 2000)
  if (!text && !Array.isArray(node.children)) return null
  budget.left--
  const children = []
  for (const c of Array.isArray(node.children) ? node.children : []) {
    const n = normalizeTree(c, depth + 1, budget)
    if (n) children.push(n)
  }
  return { text, children }
}

const treeHasText = (n) => !!n && (!!n.text || (n.children || []).some(treeHasText))

/** 按任务校验/归一化卡片数据；结构不符抛 JsonParseError（回喂重试），字段缺失宽松补默认值 */
function validateCards(task, obj, anchor) {
  const meta = () => ({ id: uid(), kind: '', task, anchorId: anchor?.id ?? null, anchorLabel: anchor?.label || '', createdAt: Date.now() })

  if (task === 'plot') {
    const lines = Array.isArray(obj.lines) ? obj.lines : []
    if (!lines.length) throw new JsonParseError('缺少 lines 数组或为空（schema 要求 lines: 2–4 条线路）')
    const cards = lines
      .map((l) => ({
        ...meta(),
        kind: 'branch',
        title: asStr(l?.title, 40),
        summary: asStr(l?.summary, 300),
        tension: asStr(l?.tension, 300),
        characters: Array.isArray(l?.characters) ? l.characters.map((x) => asStr(x, 40)).filter(Boolean).slice(0, 10) : [],
        opening: asStr(l?.opening, 4000),
        impact: asStr(l?.impact, 600)
      }))
      .filter((c) => c.title || c.summary || c.opening)
    if (!cards.length) throw new JsonParseError('lines 中没有任何有效线路（title/summary/opening 全为空）')
    return cards
  }

  if (task === 'outline') {
    const plans = Array.isArray(obj.plans) ? obj.plans : []
    if (!plans.length) throw new JsonParseError('缺少 plans 数组或为空（schema 要求 plans: 2–3 套方案）')
    const EDGE_OK = new Set(['cause', 'foreshadow', 'conflict', ''])
    const cards = plans
      .map((p) => ({
        ...meta(),
        kind: 'plan',
        name: asStr(p?.name, 40),
        idea: asStr(p?.idea, 300),
        nodes: (Array.isArray(p?.nodes) ? p.nodes : [])
          .map((n) => ({
            title: asStr(n?.title, 60),
            points: asStr(n?.points, 600),
            edge: EDGE_OK.has(n?.edge) ? n.edge : ''
          }))
          .filter((n) => n.title || n.points)
          .slice(0, 12)
      }))
      .filter((p) => p.name || p.nodes.length)
    if (!cards.length) throw new JsonParseError('plans 中没有任何有效方案（name/nodes 全为空）')
    return cards
  }

  if (task === 'lore') {
    const modeRaw = asStr(obj.mode, 10).toLowerCase()
    const revised = asStr(obj.revised, 20000)
    const tree = normalizeTree(obj.tree)
    let mode = modeRaw === 'expand' ? 'expand' : modeRaw === 'add' ? 'add' : null
    if (!mode) mode = revised ? 'expand' : treeHasText(tree) ? 'add' : null
    if (!mode) throw new JsonParseError('缺少有效产出：mode 需为 add/expand，且 tree（新增子树）或 revised（扩写文本）至少一项非空')
    return [
      {
        ...meta(),
        kind: 'diff',
        subject: 'lore',
        mode,
        tree: mode === 'add' ? tree : null,
        revised: mode === 'expand' ? revised : '',
        note: asStr(obj.note, 300)
      }
    ]
  }

  if (task === 'character') {
    const fields = {}
    if (obj.fields && typeof obj.fields === 'object' && !Array.isArray(obj.fields)) {
      for (const [k, v] of Object.entries(obj.fields).slice(0, 20)) {
        const val = asStr(v, 1200)
        const key = asStr(k, 40)
        if (key && val) fields[key] = val
      }
    }
    const bio = asStr(obj.bio, 8000)
    const aliases = Array.isArray(obj.aliases) ? obj.aliases.map((x) => asStr(x, 40)).filter(Boolean).slice(0, 5) : []
    const relations = (Array.isArray(obj.relations) ? obj.relations : [])
      .map((r) => ({ name: asStr(r?.name, 40), label: asStr(r?.label, 40) }))
      .filter((r) => r.name)
      .slice(0, 10)
    if (!Object.keys(fields).length && !bio && !aliases.length && !relations.length) {
      throw new JsonParseError('fields/bio/aliases/relations 四类建议全为空（schema 要求至少给出其中一类）')
    }
    return [{ ...meta(), kind: 'diff', subject: 'character', mode: null, tree: null, fields, bio, aliases, relations, revised: '', note: '' }]
  }

  throw new Error(`未知任务类型：${task}`)
}

/* ---------- 四大能力：装配 → 流式调用 → 严格 JSON 解析 → 卡片 ---------- */

/**
 * 运行结构化任务（plot/outline/lore/character）。
 * @param {object} p
 * @param {'plot'|'outline'|'lore'|'character'} p.task
 * @param {string|null} p.anchorId 锚点（plot=章节 id / outline=大纲节点 id / lore=幕布节点 id / character=人物 id）
 * @param {string} [p.instruction] 用户补充指令
 * @param {number} [p.budget] 上下文 token 预算
 * @param {boolean} [p.privacy] 隐私模式
 * @param {object} p.opts OpenAI 兼容调用参数（含 signal 可中断，摘要生成同享）
 * @param {(usage: object) => void} [p.onUsage] 用量上抛（主调用 + 摘要调用都计入）
 * @param {(phase: 'assembling'|'generating'|'retry', info?: object) => void} [p.onPhase] 阶段回调
 * @param {(delta: string) => void} [p.onDelta] 文本增量回调（流式预览用；重试时从新输出重新累计）
 * @returns {Promise<{ok, task, anchorId, anchor, cards, text, degraded, parseError, context, usage, finishReason}>}
 *   degraded=true 时 cards 为空数组、text 为原始纯文本（降级展示）
 */
export async function runCardTask({
  task,
  anchorId,
  instruction = '',
  budget = DEFAULT_BUDGET,
  privacy = false,
  opts,
  onUsage = null,
  onPhase = null,
  onDelta = null
}) {
  if (!TASK_PROMPTS[task] || task === 'chat') throw new Error(`runCardTask 不支持任务类型：${task}（chat 请走 runChat）`)
  if (!opts || typeof opts !== 'object') throw new Error('缺少 provider 调用参数 opts')

  onPhase?.('assembling')
  const summaryProvider = makeSummaryAdapter(opts, onUsage) // 摘要生成与主调用共享 opts（含 signal）
  const ctx = await assembleContext({ task, anchorId, budget, provider: summaryProvider, privacy })
  onPhase?.('generating', { report: ctx.report, dropped: ctx.dropped, tokens: ctx.tokens, anchor: ctx.anchor })

  const usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  const addUsage = (u) => {
    usage.prompt_tokens += Number(u?.prompt_tokens) || 0
    usage.completion_tokens += Number(u?.completion_tokens) || 0
    usage.total_tokens += Number(u?.total_tokens) || 0
    onUsage?.(u)
  }
  const stream = { onDelta, onUsage: addUsage }

  const messages = [
    { role: 'system', content: systemPromptFor(task) },
    { role: 'user', content: userMessageFor(task, { contextText: ctx.text, question: instruction }) }
  ]

  let res = await callOnce(opts, messages, stream)
  let cards = null
  let parseError = null
  try {
    cards = validateCards(task, extractJsonObject(res.text), ctx.anchor)
  } catch (e) {
    if (!(e instanceof JsonParseError)) throw e
    parseError = e.message
  }

  // 解析失败：把解析错误回喂重试 1 次（方案 §五 统一交互流）
  if (parseError) {
    onPhase?.('retry', { parseError })
    let retryRes = null
    try {
      retryRes = await callOnce(
        opts,
        [
          ...messages,
          { role: 'assistant', content: res.text.slice(0, 8000) },
          {
            role: 'user',
            content: `你的上次输出无法按 schema 解析（错误：${parseError}）。请重新输出：只输出一个符合此前 schema 的完整 JSON 对象，不要 Markdown 代码块围栏、不要任何解释性文字。`
          }
        ],
        stream
      )
    } catch {
      retryRes = null // 重试调用失败（网络/服务商错误）：保留首次原始输出走降级，不吞掉首次成果
    }
    if (retryRes) {
      res = retryRes
      try {
        cards = validateCards(task, extractJsonObject(res.text), ctx.anchor)
        parseError = null
      } catch (e) {
        if (e instanceof JsonParseError) parseError = e.message
        else throw e
      }
    }
  }

  return {
    ok: true,
    task,
    anchorId,
    anchor: ctx.anchor,
    cards: cards || [],
    text: cards ? '' : res.text,
    degraded: !cards,
    parseError: cards ? null : parseError,
    context: { report: ctx.report, dropped: ctx.dropped, tokens: ctx.tokens, privacy },
    usage,
    finishReason: res.finishReason ?? null
  }
}

/* ---------- 自由问答：只读小工具循环 ---------- */

/** 工具循环协议：追加在 chat 系统提示词之后（prompts.js 仍是提示词唯一权威源，这里只补循环机制） */
const CHAT_LOOP_SUPPLEMENT = `

【检索工具协议】本次会话附带只读检索工具。你可以在需要补充数据时先请求工具：输出且仅输出一个 JSON 对象：
{"tool":"工具名","args":{...}}
可用工具（均为只读）：
- search_chapters：{"query":"关键词","limit":1-10} 在全书章节标题与正文中检索，返回片段
- get_character：{"name":"姓名或别名"} 查人物档案、字段、小传与关系
- get_outline_subtree：{"title":"标题关键词"} 查大纲节点子树
- get_lore_subtree：{"title":"标题关键词"} 查设定节点子树
- list_recent_chapters：{"limit":1-20} 按全书顺序列出最近章节（含已缓存摘要）
收到【工具 … 结果】后继续。最终回答时输出且仅输出一个 JSON 对象：
{"answer":"回答正文","writeHint":""}
- writeHint：仅当用户表达了写入意图（如「帮我加上…」「把这段写进去」）时填对应能力名：正文发展|大纲规划|设定扩展|人物丰富，否则留空字符串。
- 其余输出纪律（只输出一个 JSON、不编造实体、简体中文）与上文一致。`

const CHAT_MAX_ROUNDS = 6 // 工具循环轮次上限，防止无限循环烧钱
const CHAT_HISTORY_TURNS = 8 // 带入模型的历史消息条数上限

const clampInt = (v, min, max, dft) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : dft
}

/* ---- 只读工具实现（全部基于 work store 内存态，只读、零写入） ---- */

function toolSearchChapters(args, work) {
  const q = String(args?.query || '').trim()
  if (!q) return { error: '缺少 query 参数' }
  const ql = q.toLowerCase()
  const hits = []
  for (const ch of work.liveChapters) {
    const body = ch.fmt === 'html' ? stripTags(ch.content) : ch.content || ''
    const titleHit = (ch.title || '').toLowerCase().includes(ql)
    const pos = body.toLowerCase().indexOf(ql)
    if (!titleHit && pos < 0) continue
    const snippet = pos >= 0 ? body.slice(Math.max(0, pos - 30), pos + ql.length + 90) : ''
    hits.push({ title: ch.title || '未命名章节', wordCount: ch.wordCount || 0, snippet: snippet ? `……${snippet}……` : '' })
    if (hits.length >= clampInt(args?.limit, 1, 10, 5)) break
  }
  return { query: q, count: hits.length, hits }
}

function toolGetCharacter(args, work) {
  const q = String(args?.name || '').trim().toLowerCase()
  if (!q) return { error: '缺少 name 参数' }
  const exact = work.liveCharacters.filter((c) => (c.name || '').toLowerCase() === q)
  const fuzzy = exact.length ? [] : work.liveCharacters.filter((c) => {
    const names = [c.name, ...(c.aliases || '').split(/[,，、/\s]+/)].filter(Boolean)
    return names.some((n) => n.toLowerCase().includes(q))
  })
  const matches = (exact.length ? exact : fuzzy).slice(0, 3)
  if (!matches.length) return { query: args?.name, count: 0, matches: [] }
  return {
    query: args?.name,
    count: matches.length,
    matches: matches.map((c) => ({
      name: c.name || '未命名',
      role: c.role || '',
      aliases: (c.aliases || '').split(/[,，、/\s]+/).filter(Boolean).join('、'),
      tags: Array.isArray(c.tags) ? c.tags : [],
      fields: c.fields || {},
      bio: asStr(stripTags(String(c.content || '')), 800),
      relations: work.relations
        .filter((r) => r.fromId === c.id || r.toId === c.id)
        .map((r) => ({
          to: work.characters.find((x) => x.id === (r.fromId === c.id ? r.toId : r.fromId))?.name || '（未知人物）',
          label: r.label || ''
        }))
    }))
  }
}

function toolGetOutlineSubtree(args, work) {
  const q = String(args?.title || '').trim().toLowerCase()
  if (!q) return { error: '缺少 title 参数' }
  const node = work.liveOlnodes().find((n) => (n.title || n.text || '').toLowerCase().includes(q))
  if (!node) return { query: args?.title, found: false }
  const lines = []
  const walk = (n, depth) => {
    if (lines.length >= 80) return
    lines.push('  '.repeat(depth) + '- ' + (n.title || n.text || '（未命名）'))
    const body = (n.text || '').replace(/\s+/g, ' ').trim().slice(0, 200)
    if (body && body !== (n.title || '').trim()) lines.push('  '.repeat(depth + 1) + body)
    for (const c of work.olnodeChildren(n.id)) walk(c, depth + 1)
  }
  walk(node, 0)
  return { query: args?.title, found: true, subtree: lines.join('\n') }
}

function toolGetLoreSubtree(args, work) {
  const q = String(args?.title || '').trim().toLowerCase()
  if (!q) return { error: '缺少 title 参数' }
  const node = work.liveMubu().find((n) => (n.text || '').toLowerCase().includes(q))
  if (!node) return { query: args?.title, found: false }
  const lines = []
  const walk = (n, depth) => {
    if (lines.length >= 80) return
    lines.push('  '.repeat(depth) + '- ' + ((n.text || '').replace(/\s+/g, ' ').trim().slice(0, 300) || '（空）'))
    for (const c of work.mubuChildren(n.id)) walk(c, depth + 1)
  }
  walk(node, 0)
  return { query: args?.title, found: true, subtree: lines.join('\n') }
}

async function toolListRecentChapters(args, work) {
  // 全局顺序复用 repo.collectExportChapters（与 context.js 同口径）；摘要只读 aisum 缓存（provider=null 不触网）
  const ordered = collectExportChapters(work.volumes, work.chapters)
    .map((x) => x.ch)
    .slice(-clampInt(args?.limit, 1, 20, 10))
  const chapters = []
  for (const ch of ordered) {
    let summary = ''
    try {
      summary = (await getChapterSummary(ch, null)) || ''
    } catch {
      summary = ''
    }
    chapters.push({ title: ch.title || '未命名章节', wordCount: ch.wordCount || 0, ...(summary ? { summary } : {}) })
  }
  return { count: chapters.length, chapters }
}

async function execChatTool(name, args, work) {
  switch (name) {
    case 'search_chapters':
      return toolSearchChapters(args, work)
    case 'get_character':
      return toolGetCharacter(args, work)
    case 'get_outline_subtree':
      return toolGetOutlineSubtree(args, work)
    case 'get_lore_subtree':
      return toolGetLoreSubtree(args, work)
    case 'list_recent_chapters':
      return await toolListRecentChapters(args, work)
    default:
      return { error: `未知工具：${name}` }
  }
}

/**
 * 自由问答（方案 §五.5）：小工具循环。
 * @param {object} p
 * @param {string} p.question 用户问题
 * @param {Array<{role:'user'|'assistant', content:string}>} [p.history] 既有对话（取最近若干条带入）
 * @param {object} p.opts OpenAI 兼容调用参数（含 signal 可中断）
 * @returns {Promise<{ok, answer, writeHint, writeTask, degraded, rounds, context, usage, finishReason}>}
 *   模型表达写入意图时 writeHint 为中文能力名、writeTask 为对应任务键；JSON 解析失败降级纯文本（degraded）。
 */
export async function runChat({
  question,
  history = [],
  budget = DEFAULT_BUDGET,
  privacy = false,
  opts,
  onUsage = null,
  onPhase = null,
  onDelta = null
}) {
  if (!opts || typeof opts !== 'object') throw new Error('缺少 provider 调用参数 opts')
  const work = useWorkStore()
  if (!work.work) throw new Error('请先打开作品再使用 AI 助手')
  const q = String(question || '').trim()
  if (!q) throw new Error('问题内容为空')

  onPhase?.('assembling')
  const summaryProvider = makeSummaryAdapter(opts, onUsage)
  const ctx = await assembleContext({ task: 'chat', anchorId: null, budget, provider: summaryProvider, privacy })
  onPhase?.('generating', { report: ctx.report, dropped: ctx.dropped, tokens: ctx.tokens, anchor: ctx.anchor })

  const usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  const addUsage = (u) => {
    usage.prompt_tokens += Number(u?.prompt_tokens) || 0
    usage.completion_tokens += Number(u?.completion_tokens) || 0
    usage.total_tokens += Number(u?.total_tokens) || 0
    onUsage?.(u)
  }
  const stream = { onDelta, onUsage: addUsage }

  const messages = [
    { role: 'system', content: systemPromptFor('chat') + CHAT_LOOP_SUPPLEMENT },
    ...history
      .filter((h) => (h.role === 'user' || h.role === 'assistant') && h.content)
      .slice(-CHAT_HISTORY_TURNS)
      .map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessageFor('chat', { contextText: ctx.text, question: q }) }
  ]

  let res = null
  for (let round = 0; round < CHAT_MAX_ROUNDS; round++) {
    res = await callOnce(opts, messages, stream)
    let obj = null
    try {
      obj = extractJsonObject(res.text)
    } catch {
      obj = null
    }

    // 工具请求 → 执行（只读）→ 结果回喂，进入下一轮
    if (obj && obj.tool && CHAT_TOOLS.includes(String(obj.tool))) {
      const args = obj.args && typeof obj.args === 'object' && !Array.isArray(obj.args) ? obj.args : {}
      let resultStr
      try {
        resultStr = JSON.stringify(await execChatTool(String(obj.tool), args, work))
      } catch (e) {
        resultStr = JSON.stringify({ error: `工具执行失败：${String(e?.message || e)}` })
      }
      messages.push({ role: 'assistant', content: res.text.slice(0, 4000) })
      messages.push({
        role: 'user',
        content: `【工具 ${String(obj.tool)} 结果】\n${resultStr.slice(0, 12000)}\n\n请继续：还需要更多数据则再输出工具请求 JSON，否则输出最终回答 JSON（{"answer":…}）。`
      })
      continue
    }

    // 最终回答
    if (obj && typeof obj.answer === 'string' && obj.answer.trim()) {
      const writeHint = asStr(obj.writeHint, 20)
      return {
        ok: true,
        answer: asStr(obj.answer, 20000),
        writeHint,
        writeTask: WRITE_HINT_TASKS[writeHint] || null,
        degraded: false,
        rounds: round + 1,
        context: { report: ctx.report, dropped: ctx.dropped, tokens: ctx.tokens, privacy },
        usage,
        finishReason: res.finishReason ?? null
      }
    }

    // JSON 解析失败 → 降级纯文本（chat schemaHint 约定：不重试）
    return {
      ok: true,
      answer: String(res.text || '').trim(),
      writeHint: '',
      writeTask: null,
      degraded: true,
      rounds: round + 1,
      context: { report: ctx.report, dropped: ctx.dropped, tokens: ctx.tokens, privacy },
      usage,
      finishReason: res.finishReason ?? null
    }
  }

  // 轮次耗尽仍未形成最终回答
  return {
    ok: true,
    answer: '（检索轮次已达上限，未能形成最终回答。请缩小问题范围后重试。）',
    writeHint: '',
    writeTask: null,
    degraded: true,
    rounds: CHAT_MAX_ROUNDS,
    context: { report: ctx.report, dropped: ctx.dropped, tokens: ctx.tokens, privacy },
    usage,
    finishReason: res?.finishReason ?? null
  }
}
