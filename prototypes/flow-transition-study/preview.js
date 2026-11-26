const DURATION = 840
const INITIAL_PHASE = 5.5

// Use the same crest in GLSL and in the interface mask. Normalized Y points up.
function frontAt(progress, y) {
  const travel = progress * progress * (3 - 2 * progress)
  const bend = 0.063 * Math.sin(4.7 * y + 3.1 * progress)
    + 0.026 * Math.sin(9.1 * y - 4.4 * progress)
  return 1.24 - 1.48 * travel + bend
}

const VERTEX = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = 0.5 * (a_position + 1.0);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const SWEEP = FLOW_DITHER_FRAGMENT
  .replace('uniform float u_time;', 'uniform float u_time;\nuniform float u_progress;')
  .replace('void main() {', 'float gaussian(float x) { return exp(-x * x); }\n\nvoid main() {')
  .replace('  float shape;', `
  float p = clamp(u_progress, 0.0, 1.0);
  float y = v_uv.y;
  float travel = p * p * (3.0 - 2.0 * p);
  float front = 1.24 - 1.48 * travel + .063 * sin(4.7 * y + 3.1 * p)
    + .026 * sin(9.1 * y - 4.4 * p);
  float strength = smoothstep(0.0, .18, p) * (1.0 - smoothstep(.80, 1.0, p));
  float d = v_uv.x - front;
  float slope = .2961 * cos(4.7 * y + 3.1 * p) + .2366 * cos(9.1 * y - 4.4 * p);
  float width = .115 + .030 * sin(4.7 * y + 3.1 * p);
  float wave = gaussian(d / width);
  float shoulder = gaussian((d + .063) / (width * .90));
  float echo = gaussian((d - .104 - .023 * cos(5.3 * y)) / (width * .67));
  float trough = gaussian((d - .048) / (width * .61));
  vec2 press = strength * (wave * .081 - echo * .023) * vec2(1.0, -slope * .88);
  press.y += strength * wave * .018 * sin(9.0 * y - 2.7 * p);
  // Bend both the mesh and the original Warp phase; keep the Bayer lattice screen-aligned.
  shapeUV += press * (u_resolution / (1.015 * u_pixelRatio * .6));
  float shape;`)
  .replace('texture2D(u_scene, v_uv).rgb;', 'texture2D(u_scene, clamp(v_uv + press, 0.0, 1.0)).rgb;')
  .replace('ribbon * 0.46', 'ribbon * (0.46 + .20 * strength * wave)')
  .replace('  gl_FragColor =', `
  // Light and shade come from the same generated color stops as the backdrop.
  blended = mix(blended, softLight(blended, u_colorBack), .32 * strength * trough);
  blended = mix(blended, u_colorRibbon, strength * (.34 * shoulder + .09 * echo));
  blended = mix(blended, softLight(blended, u_colorFront), .34 * strength * wave * (.35 + .65 * ribbon));
  gl_FragColor =`)

function compileProgram(gl, fragment) {
  const shaders = [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, fragment]
  ].map(([type, source]) => {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader))
    }
    return shader
  })
  const program = gl.createProgram()
  shaders.forEach(shader => gl.attachShader(program, shader))
  gl.linkProgram(program)
  shaders.forEach(shader => gl.deleteShader(shader))
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program))

  const uniforms = {}
  for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i += 1) {
    const { name } = gl.getActiveUniform(program, i)
    uniforms[name.replace(/\[0\]$/, '')] = gl.getUniformLocation(program, name)
  }
  return { program, uniforms, position: gl.getAttribLocation(program, 'a_position') }
}

function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false })
  if (!gl) throw new Error('WebGL is unavailable.')

  const mesh = compileProgram(gl, FLOW_MESH_FRAGMENT)
  const sweep = compileProgram(gl, SWEEP)
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)

  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  const target = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, target)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
  let width = 0
  let height = 0
  let ratio = 1
  let packedStops

  function resize() {
    const box = canvas.getBoundingClientRect()
    if (!box.width || !box.height) return
    ratio = Math.min(window.devicePixelRatio || 1, 1.5, 1550 / Math.max(box.width, box.height))
    const nextWidth = Math.max(1, Math.round(box.width * ratio))
    const nextHeight = Math.max(1, Math.round(box.height * ratio))
    if (nextWidth === width && nextHeight === height) return
    width = canvas.width = nextWidth
    height = canvas.height = nextHeight
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, target)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Incomplete mesh framebuffer.')
    }
    gl.viewport(0, 0, width, height)
  }

  function bind(pass, framebuffer) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.useProgram(pass.program)
    gl.enableVertexAttribArray(pass.position)
    gl.vertexAttribPointer(pass.position, 2, gl.FLOAT, false, 0, 0)
    gl.uniform2f(pass.uniforms.u_resolution, width, height)
    return pass.uniforms
  }

  return {
    resize,
    setColors(stops) {
      packedStops = new Float32Array(stops.flatMap(rgb => [...rgb, 1]))
    },
    draw(time, progress) {
      if (!width || !packedStops) return
      gl.bindTexture(gl.TEXTURE_2D, null)
      const m = bind(mesh, target)
      gl.uniform1f(m.u_time, time * .3)
      gl.uniform1f(m.u_colorsCount, 6)
      gl.uniform4fv(m.u_colors, packedStops)
      gl.uniform1f(m.u_distortion, .8)
      gl.uniform1f(m.u_swirl, .1)
      gl.uniform1f(m.u_grainMixer, 0)
      gl.uniform1f(m.u_grainOverlay, .01)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      const s = bind(sweep, null)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.uniform1i(s.u_scene, 0)
      gl.uniform1f(s.u_time, time * .1)
      gl.uniform1f(s.u_pixelRatio, ratio)
      gl.uniform1f(s.u_progress, progress)
      gl.uniform3fv(s.u_colorBack, packedStops.subarray(16, 19))
      gl.uniform3fv(s.u_colorFront, packedStops.subarray(20, 23))
      gl.uniform3fv(s.u_colorRibbon, packedStops.subarray(4, 7))
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
  }
}

