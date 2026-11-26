/**
 * 正文全文检索纯逻辑单元测试（chapter-search.js）
 */
import assert from 'node:assert/strict'
import {
  buildExcerpts,
  chapterPlainText,
  findCharacterAliasSuggestion,
  findTermOccurrences,
  highlightChapterSegments,
  parseChapterQuery,
  searchChapters
} from '../src/services/chapter-search.js'

let passed = 0
function test(name, fn) {
  fn()
  passed++
  console.log(`  PASS  ${name}`)
}

const volumes = [
  { id: 'v2', title: '第二卷 暗潮', sortOrder: 2000 },
  { id: 'v1', title: '第一卷 启程', sortOrder: 1000 }
]

const chapters = [
  {
    id: 'c3',
    volumeId: 'v2',
    title: '暴雨将至',
    sortOrder: 1000,
    fmt: 'html',
    content: '<p>夜色深沉，老林独自推开钟塔的铁门。</p><p>街角有人低声念起老林的名号。</p>'
  },
  {
    id: 'c1',
    volumeId: 'v1',
    title: '港口的晨雾',
    sortOrder: 1000,
    fmt: 'html',
    content: '<p><strong>林</strong>砚站在甲板上，望着远处的灯塔。</p><p>人群中林砚回过头，说了一句没头没尾的话，随后林砚转身离开。</p>'
  },
  {
    id: 'c2',
    volumeId: 'v1',
    title: '林砚的旧信',
    sortOrder: 2000,
    fmt: 'html',
    content: '<p>这一章正文里没有提到主角名字，只描写了海风与潮汐。</p>'
  },
  {
    id: 'c4',
    volumeId: null,
    title: '番外 钟塔夜话',
    sortOrder: 1000,
    fmt: 'html',
    content: '<p>林砚与故人在钟塔下重逢，聊起砚哥当年的旧事。</p>'
  },
  {
    id: 'c_del',
    volumeId: 'v1',
    title: '废弃章',
    sortOrder: 3000,
    fmt: 'html',
    content: '<p>林砚不应出现在结果中</p>',
    deletedAt: 999
  }
]

const characters = [
  { id: 'ch1', name: '林砚', aliases: '老林 / 砚哥' },
  { id: 'ch2', name: '沈清', aliases: '' }
]

test('chapterPlainText 剥除 HTML 行内标签不拆词且命中缓存', () => {
  const plain1 = chapterPlainText(chapters[1])
  assert.ok(plain1.includes('林砚站在甲板上'), '行内 <strong> 不应拆断「林砚」')
  const plain2 = chapterPlainText(chapters[1])
  assert.equal(plain1, plain2)
})

test('parseChapterQuery 拆分多词并去重小写化', () => {
  assert.deepEqual(parseChapterQuery(''), [])
  assert.deepEqual(parseChapterQuery('  林砚   钟塔  林砚 '), ['林砚', '钟塔'])
})

test('findCharacterAliasSuggestion 命中带别名人物本名或别名，无别名返回 null', () => {
  const s1 = findCharacterAliasSuggestion('林砚', characters)
  assert.ok(s1)
  assert.equal(s1.name, '林砚')
  assert.deepEqual(s1.extraTerms, ['老林', '砚哥'])

  const s2 = findCharacterAliasSuggestion('老林', characters)
  assert.ok(s2)
  assert.equal(s2.name, '林砚')
  assert.deepEqual(s2.extraTerms, ['林砚', '砚哥'])

  assert.equal(findCharacterAliasSuggestion('沈清', characters), null)
  assert.equal(findCharacterAliasSuggestion('不存在', characters), null)
})

test('searchChapters 按全书卷/章序返回正文与标题命中、准确计数并排除删除章', () => {
  const res = searchChapters({
    volumes,
    chapters,
    query: '林砚',
    bookmarkedIds: new Set(['c1'])
  })
  // 全书章序应为 c1 (v1-1) -> c2 (v1-2 标题命中) -> c4 (番外)
  assert.deepEqual(res.results.map(r => r.chapterId), ['c1', 'c2', 'c4'])
  assert.equal(res.results[0].bookmarked, true)
  assert.equal(res.results[0].bodyHitCount, 3)
  assert.equal(res.results[0].volumeTitle, '第一卷 启程')
  assert.ok(res.results[0].excerpts.length >= 1)
  assert.equal(res.results[1].bodyHitCount, 0)
  assert.equal(res.results[1].titleHit, true)
  assert.equal(res.results[2].bodyHitCount, 1)
  assert.equal(res.totalHits, 4)
})

test('searchChapters 支持空格多词 AND 组合与人物别名一键扩展', () => {
  const multi = searchChapters({ volumes, chapters, query: '林砚 钟塔' })
  assert.deepEqual(multi.results.map(r => r.chapterId), ['c4'])

  const alias = findCharacterAliasSuggestion('林砚', characters)
  const expanded = searchChapters({
    volumes,
    chapters,
    query: '林砚',
    aliasSuggestion: alias,
    includeAliases: true
  })
  // 并入「老林、砚哥」后，第二卷「暴雨将至」(c3) 也被纳入，且 c4 同时命中林砚 + 砚哥共 2 处
  assert.deepEqual(expanded.results.map(r => r.chapterId), ['c1', 'c2', 'c3', 'c4'])
  assert.equal(expanded.results[2].bodyHitCount, 2)
  assert.equal(expanded.results[3].bodyHitCount, 2)
})

test('buildExcerpts 跳过重叠窗口并保留精确 occurrenceIndex', () => {
  const text = '林砚抬头。' + '此处相隔很远的一段描写文字用于拉开窗口距离。'.repeat(2) + '林砚再次出现。'
  const occs = findTermOccurrences(text, ['林砚'])
  assert.equal(occs.length, 2)
  const ex = buildExcerpts(text, occs, 2)
  assert.equal(ex.length, 2)
  assert.equal(ex[0].occurrenceIndex, 0)
  assert.equal(ex[1].occurrenceIndex, 1)
})

test('highlightChapterSegments 长词优先与无重叠切分', () => {
  assert.deepEqual(highlightChapterSegments('林砚与老林在夜色中', ['老林', '林砚', '林']), [
    { text: '林砚', mark: true },
    { text: '与', mark: false },
    { text: '老林', mark: true },
    { text: '在夜色中', mark: false }
  ])
})

console.log(`\nALL ${passed}/${passed} chapter-search tests passed.`)
