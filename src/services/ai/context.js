import { useWorkStore } from '../../stores/work'
import { collectExportChapters } from '../../db/repo'
import { stripTags } from '../wordcount'
import { getChapterSummary } from './summarize'

/**
 * 分层上下文装配器（方案 §四 / §七）：
 * 按任务类型与锚点装配三层上下文，按 token 预算自上而下填充，超限先砍 L2：
 * - L0 常驻骨架：作品元信息 + 人物卡（每人 1–2 行）+ 设定幕布树前两层标题 + 大纲（olnodes）标题树
 * - L1 任务锚点：plot=当前章正文（剥标签纯文本）+ 前 3 章摘要 + 后 1 章摘要；
 *   outline=选中节点子树（含要点）+ 祖先链 + 兄弟节点；lore=选中节点子树 + 同层节点标题；
 *   character=人物全字段 + 关系 + 出场章节清单；chat=无锚点
 * - L2 检索召回：按 name/aliases 在正文 includes 反查出场章节取片段（RightPanel 出场人物同款匹配）
 * 返回装配文本 + 「发送范围报告」（本次发送了哪些数据）+ 被裁剪项清单，供发送按钮上方展示。
 *
 * 数据来源说明：方案中 L0 标注 loadWorkBundle，实际经 Pinia work store（open() 时即 loadWorkBundle
 * 的装载结果）读取，与各模块视图同一数据面；章节全局排序复用 repo.collectExportChapters。
 */

export const TASK_TYPES = ['plot', 'outline', 'lore', 'character', 'chat']
export const DEFAULT_BUDGET = 8000 // 方案 §三：上下文预算默认约 8k tokens

/* ---------- 裁剪参数 ---------- */
const CURRENT_CHAPTER_MAX_CHARS = 6000 // 当前章正文超长时截取首尾
const SNIPPET_CONTEXT = 60 // 片段匹配点前文字符数
const SNIPPET_LEN = 160 // 片段总长上限（字符）
const MAX_L2_CHAPTERS_PER_CHAR = 3 // 每个人物最多反查章节数
const MAX_L2_CHARS = 12 // L2 最多反查人物数
const SUMMARY_EXCERPT_CHARS = 160 // 摘要未生成时的前情节选长度
const TREE_LINE_CAP = 120 // 骨架树最大行数
const CARD_CHARS_CAP = 220 // 人物卡单行上限

/* ---------- 基础工具 ---------- */

/** token 估算：CJK 字符 ≈1 token，其余（ASCII/空白）≈0.25 token——宁高勿低，超预算安全 */
export function estimateTokens(text = '') {
  let t = 0
  for (const ch of text) t += ch.codePointAt(0) > 0x2e7f ? 1 : 0.25
  return Math.ceil(t)
}

/** 中段截取：保首尾，插「中略」标记 */
function truncateMiddle(text, maxChars) {
  if (text.length <= maxChars) return text
  const head = Math.max(0, Math.floor(maxChars * 0.6))
  const tail = Math.max(0, maxChars - head)
  return text.slice(0, head) + '\n……（中略）……\n' + (tail ? text.slice(-tail) : '')
}

/** 压缩文本到 token 上限内 */
function fitToTokens(text, maxTokens) {
  const est = estimateTokens(text)
  if (est <= maxTokens) return text
  const density = est / Math.max(1, text.length)
  return truncateMiddle(text, Math.max(40, Math.floor(maxTokens / density)))
}

const oneLine = (s, cap = 40) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, cap)

function useWork() {
  const work = useWorkStore()
  if (!work.work) throw new Error('请先打开作品再使用 AI 助手')
  return work
}

/** 人物姓名集（含别名）：与 RightPanel.vue 出场人物匹配同口径 */
const charNames = (c) => [c.name, ...(c.aliases || '').split(/[,，、/\s]+/)].filter((n) => n && n.length >= 1)

/** 章节纯文本缓存（同内容不重复剥标签） */
const plainCache = new Map()
function chapterPlainText(ch) {
  const hit = plainCache.get(ch.id)
  if (hit && hit.src === ch.content) return hit.text
  const text = (ch.fmt === 'html' ? stripTags(ch.content) : ch.content || '').trim()
  plainCache.set(ch.id, { src: ch.content, text })
  return text
}

