/**
 * 幻流「流雾粒子」WebGL2 渲染管线（纯程序化原生合成版）：
 * 两遍绘制：半分辨率网格流体底色 → 全分辨率波动平流、三层视差粒子雾化、波峰立体明暗与对角线有机波前遮罩。
 * 严格沿用 11-21 原版（4019e618）与实景背板同源的色板、流速脉冲与右上→左下对角线流场，
 * 零 DOM 截图纹理上传、零主线程阻塞、恒定高帧率。
 */
import { FLOW_DITHER_FRAGMENT, FLOW_MESH_FRAGMENT } from './flow-shaders.js'

export const LIQUID_DURATION = 1000
export const COVER_END = .44
export const REVEAL_START = .50
export const HANDOFF_POINT = .48
export const MAX_FOREGROUND_BLUR = 3.5

function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/**
 * 与片元着色器同源的覆盖层基础不透明度模型（stage=0 离场盖幕/持稳，stage=1 进场退幕），
 * 供单元测试精确校验起止零跳变、中段全屏严密遮盖以及右上→左下对角线推进方向。
 */
export function liquidMaskOpacity({
  progress,
  sweep = 0,
  crest = .5,
  fiber = .5,
  stage = 0
}) {
  const organic = .065 * (crest - .5) + .035 * (fiber - .5)
  if (stage < .5) {
    const coverP = clamp01((progress - .19 * sweep + organic - .05) / .15)
    return smoothstep(0, 1, coverP)
  }
  const revealP = clamp01((progress - REVEAL_START - .22 * sweep + organic - .05) / .18)
  return 1 - smoothstep(0, 1, revealP)
}

/**
 * 前景真实 DOM 的原地柔化雾化曲线（仅作用于 filter: blur，绝不产生位移或缩放）：
 * 离场段随波前轻微柔化融入流场，进场段随波前由雾化凝结至完全清晰，尾段提前归零杜绝跳变。
 */
export function liquidForegroundBlur(progress, stage = 0) {
  if (stage < .5) {
    return MAX_FOREGROUND_BLUR * smoothstep(.04, .36, progress)
  }
  return MAX_FOREGROUND_BLUR * (1 - smoothstep(.54, .90, progress))
}

/** 计算转场期间流场相位的积分增量，使结束接管时实景背景能无缝续接动画进度。 */
export function liquidPhase(elapsed, speed, hold = 0) {
  // Integrate the speed pulse so the live backdrop can resume at the last rendered phase.
  const bell = elapsed / 2 - Math.sin(2 * Math.PI * elapsed) / (4 * Math.PI)
  const pulse = 4.8
  const holdBell = Math.sin(Math.PI * COVER_END) ** 2
  const coverSpeed = speed + pulse * holdBell
  return speed * elapsed + pulse * bell + coverSpeed * hold
}

const FLOW_VERTEX = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = .5 * (a_position + 1.0);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

function glsl3(source) {
  return '#version 300 es\n' + source
    .replace('precision highp float;', 'precision highp float;\nout vec4 outColor;')
    .replace('varying vec2 v_uv;', 'in vec2 v_uv;')
    .replaceAll('texture2D(', 'texture(')
    .replaceAll('gl_FragColor', 'outColor')
}

