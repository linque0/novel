import assert from 'node:assert/strict'
import { createWorkerClient, workerDiagnostics } from '../src/services/book3d/worker-client.js'

const instances = []
globalThis.OffscreenCanvas = class {}
globalThis.Worker = class {
  constructor() { instances.push(this) }
  postMessage(message) { this.message = message }
  terminate() { this.terminated = true }
  reply(value, stats = { frames: 1, viewers: 0, posterRenderers: 1, models: 1 }) { this.onmessage({ data: { id: this.message.id, value, stats } }) }
}
let failures = 0
const client = createWorkerClient(() => failures++), worker = instances.at(-1)
const request = client.request('poster', { book: {} }); worker.reply('image')
assert.equal(await request, 'image')
assert.equal(workerDiagnostics().workers, 1)
assert.equal(workerDiagnostics().models, 1)
const abort = new AbortController(), cancelled = client.request('poster', {}, { signal: abort.signal })
const rejected = assert.rejects(cancelled, /cancelled/); abort.abort(); await rejected
worker.reply('late-result')
const pending = client.request('capture', {}), released = assert.rejects(pending, /released/)
client.dispose(); client.dispose(); await released
assert.equal(workerDiagnostics().workers, 0)
assert.equal(workerDiagnostics().models, 0)
assert.equal(worker.terminated, true)

const broken = createWorkerClient(() => failures++), brokenWorker = instances.at(-1)
const failing = assert.rejects(broken.request('init', {}), /GPU unavailable/)
brokenWorker.onerror({ message:'GPU unavailable', preventDefault() {} }); await failing
assert.equal(failures, 1)
assert.equal(workerDiagnostics().workers, 0)

const timed = createWorkerClient(() => failures++)
const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout
let timeout, duration
try {
  globalThis.setTimeout = (fn, ms) => { timeout = fn; duration = ms; return 1 }
  globalThis.clearTimeout = () => {}
  const expires = assert.rejects(timed.request('init', {}), /timed out/)
  assert.equal(duration, 15000)
  timeout(); await expires
} finally { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear }
assert.equal(failures, 2)
assert.equal(workerDiagnostics().workers, 0)
const original = globalThis.Worker
globalThis.Worker = undefined
assert.throws(() => createWorkerClient(), /unavailable/)
globalThis.Worker = original
console.log('PASS worker replies, cancellation, stale replies, idempotent disposal, GPU failure, 15s timeout and unavailable platform')