/** 章节全局顺序（跨卷排序，与全书导出同口径） */
const orderedChapters = (work) => collectExportChapters(work.volumes, work.chapters).map((x) => x.ch)

/* ---------- L0 常驻骨架 ---------- */

function blockWorkMeta(work) {
  const w = work.work
  const lines = [`《${w.title}》｜类型：${w.genre || '未设'}｜状态：${w.status || '未设'}`]
  if (w.intro) lines.push(`简介：${oneLine(w.intro, 200)}`)
  return { layer: 'L0', label: '作品元信息（标题/类型/状态/简介）', text: `【作品】\n${lines.join('\n')}` }
}

function blockCharCards(work) {
  const chars = work.liveCharacters
  if (!chars.length) return null
  const lines = chars.map((c) => {
    let s = `- ${c.name || '未命名'}｜${c.role || '角色未设'}`
    const alias = (c.aliases || '').split(/[,，、/\s]+/).filter(Boolean).join('/')
    if (alias) s += `｜别名：${alias}`
    if (Array.isArray(c.tags) && c.tags.length) s += `｜标签：${c.tags.join('、')}`
    for (const [k, v] of Object.entries(c.fields || {}).slice(0, 3)) {
      const val = oneLine(v, 24)
      if (val) s += `｜${k}：${val}`
    }
    return s.slice(0, CARD_CHARS_CAP)
  })
  return { layer: 'L0', label: `人物卡 ×${chars.length}`, text: `【人物】\n${lines.join('\n')}` }
}

/** 设定幕布树前两层标题 */
function blockMubuSkeleton(work) {
  const roots = work.mubuChildren(null)
  if (!roots.length) return null
  const lines = []
  let truncated = false
  for (const r of roots) {
    if (lines.length >= TREE_LINE_CAP) { truncated = true; break }
    lines.push('- ' + (oneLine(r.text) || '（空）'))
    for (const c of work.mubuChildren(r.id)) {
      if (lines.length >= TREE_LINE_CAP) { truncated = true; break }
      lines.push('  - ' + (oneLine(c.text) || '（空）'))
    }
    if (truncated) break
  }
  return {
    layer: 'L0',
    label: `设定树前两层（${roots.length} 个根节点${truncated ? '，已截断' : ''}）`,
    text: `【设定树】\n${lines.join('\n')}${truncated ? '\n……（已截断）' : ''}`
  }
}

/** 大纲（olnodes）标题树 */
function blockOutlineSkeleton(work) {
  const roots = work.olnodeChildren(null)
  if (!roots.length) return null
  const lines = []
  let truncated = false
  const walk = (list, depth) => {
    for (const n of list) {
      if (lines.length >= TREE_LINE_CAP || depth > 8) { truncated = true; return }
      lines.push('  '.repeat(depth) + '- ' + (oneLine(n.title || n.text) || '（未命名）'))
      walk(work.olnodeChildren(n.id), depth + 1)
    }
  }
  walk(roots, 0)
  return {
    layer: 'L0',
    label: `大纲标题树（${lines.length} 行${truncated ? '，已截断' : ''}）`,
    text: `【大纲树】\n${lines.join('\n')}${truncated ? '\n……（已截断）' : ''}`
  }
}

/* ---------- L1 任务锚点 ---------- */

/** plot：当前章正文 + 前 3 章摘要 + 后 1 章摘要 */
async function buildL1Plot(work, anchorId, provider, privacy, dropped) {
  const chs = orderedChapters(work)
  const idx = chs.findIndex((c) => c.id === anchorId)
  if (idx < 0) throw new Error('正文任务需要有效的章节锚点（anchorId=章节 id）')
  const cur = chs[idx]
  const blocks = []
  const fullText = chapterPlainText(cur)
  if (privacy) {
    blocks.push({ layer: 'L1', label: `当前章《${cur.title}》（隐私模式：不发送原文，仅前情摘要）`, text: `【当前章节】《${cur.title}》（隐私模式下正文不发送）` })
  } else {
    let text = fullText
    if (text.length > CURRENT_CHAPTER_MAX_CHARS) {
      dropped.push({ layer: 'L1', label: `当前章《${cur.title}》全文（${fullText.length} 字）超长`, reason: `仅发送首尾约 ${CURRENT_CHAPTER_MAX_CHARS} 字` })
      text = truncateMiddle(text, CURRENT_CHAPTER_MAX_CHARS)
    }
    blocks.push({ layer: 'L1', label: `当前章《${cur.title}》正文（约 ${text.length} 字）`, text: `【当前章节】《${cur.title}》\n${text}` })
  }
  const summaryLines = []
  for (const c of chs.slice(Math.max(0, idx - 3), idx).reverse()) {
    summaryLines.push(`- 《${c.title}》：${await summaryLineOf(c, provider, privacy)}`)
  }
  const next = chs[idx + 1]
  if (next) summaryLines.push(`- （后一章）《${next.title}》：${await summaryLineOf(next, provider, privacy)}`)
  if (summaryLines.length) {
    blocks.push({ layer: 'L1', label: `前后章摘要 ×${summaryLines.length}`, text: `【前情/后续摘要】\n${summaryLines.join('\n')}` })
  }
  return { blocks, anchor: { id: cur.id, label: cur.title, chapter: cur, chapterIndex: idx, chapterTotal: chs.length } }
}