const stage = document.querySelector('.stage')
const canvas = stage.querySelector('canvas')
const mock = stage.querySelector('.mock')
const mockBody = mock.querySelector('.mock-body')
const outgoing = document.querySelector('#outgoing')
const incoming = document.querySelector('#incoming')
const outgoingCopy = outgoing.querySelector('.mock-copy')
const incomingCopy = incoming.querySelector('.mock-copy')
const outEdge = document.querySelector('#out-edge')
const inEdge = document.querySelector('#in-edge')
const play = document.querySelector('#play')
const slow = document.querySelector('#slow')
const timeline = document.querySelector('#timeline')
const readout = document.querySelector('#time')
const palettes = document.querySelector('.palettes')
const colorInputs = [document.querySelector('#main-color'), document.querySelector('#accent-color')]
let mode = 'wave'
let position = Number(timeline.value)
let speed = 1
let startFromBeginning = true
let frame = null
let lastTick = null
let renderer

function edgePath(points, side, offset) {
  const edge = points.map(([x, y]) => [Math.min(2, Math.max(-1, x + offset)), y])
  return `M ` + edge.map(point => point.join(' ')).join(' L ') + ` L ` + side + ` 1 L ` + side + ` 0 Z`
}

function smoothBetween(start, end, value) {
  const fraction = Math.max(0, Math.min(1, (value - start) / (end - start)))
  return fraction * fraction * (3 - 2 * fraction)
}

function drawScene(progress) {
  outgoing.style.visibility = progress === 1 ? 'hidden' : 'visible'
  incoming.style.visibility = progress === 0 ? 'hidden' : 'visible'
  // Give the crest a short handoff where neither body of text overlaps the other.
  outgoingCopy.style.opacity = String(1 - smoothBetween(.32, .48, progress))
  incomingCopy.style.opacity = String(smoothBetween(.50, .68, progress))
  if (progress === 0 || progress === 1) {
    outgoing.style.maskImage = 'none'
    incoming.style.maskImage = 'none'
    return
  }
  outgoing.style.maskImage = ''
  incoming.style.maskImage = ''
  const box = canvas.getBoundingClientRect()
  const panel = mockBody.getBoundingClientRect()
  const points = Array.from({ length: 19 }, (_, i) => {
    const y = i / 18
    const sceneY = 1 - (panel.top - box.top + y * panel.height) / box.height
    const sceneX = frontAt(progress, sceneY) * box.width
    return [(sceneX + box.left - panel.left) / panel.width, y]
  })
  outEdge.setAttribute('d', edgePath(points, -1.4, -.015))
  inEdge.setAttribute('d', edgePath(points, 2.4, .015))
}

function render() {
  const progress = position / DURATION
  // The idle and sweep views share the same background time at every scrub position.
  const time = INITIAL_PHASE + position / 1000
  renderer?.draw(time, mode === 'idle' ? 0 : progress)
  if (mode === 'scene') drawScene(progress)
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
    mock.hidden = mode !== 'scene'
    render()
  })
})

function applyColors() {
  const selected = colorInputs.map(input => input.value.toUpperCase())
  const [a, b] = selected.map(hex => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255))
  renderer?.setColors(flowColorStops({ a, b, c: a.map((value, i) => (value + b[i]) * .22) }))
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
  message.textContent = '当前浏览器无法绘制实时波纹。请用支持 WebGL 的浏览器打开此设计稿。'
  message.hidden = false
  console.error(error)
}

function initialize() {
  try {
    renderer = createRenderer(canvas)
    renderer.resize()
    stage.querySelector('.stage-error').hidden = true
    applyColors()
  } catch (error) {
    renderer = null
    showError(error)
  }
}

canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault()
  renderer = null
  showError(new Error('WebGL context lost.'))
})
canvas.addEventListener('webglcontextrestored', initialize)
new ResizeObserver(() => {
  renderer?.resize()
  render()
}).observe(stage)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause()
})
initialize()
