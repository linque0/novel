/**
 * 灵感状态细粒度更新与引用稳定性纯逻辑单元测试：
 * 断言修改 selected / scroll / inspector 或 flush 完成时，不替换未变更数组与对象引用，
 * 也不触发无意义写库；并验证相同值 patchState 自动短路。
 */
import assert from 'node:assert/strict'
import { applySnipSnapshot, createSnippetPersistence, sameSnipValue } from '../src/services/snippet-persistence.js'

assert.equal(sameSnipValue(['a', 'b'], ['a', 'b']), true)
assert.equal(sameSnipValue(['a', 'b'], ['a', 'c']), false)
assert.equal(sameSnipValue({ board: { top: 12, left: 0 } }, { board: { top: 12, left: 0 } }), true)
assert.equal(sameSnipValue({ board: { top: 12, left: 0 } }, { board: { top: 24, left: 0 } }), false)

const FIELD_MAP = {
  filter: 'snipFilter', tag: 'snipTag', sort: 'snipSort', group: 'snipGroup',
  query: 'snipQuery', selected: 'snipSelectedId', tagOrder: 'snipTagOrder', order: 'snipOrder',
  inspector: 'snipInspector', scroll: 'snipScroll', cardSize: 'snipCardSize',
  sidebarWidth: 'snipSidebarWidth', expandedGroups: 'snipExpandedGroups'
}

const store = {
  snipStateWorkId: '',
  snipFilter: 'all', snipTag: '', snipSort: 'new', snipGroup: '', snipQuery: '',
  snipSelectedId: '', snipTagOrder: [], snipOrder: [], snipInspector: { journal: true, board: false },
  snipScroll: { journal: { top: 0, left: 0 }, board: { top: 0, left: 0 } },
  snipCardSize: 100, snipSidebarWidth: 220, snipExpandedGroups: [],
  snipDrafts: { quick: '', edit: {} },
  snipPersistence: { reading: false, pending: false, readError: false, writeError: false }
}

const writes = []
const engine = createSnippetPersistence({
  delay: 20,
  read: async (key) => key.startsWith('snipstate:')
    ? { filter: 'all', tagOrder: ['场景构思', '人物弧光'], order: ['n1', 'n2', 'n3'], selected: 'n1', expandedGroups: ['all'] }
    : { quick: '', edit: {} },
  write: async (key, value) => { writes.push({ key, value }) },
  apply: (snapshot) => applySnipSnapshot(store, snapshot, FIELD_MAP)
})

await engine.activate('w1')
assert.equal(store.snipStateWorkId, 'w1')
assert.deepEqual(store.snipTagOrder, ['场景构思', '人物弧光'])
assert.deepEqual(store.snipOrder, ['n1', 'n2', 'n3'])
assert.equal(store.snipSelectedId, 'n1')

const refTagOrder = store.snipTagOrder
const refOrder = store.snipOrder
const refExpanded = store.snipExpandedGroups
const refInspector = store.snipInspector
const refScroll = store.snipScroll
const refDrafts = store.snipDrafts

// 1. 仅切换 selected：其余所有未变数组与对象引用必须保持严格一致
engine.patchState('w1', { selected: 'n2' })
assert.equal(store.snipSelectedId, 'n2')
assert.strictEqual(store.snipTagOrder, refTagOrder, '切换 selected 不应替换 snipTagOrder 引用')
assert.strictEqual(store.snipOrder, refOrder, '切换 selected 不应替换 snipOrder 引用')
assert.strictEqual(store.snipExpandedGroups, refExpanded, '切换 selected 不应替换 snipExpandedGroups 引用')
assert.strictEqual(store.snipInspector, refInspector, '切换 selected 不应替换 snipInspector 引用')
assert.strictEqual(store.snipScroll, refScroll, '切换 selected 不应替换 snipScroll 引用')
assert.strictEqual(store.snipDrafts, refDrafts, '切换 selected 不应替换 snipDrafts 引用')

// 2. flush 落盘后 emit：仍然不得替换未变字段引用
await engine.flush('w1')
assert.equal(writes.length, 1)
assert.strictEqual(store.snipTagOrder, refTagOrder, 'flush 完成不应替换 snipTagOrder 引用')
assert.strictEqual(store.snipOrder, refOrder, 'flush 完成不应替换 snipOrder 引用')
assert.strictEqual(store.snipExpandedGroups, refExpanded, 'flush 完成不应替换 snipExpandedGroups 引用')

// 3. 同值 patchState 自动短路，不触发多余落盘
engine.patchState('w1', { selected: 'n2' })
await engine.flush('w1')
assert.equal(writes.length, 1, '重复设置相同 selected 不应触发二次写库')

// 4. 仅滚动拼板：不替换 tagOrder / order / expandedGroups / inspector
engine.patchState('w1', { scroll: { ...store.snipScroll, board: { top: 240, left: 0 } } })
assert.equal(store.snipScroll.board.top, 240)
assert.strictEqual(store.snipTagOrder, refTagOrder)
assert.strictEqual(store.snipOrder, refOrder)
assert.strictEqual(store.snipExpandedGroups, refExpanded)
assert.strictEqual(store.snipInspector, refInspector)

engine.dispose()
console.log('PASS: 灵感状态细粒度更新与引用稳定性单元测试全部通过！')
