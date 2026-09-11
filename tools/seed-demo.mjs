/* 文档截图专用种子：在独立 profile 中建立演示作品《星尘旅人》
   （正文 3 卷 9 章 / 人物 6 + 关系 6 / 设定幕布 13 节点 / 灵感 4 / 90 天字数日志 / 大纲画布 17 模块）
   幂等：同名作品整体重建；不写大纲 legacy 内容，避免触发 olnodes 自动迁移产生杂节点 */
import { connect } from './_cdp-lib.mjs'

const cdp = await connect('127.0.0.1:5173', '9222')

const WORK = { title: '星尘旅人', author: '林间', genre: '科幻', status: '连载', intro: '星图熄灭的三百年后，一名领航员在界脊之上重新点亮了第一枚铜刻星辰。' }

const VOLUMES = ['第一卷 · 星图初醒', '第二卷 · 雾都钟楼', '第三卷 · 界脊之上']

const CHAPTERS = [
  ['第一卷 · 星图初醒', '第一章 · 初雪', 'draft', `<p>穹顶大厅的钟声在雾中回荡了十二下。</p><p>林远把掌心贴在观测台的铜面上，冰凉的触感顺着腕骨爬上来。三百六十枚铜刻星辰悬在头顶，一枚接一枚地暗下去——像被谁依次吹熄的烛火。</p><p>“又熄了一枚。”沈砚在舱门口说，声音里带着机油味，“按这个速度，冬至之前，整张星图会全黑。”</p><p>林远没有回头。他盯着星图上那处最早熄灭的空位，那里原本属于“天枢”。父亲最后一次出航前，曾指着它说：如果有一天它灭了，你就往它灭的方向走。</p>`],
  ['第一卷 · 星图初醒', '第二章 · 领航员', 'draft', `<p>领航员公会的测试舱只有三步宽。</p><p>林远躺进去的时候，听见外面的考官在低声争论：“太年轻了，星感阈值这种东西不是练出来的。”</p><p>他闭上眼，让意识沉进那片无边无际的黑。黑暗里浮出细密的光点，像退潮后滩涂上残留的水光。他伸手，去够最远的那一枚。</p><p>舱门打开时，满室寂静。考官手里的记录仪停在了一个没人见过的数字上。</p>`],
  ['第一卷 · 星图初醒', '第三章 · 雾中的钟楼', 'done', `<p>雾都的名字起得毫不客气——这座城一年有三百天泡在雾里，剩下的六十五天在下雨。</p><p>钟楼立在城的正中，比雾高出整整一层。传说钟楼的第十二响能唤回迷航的船，可近百年里，没有人真正听过第十二响。</p><p>林远站在钟楼下仰头。铜钟的表面覆着一层青绿的锈，锈迹的纹路竟与星图上的连线一模一样。</p><p>“这不是钟。”他听见自己说，“这是一份星图。”</p>`],
  ['第二卷 · 雾都钟楼', '第四章 · 铜与锈', 'done', `<p>沈砚用撬棍挑开钟壁上一块松动的铜皮，底下露出密密麻麻的刻痕。</p><p>“三百年前的手艺。”她吹掉浮尘，“刻线的间距、角度，和观测站的星图是同一套算法。有人把整片天空搬进了这座钟里。”</p><p>林远伸手抚过其中一道刻痕，指尖传来极轻微的震颤——那不是锈在动，是钟在响，用低到听不见的频率。</p>`],
  ['第二卷 · 雾都钟楼', '第五章 · 白鸦', 'draft', `<p>星盗的船总是先到一步。</p><p>当林远从钟楼顶端望见雾里那三盏并排的灯时，就知道来的是白鸦的人。三灯成行，是星盗之间“已锁定猎物”的信号。</p><p>“他们想要钟。”沈砚握紧了撬棍。</p><p>“他们要的不是钟。”林远说，“是钟里那张星图。所有人都在找同一个答案，只是有人想先拿到手，再决定要不要告诉别人。”</p>`],
  ['第二卷 · 雾都钟楼', '第六章 · 十二响', 'draft', `<p>第十一响落下后，整座城安静得能听见雾滴落在瓦上的声音。</p><p>林远把掌心按在钟壁上，像在观测站那样，让意识沉进去。</p><p>第十二响来了。</p><p>它不是从钟里传出来的——是从天上。整片雾在那一瞬被照亮，三百六十枚星辰的光同时落下来，把雾照成了雪。</p>`],
  ['第三卷 · 界脊之上', '第七章 · 界脊', 'draft', `<p>界脊是一道横贯大陆的断崖，古人以为那是世界的边缘。</p><p>林远站在崖顶，脚下是翻涌的云海。他翻开父亲的旧航海日志，最后一页只有一行字：</p><p>“星图不是地图。星图是路。而路，得有人走。”</p>`],
  ['第三卷 · 界脊之上', '第八章 · 试炼与升级', 'done', `<p>白鸦的星舰比传闻中更大。</p><p>林远把领航舱的护罩升起，让星感完全铺开。他能“看”到对方每一个推进器的余温、每一道焊缝里残留的应力。</p><p>这不再是天赋，而是一种近乎残忍的清晰。</p><p>“你还是太年轻。”白鸦在通讯频道里笑，“你以为看清了，就能赢？”</p><p>“不。”林远说，“看清了，才知道该往哪儿打。”</p>`],
  ['第三卷 · 界脊之上', '第九章 · 新的平衡', 'draft', `<p>钟楼重新响了起来，一日十二响，一响不差。</p><p>观测站的穹顶下，三百六十枚铜刻星辰一枚接一枚地亮起。沈砚蹲在台边接线，顾昭靠在门框上看着，阿澈的投影浮在半空，像一枚安静的蓝点。</p><p>“下一步去哪儿？”沈砚问。</p><p>林远看向星图最远处那枚刚刚点亮的空位。</p><p>“往它灭的方向走。”</p>`]
]

