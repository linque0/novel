import assert from 'node:assert/strict'
import {
  cardScaleFor,
  outlineCardLayout,
  outlineDraftCardLayout,
  outlineEventLayout
} from '../src/components/outline/card-layout.js'

let passed = 0
function test(name, fn) {
  fn()
  passed++
  console.log('PASS ' + name)
}

test('cardScaleFor clamps bounds and weighs short side on non-uniform resize', () => {
  assert.equal(cardScaleFor({ w: 204, h: 141 }, 'event', 'process'), 1)
  assert.equal(cardScaleFor({ w: 800, h: 800 }, 'event', 'process'), 2)
  assert.equal(cardScaleFor({ w: 100, h: 60 }, 'event', 'process'), 0.82)
  const tallOnly = cardScaleFor({ w: 204, h: 282 }, 'event', 'process')
  const bothScaled = cardScaleFor({ w: 306, h: 211.5 }, 'event', 'process')
  assert.ok(tallOnly > 1.05 && tallOnly < 1.25, `unexpected tallOnly scale: ${tallOnly}`)
  assert.ok(Math.abs(bothScaled - 1.5) < 0.02, `unexpected bothScaled: ${bothScaled}`)
})

test('outlineEventLayout process eliminates top void and expands summary lines', () => {
  const def = outlineEventLayout('process', { w: 204, h: 141 }, {
    status: '已完成',
    association: '第一章',
    relations: '2 条关系',
    action: true,
    hasSummary: true,
    title: '松烟负二层脱离'
  })
  assert.equal(def.centered, false)
  assert.equal(def.summaryFont, 12.5)
  assert.equal(def.font, 16)
  assert.ok(def.top && def.bottom && def.summary)
  const topGap = def.title.y - (def.top.y + def.metaLine)
  assert.ok(topGap >= 5 && topGap <= 12, `top->title gap should be compact, got ${topGap}`)
  assert.ok(def.summary.lines >= 2, `default 224x154 should fit >=2 lines, got ${def.summary.lines}`)
  assert.ok(def.summary.y >= def.title.y + def.title.height)
  assert.ok(def.summary.y + def.summary.lines * def.summaryLine <= def.bottom.y)

  const big = outlineEventLayout('process', { w: 300, h: 320 }, {
    status: '已完成',
    association: '第一章',
    relations: '2 条关系',
    action: true,
    hasSummary: true,
    title: '松烟负二层脱离'
  })
  assert.ok(big.font > def.font, `title should scale up: ${big.font} vs ${def.font}`)
  assert.ok(big.summaryFont > def.summaryFont, `summaryFont should scale up: ${big.summaryFont} vs ${def.summaryFont}`)
  assert.ok(big.metaFont > def.metaFont, `metaFont should scale up: ${big.metaFont} vs ${def.metaFont}`)
  assert.ok(big.summary.lines > 3, `tall enlarged card should break past old 3-line cap, got ${big.summary.lines}`)
  const bigTopGap = big.title.y - (big.top.y + big.metaLine)
  assert.ok(bigTopGap >= 6 && bigTopGap <= 20, `enlarged top->title gap should stay compact, got ${bigTopGap}`)
})

test('outlineEventLayout process without summary stays balanced, mini 208x112 fits cleanly', () => {
  const noSum = outlineEventLayout('process', { w: 224, h: 154 }, {
    status: '待定',
    association: '第一章',
    relations: '',
    action: true,
    hasSummary: false,
    title: '短标题'
  })
  assert.equal(noSum.summary, null)
  assert.ok(noSum.title.y > noSum.top.y + noSum.metaLine + 16)

  const mini = outlineEventLayout('process', { w: 208, h: 112 }, {
    status: '进行中',
    association: '第二章',
    relations: '1 条关系',
    action: true,
    hasSummary: true,
    title: '容器事件'
  })
  assert.ok(mini.top && mini.bottom)
  assert.ok(mini.title.y >= mini.top.y + mini.metaLine)
  assert.ok(mini.title.y + mini.title.height <= mini.bottom.y)
})