const FLOW_SHARED = `
uniform float u_progress;
uniform float u_stage;
uniform float u_aspect;
uniform vec3 u_primary;
uniform vec3 u_accent;

const float PI = 3.141592653589793;
const vec2 DIAGONAL = vec2(-.8660254, .5);
const vec2 ACROSS = vec2(.5, .8660254);

vec2 flow(vec2 uv) {
  vec2 pos = vec2((uv.x - .5) * u_aspect, .5 - uv.y);
  float t = u_progress;
  float bend = .185 * sin(4.4 * pos.y + 2.1 * pos.x - 3.7 * t)
    + .075 * sin(11.1 * pos.y - 1.6 * pos.x + 3.2 * t);
  vec2 physical = DIAGONAL + ACROSS * bend;
  return vec2(physical.x / u_aspect, -physical.y);
}

vec2 traceFlow(vec2 origin, float length) {
  return origin + length * flow(origin + .5 * length * flow(origin));
}

float diagonalSweep(vec2 uv) {
  float horizontal = .8660254 * u_aspect;
  float s = (horizontal * (1.0 - uv.x) + .5 * (1.0 - uv.y)) / (horizontal + .5);
  return s + .37 * s * (1.0 - s) * sin(6.1 * uv.y + 1.7 * s);
}

float localProgress(float sweep) {
  return clamp((u_progress - .46 * sweep) / .43, 0.0, 1.0);
}

float mistHash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float mistNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mistHash21(i), mistHash21(i + vec2(1.0, 0.0)), u.x),
    mix(mistHash21(i + vec2(0.0, 1.0)), mistHash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Soft frosted sheen sampled from the moving fluid mesh along the translucent wave lip.
vec3 frostedBackdrop(vec2 uv, vec3 sharpMaterial) {
  vec2 stepUv = 22.0 * u_pixelRatio / max(u_resolution, vec2(1.0));
  vec3 acc = texture2D(u_scene, clamp(uv, 0.0, 1.0)).rgb * 0.28;
  acc += texture2D(u_scene, clamp(uv + vec2(stepUv.x, stepUv.y * 0.5), 0.0, 1.0)).rgb * 0.18;
  acc += texture2D(u_scene, clamp(uv + vec2(-stepUv.x, stepUv.y * 0.5), 0.0, 1.0)).rgb * 0.18;
  acc += texture2D(u_scene, clamp(uv + vec2(stepUv.x * 0.5, -stepUv.y), 0.0, 1.0)).rgb * 0.18;
  acc += texture2D(u_scene, clamp(uv + vec2(-stepUv.x * 0.5, -stepUv.y), 0.0, 1.0)).rgb * 0.18;
  float luma = dot(acc, vec3(.299, .587, .114));
  vec3 saturated = clamp(vec3(luma) + (acc - vec3(luma)) * 1.18, 0.0, 1.0);
  return mix(saturated, sharpMaterial, 0.12);
}
`