async function summaryLineOf(chapter, provider, privacy) {
  const s = await getChapterSummary(chapter, provider)
  if (s) return s
  if (!privacy) {
    const t = chapterPlainText(chapter)
    if (t) return `（摘要未生成，节选开头）${oneLine(t, SUMMARY_EXCERPT_CHARS)}…`
  }
  return '（摘要未生成）'
}

/** outline：选中节点子树（含要点）+ 祖先链 + 兄弟节点 */
function buildL1Outline(work, anchorId) {
  const node = work.olnodes.find((n) => n.id === anchorId && !n.deletedAt)
  if (!node) throw new Error('大纲任务需要有效的大纲节点锚点（anchorId=大纲节点 id）')
  const blocks = []
  const chain = []
  let pid = node.parentId || null
  let guard = 0 // 树操作本身有环防护（olnodeMoveTo），此处再兜底防脏数据成环
  while (pid && guard++ < 64) {
    const pn = work.olnodes.find((n) => n.id === pid && !n.deletedAt)
    if (!pn) break
    chain.unshift(oneLine(pn.title || pn.text) || '（未命名）')
    pid = pn.parentId || null
  }
  if (chain.length) {
    blocks.push({ layer: 'L1', label: `大纲祖先链 ×${chain.length}`, text: `【大纲位置】${chain.join(' > ')} > ${oneLine(node.title || node.text) || '（未命名）'}` })
  }
  const sibs = work.olnodeChildren(node.parentId).filter((s) => s.id !== node.id)
  if (sibs.length) {
    blocks.push({ layer: 'L1', label: `同级节点标题 ×${sibs.length}`, text: `【同级节点】\n${sibs.map((s) => '- ' + (oneLine(s.title || s.text) || '（未命名）')).join('\n')}` })
  }
  const lines = []
  const walk = (n, depth) => {
    lines.push('  '.repeat(depth) + '- ' + (oneLine(n.title || n.text) || '（未命名）'))
    const body = oneLine(n.text, 200)
    if (body && body !== oneLine(n.title || n.text)) lines.push('  '.repeat(depth + 1) + body)
    for (const c of work.olnodeChildren(n.id)) walk(c, depth + 1)
  }
  walk(node, 0)
  blocks.push({ layer: 'L1', label: `选中节点子树「${oneLine(node.title || node.text) || '未命名'}」（${lines.length} 行）`, text: `【选中大纲节点子树】\n${lines.join('\n')}` })
  return { blocks, anchor: { id: node.id, label: oneLine(node.title || node.text) || '未命名' } }
}

/** lore：选中幕布节点子树 + 同层节点标题（设定已统一为幕布节点树，无分类维度） */
function buildL1Lore(work, anchorId) {
  const node = work.mubu.find((n) => n.id === anchorId && !n.deletedAt)
  if (!node) throw new Error('设定任务需要有效的设定节点锚点（anchorId=幕布节点 id）')
  const blocks = []
  let count = 0
  const lines = []
  const walk = (n, depth) => {
    count++
    lines.push('  '.repeat(depth) + '- ' + (oneLine(n.text, 300) || '（空）'))
    for (const c of work.mubuChildren(n.id)) walk(c, depth + 1)
  }
  walk(node, 0)
  blocks.push({ layer: 'L1', label: `选中设定节点子树（${count} 节点）`, text: `【选中设定节点子树】\n${lines.join('\n')}` })
  const sibs = work.mubuChildren(node.parentId).filter((s) => s.id !== node.id)
  if (sibs.length) {
    blocks.push({ layer: 'L1', label: `同层节点标题 ×${sibs.length}`, text: `【同层节点】\n${sibs.map((s) => '- ' + (oneLine(s.text) || '（空）')).join('\n')}` })
  }
  return { blocks, anchor: { id: node.id, label: oneLine(node.text) || '未命名' } }
}

