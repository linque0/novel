/* 多模块内容互联（双链）：目标检索 / 预览内容 / 跳转 / 令牌解析（共享服务，无副作用）
 * 标签形态：
 *  - 富文本（正文 TipTap、设定幕布）：<span class="dl-link" data-dl-target="kind:id" data-dl-title="标题">选中文字</span>
 *  - 纯文本（大纲 / 人物小传 / 灵感）：[[标题]] 或 [[标题|显示文字]] 令牌
 * 目标模型：kind = chapter 章节 | mubu 设定节点 | character 人物 | outline 大纲 | snippet 灵感
 */
import { Mark } from '@tiptap/core'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import { stripTags } from './wordcount'

export const KIND_LABEL = { chapter: '正文', mubu: '设定', character: '人物', outline: '大纲', snippet: '灵感' }

/* ---------- TipTap 双链标记：正文中的双链以标签样式渲染并携带目标 ---------- */
export const DlLinkMark = Mark.create({
  name: 'dlLink',
  addAttributes() {
    return {
      target: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-dl-target'),
        renderHTML: (a) => (a.target ? { 'data-dl-target': a.target } : {})
      },
      title: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-dl-title') || '',
        renderHTML: (a) => ({ 'data-dl-title': a.title || '' })
      }
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-dl-target]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', { class: 'dl-link', ...HTMLAttributes }, 0]
  }
})

/* ---------- 大纲条目标签（总纲 / 卷纲 · X / 章纲 · X） ---------- */
export function outlineLabel(refId) {
  const work = useWorkStore()
  if (!work.work) return ''
  if (refId === work.work.id) return '总纲'
  const v = work.volumes.find((x) => x.id === refId)
  if (v) return '卷纲 · ' + v.title
  const c = work.chapters.find((x) => x.id === refId)
  return c ? '章纲 · ' + c.title : '大纲'
}

/* ---------- 全库可链接目标检索 ---------- */
export function searchTargets(query, limit = 40) {
  const work = useWorkStore()
  const q = (query || '').trim().toLowerCase()
  const hit = (t) => !q || String(t || '').toLowerCase().includes(q)
  const out = []
  for (const c of work.liveChapters) {
    if (hit(c.title)) out.push({ kind: 'chapter', id: c.id, title: c.title || '未命名章节', extra: `正文 · ${c.wordCount || 0}字` })
  }
  for (const n of work.liveMubu()) {
    if (hit(n.text)) out.push({ kind: 'mubu', id: n.id, title: (n.text || '').slice(0, 40) || '（空节点）', extra: '设定' })
  }
  for (const c of work.liveCharacters) {
    if (hit(c.name)) out.push({ kind: 'character', id: c.id, title: c.name || '未命名', extra: `人物${c.role ? ' · ' + c.role : ''}` })
  }
  if (work.work) {
    if (hit('总纲')) out.push({ kind: 'outline', id: work.work.id, title: '总纲', extra: '大纲' })
  }
  for (const v of work.liveVolumes) {
    const lb = '卷纲 · ' + v.title
    if (hit(lb) || hit(v.title)) out.push({ kind: 'outline', id: v.id, title: lb, extra: '大纲' })
  }
  for (const c of work.liveChapters) {
    const lb = '章纲 · ' + c.title
    if (hit(lb) || hit(c.title)) out.push({ kind: 'outline', id: c.id, title: lb, extra: '大纲' })
  }
  for (const s of work.liveSnippets) {
    const first = (s.content || '').split('\n').find((x) => x.trim()) || '（空）'
    if (hit(first)) out.push({ kind: 'snippet', id: s.id, title: first.slice(0, 30), extra: '灵感' })
  }
  return out.slice(0, limit)
}

/** 按 kind:id 精确取目标（已删除则返回 null） */
export function targetById(kind, id) {
  if (!kind || !id) return null
  const work = useWorkStore()
  if (kind === 'chapter') {
    const c = work.liveChapters.find((x) => x.id === id)
    return c ? { kind, id, title: c.title || '未命名章节', extra: `正文 · ${c.wordCount || 0}字` } : null
  }
  if (kind === 'mubu') {
    const n = work.mubu.find((x) => x.id === id && !x.deletedAt)
    return n ? { kind, id, title: (n.text || '').slice(0, 40) || '（空节点）', extra: '设定' } : null
  }
  if (kind === 'character') {
    const c = work.liveCharacters.find((x) => x.id === id)
    return c ? { kind, id, title: c.name || '未命名', extra: `人物${c.role ? ' · ' + c.role : ''}` } : null
  }
  if (kind === 'outline') {
    const lb = outlineLabel(id)
    return lb ? { kind, id, title: lb, extra: '大纲' } : null
  }
  if (kind === 'snippet') {
    const s = work.liveSnippets.find((x) => x.id === id)
    const first = s ? (s.content || '').split('\n').find((x) => x.trim()) || '（空）' : ''
    return s ? { kind, id, title: first.slice(0, 30), extra: '灵感' } : null
  }
  return null
}