const FLOW_COMPOSITE = glsl3(FLOW_DITHER_FRAGMENT
  .replace('void main() {', FLOW_SHARED + `
void main() {
  float sweep = diagonalSweep(v_uv);
  float baseProgress = localProgress(sweep);
  float bell = sin(PI * u_progress);
  bell *= bell;
  float local = sin(PI * baseProgress);
  float transport = -.228 * bell * (.62 + .38 * local);
  vec2 advected = traceFlow(v_uv, transport);
  vec2 advectedUV = 1.0 - abs(mod(advected, 2.0) - 1.0);`)
  .replace('  vec2 shapeUV = centered /', '  vec2 shapeUV = (centered + (advected - v_uv) * u_resolution / 1.015) /')
  .replace('  shape = .15 / max(0.001, abs(sin(t - shapeUV.y - shapeUV.x)));', `
  float wavePhase = t - shapeUV.y - shapeUV.x;
  shape = .15 / max(.001, abs(sin(wavePhase)));`)
  .replace('texture2D(u_scene, v_uv)', 'texture2D(u_scene, advectedUV)')
  .replace('ribbon * 0.46', 'ribbon * (.46 - .04 * bell)')
  .replace('textureColor), 0.55', 'textureColor), .55 - .17 * bell')
  .replace('  gl_FragColor = vec4(blended, 1.0);', `
  vec2 physical = vec2((advected.x - .5) * u_aspect, .5 - advected.y);
  vec2 screenPhys = vec2((v_uv.x - .5) * u_aspect, .5 - v_uv.y);
  float along = dot(physical, DIAGONAL);
  float across = dot(physical, ACROSS);
  float streamPhase = wavePhase * 1.72 + along * 4.5 + .61 * sin(across * 10.8 + t * 1.28);
  float crest = smoothstep(-.39, .86, sin(streamPhase));
  float crestAhead = smoothstep(-.39, .86, sin(streamPhase + .46));
  float crestSlope = crestAhead - crest;
  float fiber = .5 + .5 * sin(2.66 * streamPhase + .64 * sin(along * 10.0 + across * 9.4));
  float current = bell * (.34 + .66 * local);
  vec3 undertow = mix(blended, u_primary, .11 * current * (1.0 - crest));
  vec3 material = mix(undertow, u_accent, current * crest * (.09 + .18 * fiber));
  vec3 frosted = frostedBackdrop(advectedUV, material);

  float organic = .065 * (crest - .5) + .035 * (fiber - .5);
  float baseOpacity = 1.0;
  if (u_stage < .5) {
    float coverP = clamp((u_progress - .19 * sweep + organic - .05) / .15, 0.0, 1.0);
    baseOpacity = smoothstep(0.0, 1.0, coverP);
  } else {
    float revealP = clamp((u_progress - .50 - .22 * sweep + organic - .05) / .18, 0.0, 1.0);
    baseOpacity = 1.0 - smoothstep(0.0, 1.0, revealP);
  }

  float lip = 4.0 * baseOpacity * (1.0 - baseOpacity);
  float envelope = smoothstep(0.0, .08, u_progress) * (1.0 - smoothstep(.92, 1.0, u_progress));

  // Layered parallax volumetric mist (far 0.55x + near 1.25x) using pure smooth noise & background-native Bayer grain.
  vec2 farCoord = vec2(dot(screenPhys, DIAGONAL) - u_progress * .42, dot(screenPhys, ACROSS)) * 3.6;
  float farCloud = mistNoise(farCoord) * .62 + mistNoise(farCoord * 2.15 + vec2(3.7, -2.1)) * .38;
  vec2 nearCoord = vec2(dot(physical, DIAGONAL) - u_progress * .96, dot(physical, ACROSS)) * 5.2;
  float nearCloud = mistNoise(nearCoord + vec2(1.4, -0.8)) * .58 + mistNoise(nearCoord * 2.05 + vec2(-2.9, 4.3)) * .42;

  // Directional wave-ridge volumetric relief (leading crest highlight + trailing trough shade).
  float ridgeLight = max(0.0, crestSlope) * (.55 + .45 * fiber);
  float troughShade = max(0.0, -crestSlope) * (.65 + .35 * (1.0 - crest));

  vec3 volColor = mix(material, frosted, (.26 * lip + .14 * farCloud + .10 * nearCloud * lip) * envelope);
  volColor = mix(volColor, u_colorBack, clamp(troughShade * (.24 + .18 * lip) * envelope, 0.0, .38));
  vec3 crestTint = mix(u_colorFront, u_accent, .38);
  volColor += crestTint * (ridgeLight * (.18 + .22 * lip) * envelope);

  // Subtle background-native Bayer ordered-dither mist texture along the wave crest & lip (no floating dust dots).
  float mistDither = step(1.0, (farCloud * .55 + nearCloud * .45) * (.55 + .45 * max(lip, crest)) + threshold * .85);
  vec3 mistTone = mix(frosted, u_colorFront, .32);
  volColor = mix(volColor, mistTone, clamp(mistDither * (.08 + .10 * lip) * envelope, 0.0, .18));

  float opacity = baseOpacity;
  gl_FragColor = vec4(volColor * opacity, opacity);`))

