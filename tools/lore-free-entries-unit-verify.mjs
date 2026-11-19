import assert from 'node:assert/strict'
import { planLoreMove } from '../src/services/lore-move.js'
import { layoutLoreTree } from '../src/services/lore-tree-layout.js'
import { starterLoreEntries } from '../src/services/lore-entries.js'

const source = [
  { id: 'a', parentId: null, sortOrder: 0 },
  { id: 'b', parentId: null, sortOrder: 1000 },
  { id: 'child', parentId: 'a', sortOrder: 0 },
  { id: 'leaf', parentId: 'child', sortOrder: 0 }
]
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
assert.equal(seeds.length, 6)
assert.ok(seeds.every((row, index) => row.parentId === null && row.workId === 'work' && row.sortOrder === index * 1000 && row.kind))
console.log('自由条目的移动、工作中心布局和起步分类通过')
