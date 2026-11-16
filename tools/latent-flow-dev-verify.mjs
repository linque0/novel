import assert from 'node:assert/strict'
import { connect } from './_cdp-lib.mjs'

const cdp = await connect('http://127.0.0.1:5173/')
const result = await cdp.evalx(`(async () => {
  if (location.origin !== 'http://127.0.0.1:5173' || !(await native.getDataLocation()).defaultDir.endsWith('小说工坊-dev')) {
    throw new Error('This probe requires the existing desktop dev profile')
  }
  const { mountFlowBackdrop } = await import('/src/services/latent/flow.js')
  const { resolveFlowPalette } = await import('/src/services/latent/flow-palette.js')
  const { createCoverPainter } = await import('/src/services/latent/latent-gl.js')
  const originalRaf = window.requestAnimationFrame
  const originalCancel = window.cancelAnimationFrame
  const originalNow = performance.now
  const ownHidden = Object.getOwnPropertyDescriptor(document, 'hidden')
  const pending = new Map()
  const palettes = [
    resolveFlowPalette({ mode: 'custom', colors: ['#298C83', '#CBDAC6'] }),
    resolveFlowPalette({ mode: 'custom', colors: ['#A2784D', '#D7A076'] }),
  ]
  const parent = document.createElement('div')
  const canvas = document.createElement('canvas')
  parent.append(canvas)
  let width = 1920
  let height = 1080
  let hidden = false
  let now = 0
  let serial = 0
  let animation
  let painter
  const metrics = {}
  const clock = ms => {
    now += ms
    const current = [...pending.values()]
    pending.clear()
    for (const draw of current) draw(now)
  }
  const sample = source => {
    const copy = document.createElement('canvas')
    copy.width = 80
    copy.height = 45
    const context = copy.getContext('2d')
    context.drawImage(source, 0, 0, 80, 45)
    const data = context.getImageData(0, 0, 80, 45).data
    const values = data.filter((_, i) => i % 4 !== 3)
    return { range: Math.max(...values) - Math.min(...values), pixels: Array.from(values) }
  }
  try {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    window.requestAnimationFrame = draw => { pending.set(++serial, draw); return serial }
    window.cancelAnimationFrame = id => pending.delete(id)
    performance.now = () => now
    Object.defineProperties(canvas, {
      clientWidth: { get: () => width },
      clientHeight: { get: () => height },
    })
    animation = mountFlowBackdrop(canvas, { speed: 0, palette: palettes[0] })
    metrics.initial = animation.stats()
    metrics.initialPixelRange = sample(canvas).range
    metrics.speedDeltas = []
    for (const speed of [0, 0.5, 1, 2]) {
      animation.setSpeed(speed)
      const before = animation.stats().time
      clock(16)
      clock(16)
      metrics.speedDeltas.push(Math.round((animation.stats().time - before) * 1000))
    }

    animation.setSpeed(0)
    const staticFrame = sample(canvas).pixels
    clock(16)
    metrics.staticPixels = JSON.stringify(staticFrame) === JSON.stringify(sample(canvas).pixels)
    animation.setPalette(palettes[1], { duration: 300 })
    metrics.paletteChangesWhileStopped = JSON.stringify(staticFrame) !== JSON.stringify(sample(canvas).pixels)

    animation.setSpeed(2)
    const beforePause = animation.stats().time
    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    clock(8000)
    metrics.hiddenDelta = animation.stats().time - beforePause
    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    clock(16)
    metrics.resumedDelta = Math.round((animation.stats().time - beforePause) * 1000)
    animation.setReducedMotion(true)
    const beforeReduce = animation.stats().time
    clock(16)
    metrics.reducedDelta = animation.stats().time - beforeReduce
    width = 420
    height = 760
    animation.resize()
    metrics.narrow = animation.stats()
    metrics.narrowPixelRange = sample(canvas).range

    painter = createCoverPainter()
    const cover = painter.paint(palettes[1], 0.5, 80, 100)
    metrics.coverPainted = Boolean(cover?.data.some((value, i) => i % 4 !== 3 && value > 0))
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    const fallback = parent.querySelector('canvas')
    metrics.fallback = animation.stats()
    metrics.fallbackPixelRange = sample(fallback).range
    animation.setReducedMotion(false)
    clock(16)
    metrics.fallbackDelta = Math.round((animation.stats().time - metrics.fallback.time) * 1000)
    return metrics
  } finally {
    animation?.dispose()
    painter?.dispose()
    window.requestAnimationFrame = originalRaf
    window.cancelAnimationFrame = originalCancel
    performance.now = originalNow
    if (ownHidden) Object.defineProperty(document, 'hidden', ownHidden)
    else delete document.hidden
  }
})()`)

assert.ok(result && !result.PAGE_ERR, result?.PAGE_ERR)
assert.equal(result.initial.backend, 'gpu', result.initial.shaderLog)
assert.ok(result.initial.pixels[0] >= 1920 && result.initial.pixels[1] >= 1080)
assert.ok(result.initial.pixels[0] * result.initial.pixels[1] <= 2560 * 1440)
assert.ok(result.initialPixelRange > 30)
assert.deepEqual(result.speedDeltas, [0, 16, 32, 64])
assert.ok(result.staticPixels && result.paletteChangesWhileStopped)
assert.equal(result.hiddenDelta, 0)
assert.equal(result.resumedDelta, 32)
assert.equal(result.reducedDelta, 0)
assert.ok(Math.abs(result.narrow.pixels[0] / result.narrow.pixels[1] - 420 / 760) < 0.005)
assert.ok(result.narrowPixelRange > 30)
assert.ok(result.coverPainted)
assert.equal(result.fallback.backend, 'cpu')
assert.equal(result.fallback.time, result.narrow.time)
assert.equal(result.fallback.speed, 2)
assert.ok(result.fallbackPixelRange > 30)
assert.equal(result.fallbackDelta, 32)
console.log('隐现 dev 渲染通过', JSON.stringify(result))
process.exit(0)
