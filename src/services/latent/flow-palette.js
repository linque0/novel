import { paletteOf } from './palette.js'

export const FLOW_PRESETS = [
  { name: '雾蓝暮紫', colors: ['#5267A8', '#9479B5'] },
  { name: '松林薄雾', colors: ['#356A60', '#80AD92'] },
  { name: '落日余晖', colors: ['#B96852', '#DCA56B'] },
  { name: '深海极光', colors: ['#284F83', '#57B5AD'] },
  { name: '玫瑰墨夜', colors: ['#4B3D72', '#B16D8E'] }
]

export const DEFAULT_FLOW_PALETTE = { a: [0.18, 0.22, 0.5], b: [0.85, 0.4, 0.35], c: [0.06, 0.07, 0.16] }

export function normalizeFlowBackground(value) {
  const colors = Array.isArray(value?.colors) ? value.colors : []
  return {
    mode: value?.mode === 'custom' ? 'custom' : 'cover',
    colors: FLOW_PRESETS[0].colors.map((fallback, i) => {
      const color = colors[i]
      return typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : fallback
    })
  }
}

export function rgbFromHex(hex) {
  return [1, 3, 5].map(start => Number.parseInt(hex.slice(start, start + 2), 16))
}

export function resolveFlowPalette(value, work) {
  const { mode, colors } = normalizeFlowBackground(value)
  if (mode === 'cover') return work ? paletteOf(work) : DEFAULT_FLOW_PALETTE
  const [a, b] = colors.map(hex => rgbFromHex(hex).map(channel => channel / 255))
  return { a, b, c: a.map((channel, i) => (channel + b[i]) * 0.22) }
}

// In custom mode, browsing works should never restart the background transition.
export function flowPaletteKey(value, work) {
  const { mode, colors } = normalizeFlowBackground(value)
  return mode === 'custom' ? colors.join('/') : JSON.stringify([work?.id, work?.kind])
}
