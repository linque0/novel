/* 测试 profile 种子：作品 + 卷 + 章节（幂等） */
const PORT = 9222

class CDP {
  static async connect() {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
    const target = list.find((t) => t.type === 'page' && t.url.startsWith('app://'))
    if (!target) throw new Error('page not found')
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => ((ws.onopen = res), (ws.onerror = rej)))
    const cdp = new CDP(ws)
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && cdp.pending.has(msg.id)) {
        const { res, rej } = cdp.pending.get(msg.id)
        cdp.pending.delete(msg.id)
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result)
      }
    }
    return cdp
  }
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
  }
  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((res, rej) => this.pending.set(id, { res, rej }))
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) return { PAGE_ERR: r.exceptionDetails.exception?.description || r.exceptionDetails.text }
    return r.result?.value
  }
}

const cdp = await CDP.connect()
const v = await cdp.eval(`(async () => {
  const { db, uid, now } = window.__ns
  if ((await db.works.toArray()).length) return 'has'
  const t = now()
  const workId = uid()
  await db.works.add({ id: workId, title: '星尘旅人', author: '', genre: '科幻', status: '连载', intro: '', createdAt: t, updatedAt: t, deletedAt: null })
  await db.outlines.add({ id: uid(), workId, level: 'master', refId: workId, content: '', createdAt: t, updatedAt: t, deletedAt: null })
  const volId = uid()
  await db.volumes.add({ id: volId, workId, title: '第一卷', sortOrder: 0, createdAt: t, updatedAt: t, deletedAt: null })
  await db.chapters.add({ id: uid(), workId, volumeId: volId, title: '第一章 · 初雪', content: '<p>穹顶大厅的钟声在雾中回荡。</p>', wordCount: 13, status: 'draft', sortOrder: 0, createdAt: t, updatedAt: t, deletedAt: null })
  return 'seeded'
})()`)
console.log(v)
process.exit(0)