/** 解析 "kind:id" 字符串 */
export function parseTarget(str) {
  const m = String(str || '').match(/^(\w+):(.+)$/)
  return m ? { kind: m[1], id: m[2] } : null
}

/** 按标题在全库解析目标（纯文本令牌用）：先精确后包含 */
export function findByTitle(title) {
  const t = String(title || '').trim().toLowerCase()
  if (!t) return null
  const all = searchTargets('', 400)
  return all.find((x) => x.title.toLowerCase() === t) || all.find((x) => x.title.toLowerCase().includes(t)) || null
}

/* ---------- 目标预览内容（悬浮窗用） ---------- */
export function previewFor(target) {
  if (!target) return null
  const work = useWorkStore()
  const cut = (s, n = 900) => {
    const t = String(s || '').trim()
    return t.length > n ? t.slice(0, n) + '…' : t
  }
  if (target.kind === 'chapter') {
    const c = work.chapters.find((x) => x.id === target.id && !x.deletedAt)
    if (!c) return null
    const vol = work.volumes.find((v) => v.id === c.volumeId)
    return {
      kindLabel: '正文',
      title: c.title || '未命名章节',
      meta: [vol?.title, `${c.wordCount || 0}字`].filter(Boolean).join(' · '),
      body: cut(c.fmt === 'html' ? stripTags(c.content) : c.content) || '（暂无内容）'
    }
  }
  if (target.kind === 'mubu') {
    const n = work.mubu.find((x) => x.id === target.id && !x.deletedAt)
    if (!n) return null
    const path = []
    let p = n.parentId ? work.mubu.find((x) => x.id === n.parentId && !x.deletedAt) : null
    let guard = 0
    while (p && guard++ < 12) {
      path.unshift((p.text || '').slice(0, 16) || '（空）')
      p = p.parentId ? work.mubu.find((x) => x.id === p.parentId && !x.deletedAt) : null
    }
    const lines = [(n.text || '').trim() || '（空节点）']
    const walk = (pid, depth) => {
      for (const ch of work.mubuChildren(pid)) {
        if (lines.length > 14) {
          lines.push('……')
          return
        }
        lines.push('　'.repeat(depth) + '· ' + ((ch.text || '').trim() || '（空）'))
        walk(ch.id, depth + 1)
      }
    }
    walk(n.id, 1)
    return { kindLabel: '设定', title: (n.text || '').slice(0, 40) || '（空节点）', meta: path.join(' / '), body: cut(lines.join('\n')) }
  }
  if (target.kind === 'character') {
    const c = work.characters.find((x) => x.id === target.id && !x.deletedAt)
    if (!c) return null
    return {
      kindLabel: '人物',
      title: c.name || '未命名',
      meta: [c.role, c.aliases ? '别名 ' + c.aliases : ''].filter(Boolean).join(' · '),
      body: cut(c.content) || '（暂无小传）'
    }
  }
  if (target.kind === 'outline') {
    const o = work.outlines.find((x) => x.refId === target.id && !x.deletedAt)
    return { kindLabel: '大纲', title: outlineLabel(target.id) || '大纲', meta: '大纲', body: cut(o?.content) || '（暂无内容）' }
  }
  if (target.kind === 'snippet') {
    const s = work.snippets.find((x) => x.id === target.id && !x.deletedAt)
    if (!s) return null
    const first = (s.content || '').split('\n').find((x) => x.trim()) || '（空）'
    return { kindLabel: '灵感', title: first.slice(0, 30), meta: '灵感记录', body: cut(s.content) || '（空）' }
  }
  return null
}

/* ---------- 跳转 ---------- */
export function jumpTo(target) {
  if (!target) return false
  const work = useWorkStore()
  const ui = useUiStore()
  if (target.kind === 'chapter') {
    work.tab = 'chapters'
    work.selChapterId = target.id
    const c = work.chapters.find((x) => x.id === target.id)
    if (c) work.selVolumeId = c.volumeId
  } else if (target.kind === 'mubu') {
    work.tab = 'lore'
    ui.loreFocusId = target.id
  } else if (target.kind === 'character') {
    work.tab = 'characters'
    work.selCharacterId = target.id
  } else if (target.kind === 'outline') {
    work.tab = 'outline'
    work.selOutlineId = target.id
  } else if (target.kind === 'snippet') {
    work.tab = 'snippets'
    work.selSnippetId = target.id
  } else {
    return false
  }
  ui.searchOpen = false
  return true
}

