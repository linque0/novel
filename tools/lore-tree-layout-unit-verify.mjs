import assert from 'node:assert/strict'
import fs from 'node:fs'
import { layoutLoreTree, loreActiveFoldLevel, loreFoldedIdsForLevel, loreInitialFoldedIds, loreTreeMaxDepth } from '../src/services/lore-tree-layout.js'
import { parseMubuMd } from '../src/services/importers.js'

const entries = [
  { id: 'a', children: ['b', 'c'], imageWidth: 0 },
  { id: 'b', children: ['d'], imageWidth: 640 },
  { id: 'c', children: ['e'], imageWidth: 0 },
  { id: 'd', children: [], imageWidth: 0 },
  { id: 'e', children: [], imageWidth: 0 },
  { id: 'other', children: [], imageWidth: 0 }
]
const byId = new Map(entries.map(entry => [entry.id, entry]))
const sizes = new Map([
  ['a', { width: 300, height: 420 }],
  ['b', { width: 640, height: 390 }],
  ['c', { width: 90, height: 28 }],
  ['d', { width: 265, height: 300 }],
  ['e', { width: 224, height: 340 }],
  ['other', { width: 210, height: 45 }]
])

const layout = layoutLoreTree(['a', 'other'], byId, new Set(), sizes)
const positions = new Map(layout.nodes.map(node => [node.id, node]))
assert.equal(positions.get('c').x, positions.get('b').x)
assert.equal(positions.get('b').columnWidth, 640)
assert.ok(positions.get('d').x > positions.get('b').x + positions.get('b').width)
assert.ok(positions.get('e').y > positions.get('d').y + positions.get('d').height)
assert.ok(positions.get('other').y > positions.get('a').y + positions.get('a').height)
assert.equal(layout.edges.length, 6)
assert.ok(layout.bounds.x + layout.bounds.w >= positions.get('d').x + positions.get('d').width)
assert.ok(layout.bounds.y + layout.bounds.h >= positions.get('other').y + positions.get('other').height)

const folded = layoutLoreTree(['a'], byId, new Set(['b']), sizes)
assert.ok(!folded.nodes.some(node => node.id === 'd'))
assert.equal(folded.edges.length, 4)
assert.equal(folded.nodes.find(node => node.id === 'b').childCount, 1)

const cycle = new Map([['a', { id: 'a', children: ['a', 'missing'], imageWidth: 0 }]])
assert.equal(layoutLoreTree(['missing', 'a', 'a'], cycle, new Set(), new Map()).nodes.length, 1)

const elbow = layoutLoreTree(['a', 'other'], byId, new Set(), sizes, { edgeStyle: 'elbow' })
assert.ok(elbow.edges.every(edge => /^M-?\d+ -?\d+(?:H|Q|V|\s|-?\d)+$/.test(edge.d) && !edge.d.includes('C')))
assert.ok(elbow.edges.some(edge => edge.d.includes('Q')))
assert.equal(elbow.edges.find(edge => edge.id === 'a').depth, 0)
assert.equal(elbow.edges.find(edge => edge.id === 'b').parentId, 'a')

const curve = layoutLoreTree(['a', 'other'], byId, new Set(), sizes, { mode: 'double', edgeStyle: 'curve' })
assert.ok(curve.edges.every(edge => /^M-?\d+ -?\d+C-?\d+ -?\d+,-?\d+ -?\d+,-?\d+ -?\d+$/.test(edge.d)))
assert.ok(curve.nodes.every(node => Number.isInteger(node.x) && Number.isInteger(node.y)))

const childrenOf = id => byId.get(id)?.children || []
assert.equal(loreTreeMaxDepth(['a', 'other'], childrenOf), 3)
assert.equal(loreTreeMaxDepth(['other'], childrenOf), 1)
assert.equal(loreTreeMaxDepth(['a', 'a'], id => id === 'a' ? ['a'] : []), 1)

const fold0 = loreFoldedIdsForLevel(['a', 'other'], childrenOf, 0)
assert.deepEqual([...fold0].sort(), ['a', 'b', 'c'])
assert.equal(loreActiveFoldLevel(['a', 'other'], childrenOf, fold0), 1)

const fold2 = loreFoldedIdsForLevel(['a', 'other'], childrenOf, 2)
assert.deepEqual([...fold2].sort(), ['b', 'c'])
assert.equal(loreActiveFoldLevel(['a', 'other'], childrenOf, fold2), 2)

const foldAllOpen = loreFoldedIdsForLevel(['a', 'other'], childrenOf, Infinity)
assert.equal(foldAllOpen.size, 0)
assert.equal(loreActiveFoldLevel(['a', 'other'], childrenOf, foldAllOpen), Infinity)
assert.equal(loreActiveFoldLevel(['a', 'other'], childrenOf, new Set(['b'])), null)

// 1. 小树（≤40）：初始全展开
assert.equal(loreInitialFoldedIds(['a', 'other'], childrenOf).size, 0, '小树（6 节点）应全展开')

