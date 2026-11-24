import assert from 'node:assert/strict'
import { computed, reactive } from 'vue'
import { planLoreMove } from '../src/services/lore-move.js'
import { layoutLoreTree } from '../src/services/lore-tree-layout.js'
import { starterLoreEntries } from '../src/services/lore-entries.js'
import * as loreCore from '../src/services/lore-core.js'

const source = [
  { id: 'a', parentId: null, sortOrder: 0 },
  { id: 'b', parentId: null, sortOrder: 1000 },
  { id: 'child', parentId: 'a', sortOrder: 0 },
  { id: 'leaf', parentId: 'child', sortOrder: 0 }
]
assert.equal(typeof loreCore.indexLoreTree, 'function', 'the shared tree index is available')
const deleted = { id: 'deleted', parentId: 'a', deletedAt: 1 }
const sibling = { id: 'first', parentId: 'a', sortOrder: -1 }
const tree = loreCore.indexLoreTree([deleted, ...source, sibling])
assert.deepEqual(tree.live.map(node => node.id), ['first', 'a', 'child', 'leaf', 'b'])
assert.deepEqual(tree.children.get(null).map(node => node.id), ['a', 'b'])
assert.deepEqual(loreCore.loreDescendants(tree.children, 'a').map(node => node.id), ['first', 'child', 'leaf'])
assert.ok(!tree.byId.has('deleted'))
assert.strictEqual(tree.children.get('a')[1], source[2])

const state = reactive({ nodes: structuredClone(source) })
const indexed = computed(() => loreCore.indexLoreTree(state.nodes))
const initial = indexed.value
state.nodes[2].text = 'Edited'
assert.strictEqual(indexed.value, initial)
state.nodes[2].parentId = 'b'
assert.deepEqual(indexed.value.children.get('b').map(node => node.id), ['child'])
state.nodes[2].deletedAt = 1
assert.ok(!indexed.value.byId.has('child'))
state.nodes[2].deletedAt = null
state.nodes.push({ id: 'new', parentId: 'b', sortOrder: -1 })
assert.deepEqual(indexed.value.children.get('b').map(node => node.id), ['new', 'child'])
state.nodes = [{ id: 'other', sortOrder: 0 }]
assert.deepEqual(indexed.value.live.map(node => node.id), ['other'])

assert.equal(typeof loreCore.loreViewportIndices, 'function', 'the viewport can retain an offscreen editing row')
assert.deepEqual(loreCore.loreViewportIndices([0, 35, 85, 105, 170, 200], 86, 45, 0, [0]), [0, 2, 3])
assert.deepEqual(loreCore.loreViewportIndices([0, 35, 85, 105, 170, 200], 86, 45, 50, [4]), [1, 2, 3, 4])
assert.deepEqual(loreCore.loreViewportIndices([0], 0, 200, 0, []), [])

const move = (id, target, mode) => planLoreMove(source, id, target, mode, { allowRoot: true })
assert.deepEqual(move('a', 'b', 'inside').find(row => row.id === 'a'), { id: 'a', parentId: 'b', sortOrder: 0 })
assert.deepEqual(move('child', null, 'root').find(row => row.id === 'child'), { id: 'child', parentId: null, sortOrder: 2000 })
assert.deepEqual(move('child', 'a', 'before').find(row => row.id === 'child'), { id: 'child', parentId: null, sortOrder: 0 })
assert.deepEqual(move('a', 'leaf', 'inside'), [])
assert.deepEqual(move('a', 'a', 'before'), [])
assert.deepEqual(move('a', 'b', 'before'), [])
assert.deepEqual(planLoreMove(source, 'a', 'b', 'inside'), [])

const entries = new Map([
  ['a', { children: ['child'], imageWidth: 0 }],
  ['b', { children: [], imageWidth: 0 }],
  ['child', { children: ['leaf'], imageWidth: 650 }],
  ['leaf', { children: [], imageWidth: 0 }]
])
const sizes = new Map([['a', { width: 100, height: 70 }], ['child', { width: 650, height: 260 }]])
const layout = mode => layoutLoreTree(['a', 'b'], entries, new Set(), sizes, { mode, centerWidth: 88, centerHeight: 44 })
const single = layout('single')
assert.ok(single.nodes.every(node => node.x > single.center.x))
const double = layout('double')
const at = id => double.nodes.find(node => node.id === id)
assert.ok(at('a').x > double.center.x && at('b').x + at('b').width < double.center.x)
assert.ok(at('leaf').x > at('child').x + at('child').width)
assert.ok(double.edges.every(edge => /^[M][^C]+$/.test(edge.d)))
const doubleCurve = layoutLoreTree(['a', 'b'], entries, new Set(), sizes, { mode: 'double', edgeStyle: 'curve', centerWidth: 88, centerHeight: 44 })
assert.ok(doubleCurve.edges.every(edge => /^M-?\d+ -?\d+C/.test(edge.d)))
assert.ok(double.bounds.x < at('b').x)

let next = 0
const seeds = starterLoreEntries('work', () => 'entry-' + ++next, 10)
assert.deepEqual(seeds.map((row) => row.text), [
  '地理与场所', '社会与势力', '规则与禁忌', '历史与纪年',
  '物件与线索', '民俗与信仰', '科技与造物', '生灵与异类',
  '能力与体系', '典籍与传闻', '货币与资源', '事件与伏笔'
])
assert.ok(seeds.every((row, index) => row.parentId === null && row.workId === 'work' && row.sortOrder === index * 1000 && row.kind))
console.log('自由条目的移动、工作中心布局和起步分类通过')
