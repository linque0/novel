import { db, uid, now, todayStr } from './database'
import { htmlToMd, htmlToPlain } from '../services/importers'

/**
 * Repository 层：所有 Dexie 访问集中在此。
 * 后续迁移到 SQLite（Electron 主进程）时只需替换本模块实现，stores 无需改动。
 */

export async function loadWorkBundle(workId) {
  const [
    works, volumes, chapters, outlines, characters, relations,
    lorecats, lore, snippets, assetRows, links
  ] = await Promise.all([
    db.works.get(workId),
    db.volumes.where('workId').equals(workId).toArray(),
    db.chapters.where('workId').equals(workId).toArray(),
    db.outlines.where('workId').equals(workId).toArray(),
    db.characters.where('workId').equals(workId).toArray(),
    db.relations.where('workId').equals(workId).toArray(),
    db.lorecats.where('workId').equals(workId).toArray(),
    db.lore.where('workId').equals(workId).toArray(),
    db.snippets.where('workId').equals(workId).toArray(),
    db.assets.where('workId').equals(workId).toArray(),
    db.links.toArray()
  ])
  // 资产只保留元信息，blob 按需读取，避免大图全部驻留内存
  const assets = assetRows.map(({ blob, ...meta }) => meta)
  return { work: works, volumes, chapters, outlines, characters, relations, lorecats, lore, snippets, assets, links }
}

export async function listWorks() {
  const rows = await db.works.orderBy('updatedAt').reverse().toArray()
  const live = rows.filter((w) => !w.deletedAt)
  const result = []
  for (const w of live) {
    const chs = await db.chapters.where('[workId+deletedAt]').equals([w.id, null]).toArray() 
      .catch(() => db.chapters.where('workId').equals(w.id).filter((c) => !c.deletedAt).toArray())
    result.push({
      ...w,
      chapterCount: chs.length,
      totalWords: chs.reduce((s, c) => s + (c.wordCount || 0), 0)
    })
  }
  return result
}

export async function createWorkRow(payload) {
  const workId = uid()
  const t = now()
  const work = {
    id: workId,
    title: payload.title,
    author: payload.author || '',
    genre: payload.genre || '其他',
    intro: payload.intro || '',
    status: payload.status || '构思',
    createdAt: t,
    updatedAt: t,
    deletedAt: null
  }
  await db.works.add(work)
  await db.outlines.add({ id: uid(), workId, level: 'master', refId: workId, content: '', updatedAt: t })
  return work
}

export async function seedWorkDefaults(workId, { withVolume = true } = {}) {
  const t = now()
  if (withVolume) {
    const volId = uid()
    await db.volumes.add({ id: volId, workId, title: '第一卷', sortOrder: 0, createdAt: t, updatedAt: t, deletedAt: null })
  }
  const defaults = ['地点', '势力', '物品', '体系', '大事记']
  await db.lorecats.bulkAdd(
    defaults.map((name, i) => ({ id: uid(), workId, name, sortOrder: i }))
  )
}

export async function putRow(table, row) {
  row.updatedAt = now()
  await db.table(table).put(row)
  return row
}

export async function softDeleteRow(table, row) {
  row.deletedAt = now()
  row.updatedAt = row.deletedAt
  await db.table(table).put(row)
  return row
}

export async function restoreRow(table, row) {
  row.deletedAt = null
  row.updatedAt = now()
  await db.table(table).put(row)
  return row
}

export async function purgeRow(table, row) {
  await db.table(table).delete(row.id)
}

export async function addWordLog(workId, chapterId, delta) {
  if (!delta) return
  await db.wordlog.add({ id: uid(), workId, chapterId, date: todayStr(), delta, createdAt: now() })
}

export async function getWordLogs(workId) {
  return workId ? db.wordlog.where('workId').equals(workId).toArray() : db.wordlog.toArray()
}

/* ---- 版本快照 ---- */

export async function addRevision(entityType, entityId, content) {
  await db.revisions.add({ id: uid(), entityType, entityId, content, createdAt: now() })
  const all = await db.revisions.where('[entityType+entityId]').equals([entityType, entityId]).toArray()
  if (all.length > 30) {
    all.sort((a, b) => a.createdAt - b.createdAt)
    await db.revisions.bulkDelete(all.slice(0, all.length - 30).map((r) => r.id))
  }
}

