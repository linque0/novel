const VERTEX = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = 0.5 * (a_position + 1.0);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

function compileProgram(gl, vertexSource, fragmentSource) {
  const shaders = [
    [gl.VERTEX_SHADER, vertexSource],
    [gl.FRAGMENT_SHADER, fragmentSource]
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


// The row texture lets the ink and fog follow the same irregular edge.
// Two channels encode the normalized position without visible 8-bit steps.
const FRONT_ROWS = 128
const FRONT_FIELD = `
uniform sampler2D u_front;
float edgeDistance(vec2 uv) {
  vec2 edge = texture2D(u_front, vec2(.5, uv.y)).rg;
  return uv.x - (2.0 * (edge.r + edge.g / 255.0) - .5);
}
`

function fillFogFront(target, progress) {
  const travel = smoothstep(.025, .94, progress)
  for (let row = 0; row < FRONT_ROWS; row += 1) {
    const y = (row + .5) / FRONT_ROWS
    const curve = .067 * Math.sin(5.4 * y + 4.2 * progress)
      + .031 * Math.sin(12.3 * y - 5.8 * progress)
      + .018 * Math.sin(23.1 * y + 8.7 * progress)
    const front = 1.27 - 1.68 * travel + curve
    const code = Math.round((front + .5) * .5 * 65025)
    target[row * 4] = Math.floor(code / 255)
    target[row * 4 + 1] = code % 255
  }
}

function distanceFromFront(front, x, y) {
  const row = Math.max(0, Math.min(FRONT_ROWS - 1, (1 - y) * FRONT_ROWS - .5))
  const lower = Math.floor(row)
  const upper = Math.min(lower + 1, FRONT_ROWS - 1)
  const start = (front[lower * 4] * 255 + front[lower * 4 + 1]) / 65025
  const end = (front[upper * 4] * 255 + front[upper * 4 + 1]) / 65025
  return x - (2 * (start + (end - start) * (row - lower)) - .5)
}

const NOISE = `
float cloudHash(vec2 cell) {
  vec3 p = fract(vec3(cell.xyx) * .1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float cloudNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  vec2 ease = f * f * (3.0 - 2.0 * f);
  return mix(mix(cloudHash(cell), cloudHash(cell + vec2(1.0, 0.0)), ease.x),
    mix(cloudHash(cell + vec2(0.0, 1.0)), cloudHash(cell + vec2(1.0)), ease.x), ease.y);
}
float vapor(vec2 p) {
  return .57 * cloudNoise(p) + .27 * cloudNoise(p * 2.03 + 7.13)
    + .11 * cloudNoise(p * 4.19 - 3.35) + .05 * cloudNoise(p * 8.07 + 1.91);
}
`

const FOG_FRAGMENT = FLOW_DITHER_FRAGMENT
  .replace('uniform float u_pixelRatio;', `uniform float u_pixelRatio;
uniform float u_progress;
uniform vec3 u_highlight;
uniform vec3 u_colorMain;
uniform vec3 u_colorDeep;
${FRONT_FIELD}`)
  .replace('void main() {', `${NOISE}
void main() {
  float p = u_progress;
  if (p <= 0.0 || p >= 1.0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float d = edgeDistance(v_uv);
  vec2 flow = vec2(d * 8.3 + p * .90, v_uv.y * 3.4 - p * .83);
  vec2 warp = vec2(vapor(flow + vec2(4.2, 1.4)), vapor(flow - vec2(2.8, 3.7)));
  vec2 eddies = flow * vec2(1.13, 1.8) + (warp - .5) * 2.15;
  float wisps = vapor(eddies);
  float folds = vapor(eddies + vec2(.28, -.19));
  float relief = (wisps - folds) * 2.8;
  float strands = vapor(vec2(flow.x * 1.42, flow.y * 3.1) + (warp - .5) * 1.41);
  float breakUp = (wisps - .52) * .17 + (strands - .52) * .065;
  float stroke = d + breakUp;
  float veil = smoothstep(-.20, .045, stroke) * (1.0 - smoothstep(.105, .245, stroke));
  float core = smoothstep(-.057, .063, stroke) * (1.0 - smoothstep(.077, .166, stroke));
  // Fine suspended clusters advect inside the veil, with opacity inherited from its density.
  vec2 grainUV = eddies * vec2(9.8, 10.2) + (warp - .5) * 2.6;
  float floc = smoothstep(.56, .86, cloudNoise(grainUV)) * smoothstep(.29, .67, wisps);
  float fog = veil * (.12 + .49 * wisps + .21 * strands + .14 * floc)
    + core * (.30 + .13 * folds);
  fog *= smoothstep(.0, .09, p) * (1.0 - smoothstep(.92, 1.0, p));
  fog = min(.90, fog);
  if (fog < .002) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec2 drift = vec2(.20 + .66 * p, -.038 + .066 * p) + (warp - .5) * .17;
  vec2 reflected = 1.0 - abs(mod(v_uv + drift, 2.0) - 1.0);`)
  .replace('  float cellSize = max(1.0, 2.5 * u_pixelRatio);\n', '')
  .replace('  vec2 cell = floor(centered / cellSize);\n', '')
  .replace('vec2 shapeUV = centered /', 'vec2 shapeUV = (centered + drift * u_resolution / 1.015) /')
  .replace('  float threshold = bayer2(cell) + bayer2(cell * 0.5) * 0.25;\n', '')
  .replace('step(1.0, shape + threshold)', 'smoothstep(.12, .83, shape)')
  .replace('texture2D(u_scene, v_uv).rgb;', 'texture2D(u_scene, reflected).rgb;')
  .replace('ribbon * 0.46', 'ribbon * 0.31')
  .replace('textureColor), 0.55', 'textureColor), 0.22')
  .replace('  gl_FragColor = vec4(blended, 1.0);', `
  vec3 lifted = mix(u_colorFront, u_highlight, .35);
  vec3 shadow = mix(u_colorDeep, u_colorMain, .42);
  vec3 cloudy = mix(blended, u_colorFront, .19 + .19 * wisps);
  cloudy = mix(cloudy, lifted, max(0.0, relief) * .28 + floc * .055);
  cloudy = mix(cloudy, shadow, max(0.0, -relief) * .33);
  gl_FragColor = vec4(cloudy * fog, fog);`)

const INK_FRAGMENT = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_outgoing;
uniform sampler2D u_incoming;
uniform vec2 u_resolution;
uniform float u_progress;
${FRONT_FIELD}
${NOISE}

void main() {
  vec4 oldInk = texture2D(u_outgoing, v_uv);
  vec4 newInk = texture2D(u_incoming, v_uv);
  if (u_progress <= 0.0) {
    gl_FragColor = oldInk;
    return;
  }
  if (u_progress >= 1.0) {
    gl_FragColor = newInk;
    return;
  }

  float d = edgeDistance(v_uv);
  float erosion = (cloudHash(floor(v_uv * u_resolution / 2.1)) - .5) * .042;
  float oldCoverage = 1.0 - smoothstep(-.042, .035, d + erosion);
  float newCoverage = smoothstep(.058, .140, d + erosion);
  gl_FragColor = oldInk * oldCoverage + newInk * newCoverage;
}
`

function createFogRenderer(background, surface) {
  const gl = surface.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false })
  const backgroundContext = background.getContext('2d', { alpha: false })
  if (!gl || !backgroundContext) throw new Error('Canvas rendering is unavailable.')

  const mesh = compileProgram(gl, VERTEX, FLOW_MESH_FRAGMENT)
  const backdrop = compileProgram(gl, VERTEX, FLOW_DITHER_FRAGMENT)
  const fog = compileProgram(gl, VERTEX, FOG_FRAGMENT)
  const ink = compileProgram(gl, VERTEX, INK_FRAGMENT)
  const quadBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)

  function createTexture() {
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return texture
  }

  const texture = createTexture()
  const frontTexture = createTexture()
  const inkTextures = [createTexture(), createTexture()]
  const front = new Uint8Array(FRONT_ROWS * 4)
  const target = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, target)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
  let width = 0
  let height = 0
  let ratio = 1
  let stops
  let packedStops

  function useTexture(unit, texture) {
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
  }

  function resize() {
    const box = surface.getBoundingClientRect()
    if (!box.width || !box.height) return false
    const renderScale = Math.min(window.devicePixelRatio || 1, 1.35, 1360 / Math.max(box.width, box.height))
    const nextWidth = Math.max(1, Math.round(box.width * renderScale))
    const nextHeight = Math.max(1, Math.round(box.height * renderScale))
    ratio = Math.min(nextWidth / box.width, nextHeight / box.height)
    if (nextWidth === width && nextHeight === height) return false
    width = background.width = surface.width = nextWidth
    height = background.height = surface.height = nextHeight
    useTexture(0, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, target)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Incomplete mesh framebuffer.')
    }
    gl.viewport(0, 0, width, height)
    return true
  }

  function bindFront(uniforms) {
    useTexture(1, frontTexture)
    gl.uniform1i(uniforms.u_front, 1)
  }

  function bindQuadPass(pass, framebuffer) {
    gl.disable(gl.BLEND)
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.useProgram(pass.program)
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
    gl.enableVertexAttribArray(pass.position)
    gl.vertexAttribPointer(pass.position, 2, gl.FLOAT, false, 0, 0)
    gl.uniform2f(pass.uniforms.u_resolution, width, height)
    return pass.uniforms
  }

  function drawMaterial(pass, time, progress, blend = false) {
    const s = bindQuadPass(pass, null)
    const [main, accent, deep, highlight, shadow, mist] = stops
    useTexture(0, texture)
    gl.uniform1i(s.u_scene, 0)
    gl.uniform1f(s.u_time, time * .1)
    gl.uniform1f(s.u_pixelRatio, ratio)
    gl.uniform3fv(s.u_colorBack, shadow)
    gl.uniform3fv(s.u_colorFront, mist)
    gl.uniform3fv(s.u_colorRibbon, accent)
    if (pass === fog) {
      bindFront(s)
      gl.uniform1f(s.u_progress, progress)
      gl.uniform3fv(s.u_highlight, highlight)
      gl.uniform3fv(s.u_colorMain, main)
      gl.uniform3fv(s.u_colorDeep, deep)
    }
    if (pass === fog && blend) {
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  function drawInk(progress) {
    const s = bindQuadPass(ink, null)
    bindFront(s)
    useTexture(2, inkTextures[0])
    useTexture(3, inkTextures[1])
    gl.uniform1i(s.u_outgoing, 2)
    gl.uniform1i(s.u_incoming, 3)
    gl.uniform1f(s.u_progress, progress)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  return {
    resize,
    setColors(nextStops) {
      stops = nextStops
      packedStops = new Float32Array(stops.flatMap(rgb => [...rgb, 1]))
    },
    setInk(scenes) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
      scenes.forEach((scene, i) => {
        useTexture(0, inkTextures[i])
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene)
      })
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    },
    draw(time, progress, showInk = false) {
      if (!width || !stops) return null
      useTexture(0, null)
      const m = bindQuadPass(mesh, target)
      gl.uniform1f(m.u_time, time * .3)
      gl.uniform1f(m.u_colorsCount, stops.length)
      gl.uniform4fv(m.u_colors, packedStops)
      gl.uniform1f(m.u_distortion, .8)
      gl.uniform1f(m.u_swirl, .1)
      gl.uniform1f(m.u_grainMixer, 0)
      gl.uniform1f(m.u_grainOverlay, .01)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      drawMaterial(backdrop, time, 0)
      backgroundContext.drawImage(surface, 0, 0)

      fillFogFront(front, progress)
      useTexture(1, frontTexture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, FRONT_ROWS, 0, gl.RGBA, gl.UNSIGNED_BYTE, front)
      if (showInk) drawInk(progress)
      drawMaterial(fog, time, progress, showInk)
      return front
    }
  }
}