/** 初始化纯程序化「流雾粒子」WebGL2 渲染器（仅含离屏网格 FBO，零 DOM 纹理上传）。 */
export function createLiquidRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false })
  if (!gl) throw new Error('WebGL2 is unavailable.')
  function shader(type, source) {
    const id = gl.createShader(type)
    gl.shaderSource(id, source)
    gl.compileShader(id)
    if (!gl.getShaderParameter(id, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(id))
    return id
  }
  const vertex = shader(gl.VERTEX_SHADER, FLOW_VERTEX)
  function program(source) {
    const fragment = shader(gl.FRAGMENT_SHADER, source)
    const id = gl.createProgram()
    gl.attachShader(id, vertex)
    gl.attachShader(id, fragment)
    gl.bindAttribLocation(id, 0, 'a_position')
    gl.linkProgram(id)
    gl.deleteShader(fragment)
    if (!gl.getProgramParameter(id, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(id))
    const uniform = {}
    for (let i = 0; i < gl.getProgramParameter(id, gl.ACTIVE_UNIFORMS); i += 1) {
      const { name } = gl.getActiveUniform(id, i)
      uniform[name.replace(/\[0\]$/, '')] = gl.getUniformLocation(id, name)
    }
    return { id, uniform }
  }

  const mesh = program(glsl3(FLOW_MESH_FRAGMENT))
  const composite = program(FLOW_COMPOSITE)
  gl.deleteShader(vertex)
  const shape = gl.createVertexArray()
  gl.bindVertexArray(shape)
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  const meshTexture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, meshTexture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  const framebuffer = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, meshTexture, 0)
  const maxEdge = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 4096)
  const channels = new Float32Array(24)
  let pixelRatio = 1
  let allocated = false
  let meshWidth = 0
  let meshHeight = 0

  return {
    resize(cssWidth, cssHeight) {
      const dpr = window.devicePixelRatio || 1
      const density = Math.min(dpr, 1.5, maxEdge / Math.max(cssWidth, cssHeight))
      const width = Math.max(1, Math.round(cssWidth * density))
      const height = Math.max(1, Math.round(cssHeight * density))
      pixelRatio = Math.min(width / cssWidth, height / cssHeight)
      if (!allocated || canvas.width !== width || canvas.height !== height) {
        allocated = true
        canvas.width = width
        canvas.height = height
        meshWidth = Math.max(1, Math.ceil(width / 2))
        meshHeight = Math.max(1, Math.ceil(height / 2))
        gl.bindTexture(gl.TEXTURE_2D, meshTexture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, meshWidth, meshHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
          throw new Error('The transition framebuffer is incomplete.')
        }
      }
    },
    draw(progress, phase, palette, stage = 0) {
      if (gl.isContextLost()) throw new Error('Transition context lost.')
      for (let i = 0; i < palette.length; i += 1) {
        channels.set(palette[i], i * 4)
        channels[i * 4 + 3] = 1
      }
      const { width, height } = canvas
      gl.bindVertexArray(shape)

      const m = mesh.uniform
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, null)
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      gl.viewport(0, 0, meshWidth, meshHeight)
      gl.useProgram(mesh.id)
      gl.uniform2f(m.u_resolution, width, height)
      gl.uniform1f(m.u_time, phase * .3)
      gl.uniform1f(m.u_colorsCount, palette.length)
      gl.uniform4fv(m.u_colors, channels)
      gl.uniform1f(m.u_distortion, .8)
      gl.uniform1f(m.u_swirl, .1)
      gl.uniform1f(m.u_grainMixer, 0)
      gl.uniform1f(m.u_grainOverlay, .01)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      const [primary, accent, , , shadow, mist] = palette
      const s = composite.uniform
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, width, height)
      gl.useProgram(composite.id)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, meshTexture)
      gl.uniform1i(s.u_scene, 0)
      gl.uniform2f(s.u_resolution, width, height)
      gl.uniform1f(s.u_pixelRatio, pixelRatio)
      gl.uniform1f(s.u_time, phase * .1)
      gl.uniform1f(s.u_aspect, width / Math.max(1, height))
      gl.uniform1f(s.u_progress, progress)
      gl.uniform1f(s.u_stage, stage)
      gl.uniform3fv(s.u_primary, primary)
      gl.uniform3fv(s.u_accent, accent)
      gl.uniform3fv(s.u_colorBack, shadow)
      gl.uniform3fv(s.u_colorFront, mist)
      gl.uniform3fv(s.u_colorRibbon, accent)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    clear() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    },
    dispose() {
      gl.deleteFramebuffer(framebuffer)
      gl.deleteTexture(meshTexture)
      gl.deleteBuffer(buffer)
      gl.deleteVertexArray(shape)
      gl.deleteProgram(mesh.id)
      gl.deleteProgram(composite.id)
    }
  }
}
