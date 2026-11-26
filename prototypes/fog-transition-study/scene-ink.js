// Rasterize the demo's actual text at its laid-out positions, including wrapped lines.
function rasterizeScene(screen, box, width, height) {
  const sheet = document.createElement('canvas')
  sheet.width = width
  sheet.height = height
  const ctx = sheet.getContext('2d', { willReadFrequently: true })
  ctx.scale(width / box.width, height / box.height)

  const selection = screen.querySelector('.active-entry')
  const row = selection.getBoundingClientRect()
  const rowStyle = getComputedStyle(selection)
  ctx.fillStyle = rowStyle.backgroundColor
  ctx.beginPath()
  ctx.roundRect(row.left - box.left, row.top - box.top, row.width, row.height, parseFloat(rowStyle.borderRadius))
  ctx.fill()

  const range = document.createRange()
  for (const label of screen.querySelectorAll('nav span, .preview-label, h2, .mock-text')) {
    const style = getComputedStyle(label)
    ctx.font = [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].join(' ')
    ctx.fillStyle = style.color
    ctx.textBaseline = 'alphabetic'
    const metrics = ctx.measureText('浮')
    const baseline = (metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2
    const text = label.firstChild
    let offset = 0
    for (const glyph of text.textContent) {
      range.setStart(text, offset)
      offset += glyph.length
      range.setEnd(text, offset)
      if (!glyph.trim()) continue
      const rect = range.getBoundingClientRect()
      ctx.fillText(glyph, rect.left - box.left, rect.top + rect.height / 2 + baseline - box.top)
    }
  }
  return { sheet, pixels: ctx.getImageData(0, 0, width, height).data }
}

function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function sampleInk(pixels, width, height, seed) {
  const random = seededRandom(seed)
  const points = []
  let candidates = 0
  const limit = 580
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = (y * width + x) * 4
      if (pixels[i + 3] < 90) continue
      // Favor the edge of each stroke, where small pieces would separate first.
      const edge = Math.min(pixels[i - 1], pixels[i + 7]) < 84
        || Math.min(pixels[i + 3 - width * 4], pixels[i + 3 + width * 4]) < 84
      if (random() > (edge ? .78 : .34)) continue

      candidates += 1
      const slot = points.length < limit ? points.length : Math.floor(random() * candidates)
      if (slot >= limit) continue
      points[slot] = {
        x: (x + random()) / width,
        y: (y + random()) / height,
        sourceColor: [pixels[i], pixels[i + 1], pixels[i + 2]],
        size: .46 + random() ** 2 * 1.26,
        lateral: 23 + random() ** 1.4 * 73,
        height: (random() - .5) * 38,
        phase: random() * 2 * Math.PI,
        delay: (random() - .5) * .029,
        density: .48 + random() * .49
      }
    }
  }
  return points
}

function createInkAnimation(canvas) {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D rendering is unavailable.')
  let size
  let points = []
  let palette = null

  function setColors(stops) {
    palette = stops
    const mist = stops[5]
    for (const scene of points) {
      for (const point of scene) {
        const channels = point.sourceColor.map((value, i) => Math.round(value * .75 + mist[i] * 255 * .25))
        point.color = 'rgb(' + channels.join(',') + ')'
      }
    }
  }

  return {
    setColors,
    capture(screens, box, width, height) {
      canvas.width = width
      canvas.height = height
      size = { width: box.width, height: box.height }
      ctx.setTransform(width / box.width, 0, 0, height / box.height, 0, 0)
      const scenes = screens.map(screen => rasterizeScene(screen, box, width, height))
      points = scenes.map(({ pixels }, i) => sampleInk(pixels, width, height, 29187 + i * 269))
      if (palette) setColors(palette)
      return scenes.map(({ sheet }) => sheet)
    },
    draw(front, progress) {
      if (!size) return
      const { width, height } = size
      ctx.clearRect(0, 0, width, height)
      if (!front || progress <= 0 || progress >= 1) return
      const scale = Math.min(1, width / 690)

      points.forEach((scene, index) => {
        const assembling = index === 1
        for (const point of scene) {
          const d = distanceFromFront(front, point.x, point.y) + point.delay
          const phase = assembling
            ? (d - .038) / .119
            : (d + .057) / .201
          if (phase <= 0 || phase >= 1) continue
          // Both clouds follow the right-to-left airflow. Incoming fragments settle into the glyph.
          const drift = assembling ? (1 - phase) ** 1.5 : phase ** 1.30
          const dx = point.lateral * drift * scale * (assembling ? .79 : -1)
          const dy = (point.height + 11 * Math.sin(point.phase + phase * 5.6)) * drift * scale
          const opacity = smoothstep(0, .21, phase) * (1 - smoothstep(.53, 1, phase))
          const x = point.x * width + dx
          const y = point.y * height + dy
          const radius = point.size * (assembling ? .73 + phase * .27 : 1 - phase * .53)

          ctx.fillStyle = point.color
          ctx.globalAlpha = opacity * point.density * .75
          ctx.beginPath()
          ctx.ellipse(x, y, radius, radius * .57, point.phase + phase * 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      })
      ctx.globalAlpha = 1
    }
  }
}
