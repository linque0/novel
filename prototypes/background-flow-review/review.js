const review = document.querySelector('#review')
const frame = document.querySelector('.frame')
const view = {
  frame, canvas: frame.querySelector('.live'), still: frame.querySelector('.still'),
  status: frame.querySelector('.frame-status')
}
const playButton = document.querySelector('#play')
const slowButton = document.querySelector('#slow')
const timeline = document.querySelector('#timeline')
const timeLabel = document.querySelector('#time')
const paletteSelect = document.querySelector('#palette')
const noAmbientMotion = matchMedia('(prefers-reduced-motion: reduce)')
const search = new URLSearchParams(location.search)
const openedAt = performance.now()
let device = ''
let devicePinned = false
let currentPalette
let recordsOpen = false
let position = 0
let origin = INITIAL_PHASE
let slow = false
let reviewState = 'ambient-start'
let clockStart = 0
let playStart = 0
let lastDraw = -Infinity

view.canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault()
  fallBack(view, new Error('WebGL context lost.'))
  render(performance.now(), true)
})
view.canvas.addEventListener('webglcontextrestored', () => {
  prepare(view)
  resizePreview()
})

function prepare(view) {
  try {
    view.renderer = createFlowRenderer(view.canvas)
    view.still.hidden = true
    view.canvas.hidden = false
    view.status.hidden = true
    view.sizeKey = ''
    if (currentPalette) view.renderer.setPalette(currentPalette)
  } catch (error) {
    fallBack(view, error)
  }
}

function fallBack(view, error) {
  view.renderer = null
  view.still.hidden = false
  view.canvas.hidden = true
  view.status.textContent = '实时预览需要 WebGL2，可播放下方慢放。'
  view.status.hidden = false
  document.querySelector('#recordings').open = true
  console.warn(error)
}

function paletteFor(index) {
  const [a, b] = FLOW_PRESETS[index].colors.map(hex =>
    [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255))
  return flowColorStops({ a, b, c: a.map((value, i) => (value + b[i]) * .22) })
}

function applyPalette() {
  currentPalette = paletteFor(Number(paletteSelect.value))
  view.renderer?.setPalette(currentPalette)
  view.staticKey = ''
  render(performance.now(), true)
}

function setDevice(value) {
  device = value
  const phone = device !== 'desktop'
  review.classList.toggle('is-phone', phone)
  review.style.setProperty('--phone-width', phone ? value + 'px' : '')
  review.style.setProperty('--phone-width-px', phone ? value : '')
  document.querySelectorAll('[data-device]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.device === value))
  })
  resizePreview()
}

function automaticDevice() {
  if (innerWidth <= 375) return '375'
  if (innerWidth <= 570) return '390'
  return 'desktop'
}

function resizePreview() {
  if (!device) return
  const phone = device !== 'desktop'
  const dw = phone ? Number(device) : PREVIEW_WIDTH
  const dh = phone ? MOBILE_HEIGHT : PREVIEW_HEIGHT
  const dpr = devicePixelRatio || 1
  const box = view.frame.getBoundingClientRect()
  const width = Math.round(box.width * Math.min(dpr, 1.5))
  const height = Math.round(box.height * Math.min(dpr, 1.5))
  if (!width || !height) return
  const key = [dw, dh, width, height, dpr].join(':')
  if (view.sizeKey === key) return
  view.sizeKey = key
  view.layout = { dw, dh, width, height }
  view.staticKey = ''
  try {
    view.renderer?.resize(dw, dh, width, height, dpr)
  } catch (error) {
    fallBack(view, error)
  }
  if (currentPalette) render(performance.now(), true)
}

function drawStill(view, page) {
  if (!view.layout || view.staticKey === page) return
  view.staticKey = page
  const { dw, dh, width, height } = view.layout
  view.still.width = width
  view.still.height = height
  const ctx = view.still.getContext('2d')
  const cssColor = rgb => 'rgb(' + rgb.map(channel => Math.round(channel * 255)).join(',') + ')'
  const gradient = ctx.createLinearGradient(width, 0, 0, height)
  gradient.addColorStop(0, cssColor(currentPalette[1]))
  gradient.addColorStop(.57, cssColor(currentPalette[0]))
  gradient.addColorStop(1, cssColor(currentPalette[2]))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  for (const layer of captureScene(page, dw, dh, 2)) ctx.drawImage(layer, 0, 0, width, height)
}

function playPosition(now) {
  return Math.min(DURATION, Math.round(playStart + (now - clockStart) * (slow ? .25 : 1)))
}

function phaseFor(now) {
  if (reviewState === 'ambient-start') {
    const elapsed = noAmbientMotion.matches ? 0 : (now - openedAt) / 1000
    return INITIAL_PHASE + BASE_SPEED * elapsed
  }
  const transition = origin + phaseOffset(position / DURATION)
  if (reviewState !== 'ambient-end' || noAmbientMotion.matches) return transition
  return transition + BASE_SPEED * (now - clockStart) / 1000
}