/* ---------- 反向链接：扫描全库引用了指定标题的内容 ---------- */
export function findBacklinks(title) {
  const t = String(title || '').trim()
  if (!t) return []
  const work = useWorkStore()
  const has = (s) => !!s && (s.includes(`data-dl-title="${t}"`) || s.includes(`[[${t}]]`) || s.includes(`[[${t}|`))
  const out = []
  for (const c of work.liveChapters) {
    if (has(c.content)) out.push({ kind: 'chapter', id: c.id, title: c.title || '未命名章节' })
  }
  for (const n of work.liveMubu()) {
    if (has(n.html) || has(n.text)) out.push({ kind: 'mubu', id: n.id, title: (n.text || '').slice(0, 24) || '（空）' })
  }
  for (const c of work.liveCharacters) {
    if (has(c.content)) out.push({ kind: 'character', id: c.id, title: c.name || '未命名' })
  }
  for (const o of work.outlines) {
    if (o.deletedAt) continue
    if (has(o.content)) out.push({ kind: 'outline', id: o.refId, title: outlineLabel(o.refId) || '大纲' })
  }
  for (const s of work.liveSnippets) {
    if (has(s.content)) out.push({ kind: 'snippet', id: s.id, title: (s.content || '').split('\n').find((x) => x.trim())?.slice(0, 20) || '灵感' })
  }
  return out
}

/* ---------- 纯文本令牌（大纲 / 人物 / 灵感） ---------- */
export function buildToken(title, display = '') {
  const t = String(title || '').trim()
  const d = String(display || '').trim()
  return d && d !== t ? `[[${t}|${d}]]` : `[[${t}]]`
}

/** 解析文本中的令牌 → [{ start, end, title, display }]（end 为令牌结束位置） */
export function parseTokens(text) {
  const s = String(text || '')
  const out = []
  const re = /\[\[([^\[\]\n]+?)\]\]/g
  for (const m of s.matchAll(re)) {
    const raw = m[1]
    const bar = raw.indexOf('|')
    const title = (bar >= 0 ? raw.slice(0, bar) : raw).trim()
    const display = bar >= 0 ? raw.slice(bar + 1).trim() : title
    if (title) out.push({ start: m.index, end: m.index + m[0].length, title, display })
  }
  return out
}

/** 字符偏移所在令牌（含左右边界内侧），无则 null */
export function tokenAtOffset(text, offset) {
  return parseTokens(text).find((t) => offset >= t.start && offset <= t.end) || null
}

/* 令牌命中测试用镜像（模拟 textarea 换行排版），按 host 缓存 */
const mirrorCache = new WeakMap()
function mirrorOf(ta) {
  let m = mirrorCache.get(ta)
  if (!m) {
    m = document.createElement('div')
    m.setAttribute('aria-hidden', 'true')
    m.style.cssText = 'position:fixed;left:-99999px;top:0;visibility:hidden;white-space:pre-wrap;word-wrap:break-word;box-sizing:content-box;'
    document.body.appendChild(m)
    mirrorCache.set(ta, m)
  }
  const cs = getComputedStyle(ta)
  m.style.width = Math.max(0, ta.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) + 'px'
  m.style.fontFamily = cs.fontFamily
  m.style.fontSize = cs.fontSize
  m.style.fontWeight = cs.fontWeight
  m.style.fontStyle = cs.fontStyle
  m.style.lineHeight = cs.lineHeight
  m.style.letterSpacing = cs.letterSpacing
  m.style.padding = `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`
  const val = ta.value + '\n'
  if (m.textContent !== val) m.textContent = val
  return m
}

/** 鼠标点所在令牌（textarea 换行感知命中测试），无则 null */
export function tokenAtPoint(ta, clientX, clientY) {
  if (!ta || !ta.value) return null
  const tokens = parseTokens(ta.value)
  if (!tokens.length) return null
  const m = mirrorOf(ta)
  const tn = m.firstChild
  if (!tn || tn.nodeType !== 3) return null
  const mrect = m.getBoundingClientRect()
  const taRect = ta.getBoundingClientRect()
  const x = clientX - taRect.left + ta.scrollLeft + mrect.left
  const y = clientY - taRect.top + ta.scrollTop + mrect.top
  for (const t of tokens) {
    try {
      const r = document.createRange()
      r.setStart(tn, t.start)
      r.setEnd(tn, Math.min(t.end, tn.textContent.length))
      for (const rect of r.getClientRects()) {
        if (x >= rect.left - 2 && x <= rect.right + 2 && y >= rect.top - 2 && y <= rect.bottom + 2) return { ...t, rect }
      }
    } catch {
      /* 越界忽略 */
    }
  }
  return null
}