/** character：人物全字段 + 关系 + 出场章节清单 */
function buildL1Character(work, anchorId) {
  const c = work.characters.find((x) => x.id === anchorId && !x.deletedAt)
  if (!c) throw new Error('人物任务需要有效的人物锚点（anchorId=人物 id）')
  const blocks = []
  const lines = [`【人物档案】${c.name || '未命名'}`, `角色：${c.role || '未设'}`]
  const alias = (c.aliases || '').split(/[,，、/\s]+/).filter(Boolean).join('、')
  if (alias) lines.push(`别名：${alias}`)
  if (Array.isArray(c.tags) && c.tags.length) lines.push(`标签：${c.tags.join('、')}`)
  const fields = Object.entries(c.fields || {})
  if (fields.length) lines.push('字段：\n' + fields.map(([k, v]) => `- ${k}：${oneLine(v, 300)}`).join('\n'))
  if (c.content) lines.push(`小传：\n${oneLine(stripTags(String(c.content)), 1200)}`)
  blocks.push({ layer: 'L1', label: `人物「${c.name || '未命名'}」全字段`, text: lines.join('\n') })
  const nameOf = (id) => work.characters.find((x) => x.id === id)?.name || '（未知人物）'
  const rels = work.relations.filter((r) => r.fromId === c.id || r.toId === c.id)
  if (rels.length) {
    blocks.push({
      layer: 'L1',
      label: `人物关系 ×${rels.length}`,
      text: `【人物关系】\n${rels.map((r) => `- 与「${nameOf(r.fromId === c.id ? r.toId : r.fromId)}」：${r.label || '（未命名关系）'}`).join('\n')}`
    })
  }
  const names = charNames(c)
  const present = orderedChapters(work).filter((ch) => {
    const t = chapterPlainText(ch)
    return names.some((n) => t.includes(n))
  })
  if (present.length) {
    blocks.push({ layer: 'L1', label: `出场章节清单 ×${present.length}`, text: `【出场章节】\n${present.map((ch) => `- 《${ch.title}》`).join('\n')}` })
  }
  return { blocks, anchor: { id: c.id, label: c.name || '未命名' } }
}

/* ---------- L2 检索召回：人物反查出场片段 ---------- */

function buildL2(work, { task, anchor, privacy }) {
  const blocks = []
  if (privacy) return blocks // 隐私模式不发送原文片段（裁剪项由主流程记录）
  let chars = work.liveCharacters
  if (!chars.length) return blocks
  if (task === 'character' && anchor?.id) {
    chars = chars.filter((c) => c.id === anchor.id)
  } else if (task === 'plot' && anchor?.chapter) {
    const t = chapterPlainText(anchor.chapter)
    const inChapter = chars.filter((c) => charNames(c).some((n) => t.includes(n)))
    if (inChapter.length) chars = inChapter
  }
  chars = chars.slice(0, MAX_L2_CHARS)
  const exclude = new Set(task === 'plot' && anchor?.chapter ? [anchor.chapter.id] : [])
  const order = orderedChapters(work)
  for (const c of chars) {
    const names = charNames(c)
    const hits = []
    for (const ch of order) {
      if (exclude.has(ch.id)) continue
      const t = chapterPlainText(ch)
      const name = names.find((n) => t.includes(n))
      if (!name) continue
      const pos = t.indexOf(name)
      const start = Math.max(0, pos - SNIPPET_CONTEXT)
      hits.push({ title: ch.title, snippet: oneLine(t.slice(start, pos + name.length + SNIPPET_LEN), SNIPPET_LEN + SNIPPET_CONTEXT) })
      if (hits.length >= MAX_L2_CHAPTERS_PER_CHAR) break
    }
    if (hits.length) {
      blocks.push({
        layer: 'L2',
        label: `人物「${c.name || '未命名'}」出场片段 ×${hits.length} 章`,
        text: `【检索片段 · ${c.name || '未命名'}】\n` + hits.map((h) => `- 《${h.title}》：……${h.snippet}……`).join('\n')
      })
    }
  }
  return blocks
}