function updateTransport() {
  timeline.value = position
  timeline.setAttribute('aria-valuetext', position + ' 毫秒')
  timeLabel.value = position + ' / 1000 ms'
  playButton.textContent = reviewState === 'playing' ? 'Ⅱ 暂停'
    : position === DURATION ? '↻ 重播' : '▶ 播放'
}

function render(now, force = false) {
  if (!currentPalette) return
  if (reviewState === 'playing') {
    const nextPosition = playPosition(now)
    if (position === nextPosition && !force) return
    position = nextPosition
    if (position === DURATION) {
      reviewState = 'ambient-end'
      clockStart = now
      force = true
    }
    updateTransport()
  }
  if (!force && reviewState !== 'playing') {
    if (reviewState === 'review' || noAmbientMotion.matches || now - lastDraw < 32 || recordsOpen) return
  }
  lastDraw = now
  if (!view.layout) return
  if (view.renderer) view.renderer.draw(position / DURATION, phaseFor(now))
  else drawStill(view, position >= DURATION ? 'B' : 'A')
}

function seek(value) {
  if (reviewState === 'ambient-start') origin = phaseFor(performance.now())
  position = Math.max(0, Math.min(DURATION, value))
  reviewState = 'review'
  updateTransport()
  render(performance.now(), true)
}

function togglePlay() {
  const now = performance.now()
  if (reviewState === 'playing') {
    seek(playPosition(now))
    return
  }
  if (reviewState === 'ambient-start') origin = phaseFor(now)
  // A replay returns to the saved phase so the same time can be reviewed again.
  if (position === DURATION) position = 0
  playStart = position
  clockStart = now
  reviewState = 'playing'
  updateTransport()
  render(now, true)
}

async function copyRoute(button) {
  const url = new URL('index.html', location.href).href
  const message = document.querySelector('#copy-status')
  const field = document.querySelector('#copy-fallback')
  let copied = false
  try {
    await navigator.clipboard.writeText(url)
    copied = true
  } catch {
    field.hidden = false
    field.value = url
    field.select()
    try {
      copied = document.execCommand('copy')
    } catch {
      copied = false
    }
  }
  field.hidden = copied
  message.hidden = false
  message.textContent = copied ? '直达链接已复制' : '已选中直达链接，可手动复制。'
  if (copied) button.focus()
}

prepare(view)
for (const [index, { name }] of FLOW_PRESETS.entries()) {
  paletteSelect.add(new Option(name, String(index), index === 2, index === 2))
}
applyPalette()
setDevice(automaticDevice())
updateTransport()

new ResizeObserver(resizePreview).observe(frame)
window.addEventListener('resize', () => {
  if (!devicePinned) setDevice(automaticDevice())
  else resizePreview()
})
document.fonts.ready.then(() => {
  view.sizeKey = ''
  resizePreview()
})
document.querySelectorAll('[data-device]').forEach(button => button.addEventListener('click', () => {
  devicePinned = true
  setDevice(button.dataset.device)
}))
document.querySelector('#copy-link').addEventListener('click', event => copyRoute(event.currentTarget))
document.querySelector('#recordings').addEventListener('toggle', event => {
  recordsOpen = event.currentTarget.open
  if (recordsOpen) render(performance.now(), true)
})
timeline.addEventListener('input', () => seek(Number(timeline.value)))
playButton.addEventListener('click', togglePlay)
slowButton.addEventListener('click', () => {
  const now = performance.now()
  if (reviewState === 'playing') {
    position = playPosition(now)
    playStart = position
    clockStart = now
  }
  slow = !slow
  slowButton.setAttribute('aria-pressed', String(slow))
  updateTransport()
  render(now, true)
})
paletteSelect.addEventListener('change', applyPalette)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && reviewState === 'playing') seek(playPosition(performance.now()))
})

function animate(now) {
  if (!document.hidden) render(now)
  requestAnimationFrame(animate)
}
if (!search.has('capture')) requestAnimationFrame(animate)

// The export harness draws through the same renderer as the on-page canvases.
if (search.has('capture')) {
  let capture
  window.captureFrame = (t, options = {}) => {
    if (!capture) {
      const canvas = document.createElement('canvas')
      capture = { canvas, renderer: createFlowRenderer(canvas) }
      capture.renderer.resize(PREVIEW_WIDTH, PREVIEW_HEIGHT, PREVIEW_WIDTH, PREVIEW_HEIGHT, 1)
    }
    capture.renderer.setPalette(paletteFor(options.palette ?? 2))
    capture.renderer.draw(t, INITIAL_PHASE + phaseOffset(t), options)
    return capture.canvas.toDataURL('image/png')
  }
}
