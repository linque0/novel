import { normalizeText, hashContent, rowHash, chapterHash, stableStringify, tokens } from './text.js'
import { chunkText, paragraphRanges } from './chunker.js'

export const PROJECTION_VERSION = 1
export const SOURCE_TABLES = ['works', 'volumes', 'chapters', 'outlines', 'characters', 'relations', 'lorecats', 'lore', 'mubu', 'olnodes', 'snippets', 'annotations', 'assets', 'links']
export const TABLE_FOR_TYPE = { work: 'works', volume: 'volumes', chapter: 'chapters', outline: 'outlines', character: 'characters', relation: 'relations', lorecat: 'lorecats', lore: 'lore', mubu: 'mubu', olnode: 'olnodes', snippet: 'snippets', annotation: 'annotations', asset: 'assets', link: 'links' }
export function orderedChapters(bundle) {
  const out = [], used = new Set()
  const compare = (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.id).localeCompare(String(b.id))
  for (const v of (bundle.volumes || []).filter((r) => !r.deletedAt).sort(compare))
    for (const ch of (bundle.chapters || []).filter((r) => !r.deletedAt && r.volumeId === v.id).sort(compare)) { used.add(ch.id); out.push(ch) }
  out.push(...(bundle.chapters || []).filter((r) => !r.deletedAt && !used.has(r.id)).sort(compare))
  return out
}
export function sourceManifest(bundle) {
  const ids = new Set([bundle.work?.id])
  for (const table of SOURCE_TABLES.filter((t) => !['works', 'links'].includes(t))) for (const r of bundle[table] || []) ids.add(r.id)
  const entries = SOURCE_TABLES.flatMap((table) => (table === 'works' ? (bundle.work ? [bundle.work] : []) : bundle[table] || [])
    .filter((r) => table !== 'links' || ids.has(r.entityId))
    .map((r) => ({ table, id: r.id, hash: rowHash(r), deleted: !!r.deletedAt })))
    .sort((a, b) => (a.table + ':' + a.id).localeCompare(b.table + ':' + b.id))
  return { entries, hash: hashContent(stableStringify(entries)), layoutHash: hashContent(stableStringify(orderedChapters(bundle).map((ch) => [ch.id, ch.volumeId]))) }
}
export function projectBook(bundle, previous = []) {
  if (!bundle.work || bundle.work.deletedAt) return { docs: [], chunks: [], issues: [], manifest: sourceManifest(bundle) }
  const workId = bundle.work.id, docs = [], chunks = [], issues = [], old = new Map(previous.map((d) => [d.id, d]))
  const live = (table) => (bundle[table] || []).filter((r) => !r.deletedAt)
  const versions = (table, row) => ({ table, id: row.id, hash: table === 'chapters' ? chapterHash(row) : rowHash(row) })
  const add = (type, row, text, path, semanticClass, meta = {}, deps = []) => {
    const id = `doc:${workId}:${type}:${row.id}`, plainText = normalizeText(text, 'text')
    const paragraphs = paragraphRanges(plainText, old.get(id)?.paragraphs)
    const doc = { id, workId, sourceType: type, sourceId: row.id, sourceTable: TABLE_FOR_TYPE[type], title: row.title || row.name || path.at(-1) || '未命名',
      headingPath: path, orderKey: String(docs.length).padStart(9, '0'), plainText, markdown: plainText, paragraphs, semanticClass,
      sourceHash: type === 'chapter' ? chapterHash(row) : rowHash(row), textHash: hashContent(plainText),
      deps: [versions(TABLE_FOR_TYPE[type], row), ...deps], contextHash: hashContent(stableStringify([path, meta, deps])),
      meta, projectionVersion: PROJECTION_VERSION, tokenEstimate: tokens(plainText), updatedAt: Date.now() }
    docs.push(doc)
    chunks.push(...chunkText(plainText, { docId: id, paragraphs }).map((c) => ({ ...c, workId })))
    return doc
  }
  const work = bundle.work
  add('work', work, [work.title, work.author, work.genre, work.intro || work.description || work.synopsis, work.status].filter(Boolean).join('\n'), [work.title], 'metadata')
  for (const v of live('volumes').sort((a,b) => (a.sortOrder || 0) - (b.sortOrder || 0))) add('volume', v, v.title || '', [work.title, v.title || '未命名卷'], 'metadata')
  const chapterIndex = new Map()
  for (const [i, ch] of orderedChapters(bundle).entries()) {
    chapterIndex.set(ch.id, i)
    const v = live('volumes').find((r) => r.id === ch.volumeId)
    add('chapter', ch, normalizeText(ch.content, ch.fmt), [v?.title || '未分卷', ch.title || '未命名章'], 'fact', { chapterId: ch.id, orderIdx: i, volumeId: ch.volumeId, status: ch.status }, v ? [versions('volumes', v)] : [])
  }
  const chars = new Map(live('characters').map((r) => [r.id, r]))
  for (const c of chars.values()) {
    const rels = live('relations').filter((r) => r.fromId === c.id || r.toId === c.id)
    const peers = rels.flatMap((r) => [chars.get(r.fromId), chars.get(r.toId)]).filter(Boolean)
    const text = [c.name, c.aliases && '别名：' + c.aliases, c.role && '角色：' + c.role, (c.tags || []).join('、'),
      ...Object.entries(c.fields || {}).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => k + '：' + (typeof v === 'object' ? stableStringify(v) : v)),
      normalizeText(c.content, c.fmt), ...rels.map((r) => `${chars.get(r.fromId)?.name || r.fromId} → ${chars.get(r.toId)?.name || r.toId}：${r.label || ''}`)].filter(Boolean).join('\n')
    add('character', c, text, ['人物', c.name || '未命名人物'], 'setting', { aliases: c.aliases, role: c.role, tags: c.tags, temporalStatus: 'unknown' }, [...rels.map((r) => versions('relations', r)), ...peers.map((r) => versions('characters', r))])
  }
  for (const r of live('relations')) {
    if (!chars.has(r.fromId) || !chars.has(r.toId)) { issues.push({ type: 'orphan-relation', sourceId: r.id }); continue }
    add('relation', r, `${chars.get(r.fromId).name} → ${chars.get(r.toId).name}：${r.label || ''}`, ['人物关系', r.label || '关联'], 'setting', { fromId: r.fromId, toId: r.toId, temporalStatus: 'unknown' }, [versions('characters', chars.get(r.fromId)), versions('characters', chars.get(r.toId))])
  }
  const tree = (table, type, rootLabel, semanticClass) => {
    const rows = live(table), byId = new Map(rows.map((r) => [r.id,r])), seen = new Set()
    const walk = (row, chain = []) => {
      if (seen.has(row.id)) return
      seen.add(row.id)
      const title = row.title || normalizeText(row.text || row.html).split('\n')[0] || '空节点'
      const ancestors = [...chain, row]
      const body = normalizeText(row.html || row.text || row.content || '', row.html ? 'html' : undefined)
      const boxes = (row.textboxes || []).map((b) => normalizeText(b.text)).filter(Boolean)
      const rels = (row.rels || []).map((r) => `${r.kind || '关联'} → ${byId.get(r.to)?.title || byId.get(r.toId)?.title || r.to || r.toId || ''}`)
      add(type, row, [row.title, body, ...boxes, ...rels].filter(Boolean).join('\n'), [rootLabel, ...ancestors.map((n) => n.title || normalizeText(n.text || n.html).split('\n')[0] || '空节点')], semanticClass,
        { parentId: row.parentId, refId: row.refId, kind: row.kind, rels: row.rels || [], chapterId: chapterIndex.has(row.refId) ? row.refId : null }, ancestors.slice(0,-1).map((n) => versions(table,n)))
      rows.filter((r) => r.parentId === row.id).sort((a,b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.id).localeCompare(String(b.id))).forEach((r) => walk(r, ancestors))
    }
    rows.filter((r) => !r.parentId || !byId.has(r.parentId)).sort((a,b) => (a.sortOrder || 0) - (b.sortOrder || 0)).forEach((r) => walk(r))
    for (const row of rows.filter((r) => !seen.has(r.id))) { issues.push({ type: 'tree-cycle', table, sourceId: row.id }); walk(row) }
  }
  tree('mubu', 'mubu', '设定', 'setting')
  tree('olnodes', 'olnode', '大纲计划', 'plan')
  // Migrated legacy rows can still hold edits; exclude only exact mapped duplicates.
  for (const r of live('outlines')) if (!live('olnodes').some((n) => n.refId === r.refId && normalizeText(n.html || n.text) === normalizeText(r.content))) add('outline', r, normalizeText(r.content), ['旧版大纲', r.level || '', r.refId || ''], 'plan', { refId: r.refId, chapterId: chapterIndex.has(r.refId) ? r.refId : null })
  if (!live('mubu').length) {
    tree('lorecats', 'lorecat', '旧版设定分类', 'metadata')
    for (const r of live('lore')) add('lore', r, normalizeText(r.content), ['旧版设定', r.title || r.name || r.id], 'setting', { categoryId: r.categoryId })
  }
  for (const r of live('snippets')) add('snippet', r, [r.title, normalizeText(r.content || r.text, r.fmt), (r.tags || []).join('、')].filter(Boolean).join('\n'), ['灵感', r.title || r.id], 'inspiration')
  for (const r of live('annotations')) {
    const ch = live('chapters').find((c) => c.id === r.chapterId)
    if (!ch) { issues.push({ type: 'orphan-annotation', sourceId: r.id }); continue }
    add('annotation', r, [r.text, r.note, r.kind].filter(Boolean).join('\n'), ['批注', ch.title, r.kind || '备注'], 'comment', { chapterId: r.chapterId, anchorValid: normalizeText(ch.content, ch.fmt).includes(r.text || '') }, [versions('chapters', ch)])
  }
  for (const r of live('assets')) {
    add('asset', r, normalizeText(r.transcript || r.extractedText || '', 'text'), ['附件', r.name || r.id], 'metadata', { unparsed: !r.transcript && !r.extractedText, mime: r.mime })
    if (!r.transcript && !r.extractedText) issues.push({ type: 'unparsed-asset', sourceId: r.id, title: r.name })
  }
  return { docs, chunks, issues, manifest: sourceManifest(bundle) }
}
