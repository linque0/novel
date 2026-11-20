import assert from 'node:assert/strict'
import { createFlowTransitionController } from '../src/services/latent/flow-transition.js'
import { liquidFrame, liquidProgress, matchesSceneAspect, sameSceneRect, sceneCaptureOptions } from '../src/services/latent/liquid-transition.js'
import { liquidPhase } from '../src/services/latent/liquid-transition-gl.js'
import { createFlowCaptureQueue } from '../src/services/latent/flow-capture-queue.js'

// A snapshot's viewport coordinates stay in CSS pixels, even when its texture is downsampled.
const rect = { left: 23, top: 41, width: 1400, height: 800 }
const capture = sceneCaptureOptions(rect, .75, 12, 30)
assert.deepEqual(capture.clip, { x: 35, y: 71, width: 1400, height: 800 })
assert.equal(capture.dpr, .75)
assert.equal(capture.excludeMode, 'hide')
assert.equal('width' in capture || 'height' in capture, false)
assert(matchesSceneAspect({ width: 1050, height: 600 }, rect))
assert(matchesSceneAspect({ width: 1600, height: 914 }, rect))
assert(!matchesSceneAspect({ width: 1400, height: 750 }, rect))
assert(!sameSceneRect(rect, { ...rect, left: 28 }))
assert(sameSceneRect(rect, { ...rect, width: 1400.4 }))
const fullscreen = sceneCaptureOptions({ left: 0, top: 0, width: 1400, height: 800 }, .75, 0, 0)
assert.deepEqual(fullscreen.clip, { x: 0, y: 0, width: 1400, height: 800 })
assert.equal(fullscreen.exclude, '[data-flow-transition-backdrop], .ls-card.is-out')
assert.equal(fullscreen.fast, true)
assert.equal(liquidProgress(0), 0)
assert.equal(liquidProgress(150), .15)
assert.equal(liquidProgress(500), .5)
assert.equal(liquidProgress(1000), 1)
assert.equal(liquidProgress(2000), 1)
const phase = Array.from({ length: 1001 }, (_, i) => liquidPhase(i / 1000, .35))
assert.equal(phase[0], 0)
assert(Math.abs(phase[1000] - 2.75) < 1e-9)
assert(phase.slice(1).every((value, i) => value > phase[i]))
const start = 100
const mid = liquidFrame(600, start, .35)
assert.equal(mid.time, .5)
assert(mid.phase > 0)
assert.equal(liquidFrame(1100, start, .35).time, 1)

const control = () => createFlowTransitionController({
  isReducedMotion: () => false, hasDocument: () => true
})
const route = { skin: 'dsh' }
const ctrl = control()
const steps = []
let finishCover
let coverStarted
let finishPaint
let paintStarted
let finishReveal
let revealStarted
const covering = new Promise(resolve => { coverStarted = resolve })
const painting = new Promise(resolve => { paintStarted = resolve })
const revealing = new Promise(resolve => { revealStarted = resolve })
ctrl.attach(async () => {
  steps.push('capture old')
  return {
    play: () => new Promise(resolve => {
      steps.push('play')
      finishCover = resolve
      coverStarted()
    }),
    reveal: () => new Promise(resolve => {
      steps.push('reveal')
      finishReveal = resolve
      revealStarted()
    }),
    dispose: () => { steps.push('dispose') }
  }
})
const switching = ctrl.run(() => { steps.push('commit'); return 'ok' }, {
  ...route,
  afterCommit: () => new Promise(resolve => {
    steps.push('paint')
    finishPaint = resolve
    paintStarted()
  })
})
await covering
assert.deepEqual(steps, ['capture old', 'play'])
finishCover()
await painting
assert.deepEqual(steps, ['capture old', 'play', 'commit', 'paint'])
finishPaint()
await revealing
assert.deepEqual(steps, ['capture old', 'play', 'commit', 'paint', 'reveal'])
finishReveal()
assert.equal(await switching, 'ok')
assert.deepEqual(steps, ['capture old', 'play', 'commit', 'paint', 'reveal', 'dispose'])

steps.length = 0
await ctrl.run(() => steps.push('direct'), { ...route, reducedMotion: true })
await ctrl.run(() => steps.push('crimson'), { skin: 'crimson' })
assert.deepEqual(steps, ['direct', 'crimson'])

