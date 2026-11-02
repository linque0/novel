/** Deterministic synthetic projection/search benchmark; no author data, DB, network or AI. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import os from 'node:os'
import { build } from 'esbuild'
import { projectBook, sourceManifest, SOURCE_TABLES } from '../src/services/project/normalize.js'
import { stableStringify } from '../src/services/project/text.js'

// Load the actual queryBook implementation while making accidental I/O fail loudly.
const compiled = await build({ entryPoints: ['src/services/ai/booksource.js'], bundle: true, platform: 'node', format: 'esm', write: false, plugins: [{ name: 'forbid-benchmark-io', setup(b) {
  b.onResolve({ filter: /(?:db\/project-repo\.js|\.\/summarize\.js)$/ }, args => ({ path: args.path, namespace: 'no-io' }))
  b.onLoad({ filter: /.*/, namespace: 'no-io' }, args => ({ contents: args.path.includes('summarize') ? 'export const getChapterSummary=()=>{throw Error("benchmark forbids summaries / I/O")}' : 'export const readProjection=()=>{throw Error("benchmark forbids DB")}' }))
} }] })
const { queryBook } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'))
const sha = value => createHash('sha256').update(stableStringify(value)).digest('hex')
const workId = 'synthetic-creative-benchmark-v1'
const bundle = Object.fromEntries(SOURCE_TABLES.filter(t => t !== 'works').map(t => [t, []]))
bundle.work = { id: workId, title: '千章合成基准', author: 'synthetic', updatedAt: 0 }
bundle.volumes = Array.from({ length: 10 }, (_, i) => ({ id: `volume-${i}`, workId, title: `第${i + 1}卷`, sortOrder: i }))
const body = '林昭沿着河岸寻找铜符，沈青梧在城门记录约定。人物保持此前伤势，机关遵循能量守恒；城中人只能根据亲眼所见判断来客。雨声渐紧，他们回到驿站整理地图，等待下一次行动。\n\n'
bundle.chapters = Array.from({ length: 1000 }, (_, i) => ({ id: `chapter-${String(i).padStart(4, '0')}`, workId, volumeId: `volume-${Math.floor(i / 100)}`, title: `第${i + 1}章 合成事件${i % 17}`, sortOrder: i, fmt: 'text', content: `合成编号${i}。\n\n` + body.repeat(14), updatedAt: 0 }))
bundle.mubu = [{ id: 'rule', workId, text: '能量使用必须付出代价，人物不得凭空获知秘密。', rulePolicy: { scope: 'global', status: 'confirmed' } }]
const chapterChars = bundle.chapters.reduce((n, c) => n + c.content.length, 0)
assert(chapterChars >= 1_000_000)
const memory = () => Object.fromEntries(Object.entries(process.memoryUsage()).map(([key, value]) => [key, Math.round(value / 1048576 * 100) / 100]))
const timed = fn => { const start = performance.now(); const value = fn(); return { value, ms: Number((performance.now() - start).toFixed(3)) } }
const before = memory()
const manifest = timed(() => sourceManifest(bundle))
const projection = timed(() => projectBook(bundle))
const afterProjection = memory()
const stableProjection = model => sha({ manifest: model.manifest, docs: model.docs.map(({ updatedAt, ...doc }) => doc), chunks: model.chunks, issues: model.issues })
const projectionHash = stableProjection(projection.value)
const repeat = timed(() => projectBook(bundle))
assert.equal(stableProjection(repeat.value), projectionHash, 'identical source must produce a stable projection hash')
assert.equal(manifest.value.hash, projection.value.manifest.hash)
const model = projection.value
const chunksByDoc = new Map()
for (const chunk of model.chunks) { if (!chunksByDoc.has(chunk.docId)) chunksByDoc.set(chunk.docId, []); chunksByDoc.get(chunk.docId).push(chunk) }
const session = { work: bundle, docs: model.docs, chunks: model.chunks, edges: [], chunksByDoc, manifest: model.manifest, access: { workId, privacy: false } }
const queries = ['铜符 城门', '伤势 能量守恒', '不存在的星际飞船', '合成事件16']
const searches = queries.map(query => {
  const run = timed(() => queryBook(session, { query, limit: 10, limitTokens: 8000 }))
  assert(run.value.tokens <= 8000)
  assert(run.value.items.length <= 10)
  assert.equal(run.value.sourceRevision, manifest.value.hash)
  return { query, ms: run.ms, matchedChunks: run.value.total, returnedItems: run.value.items.length, tokens: run.value.tokens }
})
console.log(JSON.stringify({ benchmark: workId, inputSha256: sha(bundle), projectionSha256: projectionHash, stableProjectionVerified: true, environment: { node: process.version, platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length }, chapters: bundle.chapters.length, chapterChars, docs: model.docs.length, chunks: model.chunks.length, timingsMs: { sourceManifest: manifest.ms, projectBook: projection.ms, repeatedProjectBook: repeat.ms }, searches, memoryMiB: { before, afterProjection, afterRepeatedProjectionAndSearch: memory() }, limitations: 'Synthetic CPU / process memory measurements only; no DB, embeddings, real AI, UI performance or writing-quality evaluation. Times include normal runtime variation; memory is process snapshots, not a measured peak.' }, null, 2))