export async function listRevisions(entityType, entityId) {
  const rows = await db.revisions.where('[entityType+entityId]').equals([entityType, entityId]).toArray()
  return rows.sort((a, b) => b.createdAt - a.createdAt)
}

/* ---- 资产 ---- */

export async function addAssetRow(workId, name, mime, blob) {
  const row = { id: uid(), workId, name, mime, size: blob.size, blob, createdAt: now(), deletedAt: null }
  await db.assets.add(row)
  const { blob: _b, ...meta } = row
  return meta
}

export async function getAssetBlob(id) {
  const row = await db.assets.get(id)
  return row ? row.blob : null
}

export async function deleteAssetRow(row, purge = false) {
  if (purge) {
    await db.assets.delete(row.id)
    const ls = await db.links.where('assetId').equals(row.id).toArray()
    await db.links.bulkDelete(ls.map((l) => l.id))
  } else {
    row.deletedAt = now()
    await db.assets.put({ ...row, deletedAt: row.deletedAt })
  }
}

export async function addLink(entityType, entityId, assetId, sortOrder = 0) {
  const row = { id: uid(), entityType, entityId, assetId, sortOrder }
  await db.links.add(row)
  return row
}

export async function removeLink(linkId) {
  await db.links.delete(linkId)
}

/* ---- 备份 / 恢复 ---- */

export async function exportBackupJson() {
  const tables = ['works', 'volumes', 'chapters', 'outlines', 'characters', 'relations', 'lorecats', 'lore', 'snippets', 'links', 'wordlog', 'appconfig']
  const dump = { version: 1, exportedAt: now(), assets: [], data: {} }
  for (const t of tables) dump.data[t] = await db.table(t).toArray()
  const assetRows = await db.assets.toArray()
  for (const a of assetRows) {
    const base64 = a.blob ? await blobToDataUrl(a.blob) : null
    dump.assets.push({ id: a.id, workId: a.workId, name: a.name, mime: a.mime, size: a.size, createdAt: a.createdAt, deletedAt: a.deletedAt, dataUrl: base64 })
  }
  return JSON.stringify(dump)
}

export async function importBackupJson(text) {
  const dump = JSON.parse(text)
  if (!dump || !dump.data) throw new Error('备份文件格式不正确')
  await Promise.all(db.tables.map((t) => t.clear()))
  for (const t of Object.keys(dump.data)) {
    const rows = dump.data[t] || []
    if (rows.length) await db.table(t).bulkPut(rows)
  }
  for (const a of dump.assets || []) {
    const { dataUrl, ...meta } = a
    let blob = null
    if (dataUrl) blob = await (await fetch(dataUrl)).blob()
    await db.assets.put({ ...meta, blob })
  }
  return true
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

/* ---- 全书导出 ---- */

export async function buildBookText(work, volumes, chapters, asMarkdown) {
  const asFmt = (c) => {
    if (c.fmt === 'html') return asMarkdown ? htmlToMd(c.content) : htmlToPlain(c.content)
    return c.content || ''
  }
  const vols = volumes.filter((v) => !v.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder)
  const lines = []
  lines.push(asMarkdown ? `# ${work.title}` : `${work.title}`)
  if (work.author) lines.push(asMarkdown ? `> 作者：${work.author}` : `作者：${work.author}`)
  lines.push('')
  const used = new Set()
  for (const v of vols) {
    const chs = chapters.filter((c) => !c.deletedAt && c.volumeId === v.id).sort((a, b) => a.sortOrder - b.sortOrder)
    if (chs.length || vols.length > 1) lines.push(asMarkdown ? `## ${v.title}` : `【${v.title}】`, '')
    for (const c of chs) {
      used.add(c.id)
      lines.push(asMarkdown ? `### ${c.title}` : c.title, '', asFmt(c), '', '')
    }
  }
  // 不属于任何卷的散章
  for (const c of chapters.filter((x) => !x.deletedAt && !used.has(x.id))) {
    lines.push(asMarkdown ? `### ${c.title}` : c.title, '', asFmt(c), '', '')
  }
  return lines.join('\n').replace(/\n{4,}/g, '\n\n\n').trim() + '\n'
}