test('outlineEventLayout diamond and ellipse remain centered and scale smoothly', () => {
  const dDef = outlineEventLayout('diamond', { w: 250, h: 210 }, {
    status: '进行中',
    association: '第一章',
    relations: '2 条关系',
    action: true,
    hasSummary: true,
    title: '建木突入'
  })
  assert.equal(dDef.centered, true)
  assert.ok(dDef.top && dDef.bottom)

  const dBig = outlineEventLayout('diamond', { w: 400, h: 336 }, {
    status: '进行中',
    association: '第一章',
    relations: '2 条关系',
    action: true,
    hasSummary: true,
    title: '建木突入'
  })
  assert.ok(dBig.font > dDef.font && dBig.summaryFont > dDef.summaryFont)
  assert.ok(dBig.summary && dBig.summary.lines >= 1, `diamond summary should fit >=1 scaled line, got ${dBig.summary?.lines}`)

  const eBig = outlineEventLayout('ellipse', { w: 340, h: 200 }, {
    status: '已完成',
    association: '第二章',
    relations: '1 条关系',
    action: true,
    hasSummary: true,
    title: '节点波动'
  })
  assert.equal(eBig.centered, true)
  assert.ok(eBig.summaryFont > 15 && eBig.top && eBig.bottom)
})

test('outlineCardLayout scales cite & volume fonts and summary lines', () => {
  const citeDef = outlineCardLayout({ w: 178, h: 128 }, { kind: 'cite', title: '人物档案' })
  const citeBig = outlineCardLayout({ w: 340, h: 250 }, { kind: 'cite', title: '人物档案' })
  assert.ok(citeDef.summaryFont >= 12.5)
  assert.ok(citeBig.font > citeDef.font && citeBig.summaryFont > citeDef.summaryFont && citeBig.metaFont > citeDef.metaFont)
  assert.ok(citeBig.summaryLines >= citeDef.summaryLines)

  const volDef = outlineCardLayout({ w: 190, h: 128 }, { kind: 'volume', title: '第一卷' })
  const volBig = outlineCardLayout({ w: 320, h: 210 }, { kind: 'volume', title: '第一卷' })
  assert.ok(volBig.font > volDef.font && volBig.summaryFont > volDef.summaryFont && volBig.metaFont > volDef.metaFont)
})

test('outlineDraftCardLayout scales note & anchor typography and clamps bodyLines dynamically', () => {
  const noteDef = outlineDraftCardLayout({ w: 178, h: 128 }, { kind: 'note', title: '田野笔记' })
  const noteTall = outlineDraftCardLayout({ w: 260, h: 280 }, { kind: 'note', title: '田野笔记' })
  assert.equal(noteDef.bodyFont, 12)
  assert.ok(noteTall.bodyFont > noteDef.bodyFont && noteTall.titleFont > noteDef.titleFont && noteTall.metaFont > noteDef.metaFont)
  assert.ok(noteTall.bodyLines > noteDef.bodyLines, `expected more lines when stretched tall: ${noteTall.bodyLines} vs ${noteDef.bodyLines}`)

  const anchorDef = outlineDraftCardLayout({ w: 178, h: 128 }, { kind: 'anchor', title: '第一章' })
  const anchorBig = outlineDraftCardLayout({ w: 260, h: 260 }, { kind: 'anchor', title: '第一章' })
  assert.ok(anchorBig.bodyFont > anchorDef.bodyFont && anchorBig.titleFont > anchorDef.titleFont && anchorBig.bodyLines > anchorDef.bodyLines, `anchor lines: ${anchorBig.bodyLines} vs ${anchorDef.bodyLines}`)
})

