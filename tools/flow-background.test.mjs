import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeFlowBackground, resolveFlowPalette, flowPaletteKey } from '../src/services/latent/flow-palette.js'
import { paletteOf } from '../src/services/latent/palette.js'
import { createCpuBackdrop } from '../src/services/latent/cpu-backdrop.js'

test('missing or malformed preferences preserve cover mode and recover individual colors', () => {
  assert.deepEqual(normalizeFlowBackground(), { mode: 'cover', colors: ['#5267A8', '#9479B5'] })
  assert.deepEqual(normalizeFlowBackground({ mode: 'other', colors: ['#abcdef', '#123'] }), {
    mode: 'cover', colors: ['#ABCDEF', '#9479B5']
  })
})

test('cover mode keeps work palettes and has a deterministic fallback without a work', () => {
  const book = { id: 'first', kind: 'cedar' }
  assert.deepEqual(resolveFlowPalette(null, book), paletteOf(book))
  assert.notDeepEqual(resolveFlowPalette(null, null), paletteOf(book))
})

test('custom mode uses both exact RGB inputs even without a work, and ignores changes of work', () => {
  const pref = { mode: 'custom', colors: ['#FF0000', '#0080FF'] }
  const book = { id: 'first', kind: 'cedar' }
  const palette = resolveFlowPalette(pref)
  assert.deepEqual(palette.a, [1, 0, 0])
  assert.deepEqual(palette.b, [0, 128 / 255, 1])
  assert.deepEqual(resolveFlowPalette(pref, book), palette)
  assert.equal(flowPaletteKey(pref, book), flowPaletteKey(pref))
  assert.notEqual(flowPaletteKey(null, book), flowPaletteKey(null, null))
  assert.notEqual(flowPaletteKey(pref), flowPaletteKey({ ...pref, colors: ['#FF0000', '#000000'] }))
})

test('CPU backdrop repaints the chosen palette immediately and after a reduced-motion resize', t => {
  const frames = []
  const context = {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: frame => frames.push(frame)
  }
  const canvas = { getContext: () => context, clientWidth: 40, clientHeight: 40 }
  globalThis.window = new EventTarget()
  globalThis.document = Object.assign(new EventTarget(), { hidden: false })
  globalThis.requestAnimationFrame = () => 1
  globalThis.cancelAnimationFrame = () => {}
  t.after(() => {
    delete globalThis.window
    delete globalThis.document
    delete globalThis.requestAnimationFrame
    delete globalThis.cancelAnimationFrame
  })
  const cpu = createCpuBackdrop(canvas, { simWidth: 32 })
  cpu.setReducedMotion(true)
  cpu.setPalette(resolveFlowPalette({ mode: 'custom', colors: ['#FF0000', '#FF0000'] }))
  const afterColor = frames.length
  assert.ok(frames.at(-1).data[0] > frames.at(-1).data[1] + 20)
  canvas.clientHeight = 60
  cpu.resize()
  assert.equal(frames.length, afterColor + 1)
  assert.deepEqual([canvas.width, canvas.height], [21, 32])
  assert.equal(frames.at(-1).data.length, 21 * 32 * 4)
  assert.ok(frames.at(-1).data[0] > frames.at(-1).data[1] + 20)
  cpu.dispose()
})

test('a transition suspends the backdrop loop and resumes once at the handed-off phase', t => {
  const callbacks = new Map()
  let frameId = 0
  globalThis.window = new EventTarget()
  globalThis.document = Object.assign(new EventTarget(), { hidden: false })
  globalThis.requestAnimationFrame = fn => {
    callbacks.set(++frameId, fn)
    return frameId
  }
  globalThis.cancelAnimationFrame = id => callbacks.delete(id)
  t.after(() => {
    delete globalThis.window
    delete globalThis.document
    delete globalThis.requestAnimationFrame
    delete globalThis.cancelAnimationFrame
  })
  const context = {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {}
  }
  const cpu = createCpuBackdrop({ getContext: () => context, clientWidth: 40, clientHeight: 40 }, { simWidth: 32 })
  assert.equal(callbacks.size, 1)
  const release = cpu.holdTransition()
  assert.equal(callbacks.size, 0)
  cpu.setSpeed(1.5)
  cpu.syncTransitionTime(4)
  assert.equal(callbacks.size, 0)
  assert.equal(cpu.transitionFrame().time, 4)
  release()
  assert.equal(callbacks.size, 1)
  cpu.dispose()
  assert.equal(callbacks.size, 0)
})
