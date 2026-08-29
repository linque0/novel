import Dexie from 'dexie'

export const db = new Dexie('novel-studio')

db.version(1).stores({
  works: 'id, updatedAt, deletedAt',
  volumes: 'id, workId, [workId+sortOrder]',
  chapters: 'id, workId, volumeId, [workId+deletedAt], updatedAt',
  outlines: 'id, workId, level, refId, [workId+level]',
  characters: 'id, workId, [workId+deletedAt], name',
  relations: 'id, workId, fromId, toId',
  lorecats: 'id, workId, [workId+sortOrder]',
  lore: 'id, workId, categoryId, [workId+deletedAt]',
  snippets: 'id, workId, [workId+deletedAt], createdAt',
  assets: 'id, workId, [workId+deletedAt]',
  links: 'id, [entityType+entityId], assetId',
  revisions: 'id, [entityType+entityId], createdAt',
  wordlog: 'id, date, workId, [workId+date], [date+chapterId]',
  appconfig: 'key'
})

// v2：设定分类支持文件夹式嵌套（parentId）
db.version(2).stores({
  works: 'id, updatedAt, deletedAt',
  volumes: 'id, workId, [workId+sortOrder]',
  chapters: 'id, workId, volumeId, [workId+deletedAt], updatedAt',
  outlines: 'id, workId, level, refId, [workId+level]',
  characters: 'id, workId, [workId+deletedAt], name',
  relations: 'id, workId, fromId, toId',
  lorecats: 'id, workId, parentId, [workId+sortOrder]',
  lore: 'id, workId, categoryId, [workId+deletedAt]',
  snippets: 'id, workId, [workId+deletedAt], createdAt',
  assets: 'id, workId, [workId+deletedAt]',
  links: 'id, [entityType+entityId], assetId',
  revisions: 'id, [entityType+entityId], createdAt',
  wordlog: 'id, date, workId, [workId+date], [date+chapterId]',
  appconfig: 'key'
})

export const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' +
      Date.now().toString(36) +
      '-' +
      Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(36).padStart(2, '0')).join('')

export const now = () => Date.now()

export const todayStr = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * 打开数据库（带重试）。
 * Chromium 偶发 IndexedDB open() UnknownError；另一实例占用数据目录时也会打开失败。
 */
export async function openDbWithRetry(tries = 8) {
  for (let i = 0; i < tries; i++) {
    try {
      await db.open()
      return true
    } catch (err) {
      console.warn('[db] open failed, retry', i + 1, String(err))
      try {
        db.close()
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 250 * (i + 1)))
    }
  }
  return false
}