test('no-title cards omit title slot, boost body font, and preserve empty placeholder', () => {
  const evWithTitle = outlineEventLayout('process', { w: 204, h: 141 }, {
    association: '第一章',
    relations: '2 条关系',
    action: true,
    hasSummary: true,
    title: '有标题'
  })
  const evNoTitle = outlineEventLayout('process', { w: 204, h: 141 }, {
    association: '第一章',
    relations: '2 条关系',
    action: true,
    hasSummary: true,
    title: '',
    hasTitle: false,
    topRightWidth: 46
  })
  assert.equal(evNoTitle.hasTitle, false)
  assert.equal(evNoTitle.title, null)
  assert.ok(evNoTitle.summaryFont >= 14.5 && evNoTitle.summaryFont > evWithTitle.summaryFont)
  assert.ok(evNoTitle.summary && evNoTitle.summary.lines >= 3, `no-title event should fit >=3 lines, got ${evNoTitle.summary?.lines}`)
  assert.ok(evNoTitle.summary.y <= evWithTitle.title.y + 2, `no-title summary should start near top slot`)
  assert.ok(evNoTitle.summary.y + evNoTitle.summary.lines * evNoTitle.summaryLine <= evNoTitle.bottom.y)

  const evEmpty = outlineEventLayout('process', { w: 204, h: 141 }, {
    association: '未关联章节',
    relations: '',
    action: true,
    hasSummary: false,
    title: '',
    hasTitle: false
  })
  assert.equal(evEmpty.title, null)
  assert.equal(evEmpty.summary, null)
  assert.ok(evEmpty.empty && evEmpty.empty.y > evEmpty.top.y)

  const dNoTitle = outlineEventLayout('diamond', { w: 250, h: 210 }, {
    association: '第一章',
    relations: '',
    action: true,
    hasSummary: true,
    title: '',
    hasTitle: false
  })
  assert.equal(dNoTitle.title, null)
  assert.ok(dNoTitle.summary && dNoTitle.summaryFont >= 14.5 && dNoTitle.summary.lines >= 2)

  const noteWithTitle = outlineDraftCardLayout({ w: 178, h: 128 }, { kind: 'note', title: '标题', hasTitle: true })
  const noteNoTitle = outlineDraftCardLayout({ w: 178, h: 128 }, { kind: 'note', title: '', hasTitle: false })
  assert.equal(noteNoTitle.hasTitle, false)
  assert.ok(noteNoTitle.bodyFont >= 14.5 && noteNoTitle.bodyFont > noteWithTitle.bodyFont)
  assert.ok(noteNoTitle.bodyLines >= 3, `no-title note should reclaim title space, got ${noteNoTitle.bodyLines}`)
})

test('content-aware auto-fill scales font up for short/medium text, shrinks gracefully for long text, and caps aesthetically', () => {
  const shortText = '危机爆发'
  const medText = '病毒谣言引发支点撬动，苏明远以牵星实施温和覆写，周砚用息壤一夜重建塌陷街区。'
  const longText = '第一行休谟指数骤降记录\n第二行全校记忆偏差核查\n第三行地下十三阶入口封锁\n第四行守夜人临时应急预案\n第五行异常因果回弹观测结果\n第六行额外长文用于校验溢出撑满'

  // Same 260x190 no-title event card: short >= med > long
  const evShort = outlineEventLayout('process', { w: 260, h: 190 }, {
    association: '第五章', relations: '4 条关系', action: true, hasTitle: false, title: '', summary: shortText
  })
  const evMed = outlineEventLayout('process', { w: 260, h: 190 }, {
    association: '第五章', relations: '4 条关系', action: true, hasTitle: false, title: '', summary: medText
  })
  const evLong = outlineEventLayout('process', { w: 260, h: 190 }, {
    association: '第五章', relations: '4 条关系', action: true, hasTitle: false, title: '', summary: longText
  })
  assert.ok(evShort.summaryFont <= 26 && evShort.summaryFont >= 22, `short text should cap aesthetically: ${evShort.summaryFont}`)
  assert.ok(evMed.summaryFont >= 17.5 && evMed.summaryFont < evShort.summaryFont, `37-char card should fill aggressively: ${evMed.summaryFont}`)
  assert.ok(evLong.summaryFont < evMed.summaryFont && evLong.summaryFont >= 11, `long text shrinks gracefully: ${evLong.summaryFont}`)
  assert.ok(evShort.summary.y > evShort.top.y + evShort.metaLine + 20, `short text should vertically center`)

  // Titled event maintains title > summary hierarchy (~1.2x)
  const evTitledMed = outlineEventLayout('process', { w: 280, h: 210 }, {
    association: '第五章', relations: '2 条关系', action: true, hasTitle: true, title: '松烟负二层脱离', summary: medText
  })
  assert.ok(evTitledMed.font >= evTitledMed.summaryFont * 1.18, `title/body hierarchy broken: ${evTitledMed.font} vs ${evTitledMed.summaryFont}`)

  // Draft note: short text gets larger font and centers; long text uses smaller font and top-aligns
  const noteShort = outlineDraftCardLayout({ w: 240, h: 200 }, { kind: 'note', title: '', summary: shortText, hasTitle: false })
  const noteLong = outlineDraftCardLayout({ w: 240, h: 200 }, { kind: 'note', title: '', summary: longText, hasTitle: false })
  assert.ok(noteShort.bodyFont > noteLong.bodyFont && noteShort.bodyFont <= 26)
  assert.equal(noteShort.justify, 'center')
  assert.equal(noteLong.justify, 'flex-start')
})

console.log(`card-layout: ${passed} checks passed`)
