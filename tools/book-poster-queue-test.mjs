import assert from 'node:assert/strict'
import { createPosterQueue } from '../src/services/book3d/poster-queue.js'

const turn = () => new Promise(resolve => setTimeout(resolve, 10))
let renders = [], finish, releases = 0, hidden = false
const queue = createPosterQueue({
  render: job => { renders.push(job.key); return new Promise(resolve => { finish = resolve }) },
  dispose: () => { releases++ }, hidden: () => hidden, maxEntries: 2, maxBytes: 40
})
const retain = queue.retain()
const a = new AbortController(), b = new AbortController()
const first = queue.get({key:'same', signal:a.signal}), second = queue.get({key:'same', signal:b.signal})
await turn(); assert.deepEqual(renders, ['same'], 'duplicate requests share rendering')
a.abort(); assert.equal(await first, null, 'one subscriber cancels independently')
finish('poster-a'); assert.equal(await second, 'poster-a')
assert.equal(await queue.get({key:'same'}), 'poster-a', 'completed results are reused')
retain(); assert.equal(releases, 1, 'last user releases GPU resources')
assert.equal(queue.diagnostics().cachedPosters, 1, 'leaving retains completed images')

const release = queue.retain()
hidden = true
const low = queue.get({key:'low',priority:0}), high = queue.get({key:'high',priority:10})
const c = new AbortController(), cancelled = queue.get({key:'cancelled',signal:c.signal})
c.abort(); assert.equal(await cancelled, null)
await turn(); assert.equal(renders.length, 1, 'hidden pages do not render')
hidden = false; queue.resume(); await turn(); assert.equal(renders.at(-1), 'high', 'hero requests take priority')
finish('poster-b'); await high; await turn(); assert.equal(renders.at(-1),'low'); finish('poster-c'); await low
assert.equal(queue.diagnostics().cachedPosters, 2, 'LRU entry limit is enforced')
const oversized = queue.get({key:'large'}); await turn(); finish('x'.repeat(30)); await oversized
assert.ok(queue.diagnostics().cacheBytes <= 40, 'encoded image memory is bounded')
const bad = queue.get({key:'failure'}); await turn(); finish(null); assert.equal(await bad,null)
const retry = queue.get({key:'failure'}); await turn(); finish('ok'); assert.equal(await retry,'ok', 'failures do not poison retries')
const stale = queue.get({key:'stale'}); await turn(); const staleFinish = finish
release(); assert.equal(await stale,null,'unmount settles outstanding consumers')
staleFinish('old-image'); await turn()
assert.equal(queue.diagnostics().pendingPosters,0)
assert.ok(!queue.has('stale'),'stale completions do not enter cache')
console.log('PASS poster deduplication, subscriber cancellation, visibility, priority, bounded LRU, retry and release')
