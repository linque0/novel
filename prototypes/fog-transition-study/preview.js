const DURATION = Number(document.querySelector('#timeline').max)
const INITIAL_PHASE = 5.5

const stage = document.querySelector('.stage')
const background = stage.querySelector('.background-layer')
const canvas = stage.querySelector('.fog-layer')
const inkAnimation = createInkAnimation(stage.querySelector('.particle-layer'))
const mock = stage.querySelector('.mock')
const outgoing = document.querySelector('#outgoing')
const incoming = document.querySelector('#incoming')
const play = document.querySelector('#play')
const slow = document.querySelector('#slow')
const timeline = document.querySelector('#timeline')
const readout = document.querySelector('#time')
const palettes = document.querySelector('.palettes')
const colorInputs = [document.querySelector('#main-color'), document.querySelector('#accent-color')]
let mode = 'scene'
let position = Number(timeline.value)
let speed = 1
let startFromBeginning = true
let frame = null
let lastTick = null
let renderer

const smoothstep = (edge0, edge1, x) => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function captureInk() {
  const box = canvas.getBoundingClientRect()
  renderer.setInk(inkAnimation.capture([outgoing, incoming], box, canvas.width, canvas.height))
}

function render() {
  const progress = position / DURATION
  const time = INITIAL_PHASE + position / 1000
  const showScene = mode === 'scene'

  mock.classList.toggle('is-preview-hidden', !showScene)
  mock.classList.toggle('is-rendered', Boolean(renderer))
  const fallbackShowsNew = progress === 1
  outgoing.hidden = !renderer && fallbackShowsNew
  incoming.hidden = !renderer && !fallbackShowsNew
  outgoing.setAttribute('aria-hidden', String(!showScene || progress >= .5))
  incoming.setAttribute('aria-hidden', String(!showScene || progress < .5))
  const front = renderer?.draw(time, mode === 'idle' ? 0 : progress, showScene)
  inkAnimation.draw(showScene ? front : null, progress)

  timeline.value = Math.round(position)
  readout.value = Math.round(position) + ' / ' + DURATION + ' ms'
  timeline.setAttribute('aria-valuetext', Math.round(position) + ' 毫秒')
}

function pause() {
  if (frame !== null) cancelAnimationFrame(frame)
  frame = null
  lastTick = null
  play.textContent = '▶ 播放'
}

function tick(now) {
  if (lastTick !== null) position = Math.min(DURATION, position + (now - lastTick) * speed)
  lastTick = now
  render()
  if (position === DURATION) {
    startFromBeginning = true
    pause()
  } else {
    frame = requestAnimationFrame(tick)
  }
}

play.addEventListener('click', () => {
  if (frame !== null) {
    pause()
    return
  }
  if (startFromBeginning) position = 0
  startFromBeginning = false
  render()
  play.textContent = 'Ⅱ 暂停'
  frame = requestAnimationFrame(tick)
})

slow.addEventListener('click', () => {
  speed = speed === 1 ? .25 : 1
  slow.setAttribute('aria-pressed', String(speed !== 1))
})

timeline.addEventListener('input', () => {
  pause()
  position = Number(timeline.value)
  startFromBeginning = position === DURATION
  render()
})

document.querySelectorAll('.modes button').forEach(button => {
  button.addEventListener('click', () => {
    mode = button.dataset.mode
    document.querySelectorAll('.modes button').forEach(item => item.setAttribute('aria-pressed', String(item === button)))
    render()
  })
})

function applyColors() {
  const selected = colorInputs.map(input => input.value.toUpperCase())
  const [a, b] = selected.map(hex => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255))
  const stops = flowColorStops({ a, b, c: a.map((value, i) => (value + b[i]) * .22) })
  renderer?.setColors(stops)
  inkAnimation.setColors(stops)
  Array.from(palettes.children).forEach((button, i) => {
    button.setAttribute('aria-pressed', String(FLOW_PRESETS[i].colors.every((color, j) => color === selected[j])))
  })
  render()
}

FLOW_PRESETS.forEach(preset => {
  const button = document.createElement('button')
  button.type = 'button'
  button.style.setProperty('--a', preset.colors[0])
  button.style.setProperty('--b', preset.colors[1])
  const swatch = document.createElement('i')
  swatch.setAttribute('aria-hidden', 'true')
  button.append(swatch, preset.name)
  button.addEventListener('click', () => {
    colorInputs.forEach((input, i) => { input.value = preset.colors[i] })
    applyColors()
  })
  palettes.append(button)
})
colorInputs.forEach(input => input.addEventListener('input', applyColors))

function showError(error) {
  pause()
  const message = stage.querySelector('.stage-error')
  message.textContent = '当前浏览器无法绘制实时雾幕。请用支持 WebGL 的浏览器打开此设计稿。'
  message.hidden = false
  console.error(error)
}

function initialize() {
  try {
    renderer = createFogRenderer(background, canvas)
    renderer.resize()
    outgoing.hidden = false
    incoming.hidden = false
    captureInk()
    stage.querySelector('.stage-error').hidden = true
    applyColors()
  } catch (error) {
    renderer = null
    render()
    showError(error)
  }
}

canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault()
  renderer = null
  render()
  showError(new Error('WebGL context lost.'))
})
canvas.addEventListener('webglcontextrestored', initialize)
new ResizeObserver(() => {
  if (renderer?.resize()) captureInk()
  render()
}).observe(stage)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause()
})
initialize()
document.fonts.ready.then(() => {
  if (!renderer) return
  captureInk()
  render()
})
