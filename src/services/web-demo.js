/**
 * Web Demo 首次访问展示样书自动预置：
 * 仅在 VITE_WEB_DEMO === 'true'、非 DSH 插件且非 Electron 桌面端时生效；
 * 通过 db.appconfig['web-demo:seeded:v1'] 一次性终态标记保证仅在首次空库时写入 1 本样书，
 * 访客后续删除或清空书架后刷新不会强制重写。
 */
import { db, uid, now } from '../db/database'
import { countWords } from './wordcount'

const DEMO_SEED_KEY = 'web-demo:seeded:v1'
let pendingSeed = null

function localDateOffset(daysAgo) {
  const d = new Date(Date.now() - daysAgo * 86400000)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function dlLink(kind, id, title, label = title) {
  return `<span class="dl-link" data-dl-target="${kind}:${id}" data-dl-title="${title}">${label}</span>`
}

function noteMark(noteId, color, text) {
  return `<span class="note-mark" data-note-id="${noteId}" data-note-color="${color}" style="--note-color:${color}">${text}</span>`
}

async function seedDemoBook() {
  const t = now()
  const workId = uid()

  await db.works.add({
    id: workId,
    title: '星尘旅人',
    author: '林间',
    genre: '科幻',
    status: '连载',
    intro: '星图熄灭的三百年后，一名领航员在界脊之上重新点亮了第一枚铜刻星辰。（在线体验样书，可自由编辑或删除）',
    kind: 'novel',
    lastOpenedAt: t,
    createdAt: t,
    updatedAt: t,
    deletedAt: null
  })

  /* 保持 legacy outlines 为空串，确保大纲模块只加载下面预置的自由画布节点 */
  await db.outlines.add({ id: uid(), workId, level: 'master', refId: workId, content: '', updatedAt: t })

  /* ---- 卷 ---- */
  const volumes = ['第一卷 · 星图初醒', '第二卷 · 雾都钟楼', '第三卷 · 界脊之上']
  const volIds = {}
  for (let i = 0; i < volumes.length; i++) {
    const vid = uid()
    volIds[volumes[i]] = vid
    await db.volumes.add({ id: vid, workId, title: volumes[i], sortOrder: i, createdAt: t, updatedAt: t, deletedAt: null })
  }

  /* ---- 设定幕布树 ---- */
  const loreRows = [
    ['世界观', null, '三百年后星图渐次熄灭，人类航路随之萎缩，世界退回以雾都与界脊为界的狭小版图。'],
    ['界脊', '世界观', '横贯大陆的断崖，古人以为是世界边缘；实为古星图航路的起点，崖壁岩层中嵌有与钟楼同源的铜刻刻线。'],
    ['观测站', '世界观', '建于界脊之上，穹顶内悬三百六十枚铜刻星辰的活星图。'],
    ['三百六十枚铜刻星辰', '观测站', '与钟楼铜钟同源而铸。受到星感牵引会自行明灭，是星图活着的证据。'],
    ['组织与势力', null, ''],
    ['领航员公会', '组织与势力', '垄断星感测试与航路授权的机构，只承认可复现的阈值。'],
    ['星盗舰队', '组织与势力', '以[[白鸦]]为首，在雾都至[[界脊]]的旧航路上劫掠，实为自行探索星图终点。'],
    ['器物与设定', null, ''],
    ['钟楼铜钟', '器物与设定', '雾都城心的巨型铜钟，钟壁刻痕与星图连线完全一致；第十二响可照彻全城之雾。'],
    ['星感阈值', '器物与设定', '衡量领航员与星图共鸣能力的指标。公会记录的历史最高值为 87，[[林远]]测得 143。']
  ]
  const mubuIds = {}
  let mubuOrder = 0
  for (const [text, parent, note] of loreRows) {
    const mid = uid()
    mubuIds[text] = mid
    await db.mubu.add({
      id: mid,
      workId,
      parentId: parent ? mubuIds[parent] : null,
      sortOrder: mubuOrder++ * 1000,
      text,
      html: note || null,
      fold: false,
      deletedAt: null,
      createdAt: t,
      updatedAt: t
    })
  }

  /* ---- 人物与关系图谱 ---- */
  const charSpecs = [
    ['林远', '主角', ['领航员', '星感'], '星图熄灭后第一位重新点亮[[三百六十枚铜刻星辰]]的领航员。寡言，习惯把掌心贴在冰凉的金属上思考。', { 外貌: '瘦高，左眼因星感过载微微泛银', 性格: '沉默、固执，认准方向就不肯回头' }],
    ['沈砚', '配角', ['机械师'], '星舰“凫川号”的机械师。能在任何一艘破船上找出能用的零件，说话比发动机响。', { 外貌: '短发，工装袖口常带机油痕迹', 性格: '直率、嘴硬心软' }],
    ['顾昭', '导师', ['退役舰长'], '凫川号原舰长，把毕生航图交给[[林远]]后，留在[[观测站]]守钟。', { 外貌: '灰白鬓角，右腿旧伤', 性格: '沉稳、关键处一句顶十句' }],
    ['白鸦', '反派', ['星盗首领'], '[[星盗舰队]]首领，也在寻找星图的终点。手段狠厉，却始终没有对[[林远]]下死手。', { 外貌: '常戴半张银面具遮住右颊旧疤', 性格: '冷酷、极有耐心' }],
    ['苏黎', '盟友', ['星图学者'], '最早提出“[[钟楼铜钟]]即星图”猜想的学者，因论文被斥为异端而离开[[领航员公会]]。', { 外貌: '总抱着一卷手抄星图', 性格: '锋利执拗，笑起来极温和' }]
  ]
  const charIds = {}
  for (const [name, role, tags, bio, fields] of charSpecs) {
    const cid = uid()
    charIds[name] = cid
    await db.characters.add({
      id: cid,
      workId,
      name,
      role,
      tags,
      aliases: '',
      content: bio,
      fields,
      avatarAssetId: null,
      deletedAt: null,
      createdAt: t,
      updatedAt: t,
      __defaultsSeeded: true
    })
  }
  const relSpecs = [
    ['林远', '沈砚', '同袍', 'bottom', 'top'],
    ['林远', '顾昭', '师徒', 'top', 'bottom'],
    ['顾昭', '白鸦', '宿敌', 'right', 'left'],
    ['林远', '苏黎', '青梅竹马', 'right', 'left'],
    ['白鸦', '沈砚', '胁迫', 'bottom', 'bottom']
  ]
  for (const [from, to, label, fromSide, toSide] of relSpecs) {
    await db.relations.add({
      id: uid(),
      workId,
      fromId: charIds[from],
      toId: charIds[to],
      label,
      notes: '',
      fromSide,
      toSide,
      updatedAt: t
    })
  }

  /* ---- 设定↔人物 / 设定↔设定 关联关系 ---- */
  await db.lorelinks.bulkAdd([
    { id: uid(), workId, fromKind: 'mubu', fromId: mubuIds['观测站'], toKind: 'character', toId: charIds['顾昭'], label: '驻守', reverseLabel: '驻守之地', description: '顾昭退役后长驻观测站看护星图', color: '', createdAt: t, updatedAt: t },
    { id: uid(), workId, fromKind: 'mubu', fromId: mubuIds['星盗舰队'], toKind: 'character', toId: charIds['白鸦'], label: '首领', reverseLabel: '统领', description: '白鸦率领舰队沿雾都航道追索星图', color: '', createdAt: t, updatedAt: t },
    { id: uid(), workId, fromKind: 'mubu', fromId: mubuIds['钟楼铜钟'], toKind: 'mubu', toId: mubuIds['三百六十枚铜刻星辰'], label: '共振', reverseLabel: '同源', description: '第十二响与观测站星辰同频共振', color: '', createdAt: t, updatedAt: t }
  ])

  /* ---- 多卷章节正文（含双链 + 批注锚点） ---- */
  const noteId1 = uid()
  const noteId2 = uid()
  const chSpecs = [
    [
      '第一卷 · 星图初醒',
      '第一章 · 初雪',
      'draft',
      `<p>穹顶大厅的钟声在雾中回荡了十二下。</p>` +
        `<p>${dlLink('character', charIds['林远'], '林远')}把掌心贴在${dlLink('mubu', mubuIds['观测站'], '观测站')}的铜面上，冰凉的触感顺着腕骨爬上来。${dlLink('mubu', mubuIds['三百六十枚铜刻星辰'], '三百六十枚铜刻星辰')}悬在头顶，一枚接一枚地暗下去——${noteMark(noteId1, '#8e44ad', '像被谁依次吹熄的烛火')}。</p>` +
        `<p>“又熄了一枚。”${dlLink('character', charIds['沈砚'], '沈砚')}在舱门口说，声音里带着机油味，“按这个速度，冬至之前，整张星图会全黑。”</p>` +
        `<p>林远没有回头。他盯着星图上最早熄灭的空位：父亲最后一次出航前曾说，如果有一天它灭了，就往它灭的方向走。</p>`
    ],
    [
      '第一卷 · 星图初醒',
      '第二章 · 领航员',
      'done',
      `<p>${dlLink('mubu', mubuIds['领航员公会'], '领航员公会')}的测试舱只有三步宽。</p>` +
        `<p>林远躺进去时，听见考官争论着${dlLink('mubu', mubuIds['星感阈值'], '星感阈值')}的上限。闭上眼后，黑暗里浮出细密的光点，像退潮滩涂上残留的水光。</p>` +
        `<p>舱门打开时满室寂静，记录仪的数字停在 143——一个没人见过的读数。</p>`
    ],
    [
      '第二卷 · 雾都钟楼',
      '第三章 · 雾中的钟楼',
      'done',
      `<p>雾都一年有三百天泡在雾里。城心的${dlLink('mubu', mubuIds['钟楼铜钟'], '钟楼铜钟')}比雾高出整整一层，铜钟表面覆着青绿的锈，纹路竟与星图连线完全一致。</p>` +
        `<p>${dlLink('character', charIds['苏黎'], '苏黎')}翻开手抄拓片：“这不是报时的钟，这是一份可以行走的星图。”</p>`
    ],
    [
      '第二卷 · 雾都钟楼',
      '第四章 · 白鸦',
      'draft',
      `<p>当林远从钟楼顶端望见雾里三盏并排的信号灯时，便知道来的是${dlLink('character', charIds['白鸦'], '白鸦')}的人。</p>` +
        `<p>${noteMark(noteId2, '#c0392b', '“他们要的不是钟，是钟里那张星图。”')}沈砚握紧了手里的扳手，听见雾海深处传来引擎的低鸣。</p>`
    ],
    [
      '第三卷 · 界脊之上',
      '第五章 · 第十二响',
      'draft',
      `<p>${dlLink('mubu', mubuIds['界脊'], '界脊')}是一道横贯大陆的断崖。冬至正午，第十二响落下时，三百六十枚星辰的光同时落进云海，把浓雾照成了雪。</p>` +
        `<p>${dlLink('character', charIds['顾昭'], '顾昭')}靠在门框上轻声道：“新的航路，终于亮了。”</p>`
    ]
  ]
  const chIds = {}
  const chOrder = {}
  for (let i = 0; i < chSpecs.length; i++) {
    const [vol, title, status, html] = chSpecs[i]
    const cid = uid()
    chIds[title] = cid
    chOrder[vol] = chOrder[vol] || 0
    const at = t - (chSpecs.length - i) * 86400000
    await db.chapters.add({
      id: cid,
      workId,
      volumeId: volIds[vol],
      title,
      fmt: 'html',
      content: html,
      wordCount: countWords(html.replace(/<[^>]+>/g, '')),
      status,
      sortOrder: chOrder[vol]++,
      createdAt: at,
      updatedAt: at,
      deletedAt: null
    })
  }

  /* ---- 正文批注 ---- */
  await db.annotations.bulkAdd([
    {
      id: uid(),
      workId,
      chapterId: chIds['第一章 · 初雪'],
      noteId: noteId1,
      text: '像被谁依次吹熄的烛火',
      note: '伏笔：星辰熄灭的顺序对应后续界脊航道封锁的坐标顺序。',
      color: '#8e44ad',
      kind: 'foreshadow',
      createdAt: t - 3600000,
      updatedAt: t - 3600000,
      deletedAt: null
    },
    {
      id: uid(),
      workId,
      chapterId: chIds['第四章 · 白鸦'],
      noteId: noteId2,
      text: '“他们要的不是钟，是钟里那张星图。”',
      note: '待扩写：补充白鸦与顾昭旧案的对峙台词，拉高冲突张力。',
      color: '#c0392b',
      kind: 'revise',
      createdAt: t - 1800000,
      updatedAt: t - 1800000,
      deletedAt: null
    }
  ])

  /* ---- 灵感卡片 ---- */
  const snippets = [
    { content: '钟楼的第十二响不是声音，而是三百六十枚星辰共振的光。', tags: ['核心设定', '高潮'] },
    { content: '白鸦的银面具内侧，其实刻着半张北境失联航图。', tags: ['人物伏笔'] },
    { content: '父亲的航海日志最后一页，墨迹比前面几页都新。', tags: ['悬念'] },
    { content: '试着在第三卷加入“静默航行”段落：关闭引擎，只靠星感听潮汐回声。', tags: ['桥段构思'] }
  ]
  for (let i = 0; i < snippets.length; i++) {
    await db.snippets.add({
      id: uid(),
      workId,
      content: snippets[i].content,
      tags: snippets[i].tags,
      createdAt: t - i * 3600000,
      updatedAt: t - i * 3600000,
      deletedAt: null
    })
  }

  /* ---- 近 7 天写作统计日志 ---- */
  const deltas = [2480, 1820, 3150, 960, 2740, 1980, 3420]
  const chList = Object.values(chIds)
  for (let d = 0; d < 7; d++) {
    const date = localDateOffset(6 - d)
    await db.wordlog.add({
      id: uid(),
      workId,
      chapterId: chList[d % chList.length],
      date,
      delta: deltas[d],
      createdAt: t - (6 - d) * 86400000
    })
  }

  /* ---- 大纲自由画布节点与语义连线 ---- */
  const nodes = []
  const addNode = (o) => {
    const id = uid()
    nodes.push({
      id,
      workId,
      parentId: null,
      refId: null,
      kind: 'event',
      title: '',
      text: '',
      html: null,
      fold: false,
      sortOrder: nodes.length * 1000,
      canvasX: 0,
      canvasY: 0,
      w: null,
      h: null,
      shape: 'process',
      pin: false,
      status: 'planned',
      rels: [],
      deletedAt: null,
      createdAt: t,
      updatedAt: t,
      ...o
    })
    return id
  }
  const addRel = (fromId, toId, o = {}) => {
    const from = nodes.find((n) => n.id === fromId)
    if (!from) return
    from.rels.push({
      id: uid(),
      toId,
      label: '',
      kind: '关联',
      arrows: '->',
      style: '',
      fromSide: 'right',
      toSide: 'left',
      ...o
    })
  }

  const e1 = addNode({ title: '铜星依次熄灭', shape: 'process', canvasX: 120, canvasY: 320, text: '观测站铜星一枚接一枚暗下，冬至前整张星图将全黑。', status: 'done' })
  const e2 = addNode({ title: '领航员测试', shape: 'diamond', canvasX: 430, canvasY: 320, text: '林远在测试舱测出 143 的异常星感阈值。', status: 'done' })
  const e3 = addNode({ title: '钟楼即星图', shape: 'ellipse', canvasX: 740, canvasY: 320, text: '雾都钟楼铜钟刻痕与观测站星图连线完全吻合。', status: 'writing' })
  const e4 = addNode({ title: '白鸦抢先一步', shape: 'para', canvasX: 1050, canvasY: 320, text: '星盗白鸦率舰抵达钟楼，三方围绕第十二响展开争夺。', status: 'revise' })
  const e5 = addNode({ title: '第十二响归位', shape: 'process', canvasX: 1360, canvasY: 320, text: '界脊之上三百六十枚铜刻星辰重新亮起。', status: 'planned' })

  addRel(e1, e2, { label: '触发', kind: '因果' })
  addRel(e2, e3, { label: '发现', kind: '关联', style: 'dashed' })
  addRel(e3, e4, { label: '对抗', kind: '冲突', arrows: '<->' })
  addRel(e4, e5, { label: '转折', kind: '因果' })

  const cite1 = addNode({ kind: 'cite', refId: 'mubu:' + mubuIds['钟楼铜钟'], title: '钟楼铜钟', canvasX: 740, canvasY: 130, w: 156, h: 56 })
  const cite2 = addNode({ kind: 'cite', refId: 'mubu:' + mubuIds['界脊'], title: '界脊', canvasX: 1360, canvasY: 130, w: 140, h: 56 })
  addRel(cite1, e3, { label: '依据', kind: '伏笔', style: 'dashed', fromSide: 'bottom', toSide: 'top' })
  addRel(cite2, e5, { label: '舞台', kind: '关联', style: 'dotted', fromSide: 'bottom', toSide: 'top' })

  const anc1 = addNode({ kind: 'volume', refId: volIds['第一卷 · 星图初醒'], title: '第一卷 · 星图初醒', canvasX: 120, canvasY: 130, w: 184, h: 56 })
  const anc2 = addNode({ kind: 'anchor', refId: chIds['第五章 · 第十二响'], title: '第五章 · 第十二响', canvasX: 1050, canvasY: 130, w: 184, h: 56 })
  addRel(anc1, e1, { label: '开篇', kind: '关联', fromSide: 'bottom', toSide: 'top' })
  addRel(e4, anc2, { label: '收束', kind: '因果', fromSide: 'top', toSide: 'bottom' })

  const note1 = addNode({ kind: 'note', title: '伏笔', text: '父亲航海日志最后一页墨迹比前面都新。', canvasX: 430, canvasY: 530, w: 200, h: 86 })
  addRel(note1, e2, { label: '呼应', kind: '伏笔', style: 'dashed', arrows: '--', fromSide: 'top', toSide: 'bottom' })

  addNode({ kind: 'textbox', title: '', text: '全书主旋律：熄灭 → 寻路 → 点亮', canvasX: 740, canvasY: 550, w: 260, h: 72 })

  const contId = addNode({ kind: 'container', title: '角色线 · 对照组', canvasX: 120, canvasY: 540, w: 260, h: 170 })
  addNode({ kind: 'note', parentId: contId, title: '', text: '[[林远]]：从守望到启航', canvasX: 140, canvasY: 600, w: 220, h: 46, sortOrder: 0 })
  addNode({ kind: 'note', parentId: contId, title: '', text: '[[白鸦]]：追索同源星图真相', canvasX: 140, canvasY: 654, w: 220, h: 46, sortOrder: 1 })

  await db.olnodes.bulkAdd(nodes)
  await db.appconfig.bulkPut([
    { key: 'olnodes-mig:' + workId, value: 1 },
    { key: 'olnodes-mig2:' + workId, value: 1 },
    { key: 'olcanvas:' + workId, value: { snap: true, density: 'detail', edgeStyle: 'ortho', edgeWidth: 1.8, arrowSize: 1 } }
  ])
}

export async function ensureWebDemoSeeded() {
  if (import.meta.env.VITE_WEB_DEMO !== 'true') return false
  if (typeof __NS_PLUGIN__ !== 'undefined' && __NS_PLUGIN__) return false
  if (typeof window !== 'undefined' && window.native?.isElectron) return false

  if (pendingSeed) return pendingSeed
  pendingSeed = (async () => {
    try {
      const done = await db.appconfig.get(DEMO_SEED_KEY)
      if (done?.value) return false
      const liveWorks = (await db.works.toArray()).filter((w) => !w.deletedAt)
      if (liveWorks.length > 0) {
        await db.appconfig.put({ key: DEMO_SEED_KEY, value: true })
        return false
      }
      await seedDemoBook()
      await db.appconfig.put({ key: DEMO_SEED_KEY, value: true })
      return true
    } finally {
      pendingSeed = null
    }
  })()
  return pendingSeed
}