const CHARACTERS = [
  ['林远', '主角', ['领航员', '星感'], '星图熄灭后第一位重新点亮铜刻星辰的领航员。寡言，习惯把掌心贴在冰凉的金属上思考。', { '外貌': '瘦高，指节有常年握舵磨出的茧；左眼因星感过载微微泛银。', '性格': '沉默、固执，认准方向就不肯回头。' }],
  ['沈砚', '配角', ['机械师'], '星舰“凫川号”的机械师。能在任何一艘破船上找出能用的零件，说话比发动机响。', { '外貌': '短发，工装袖口永远是油污。', '性格': '直率、嘴硬心软。' }],
  ['顾昭', '导师', ['退役舰长'], '凫川号原舰长，因一次航道事故退役。把毕生航图交给林远后，留在观测站守钟。', { '外貌': '灰白鬓角，右腿旧伤，走路略跛。', '性格': '沉稳、话少，关键处一句顶十句。' }],
  ['白鸦', '反派', ['星盗', '星盗首领'], '星盗舰队首领，也在寻找星图的终点。手段狠厉，却始终没有对林远下死手。', { '外貌': '常戴半张银面具，遮住右颊旧疤。', '性格': '冷酷、耐心，从不做无意义的杀戮。' }],
  ['苏黎', '红颜', ['星图学者'], '星图学者，最早提出“钟楼即星图”猜想的人，因论文被斥为异端而离会。', { '外貌': '总抱着一卷手抄星图，指尖沾墨。', '性格': '锋利、执拗，笑起来却极软。' }],
  ['阿澈', '盟友', ['AI', '舰载人格'], '凫川号的舰载人格，只有一枚蓝色光点的投影。会记下船上每个人说过的每一句话。', { '外貌': '一枚浮空的蓝色光点投影。', '性格': '温和、精确，偶尔冒出一句玩笑。' }]
]

const RELATIONS = [
  ['林远', '沈砚', '同袍', 'bottom', 'top'],
  ['林远', '顾昭', '师徒', 'top', 'bottom'],
  ['顾昭', '白鸦', '宿敌', 'right', 'left'],
  ['林远', '苏黎', '青梅竹马', 'right', 'left'],
  ['白鸦', '沈砚', '胁迫', 'bottom', 'bottom'],
  ['阿澈', '林远', '共生契约', 'left', 'right']
]

