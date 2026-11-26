/**
 * 设定搜索纯逻辑单元测试（lore-search.js）
 */
import assert from 'node:assert/strict'
import { ancestorPathText, highlightSegments, matchLoreNode, parseLoreQuery, searchLoreNodes } from '../src/services/lore-search.js'

let passed = 0
function test(name, fn) {
  fn()
  passed++
  console.log(`  PASS  ${name}`)
}

const sample = [
  { id: 'r1', parentId: null, text: '世界地理', tags: ['地理'] },
  { id: 'c1', parentId: 'r1', text: '长明城', tags: ['城池', '核心'] },
  { id: 'c2', parentId: 'c1', text: '长明钟塔的古老钟声', tags: ['地标', '长明'] },
  { id: 'r2', parentId: null, text: '神兵谱', tags: ['器物'] },
  { id: 'c3', parentId: 'r2', text: '白霜长剑', tags: ['武器', '长明遗物'] },
  { id: 'c4', parentId: 'r2', text: '关于长明的残页记载', tags: [] },
  { id: 'c5', parentId: 'r2', text: '长明', tags: [] },
  { id: 'del', parentId: 'r1', text: '已删除长明节点', tags: [], deletedAt: 123 }
]
const byId = new Map(sample.map(n => [n.id, n]))

test('parseLoreQuery 拆分、去重与大小写归一', () => {
  assert.deepEqual(parseLoreQuery(''), [])
  assert.deepEqual(parseLoreQuery('   '), [])
  assert.deepEqual(parseLoreQuery('长明'), ['长明'])
  assert.deepEqual(parseLoreQuery('  长明   Alpha  长明  alpha '), ['长明', 'alpha'])
})

test('matchLoreNode 支持正文命中、标签命中与多词元 AND 匹配', () => {
  const m1 = matchLoreNode(sample[4], ['长明', '武器'])
  assert.equal(m1.matched, true)
  assert.equal(m1.textHit, false)
  assert.deepEqual(m1.matchedTags, ['武器', '长明遗物'])

  const m2 = matchLoreNode(sample[4], ['白霜', '长明'])
  assert.equal(m2.matched, true)
  assert.equal(m2.textHit, true)

  const m3 = matchLoreNode(sample[4], ['白霜', '不存在'])
  assert.equal(m3.matched, false)
})

test('searchLoreNodes 相关性排序（完全匹配 > 前缀匹配 > 中间/标签）并排除删除节点', () => {
  const res = searchLoreNodes(sample, byId, '长明')
  assert.equal(res.query, '长明')
  assert.deepEqual(res.tokens, ['长明'])
  assert.equal(res.hits.length, 5)
  assert.equal(res.hitIds.has('del'), false)
  // 完全匹配 "长明" 应在最前，其次为前缀匹配 "长明钟塔..."（文本前缀+标签完全命中）与 "长明城"
  assert.equal(res.hits[0].node.id, 'c2') // 文本前缀 90 + 标签完全匹配 70 = 160
  assert.equal(res.hits[1].node.id, 'c5') // 文本完全匹配 = 120
  assert.equal(res.hits[2].node.id, 'c1') // 文本前缀 = 90
  // keepIds 包含祖先链 r1 和 r2
  assert.equal(res.keepIds.has('r1'), true)
  assert.equal(res.keepIds.has('r2'), true)
  assert.equal(res.hitIds.has('r1'), false)
  assert.equal(res.hitIds.has('r2'), false)
})

test('ancestorPathText 正确生成多级祖先路径且防环', () => {
  assert.equal(ancestorPathText(sample[0], byId), '')
  assert.equal(ancestorPathText(sample[2], byId), '世界地理 › 长明城')
  const loopMap = new Map([
    ['a', { id: 'a', parentId: 'b', text: 'A' }],
    ['b', { id: 'b', parentId: 'a', text: 'B' }]
  ])
  assert.equal(ancestorPathText(loopMap.get('a'), loopMap), 'B')
})

test('highlightSegments 切分、大小写无关与重叠区间合并', () => {
  assert.deepEqual(highlightSegments('长明城的古老长明钟', ['长明']), [
    { text: '长明', mark: true },
    { text: '城的古老', mark: false },
    { text: '长明', mark: true },
    { text: '钟', mark: false }
  ])
  assert.deepEqual(highlightSegments('HelloWorld', ['hello', 'lowo']), [
    { text: 'HelloWo', mark: true },
    { text: 'rld', mark: false }
  ])
  assert.deepEqual(highlightSegments('普通文本', ['无命中']), [
    { text: '普通文本', mark: false }
  ])
})

console.log(`\nALL ${passed}/${passed} lore-search tests passed.`)
