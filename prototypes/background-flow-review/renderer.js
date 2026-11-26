/* Deterministic background and UI advection in a single WebGL2 composition. */
const BASE_SPEED = .35
const INITIAL_PHASE = 5.5
const DURATION = 1000

function phaseOffset(t) {
  const bell = t / 2 - Math.sin(2 * Math.PI * t) / (4 * Math.PI)
  return BASE_SPEED * t + 2.65 * bell
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
uniform float u_aspect;
uniform int u_output;
uniform float u_testLocal;
uniform vec3 u_primary;
uniform vec3 u_accent;
uniform sampler2D u_oldForms;
uniform sampler2D u_oldText;
uniform sampler2D u_newForms;
uniform sampler2D u_newText;

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
  // Midpoint sampling bends the advection and the individual blur taps along the same field.
  return origin + length * flow(origin + .5 * length * flow(origin));
}

float localProgress(vec2 uv) {
  float horizontal = .8660254 * u_aspect;
  float s = (horizontal * (1.0 - uv.x) + .5 * (1.0 - uv.y)) / (horizontal + .5);
  s += .37 * s * (1.0 - s) * sin(6.1 * uv.y + 1.7 * s);
  return clamp((u_progress - .52 * s) / .48, 0.0, 1.0);
}

vec4 sampleInk(sampler2D image, vec2 uv, float lod) {
  if (min(uv.x, uv.y) < 0.0 || max(uv.x, uv.y) > 1.0) return vec4(0.0);
  return textureLod(image, uv, lod);
}

vec4 inkAlongFlow(sampler2D image, vec2 uv, float shift, float span, float haze) {
  vec2 source = traceFlow(uv, shift);
  if (span < .0002) return sampleInk(image, source, 0.0);
  vec2 stepAlong = flow(source) * span;
  vec2 spread = vec2(stepAlong.y / u_aspect, -stepAlong.x * u_aspect) * haze;
  // The mip footprint bridges adjacent taps so stretched strokes form a smear, not copies of glyphs.
  float lod = log2(max(1.0, length(stepAlong * vec2(textureSize(image, 0))) * .48));
  vec4 value = sampleInk(image, source, lod) * .26;
  value += sampleInk(image, source - .41 * stepAlong - spread, lod) * .19;
  value += sampleInk(image, source + .41 * stepAlong + spread, lod) * .19;
  value += sampleInk(image, source - .83 * stepAlong + .73 * spread, lod) * .13;
  value += sampleInk(image, source + .83 * stepAlong - .73 * spread, lod) * .13;
  value += sampleInk(image, source - 1.34 * stepAlong, lod) * .05;
  value += sampleInk(image, source + 1.34 * stepAlong, lod) * .05;
  return value;
}

vec3 placeInk(vec3 color, vec3 material, vec4 ink, float visibility, float dilution) {
  vec3 tint = mix(ink.rgb, material * ink.a, dilution);
  return color * (1.0 - visibility * ink.a) + tint * visibility;
}

// Diluted source color becomes an optical density in the same crests as the background.
vec3 pigment(vec3 material, vec4 forms, vec4 text, float crest, float strength) {
  float lightInk = min(1.0, text.a * 5.4);
  float darkInk = max(0.0, forms.a - dot(forms.rgb, vec3(.299, .587, .114)));
  vec3 dyed = mix(material, u_colorBack, darkInk * strength * (.13 + .44 * crest));
  return mix(dyed, u_colorFront, lightInk * strength * (.12 + .57 * crest));
}

vec3 compositeScene(vec3 material, float p, vec2 refraction, float crest, float filament) {
  if (p < .44) {
    float melt = smoothstep(.008, .36, p);
    float erosion = smoothstep(.10, .44, p);
    float shift = -melt * (.17 + .085 * crest);
    vec2 wet = v_uv + refraction * melt;
    vec4 oldForm = inkAlongFlow(u_oldForms, wet, shift, .069 * melt, .10);
    vec4 oldText = inkAlongFlow(u_oldText, wet, shift - .048 * melt, .104 * melt, .16);
    float structure = 1.0 - erosion;
    float type = 1.0 - smoothstep(.085, .412, p);
    float drift = smoothstep(.045, .275, p) * (1.0 - smoothstep(.292, .44, p));
    vec3 tint = pigment(material, oldForm, oldText, crest, drift * (.60 + .38 * filament));
    vec3 layer = placeInk(tint, tint, oldForm, structure, .93 * melt);
    return placeInk(layer, tint, oldText, type, .96 * melt);
  }
  if (p > .56) {
    float structure = smoothstep(.56, .82, p);
    float typeVisible = smoothstep(.68, .935, p);
    float clarity = smoothstep(.76, 1.0, p);
    float gather = 1.0 - structure;
    float typeGather = 1.0 - smoothstep(.68, 1.0, p);
    vec4 newForm = inkAlongFlow(u_newForms, v_uv + refraction * gather,
      (.126 + .086 * crest) * gather, .095 * gather, .13);
    vec4 newText = inkAlongFlow(u_newText, v_uv + refraction * typeGather * .72,
      .117 * typeGather, .091 * (1.0 - clarity), .24);
    float deposition = smoothstep(.56, .664, p) * (1.0 - smoothstep(.75, .91, p));
    float hints = smoothstep(.66, .75, p);
    vec3 tint = pigment(material, newForm, newText * hints, crest, deposition * (.58 + .42 * filament));
    vec3 layer = placeInk(tint, tint, newForm, structure, .90 * gather);
    return placeInk(layer, tint, newText, typeVisible, .76 * (1.0 - clarity));
  }
  return material;
}
`

const FLOW_COMPOSITE = glsl3(FLOW_DITHER_FRAGMENT
  .replace('void main() {', FLOW_SHARED + `
