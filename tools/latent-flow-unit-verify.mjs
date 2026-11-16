import assert from 'node:assert/strict'
import { advanceFlowTime, flowBufferSize, normalizeFlowSpeed } from '../src/services/latent/flow-motion.js'
import { blendFlowStops, flowColorStops } from '../src/services/latent/flow-color-stops.js'
import { accentOf, cssGradientOf, paletteOf } from '../src/services/latent/palette.js'

assert.equal(normalizeFlowSpeed(undefined), 1)
assert.equal(normalizeFlowSpeed(null), 1)
assert.equal(normalizeFlowSpeed(NaN), 1)
assert.equal(normalizeFlowSpeed(-1), 0)
assert.equal(normalizeFlowSpeed(3), 2)
assert.equal(normalizeFlowSpeed(0.46), 0.5)
assert.equal(normalizeFlowSpeed(0), 0)

for (const speed of [0, 0.5, 1, 2]) {
  assert.equal(advanceFlowTime(12, 32, speed), 12 + 0.032 * speed)
}
assert.equal(advanceFlowTime(12, 4000, 1), 12.064)
assert.equal(advanceFlowTime(12, -5, 1), 12)
assert.deepEqual(flowBufferSize(1920, 1080, 1, 1, 4096), [1920, 1080])
assert.deepEqual(flowBufferSize(1920, 1080, 2, 1, 4096), [2560, 1440])
assert.deepEqual(flowBufferSize(1920, 1080, 2, 0.75, 4096), [1920, 1080])
assert.deepEqual(flowBufferSize(440, 800, 1.5, 1, 4096), [660, 1200])
assert.deepEqual(flowBufferSize(440, 800, 2, 1, 1024), [563, 1024])
console.log('隐现流动背景：速度归一化、连续相位和渲染像素预算通过')

const linearize = v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
const luminance = rgb => rgb.map(linearize)
  .reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0)

function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ]
}
for (const palette of [
  { a: [0.49, 0.41, 0.67], b: [0.55, 0.45, 0.76], c: [0.12, 0.07, 0.25] },
  { a: [0, 1, 1], b: [0, 0.9, 0], c: [0, 0.2, 0.1] },
  { a: [1, 0, 0], b: [1, 0.5, 0], c: [0.3, 0.1, 0] },
  { a: [0, 0, 0], b: [1, 1, 1], c: [0.2, 0.2, 0.2] }
]) {
  const stops = flowColorStops(palette)
  assert.equal(stops.length, 6)
  assert.ok(stops.flat().every(value => Number.isFinite(value) && value >= 0 && value <= 1))
  const [main, accent, transition, highlight, shadow, mist] = stops.map(luminance)
  assert.ok(shadow < 0.025 && shadow < transition && transition < main && main < accent && accent < mist && mist < highlight)
  assert.ok(highlight - shadow > 0.6)
  if (palette.a[0] === palette.a[1] && palette.a[1] === palette.a[2]) {
    for (const rgb of stops) assert.equal(Math.max(...rgb) - Math.min(...rgb), 0)
  }
}
console.log('隐现色板：六阶明度、sRGB 色域与中性灰阶通过')

const from = flowColorStops({ a: [0, 1, 1], b: [0, 0.9, 0], c: [0, 0.2, 0.1] })
const to = flowColorStops({ a: [1, 0, 0], b: [1, 0.5, 0], c: [0.3, 0.1, 0] })
assert.equal(blendFlowStops(from, to, 0, 300), from)
assert.equal(blendFlowStops(from, to, 300, 300), to)
assert.equal(blendFlowStops(from, to, 0, 0), to)
const halfway = blendFlowStops(from, to, 150, 300)
assert.ok(halfway.every((rgb, i) => rgb.every((value, channel) =>
  Math.abs(value - (from[i][channel] + to[i][channel]) / 2) < 1e-12
)))

const coverPairs = new Set()
for (let index = 0; index < 200; index += 1) {
  const work = { id: 'cover-palette-' + index }
  const palette = paletteOf(work)
  const [main, accent, shadow] = [palette.a, palette.b, palette.c].map(luminance)
  const contrast = (accent + 0.05) / (main + 0.05)
  assert.ok(contrast >= 2.25, `cover contrast ${contrast} for ${work.id}`)
  assert.ok(shadow < main)
  for (const [rgb, lightness, maxChroma] of [[palette.a, 0.48, 0.12], [palette.b, 0.74, 0.16], [palette.c, 0.31, 0.07]]) {
    assert.ok(rgb.every(channel => channel >= 0 && channel <= 1))
    const [l, a, b] = oklab(rgb.map(linearize))
    assert.ok(Math.abs(l - lightness) < 0.0001, `cover lightness ${l} for ${work.id}`)
    assert.ok(Math.hypot(a, b) <= maxChroma + 0.0001)
  }
  assert.deepEqual(paletteOf({ ...work, title: '改过书名', kind: 'ink' }), palette)
  assert.ok(cssGradientOf(work).includes(accentOf(work)), 'flat cover uses the same accent')
  coverPairs.add(JSON.stringify(palette))
}
assert.ok(coverPairs.size >= 195)
console.log('幻流书封：RGB 色彩范围、明暗层次与配色稳定性通过')
