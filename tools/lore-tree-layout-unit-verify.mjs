import assert from 'node:assert/strict'
import { layoutLoreTree } from '../src/services/lore-tree-layout.js'

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
console.log('层级导图排布通过：列宽、内容避让、多根、边界、折叠、折线/曲线与缺失节点')