void main() {
  float baseProgress = localProgress(v_uv);
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
  .replace('ribbon * 0.46', 'ribbon * (.28 + .14 * bell)')
  .replace('textureColor), 0.55', 'textureColor), .28 + .10 * bell')
  .replace('  gl_FragColor = vec4(blended, 1.0);', `
  // The moving crests color the current, refract the UI, and determine where it melts or gathers first.
  vec2 physical = vec2((advected.x - .5) * u_aspect, .5 - advected.y);
  float along = dot(physical, DIAGONAL);
  float across = dot(physical, ACROSS);
  float streamPhase = wavePhase * 1.72 + along * 4.5 + .61 * sin(across * 10.8 + t * 1.28);
  float crest = smoothstep(-.39, .86, sin(streamPhase));
  float fiber = .5 + .5 * sin(2.66 * streamPhase + .64 * sin(along * 10.0 + across * 9.4));
  float spread = bell * baseProgress * (1.0 - baseProgress);
  float p = clamp(baseProgress + spread * (.43 * (crest - .5) + .22 * (fiber - .5)), 0.0, 1.0);
  if (u_testLocal >= 0.0) p = u_testLocal;
  if (u_output == 2) {
    outColor = vec4(p < .44 ? 1.0 : 0.0, p > .56 ? 1.0 : 0.0, p, 1.0);
    return;
  }

  vec2 crossUV = vec2(ACROSS.x / u_aspect, -ACROSS.y);
  float ripple = .031 * sin(streamPhase) + .012 * cos(2.66 * streamPhase + across * 7.7);
  vec2 refraction = crossUV * ripple + (advected - v_uv) * .40;
  float current = bell * (.34 + .66 * local);
  vec3 undertow = mix(blended, u_primary, .11 * current * (1.0 - crest));
  vec3 material = mix(undertow, u_accent, current * crest * (.09 + .18 * fiber));
  if (u_output == 3 || u_output == 4) {
    vec4 forms = u_output == 3 ? sampleInk(u_oldForms, v_uv, 0.0) : sampleInk(u_newForms, v_uv, 0.0);
    vec4 type = u_output == 3 ? sampleInk(u_oldText, v_uv, 0.0) : sampleInk(u_newText, v_uv, 0.0);
    vec3 layer = placeInk(material, material, forms, 1.0, 0.0);
    gl_FragColor = vec4(placeInk(layer, material, type, 1.0, 0.0), 1.0);
    return;
  }
  gl_FragColor = vec4(u_output == 1 ? material : compositeScene(material, p, refraction, crest, fiber), 1.0);`))

function createFlowRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false })
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

  function allocateTexture() {
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return tex
  }
  const meshTexture = allocateTexture()
  const ink = Array.from({ length: 4 }, allocateTexture)
  const framebuffer = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, meshTexture, 0)
  const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE)
  let geometry
  let palette
  let channels
  let pixelRatio = 1

  function bindTexture(unit, tex) {
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
  }

  return {
    resize(logicalWidth, logicalHeight, width, height, dpr) {
      canvas.width = width
      canvas.height = height
      pixelRatio = Math.min(width / logicalWidth, height / logicalHeight)
      gl.viewport(0, 0, width, height)
      bindTexture(0, meshTexture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error('The background framebuffer is incomplete.')
      }

      const density = Math.min(Math.max(2, dpr), maxTexture / Math.max(logicalWidth, logicalHeight))
      const key = [logicalWidth, logicalHeight, density].join(':')
      if (geometry !== key) {
        geometry = key
        const layers = ['A', 'B'].flatMap(page => captureScene(page, logicalWidth, logicalHeight, density))
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
        layers.forEach((layer, i) => {
          bindTexture(0, ink[i])
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
          gl.generateMipmap(gl.TEXTURE_2D)
        })
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      }
    },
    setPalette(stops) {
      palette = stops
      channels = new Float32Array(stops.flatMap(rgb => [...rgb, 1]))
    },
    draw(time, phase, options = {}) {
      const { output = 0, local = -1 } = options
      const { width, height } = canvas
      const m = mesh.uniform
      bindTexture(0, null)
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
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
      gl.useProgram(composite.id)
      gl.uniform2f(s.u_resolution, width, height)
      gl.uniform1f(s.u_pixelRatio, pixelRatio)
      gl.uniform1f(s.u_time, phase * .43)
      gl.uniform1f(s.u_aspect, width / height)
      gl.uniform1f(s.u_progress, time)
      gl.uniform1f(s.u_testLocal, local)
      gl.uniform1i(s.u_output, output)
      gl.uniform3fv(s.u_primary, primary)
      gl.uniform3fv(s.u_accent, accent)
      gl.uniform3fv(s.u_colorBack, shadow)
      gl.uniform3fv(s.u_colorFront, mist)
      gl.uniform3fv(s.u_colorRibbon, accent)
      bindTexture(0, meshTexture)
      gl.uniform1i(s.u_scene, 0)
      const samplers = ['u_oldForms', 'u_oldText', 'u_newForms', 'u_newText']
      ink.forEach((tex, i) => {
        bindTexture(i + 1, tex)
        gl.uniform1i(s[samplers[i]], i + 1)
      })
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
  }
}
