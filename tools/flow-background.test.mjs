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
  globalThis.requestAnimationFrame = () => 1
  globalThis.cancelAnimationFrame = () => {}
  t.after(() => {
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
  assert.equal(frames.at(-1).data.length, 32 * 48 * 4)
  assert.ok(frames.at(-1).data[0] > frames.at(-1).data[1] + 20)
  cpu.dispose()
})