const LORE = [
  ['世界观', null, '三百年后星图渐次熄灭，人类航路随之萎缩，世界退回以雾都与界脊为界的狭小版图。'],
  ['界脊', '世界观', '横贯大陆的断崖，古人以为是世界边缘；实为古星图航路的起点，崖壁岩层中嵌有与钟楼同源的铜刻刻线。'],
  ['星图', '世界观', '并非天空的摹本，而是一份可以行走的路线图——每一枚星辰对应一处可以抵达的坐标。'],
  ['观测站', '世界观', '建于界脊之上，穹顶内悬三百六十枚铜刻星辰的活星图。'],
  ['穹顶大厅', '观测站', '观测站的核心。铜面观测台常年覆着一层薄霜，钟声在此回荡十二下。'],
  ['三百六十枚铜刻星辰', '观测站', '与钟楼铜钟同源而铸。受到星感牵引会自行明灭，是星图活着的证据。'],
  ['组织与势力', null, ''],
  ['领航员公会', '组织与势力', '垄断星感测试与航路授权的机构，只承认可复现的阈值。'],
  ['星盗舰队', '组织与势力', '以白鸦为首，在雾都至界脊的旧航路上劫掠，实为自行探索星图终点。'],
  ['器物与设定', null, ''],
  ['凫川号', '器物与设定', '顾昭退役后留给林远的旧式星舰，外壳锈迹斑斑，主引擎每隔三日需要沈砚敲一次。'],
  ['钟楼铜钟', '器物与设定', '雾都城心的巨型铜钟，钟壁刻痕与星图连线完全一致；第十二响可照彻全城之雾。'],
  ['星感阈值', '器物与设定', '衡量领航员与星图共鸣能力的指标。公会记录的历史最高值为 87，林远测得 143。']
]

const SNIPPETS = [
  '灵感：钟楼的第十二响不是声音，是光——从天上落下来，把雾照成雪。',
  '灵感：阿澈会把每个人说过的话都记下来，包括那些说出口又后悔的。',
  '灵感：白鸦的银面具下不是伤疤，是半张星图。',
  '灵感：林远父亲的航海日志最后一页，字迹比前面都新。'
]

/* 画布：一条自左向右的事件主链（含闭环回路）+ 引用卡/锚点/便签/文本框 + 一个归组容器 */
const CANVAS = {
  events: [
    ['铜星依次熄灭', 'process', 120, 320, 3, null],
    ['领航员测试', 'diamond', 440, 320, null, null],
    ['钟楼即星图', 'ellipse', 760, 320, null, null],
    ['白鸦抢先一步', 'para', 1080, 320, null, null],
    ['第十二响', 'process', 1400, 320, null, null],
    ['终局对决', 'diamond', 1720, 320, null, null]
  ],
  chain: [
    ['铜星依次熄灭', '领航员测试', { label: '触发', kind: '因果' }],
    ['领航员测试', '钟楼即星图', { label: '发现', kind: '关联', style: 'dashed' }],
    ['钟楼即星图', '白鸦抢先一步', { label: '对抗', kind: '冲突', arrows: '<->' }],
    ['白鸦抢先一步', '第十二响', { label: '转折', kind: '因果' }],
    ['第十二响', '终局对决', { label: '升级', kind: '冲突', edgeWidth: 2.6, arrowScale: 1.6 }],
    ['终局对决', '铜星依次熄灭', { label: '闭环', kind: '伏笔', style: 'dashed', arrows: '--' }]
  ],
  cites: [
    ['钟楼铜钟', 1240, 130],
    ['界脊', 1740, 130]
  ],
  anchors: [
    ['volume', '第一卷 · 星图初醒', 120, 130],
    ['chapter', '第三章 · 雾中的钟楼', 760, 130],
    ['chapter', '第九章 · 新的平衡', 1720, 130]
  ],
  notes: [
    ['伏笔', '父亲的日志最后一页，字迹比前面都新。', 440, 560],
    ['悬念', '星图不是地图，是路。得有人走。', 1080, 560]
  ],
  textbox: ['全书主旋律：熄灭 → 寻路 → 点亮', 760, 620],
  container: ['容器 · 归组示例', 120, 760, 600, 240, ['可用于收纳一组同类模块', '拖入即归组、拖出即回根级']]
}