const failing = control()
failing.attach(() => { throw Error('capture failed') })
assert.equal(await failing.run(() => 'arrived', route), 'arrived')
failing.attach(() => ({ play: () => { throw Error('context lost') }, dispose() {} }))
assert.equal(await failing.run(() => 'arrived', route), 'arrived')
await assert.rejects(failing.run(() => { throw Error('commit failed') }, route), /commit failed/)
await assert.rejects(failing.run(() => 'ok', {
  ...route, afterCommit: () => { throw Error('after commit failed') }
}), /after commit failed/)

const rapid = control()
const log = []
let release
rapid.attach(() => new Promise(resolve => {
  log.push('capture')
  release = () => resolve({ play: () => log.push('play once'), dispose: () => log.push('disposed') })
}))
const first = rapid.run(() => log.push('stale commit'), route)
const second = rapid.run(() => log.push('latest commit'), route)
release()
await Promise.all([first, second])
assert.deepEqual(log, ['capture', 'play once', 'latest commit', 'disposed'])

const ongoing = control()
let finishCommit
let nowCommitting
const didCommit = new Promise(resolve => { nowCommitting = resolve })
const a = ongoing.run(async () => {
  log.push('start A')
  nowCommitting()
  await new Promise(resolve => { finishCommit = resolve })
  log.push('finish A')
}, route)
await didCommit
const b = ongoing.run(() => log.push('B'), route)
const c = ongoing.run(() => log.push('C'), route)
finishCommit()
await Promise.all([a, b, c])
assert.deepEqual(log.slice(-3), ['start A', 'finish A', 'C'])

const captureQueue = createFlowCaptureQueue((a, b) => a === b)
const older = new AbortController()
const newer = new AbortController()
const opts = { signal: newer.signal, timeoutMs: 500 }
let completeRaster
const preparing = captureQueue('outline', () => new Promise(resolve => { completeRaster = resolve }), {
  ...opts, signal: older.signal
})
await Promise.resolve()
older.abort()
assert.equal(await preparing, null)
const reuse = captureQueue('outline', () => { throw Error('duplicate raster') }, opts)
assert.equal(await captureQueue('characters', () => { throw Error('busy raster') }, { ...opts, skipBusy: true }), null)
const queued = captureQueue('characters', () => 'characters captured', opts)
completeRaster('outline captured')
assert.equal(await reuse, 'outline captured')
assert.equal(await queued, 'characters captured')

const repeated = control()
let signalPlaying
let releasePlaying
let didPlay
const playStarted = new Promise(resolve => { didPlay = resolve })
repeated.attach(({ signal }) => ({
  play: () => new Promise(resolve => {
    signalPlaying = signal
    releasePlaying = resolve
    didPlay()
  }),
  dispose() {}
}))
const activePlay = repeated.run(() => 'shown', route)
await playStarted
const retarget = repeated.run(() => 'latest', route)
assert.equal(signalPlaying.aborted, false)
releasePlaying()
assert.equal(await activePlay, undefined)
assert.equal(await retarget, 'latest')

const cancelled = control()
const aborts = []
cancelled.attach(({ signal }) => ({
  play: () => new Promise(resolve => {
    signal.addEventListener('abort', resolve, { once: true })
  }),
  dispose: () => aborts.push('disposed')
}))
const staying = cancelled.run(() => aborts.push('unexpected commit'), route)
await Promise.resolve()
cancelled.cancelPending()
await staying
assert.deepEqual(aborts, ['disposed'])

const interruptReveal = control()
const revealLog = []
let revealCount = 0
let revealStartedGate
const revealRunning = new Promise(resolve => { revealStartedGate = resolve })
interruptReveal.attach(({ signal }) => ({
  play: () => Promise.resolve(),
  reveal: () => {
    const idx = ++revealCount
    revealLog.push('reveal ' + idx)
    if (idx === 1) {
      return new Promise(resolve => {
        signal.addEventListener('abort', () => { revealLog.push('reveal aborted'); resolve() }, { once: true })
        revealStartedGate()
      })
    }
    return Promise.resolve()
  },
  dispose: () => revealLog.push('disposed')
}))
const firstNav = interruptReveal.run(() => revealLog.push('first commit'), route)
await revealRunning
const secondNav = interruptReveal.run(() => revealLog.push('second commit'), route)
await Promise.all([firstNav, secondNav])
assert(revealLog.includes('reveal aborted'))
assert(revealLog.includes('second commit'))
assert(revealLog.includes('reveal 2'))
console.log('斜流切页状态机通过：遮盖后提交、绘制后交接、连点复用、提交串行、揭示可打断、渲染降级及异常清理')