/* ---------- 装配主流程 ---------- */

/**
 * 装配三层上下文。
 * @param {object} opts
 * @param {'plot'|'outline'|'lore'|'character'|'chat'} opts.task 任务类型
 * @param {string|null} opts.anchorId 锚点 id（plot=章节 id / outline=大纲节点 id / lore=幕布节点 id / character=人物 id / chat=可空）
 * @param {number} [opts.budget] token 预算（默认 8000，超限先砍 L2，再逐块压缩 L1/L0）
 * @param {object|Function|null} [opts.provider] 摘要生成用 provider（见 summarize.js 约定；缺省只读缓存）
 * @param {boolean} [opts.privacy] 隐私模式：不发送正文原文与检索片段，摘要缺失不再降级为节选
 * @returns {{ task, anchorId, text, report, dropped, tokens, anchor }}
 */
export async function assembleContext({
  task = 'chat',
  anchorId = null,
  budget = DEFAULT_BUDGET,
  provider = null,
  privacy = false
} = {}) {
  if (!TASK_TYPES.includes(task)) throw new Error(`未知任务类型：${task}`)
  if (!(budget > 0)) budget = DEFAULT_BUDGET
  const work = useWork()
  const dropped = []

  // L0 常驻骨架
  const l0 = [blockWorkMeta(work), blockCharCards(work), blockMubuSkeleton(work), blockOutlineSkeleton(work)].filter(Boolean)

  // L1 任务锚点
  let l1 = []
  let anchor = { id: anchorId, label: '' }
  if (task === 'plot') {
    const r = await buildL1Plot(work, anchorId, provider, privacy, dropped)
    l1 = r.blocks
    anchor = r.anchor
  } else if (task === 'outline') {
    const r = buildL1Outline(work, anchorId)
    l1 = r.blocks
    anchor = r.anchor
  } else if (task === 'lore') {
    const r = buildL1Lore(work, anchorId)
    l1 = r.blocks
    anchor = r.anchor
  } else if (task === 'character') {
    const r = buildL1Character(work, anchorId)
    l1 = r.blocks
    anchor = r.anchor
  }

  // L2 检索召回（隐私模式整体不发送）
  const l2 = buildL2(work, { task, anchor, privacy })
  if (privacy && work.liveCharacters.length) {
    dropped.push({ layer: 'L2', label: `人物出场检索片段（候选人物 ×${work.liveCharacters.length}）`, reason: '隐私模式：不发送正文片段' })
  }

  // 预算装配：L0 → L1 优先全保（超限逐块压缩），L2 塞剩余、装不下整组放弃
  const report = []
  const parts = []
  const used = { L0: 0, L1: 0, L2: 0 }
  let remaining = budget

  const put = (block, minTokens) => {
    const est = estimateTokens(block.text)
    let text = block.text
    if (est > remaining) {
      if (remaining < minTokens) {
        dropped.push({ layer: block.layer, label: block.label, reason: '超出 token 预算，整块放弃' })
        return false
      }
      text = fitToTokens(text, remaining)
      dropped.push({ layer: block.layer, label: block.label, reason: `超出 token 预算，已压缩（原约 ${est} tokens）` })
    }
    parts.push(text)
    used[block.layer] += estimateTokens(text)
    remaining -= estimateTokens(text)
    report.push(block.label)
    return true
  }

  for (const b of l0) put(b, 60)
  for (const b of l1) put(b, 120)
  let l2Dropped = false
  for (const b of l2) {
    if (l2Dropped || estimateTokens(b.text) > remaining) {
      l2Dropped = true
      dropped.push({ layer: 'L2', label: b.label, reason: '超出 token 预算，L2 检索召回整组放弃' })
      continue
    }
    put(b, 0)
  }

  return {
    task,
    anchorId,
    privacy,
    anchor,
    text: parts.join('\n\n'),
    report, // 发送范围报告：本次发送了哪些数据（显示在发送按钮上方）
    dropped, // 被裁剪/压缩项（隐私模式与预算裁剪透明化）
    tokens: { budget, used: budget - Math.max(0, remaining), l0: used.L0, l1: used.L1, l2: used.L2 }
  }
}
