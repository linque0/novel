import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Schema } from '@tiptap/pm/model'
import { captureWritingAnchor, validateWritingAnchor } from '../src/services/ai/writing-anchor.js'
import { chapterHash, rowHash } from '../src/services/project/text.js'
import { taskApplyActions } from '../src/services/ai/task-profiles.js'

// Exercise the actual application implementation with in-memory dependencies.
// No browser/CDP session, database, filesystem write, provider or model is used.
// Hashes, task permissions and writing-anchor validation use production helpers.
const source = (await readFile(new URL('../src/services/ai/application.js', import.meta.url), 'utf8'))
  .replace(/^import .*\r?\n/gm, '')
  .replace(/^export /gm, '')
const schema = new Schema({ nodes: { doc: { content: 'paragraph+' }, paragraph: { content: 'text*' }, text: {} } })
const clone = value => JSON.parse(JSON.stringify(value))
const unexpected = name => () => { throw new Error('Unexpected dependency call: ' + name) }

async function scenario(mutateWhileSaving) {
  const work = {
    work: { id: 'race-work' },
    chapters: [
      { id: 'chapter-a', workId: 'race-work', title: '甲章', fmt: 'text', content: '甲章原文。' },
      { id: 'chapter-b', workId: 'race-work', title: '乙章', fmt: 'text', content: '乙章珍贵原文。' },
    ],
    outlines: [], olnodes: [], mubu: [], characters: [], relations: [],
    selChapterId: 'chapter-a', olUndo: [], olRedo: [],
  }
  let rollbackCalls = 0
  function editorFor(chapter) {
    let doc = schema.node('doc', null, [schema.node('paragraph', null, schema.text(chapter.content))])
    const editor = {
      isDestroyed: false, isEditable: true,
      get state() { return { doc, selection: { from: 1, to: 1, empty: true } } },
      getJSON: () => doc.toJSON(),
      getHTML: () => '<p>' + chapter.content + '</p>',
      commands: {
        setContent(value) {
          rollbackCalls++
          doc = schema.nodeFromJSON(value)
          chapter.content = doc.textContent
        },
      },
      userInput(text) {
        chapter.content = text
        doc = schema.node('doc', null, [schema.node('paragraph', null, schema.text(text))])
      },
      // Both races must be rejected before any AI editor transaction begins.
      chain: unexpected('editor.chain'),
    }
    return editor
  }
  const editorA = editorFor(work.chapters[0]), editorB = editorFor(work.chapters[1])
  const priorWindow = globalThis.window
  globalThis.window = { __ns: { editor: editorA } }
  let snapshotPending = false, mutationInjected = false
  const autosave = {
    mark(table, row, options = {}) { if (table === 'chapters' && options.forceSnapshot) snapshotPending = true },
    async flushAll() {
      if (!snapshotPending || mutationInjected) return
      snapshotPending = false
      // A microtask boundary stands in for the asynchronous storage flush.
      await Promise.resolve()
      mutationInjected = true
      mutateWhileSaving({ work, editorA, editorB })
    },
  }
  const dependencies = {
    nextTick: async () => {}, autosave, isPopped: () => false,
    db: { table: table => ({ get: async id => clone(work[table].find(row => row.id === id)) }) },
    uid: () => crypto.randomUUID(), putAiRow: unexpected('putAiRow'), aiRows: async () => [],
    leaseJob: async () => true, updateJob: async () => {},
    entityHash: rowHash, chapterHash, clone, namesOf: () => [], ordered: () => work.chapters,
    fingerprint: unexpected('fingerprint'), sourceManifest: unexpected('sourceManifest'),
    readSourceSnapshot: unexpected('readSourceSnapshot'),
    applyWorkflow: unexpected('applyWorkflow'), undoWorkflow: unexpected('undoWorkflow'),
    taskApplyActions, validateWritingAnchor, markChapterStale: unexpected('markChapterStale'),
    closeHistory: unexpected('closeHistory'),
  }
  const { applyProposal } = Function(...Object.keys(dependencies), source + '\nreturn { applyProposal }')(...Object.values(dependencies))
  const anchor = captureWritingAnchor(editorA, {
    workId: work.work.id, chapterId: work.chapters[0].id, chapter: work.chapters[0], mode: 'insert',
  })
  const card = {
    id: 'race-candidate', kind: 'draft', task: 'plot', taskType: 'chapter.continue',
    workId: work.work.id, anchorId: work.chapters[0].id, sourceHash: chapterHash(work.chapters[0]),
    source: { taskRequest: { type: 'chapter.continue', writingAnchor: anchor } },
    complete: true, status: 'draft', text: 'AI 候选正文。',
  }
  try {
    let failure
    try { await applyProposal(work, card, { action: 'insert' }) } catch (error) { failure = error }
    assert.equal(mutationInjected, true, 'the race must happen during the application snapshot flush')
    assert.ok(failure, 'a changed target/source must reject the old candidate')
    assert.match(failure.message, /目标已变化|生成依据已变化|来源已变化|正文已变化/)
    assert.equal(card.status, 'draft', 'the refused candidate must remain unapplied')
    return { work, editorA, editorB, rollbackCalls }
  } finally {
    if (priorWindow === undefined) delete globalThis.window
    else globalThis.window = priorWindow
  }
}

const cases = [
  ['switching chapters during save preserves both chapters', async () => {
    const result = await scenario(({ work, editorA, editorB }) => {
      work.selChapterId = 'chapter-b'
      editorA.isDestroyed = true
      globalThis.window.__ns.editor = editorB
    })
    assert.equal(result.work.chapters.find(row => row.id === 'chapter-a').content, '甲章原文。')
    assert.equal(result.work.chapters.find(row => row.id === 'chapter-b').content, '乙章珍贵原文。')
    assert.equal(result.editorB.state.doc.textContent, '乙章珍贵原文。')
    assert.equal(result.rollbackCalls, 0, 'validation failure must not restore an untouched editor')
  }],
  ['typing in the same chapter during save preserves new author text', async () => {
    const result = await scenario(({ editorA }) => editorA.userInput('甲章原文。作者等待时新增的内容。'))
    assert.equal(result.work.chapters.find(row => row.id === 'chapter-a').content, '甲章原文。作者等待时新增的内容。')
    assert.equal(result.editorA.state.doc.textContent, '甲章原文。作者等待时新增的内容。')
    assert.equal(result.rollbackCalls, 0, 'validation failure must not remove concurrent author input')
  }],
]
let passed = 0
for (const [name, run] of cases) {
  try { await run(); passed++; console.log('PASS ' + name) }
  catch (error) { console.error('FAIL ' + name + '\n' + error.stack) }
}
console.log(`${passed}/${cases.length} writing application race checks passed`)
if (passed !== cases.length) process.exitCode = 1