const r = await cdp.evalx(`(async () => {
  const { db, uid, now, countWords } = window.__ns
  const t = now()
  const W = ${JSON.stringify(WORK)}, VOLS = ${JSON.stringify(VOLUMES)}, CHS = ${JSON.stringify(CHAPTERS)}
  const CHARS = ${JSON.stringify(CHARACTERS)}, RELS = ${JSON.stringify(RELATIONS)}, LORE = ${JSON.stringify(LORE)}
  const SN = ${JSON.stringify(SNIPPETS)}, CV = ${JSON.stringify(CANVAS)}

  /* ---- 幂等：清理同名作品的全部数据与迁移标记 ---- */
  const old = (await db.works.toArray()).filter((w) => w.title === W.title)
  for (const o of old) {
    for (const tb of ['volumes','chapters','outlines','characters','relations','mubu','snippets','olnodes','wordlog','bookmarks','links','revisions']) {
      const rows = await db[tb].where('workId').equals(o.id).toArray().catch(() => [])
      if (rows.length) await db[tb].bulkDelete(rows.map((x) => x.id))
    }
    await db.appconfig.bulkDelete(['olnodes-mig:' + o.id, 'olnodes-mig2:' + o.id])
    await db.works.delete(o.id)
  }

  const workId = uid()
  await db.works.add({ id: workId, ...W, createdAt: t, updatedAt: t, deletedAt: null })
  /* 主大纲保持空内容：不触发 olnodes legacy 自动迁移，画布只含下方手工铺设的模块 */
  await db.outlines.add({ id: uid(), workId, level: 'master', refId: workId, content: '', updatedAt: t })

  /* ---- 卷 / 章 ---- */
  const volIds = {}
  for (let i = 0; i < VOLS.length; i++) {
    const vid = uid(); volIds[VOLS[i]] = vid
    await db.volumes.add({ id: vid, workId, title: VOLS[i], sortOrder: i, createdAt: t, updatedAt: t, deletedAt: null })
  }
  const chIds = {}, chOrder = {}
  for (let i = 0; i < CHS.length; i++) {
    const [vol, title, status, html] = CHS[i]
    const cid = uid(); chIds[title] = cid
    chOrder[vol] = chOrder[vol] || 0
    const at = t - (CHS.length - i) * 86400000
    await db.chapters.add({ id: cid, workId, volumeId: volIds[vol], title, content: html,
      wordCount: countWords(html.replace(/<[^>]+>/g, '')), status, sortOrder: chOrder[vol]++, createdAt: at, updatedAt: at, deletedAt: null })
  }

  /* ---- 人物 / 关系 ---- */
  const charIds = {}
  for (const [name, role, tags, bio, fields] of CHARS) {
    const cid = uid(); charIds[name] = cid
    await db.characters.add({ id: cid, workId, name, role, tags, aliases: '', content: bio, fields, deletedAt: null, createdAt: t, updatedAt: t, __defaultsSeeded: true })
  }
  for (const [a, b, label, fs, ts] of RELS) {
    await db.relations.add({ id: uid(), workId, fromId: charIds[a], toId: charIds[b], label, notes: '', fromSide: fs, toSide: ts, updatedAt: t })
  }

  /* ---- 设定幕布树 ---- */
  const mubuIds = {}
  let order = 0
  for (const [text, parent, note] of LORE) {
    const mid = uid(); mubuIds[text] = mid
    await db.mubu.add({ id: mid, workId, parentId: parent ? mubuIds[parent] : null, sortOrder: order++ * 1000, text,
      html: note ? note : null, fold: false, deletedAt: null, createdAt: t, updatedAt: t })
  }

  /* ---- 灵感 ---- */
  for (let i = 0; i < SN.length; i++) {
    await db.snippets.add({ id: uid(), workId, content: SN[i], tags: [], createdAt: t - i * 3600000, updatedAt: t - i * 3600000, deletedAt: null })
  }

  /* ---- 字数日志：近 90 天（柱状图 + 热力图有内容） ---- */
  let d = 0
  while (d < 90) {
    const date = new Date(t - d * 86400000).toISOString().slice(0, 10)
    const n = 2 + ((d * 7919) % 5)
    for (let k = 0; k < n; k++) {
      const delta = 120 + ((d * 131 + k * 977) % 1800)
      await db.wordlog.add({ id: uid(), workId, chapterId: chIds[CHS[(d + k) % CHS.length][1]], date, delta, createdAt: t - d * 86400000 - k * 60000 })
    }
    d += 1
  }

  /* ---- 大纲画布 ---- */
  const N = []
  const add = (o) => { const id = uid(); N.push({ id, workId, parentId: null, refId: null, kind: 'event', title: '', text: '', html: null, fold: false, sortOrder: 0, canvasX: 0, canvasY: 0, w: null, h: null, shape: 'process', pin: false, rels: [], deletedAt: null, createdAt: t, updatedAt: t, ...o }); return id }
  const evId = {}
  for (const [title, shape, x, y, w, h] of CV.events) {
    evId[title] = add({ kind: 'event', title, shape, canvasX: x, canvasY: y, w, h, sortOrder: N.length * 1000 })
  }
  const relAdd = (fromId, toId, o) => {
    const fn = N.find((n) => n.id === fromId)
    const rel = { id: uid(), toId, label: '', kind: '关联', arrows: '->', style: '', fromSide: 'right', toSide: 'left', ...o }
    fn.rels.push(rel)
    return rel
  }
  for (const [a, b, o] of CV.chain) relAdd(evId[a], evId[b], o)

  for (const [title, x, y] of CV.cites) {
    const mid = mubuIds[title]
    const cid = add({ kind: 'cite', refId: mid ? 'mubu:' + mid : null, title, canvasX: x, canvasY: y, w: 150, h: 56, sortOrder: 9000 })
    if (title === '钟楼铜钟') relAdd(cid, evId['钟楼即星图'], { label: '依据', kind: '伏笔', style: 'dashed', fromSide: 'bottom', toSide: 'top' })
    if (title === '界脊') relAdd(cid, evId['第十二响'], { label: '背景', kind: '关联', style: 'dotted', fromSide: 'bottom', toSide: 'top' })
  }
  for (const [type, title, x, y] of CV.anchors) {
    const aid = add({ kind: type === 'volume' ? 'volume' : 'anchor', refId: type === 'volume' ? volIds[title] : chIds[title], title, canvasX: x, canvasY: y, w: 176, h: 56, sortOrder: 9500 })
    if (title.includes('第九章')) relAdd(evId['终局对决'], aid, { label: '收束', kind: '因果', fromSide: 'right', toSide: 'left' })
  }
  for (const [title, text, x, y] of CV.notes) {
    const nid = add({ kind: 'note', title, text, canvasX: x, canvasY: y, w: 190, h: 86, sortOrder: 8000 })
    if (title === '伏笔') relAdd(nid, evId['领航员测试'], { label: '伏笔', kind: '伏笔', style: 'dashed', arrows: '--', fromSide: 'top', toSide: 'bottom' })
    if (title === '悬念') relAdd(nid, evId['白鸦抢先一步'], { label: '呼应', kind: '关联', style: 'dashed', arrows: '--', fromSide: 'top', toSide: 'bottom' })
  }
  const [tbText, tbx, tby] = CV.textbox
  add({ kind: 'textbox', title: '', text: tbText, canvasX: tbx, canvasY: tby, w: 260, h: 76, sortOrder: 8500 })
  const [cTitle, cx, cy, cw, chh, kids] = CV.container
  const contId = add({ kind: 'container', title: cTitle, canvasX: cx, canvasY: cy, w: cw, h: chh, sortOrder: 7000 })
  kids.forEach((txt, i) => add({ kind: 'note', parentId: contId, title: '', text: txt, canvasX: cx + 40 + i * 280, canvasY: cy + 70, w: 240, h: 80, sortOrder: i }))

  await db.olnodes.bulkAdd(N)

  /* ---- 回收站示例（软删除，仅用于截图展示"可恢复"状态） ---- */
  const trashT = t - 3 * 86400000
  await db.chapters.add({ id: uid(), workId, volumeId: volIds[VOLS[0]], title: '废稿 · 旧的开篇', content: '<p>（弃用的开篇方案）</p>', wordCount: 0, status: 'draft', sortOrder: 99, createdAt: trashT, updatedAt: trashT, deletedAt: trashT })
  await db.characters.add({ id: uid(), workId, name: '旧设定 · 无名领航员', role: '龙套', tags: [], aliases: '', content: '', fields: {}, deletedAt: trashT, createdAt: trashT, updatedAt: trashT, __defaultsSeeded: true })
  await db.snippets.add({ id: uid(), workId, content: '灵感：（已弃用的结局方案）林远留在观测站守钟。', tags: [], createdAt: trashT, updatedAt: trashT, deletedAt: trashT })

  /* 标记 olnodes 迁移已完成：否则 migrateOlnodes 的 v1→v2 步骤会把便签（kind:'note'）改写成事件 */
  await db.appconfig.bulkPut([{ key: 'olnodes-mig:' + workId, value: 1 }, { key: 'olnodes-mig2:' + workId, value: 1 }])
  return { workId, chapters: CHS.length, chars: CHARS.length, mubu: LORE.length, nodes: N.length,
    edges: N.reduce((s, n) => s + n.rels.length, 0) }
})()`)

console.log(JSON.stringify(r))
process.exit(0)