// 2. 中树（41–150）：收敛至可见节点 ≤ maxVisible 的最深层级（保底 ≥ 2 级）
const medChildren = new Map()
const medRoots = ['r1', 'r2']
for (const r of medRoots) {
  const lv1 = []
  for (let i = 0; i < 4; i++) {
    const id1 = `${r}-${i}`
    lv1.push(id1)
    const lv2 = []
    for (let j = 0; j < 6; j++) {
      const id2 = `${id1}-${j}`
      lv2.push(id2)
      medChildren.set(id2, [`${id2}-leaf`])
    }
    medChildren.set(id1, lv2)
  }
  medChildren.set(r, lv1)
}
// 中树总量：2 + 8 + 48 + 48 = 106 节点；第 2 级可见 2 + 8 = 10 ≤ 48；第 3 级可见 58 > 48 → 应收敛到 2 级
const medChildOf = id => medChildren.get(id) || []
const medFold = loreInitialFoldedIds(medRoots, medChildOf, { maxVisible: 48 })
assert.equal(loreActiveFoldLevel(medRoots, medChildOf, medFold), 2, '中树（106 节点）应收敛至 2 级')

// 若传入深层 activeId，其祖先链应自动展开使其可见
const medFoldWithActive = loreInitialFoldedIds(medRoots, medChildOf, { maxVisible: 48, activeId: 'r1-0-0-leaf' })
assert.ok(!medFoldWithActive.has('r1') && !medFoldWithActive.has('r1-0') && !medFoldWithActive.has('r1-0-0'), 'activeId 的祖先链应自动展开')
assert.ok(medFoldWithActive.has('r1-1'), '非 activeId 分支应保持折叠')

// 3. 大树（>150，真实样本《浮世地域集》1,009 节点）：默认展开至 2 级
const samplePath = 'e:/小小的说/浮世/浮世地域集.md'
if (fs.existsSync(samplePath)) {
  const tree = parseMubuMd(fs.readFileSync(samplePath, 'utf8'))
  const childMap = new Map()
  const textById = new Map()
  let seq = 0
  const ingest = (list) => list.map((node) => {
    const id = 'n' + (++seq)
    textById.set(id, node.text)
    childMap.set(id, ingest(node.children || []))
    return id
  })
  const bigRoots = ingest(tree)
  const bigChildOf = id => childMap.get(id) || []
  const bigFold = loreInitialFoldedIds(bigRoots, bigChildOf)
  assert.equal(loreActiveFoldLevel(bigRoots, bigChildOf, bigFold), 2, '千节点《浮世地域集》初始应折叠至 2 级')

  // 统计可见节点数：应远小于 1009（3 根 + 16 二级 = 19）
  let visibleCount = 0
  const countVis = (id) => {
    visibleCount++
    if (!bigFold.has(id)) for (const c of bigChildOf(id)) countVis(c)
  }
  for (const r of bigRoots) countVis(r)
  assert.ok(visibleCount >= 15 && visibleCount <= 30, `初始展开 2 级后可见节点应约 19 个，实际 ${visibleCount}`)

  // 带 7 层深 activeId（「第一阶段：脱离」）时祖先链全部展开
  const deepId = [...textById.entries()].find(([, txt]) => txt.includes('第一阶段：脱离'))?.[0]
  assert.ok(deepId)
  const bigFoldActive = loreInitialFoldedIds(bigRoots, bigChildOf, { activeId: deepId })
  const reached = new Set()
  const walkVis = (id) => {
    reached.add(id)
    if (!bigFoldActive.has(id)) for (const c of bigChildOf(id)) walkVis(c)
  }
  for (const r of bigRoots) walkVis(r)
  assert.ok(reached.has(deepId), '千节点带 activeId 时目标深层节点应自动可见')
}

// 4. 大树布局间距自适应（>120 可见节点收紧 BRANCH_GAP / ROOT_GAP，≤120 不变）
const makeFlatStar = (count) => {
  const map = new Map()
  const rKids = []
  for (let i = 0; i < count; i++) {
    const id = 'k' + i
    rKids.push(id)
    map.set(id, { id, children: [], imageWidth: 0 })
  }
  map.set('r0', { id: 'r0', children: rKids, imageWidth: 0 })
  return map
}
const small100 = layoutLoreTree(['r0'], makeFlatStar(100), new Set(), new Map())
const big150 = layoutLoreTree(['r0'], makeFlatStar(150), new Set(), new Map())
const gapSmall = small100.nodes.find(n => n.id === 'k1').y - (small100.nodes.find(n => n.id === 'k0').y + small100.nodes.find(n => n.id === 'k0').height)
const gapBig = big150.nodes.find(n => n.id === 'k1').y - (big150.nodes.find(n => n.id === 'k0').y + big150.nodes.find(n => n.id === 'k0').height)
assert.equal(gapSmall, 24, '≤120 可见节点保持原 BRANCH_GAP=24')
assert.equal(gapBig, 14, '>120 可见节点应自动收紧 BRANCH_GAP=14')

console.log('层级导图排布与层级折叠展开计算通过：列宽、内容避让、多根、边界、动态深度、分级折叠、自适应初始折叠与大树紧凑间距')
