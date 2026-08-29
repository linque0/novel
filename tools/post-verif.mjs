/* 崩溃恢复验收 + 重置为干净的演示数据 */
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const PORT = 9222

class CDP {
  static async connect() {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
    const target = list.find((t) => t.type === 'page' && t.url.startsWith('app://'))
    if (!target) throw new Error('page target not found')
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
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails))
    return r.result?.value
  }
  async shot(name) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(resolve(here, name), Buffer.from(data, 'base64'))
  }
}

const mode = process.argv[2] || 'verify'
const cdp = await CDP.connect()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (mode === 'verify') {
  /* 崩溃恢复：打开作品，校验全部要素仍在 */
  await cdp.eval(`document.querySelector('.book-card').click()`)
  await sleep(1000)
  const v = await cdp.eval(`(async () => {
    const { db } = window.__ns
    const chapters = await db.chapters.toArray()
    const chars = await db.characters.toArray()
    const lore = await db.lore.toArray()
    const snips = await db.snippets.toArray()
    const wordlog = await db.wordlog.toArray()
    return {
      content: chapters.some((c) => (c.content || '').includes('夜色像一块浸透了墨的绒布')),
      charLin: chars.some((c) => c.name === '林远'),
      loreOk: lore.some((l) => l.title === '观测站'),
      snipOk: snips.some((s) => (s.content || '').includes('罗盘在满月')),
      wordlog: wordlog.length
    }
  })()`)
  const ok = v.content && v.charLin && v.loreOk && v.snipOk && v.wordlog > 0
  console.log(`${ok ? 'PASS' : 'FAIL'}  崩溃恢复（强杀进程后数据完好）  —— ${JSON.stringify(v)}`)
  process.exit(ok ? 0 : 1)
}

if (mode === 'seed') {
  /* 清理测试残留，重建一份干净的演示作品 */
  await cdp.eval(`(async () => {
    const { db, uid, now } = window.__ns
    await Promise.all(db.tables.map((t) => t.clear()))
    const t = now()
    const workId = uid()
    await db.works.add({ id: workId, title: '星尘旅人', author: '', genre: '科幻', status: '连载', intro: '观测站的年轻测绘员林远，在星图异动之夜接过一枚黄铜罗盘，从此踏上寻找失落黎明之旅。', createdAt: t, updatedAt: t, deletedAt: null })
    await db.outlines.add({ id: uid(), workId, level: 'master', refId: workId, content: '总纲：星图碎片散落四境，每一块碎片都在低语同一句话——黎明仍在。旅人自雾都出发，穿越界脊、沉海、灰烬平原，最终发现"黎明"是观测站 itself 的名字。', createdAt: t, updatedAt: t, deletedAt: null })
    const volId = uid()
    await db.volumes.add({ id: volId, workId, title: '第一卷 · 雾都来信', sortOrder: 0, createdAt: t, updatedAt: t, deletedAt: null })
    const mkChapter = async (title, content, sort, oc) => {
      const id = uid()
      await db.chapters.add({ id, workId, volumeId: volId, title, content, wordCount: content.replace(/\\s/g, '').length, status: 'draft', sortOrder: sort, createdAt: t, updatedAt: t, deletedAt: null })
      await db.outlines.add({ id: uid(), workId, level: 'chapter', refId: id, content: oc, createdAt: t, updatedAt: t, deletedAt: null })
      return id
    }
    await mkChapter('第一章 · 初雪', '夜色像一块浸透了墨的绒布，沉沉压在观测站的穹顶之上。\\n\\n林远抬头，星图在头顶缓缓旋转。三百六十枚铜刻的星辰各自归位，唯独"黎明"那一枚，二十年来始终空着。\\n\\n初雪落进界脊的风里。他把黄铜罗盘揣进大衣内袋，罗盘贴着心口，微微发烫。', 0, '出场：林远。铺垫：空缺的"黎明"星辰、发烫的罗盘。')
    await mkChapter('第二章 · 夜行', '他提灯走过长街，灯芯里燃的不是火，是一小撮研碎的星屑。\\n\\n雾都的钟楼敲了十一下。第十二下，永远缺席。\\n\\n"再往东，别回头。"罗盘的指针在颤，像一根被惊醒的睫毛。', 1000, '出场：林远。钩子：缺失的第十二声钟响。')
    const c1 = await db.chapters.where('workId').equals(workId).first()
    const lin = uid()
    await db.characters.add({ id: lin, workId, name: '林远', aliases: '小林', role: '主角', tags: ['观测员', '旅人'], fields: { 年龄: '二十四', 随身物: '黄铜罗盘' }, avatarAssetId: null, content: '观测站最年轻的测绘员。沉默寡言，习惯把问题写在袖口内侧。父亲二十年前在寻找"黎明"时失踪。', createdAt: t, updatedAt: t, deletedAt: null })
    const su = uid()
    await db.characters.add({ id: su, workId, name: '苏眉', aliases: '', role: '配角', tags: ['钟楼守夜人'], fields: {}, avatarAssetId: null, content: '雾都钟楼的守夜人，知道所有关于第十二声钟响的传闻。说话像打哑谜。', createdAt: t, updatedAt: t, deletedAt: null })
    await db.relations.add({ id: uid(), workId, fromId: lin, toId: su, label: '指引者' })
    const catId = uid()
    await db.lorecats.bulkAdd([
      { id: catId, workId, name: '地点', sortOrder: 0, deletedAt: null },
      { id: uid(), workId, name: '势力', sortOrder: 1, deletedAt: null },
      { id: uid(), workId, name: '物品', sortOrder: 2, deletedAt: null },
      { id: uid(), workId, name: '体系', sortOrder: 3, deletedAt: null },
      { id: uid(), workId, name: '大事记', sortOrder: 4, deletedAt: null }
    ])
    await db.lore.bulkAdd([
      { id: uid(), workId, categoryId: catId, title: '雾都', content: '终年被十二时辰制的雾笼罩的城市。钟楼每报到第十一下便哑火，传说第十二响响起之日，即是"黎明"归来之时。', tags: ['城市'], createdAt: t, updatedAt: t, deletedAt: null },
      { id: uid(), workId, categoryId: catId, title: '观测站', content: '建于界脊之上，穹顶内悬三百六十枚铜刻星辰的活星图。监控星图异动，是旅人出发的地方。', tags: ['建筑'], createdAt: t, updatedAt: t, deletedAt: null },
      { id: uid(), workId, categoryId: catId, title: '黄铜罗盘', content: '不指向北方，指向"最想抵达之处"。满月之夜会指向错误的方位——例外的那一次，是线索。', tags: ['道具'], createdAt: t, updatedAt: t, deletedAt: null }
    ])
    await db.snippets.bulkAdd([
      { id: uid(), workId, content: '灵感：罗盘在满月之夜指向错误的方位——而那个方向，站着一脸茫然的苏眉。', tags: [], createdAt: t - 86400000, updatedAt: t, deletedAt: null },
      { id: uid(), workId, content: '灵感：第二章结尾让灯芯里的星屑熄灭一粒，呼应"每一章熄灭一颗星"的卷结构。', tags: [], createdAt: t, updatedAt: t, deletedAt: null }
    ])
    return 'seeded'
  })()`)
  console.log('演示数据已重建')
  process.exit(0)
}
