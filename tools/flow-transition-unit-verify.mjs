import assert from 'node:assert/strict'
import { createFlowTransitionController, rgbCss } from '../src/services/latent/flow-transition.js'

assert.equal(rgbCss([1, 0.5, 0]), 'rgb(255 128 0)')
assert.equal(rgbCss([0, 0, 1], 0.5), 'rgb(0 0 255 / 0.5)')

const ctrl = createFlowTransitionController({
  isReducedMotion: () => false,
  hasDocument: () => true
})

const phases = []
const stopSub = ctrl.subscribe(s => phases.push(s.phase))

// 1. Non-dsh skins bypass wave transition
let ran = false
await ctrl.run(() => { ran = true; return 'ok' }, { skin: 'crimson' })
assert.equal(ran, true)
assert.equal(ctrl.state.active, false)

// 2. Reduced motion bypasses wave transition
ran = false
await ctrl.run(() => { ran = true }, { skin: 'dsh', reducedMotion: true })
assert.equal(ran, true)
assert.equal(ctrl.state.active, false)

// 3. Normal dsh transition: covering -> commit at cover end -> revealing -> idle
phases.length = 0
let committedAtPhase = ''
await ctrl.run(() => {
  committedAtPhase = ctrl.state.phase
  return 'done'
}, {
  skin: 'dsh',
  coverMs: 45,
  revealMs: 45,
  work: { id: 'book-1' },
  flowBackground: { mode: 'cover' }
})
assert.equal(committedAtPhase, 'switching')
assert.equal(ctrl.state.active, false)
assert.equal(ctrl.state.phase, 'idle')
assert.deepEqual(phases, ['covering', 'switching', 'revealing', 'idle'])

// 4. flowSpeed === 0 still plays transition
let playedWithZeroSpeed = false
await ctrl.run(() => {
  playedWithZeroSpeed = ctrl.state.active && ctrl.state.phase === 'switching'
}, {
  skin: 'dsh',
  flowSpeed: 0,
  coverMs: 40,
  revealMs: 40
})
assert.equal(playedWithZeroSpeed, true)
assert.equal(ctrl.state.active, false)

// 5. Rapid consecutive transitions supersede earlier commit
const log = []
const p1 = ctrl.run(() => log.push('first'), { skin: 'dsh', coverMs: 60, revealMs: 40 })
await new Promise(r => setTimeout(r, 15))
const p2 = ctrl.run(() => log.push('second'), { skin: 'dsh', coverMs: 50, revealMs: 40 })
await Promise.all([p1, p2])
assert.deepEqual(log, ['second'])
assert.equal(ctrl.state.active, false)
assert.equal(ctrl.state.phase, 'idle')

// 6. Commit error cleans up overlay state and propagates
await assert.rejects(
  ctrl.run(() => { throw new Error('boom') }, { skin: 'dsh', coverMs: 40, revealMs: 40 }),
  /boom/
)
assert.equal(ctrl.state.active, false)
assert.equal(ctrl.state.phase, 'idle')

stopSub()
console.log('流波切页过渡状态机通过：覆盖切换揭开、配色提取、极速连点抢占、异常清理与减动效直切')
