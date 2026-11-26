import { marked } from 'marked'

const colors = ['#a1c7bb', '#c5adcf', '#d5ac8b', '#a8a7c4', '#b9b2a2']
const titleLimit = 34

function plainText(tokens = []) {
  return tokens.map(token => {
    if (token.type === 'html') return ''
    if (token.type === 'br') return '\n'
    if (token.type === 'space') return token.raw
    if (token.type === 'list') return token.items.map(item => plainText(item.tokens)).join('\n')
    return token.tokens ? plainText(token.tokens) : token.text ?? ''
  }).join('')
}

function entryTitle(blocks) {
  const first = blocks.find(token => token.type !== 'space')
  const line = plainText(first ? [first] : []).trim().split('\n')[0]
  const field = line.match(/^([^：:\s][^：:]{0,19})[：:]\s*\S/)
  const title = (field?.[1] || line).replace(/[：:]$/, '').trim()
  const chars = [...title]
  return chars.length > titleLimit ? chars.slice(0, titleLimit - 1).join('') + '…' : title || '空条目'
}

function linkTargets(blocks) {
  const targets = []
  marked.walkTokens(blocks, token => {
    if (token.type !== 'link' || !token.href.startsWith('#') || token.href.length === 1) return
    try { targets.push(decodeURIComponent(token.href.slice(1))) }
    catch { /* A malformed fragment has no resolvable target. */ }
  })
  return targets
}

export function parseLoreMarkdown(source, fallbackTitle = '设定集') {
  const tokens = marked.lexer(source.replace(/^\uFEFF/, ''))
  const documentTitle = tokens.find(token => token.type === 'heading' && token.depth === 1)
  const workTitle = plainText(documentTitle?.tokens).trim() || fallbackTitle
  const sets = []
  const nodes = []
  const anchors = new Map()
  const references = []
  let listCount = 0

  function addAnchor(title, id) {
    const slug = title.toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '').replace(/\s+/g, '-')
    for (const key of new Set([title, slug])) {
      if (!key) continue
      anchors.set(key, anchors.has(key) ? null : id)
    }
  }

  function addSet(title) {
    const set = { id: 'group-' + sets.length, title, color: colors[sets.length % colors.length], createdAt: sets.length }
    sets.push(set)
    return set
  }

  function addNode(set, parent, title, summary, blocks = []) {
    // The document content identifies the layout namespace. IDs within it
    // follow source order, so repeated labels have independent coordinates.
    const node = {
      id: 'entry-' + nodes.length, setId: set.id, parentId: parent?.id,
      title, summary, createdAt: nodes.length
    }
    nodes.push(node)
    addAnchor(title, node.id)
    for (const target of linkTargets(blocks)) references.push({ from: node.id, target })
    return node
  }

  function readList(list, set, parent) {
    for (const item of list.items) {
      listCount++
      const blocks = item.tokens.filter(token => token.type !== 'list')
      const summary = blocks.map(token => plainText([token]).trim()).filter(Boolean).join('\n\n')
      const node = addNode(set, parent, entryTitle(blocks), summary, blocks)
      for (const token of item.tokens) {
        if (token.type === 'list') readList(token, set, node)
      }
    }
  }

  let set
  const headings = []
  const blocks = tokens.filter(token => token.type !== 'space')
  for (const [index, token] of blocks.entries()) {
    if (token === documentTitle) continue
    if (token.type === 'heading') {
      const title = plainText(token.tokens).trim() || '未命名分组'
      while (headings.length && headings.at(-1).depth >= token.depth) headings.pop()
      const parent = headings.at(-1)
      if (parent) {
        set = parent.set
        headings.push({ depth: token.depth, set, node: addNode(set, parent.node, title, '') })
      } else {
        set = addSet(title)
        headings.push({ depth: token.depth, set })
      }
    } else if (token.type === 'paragraph' && !headings.length && blocks[index + 1]?.type === 'list') {
      const title = plainText(token.tokens).trim()
      if (title && title.length <= 48 && !title.includes('\n')) set = addSet(title)
    } else if (token.type === 'list') {
      set ??= addSet(workTitle)
      readList(token, set, headings.at(-1)?.node)
    }
  }
  if (!listCount) throw new Error('文件里没有可导入的 Markdown 列表。')

  const links = []
  const seen = new Set()
  for (const { from, target } of references) {
    const to = anchors.get(target)
    const key = JSON.stringify([from, to])
    if (!to || to === from || seen.has(key)) continue
    seen.add(key)
    links.push({ id: 'reference-' + links.length, from, to, label: '文档引用' })
  }
  return { sets, nodes, links, satellites: [], workTitle }
}
