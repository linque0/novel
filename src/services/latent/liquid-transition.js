import { getTransitionBackdrop } from './flow.js'
import { blendFlowStops } from './flow-color-stops.js'
import { createFlowCaptureQueue } from './flow-capture-queue.js'
import { createLiquidRenderer, LIQUID_DURATION, liquidPhase } from './liquid-transition-gl.js'

const CAPTURE_BUDGET_MS = 450
const HANDOFF_POINT = .96
const INCOMING_GATE = .24
const samePixel = (a, b) => Math.abs(a - b) < 1

export function liquidProgress(elapsed) {
  return Math.min(1, Math.max(0, elapsed / LIQUID_DURATION))
}

export function liquidFrame(now, start, speed, hold = 0) {
  const time = liquidProgress(now - start)
  return { time, phase: liquidPhase(time, speed, hold) }
}

function captureKey(root, rect) {
  const view = root.querySelector('.workbench-shell[data-module], .latent-shelf') || root
  return { root, view, module: view.dataset.module, rect }
}

function sameCapture(a, b) {
  return a.root === b.root && a.view === b.view && a.module === b.module && sameSceneRect(a.rect, b.rect)
}

export function sameSceneRect(a, b) {
  return ['left', 'top', 'width', 'height'].every(key => samePixel(a[key], b[key]))
}

export function matchesSceneAspect(image, rect) {
  return image.width > 0 && image.height > 0 && rect.width > 0 && rect.height > 0 &&
    Math.abs(image.height - image.width * rect.height / rect.width) <= 2
}

export function sceneCaptureOptions(rect, density, scrollX, scrollY, fast = true) {
  return {
    dpr: density,
    clip: { x: rect.left + scrollX, y: rect.top + scrollY, width: rect.width, height: rect.height },
    exclude: '[data-flow-transition-backdrop], .ls-card.is-out',
    excludeMode: 'hide',
    embedFonts: false,
    fast,
    outerTransforms: false,
    plugins: [{
      name: 'novel-studio-transition',
      afterClone({ clone, element }) {
        if (!clone) return
        clone.style.setProperty('box-sizing', 'border-box', 'important')
        clone.style.setProperty('width', element.offsetWidth + 'px', 'important')
        clone.style.setProperty('height', element.offsetHeight + 'px', 'important')
        clone.style.setProperty('background', 'none', 'important')
        for (const layer of clone.querySelectorAll('.latent-shelf, .workbench-shell[data-flow]')) {
          layer.style.setProperty('background', 'none', 'important')
        }
        for (const backdrop of clone.querySelectorAll('.ls-backdrop-wrap, .st-backdrop-wrap')) {
          backdrop.style.setProperty('display', 'none', 'important')
        }
        // In the isolated capture tree there is no live backdrop behind glass panels; skip expensive blur filters.
        const style = clone.ownerDocument.createElement('style')
        style.textContent = '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'
        clone.prepend(style)
      }
    }]
  }
}

export function createLiquidTransition(canvas, getScene) {
  let renderer
  let disposed = false
  let disposeSurface
  const queueCapture = createFlowCaptureQueue(sameCapture)
  let snapdomModule
  const loadSnapdom = () => {
    snapdomModule ||= import('@zumer/snapdom').catch(error => {
      snapdomModule = null
      throw error
    })
    return snapdomModule
  }
  let warmupTimer
  let warmupIdle
  function cancelWarmup() {
    if (warmupTimer !== undefined) {
      clearTimeout(warmupTimer)
      warmupTimer = undefined
    }
    if (warmupIdle !== undefined) {
      window.cancelIdleCallback?.(warmupIdle)
      warmupIdle = undefined
    }
  }
  function scheduleWarmup(delayMs = 0) {
    cancelWarmup()
    if (disposed) return
    const queueIdle = () => {
      warmupTimer = undefined
      if (disposed || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const run = () => {
        warmupIdle = undefined
        if (disposed || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        loadSnapdom().then(({ snapdom }) => {
          if (disposed || document.hidden) return
          const root = getScene()
          if (!root) return
          const rect = root.getBoundingClientRect()
          if (rect.width >= 1 && rect.height >= 1) {
            const density = Math.min(.85, window.devicePixelRatio || 1, 1)
            snapdom(root, sceneCaptureOptions(rect, density, window.scrollX, window.scrollY, false)).catch(() => {})
          }
        }).catch(() => {})
        if (renderer) return
        try {
          renderer = createLiquidRenderer(canvas)
          const root = getScene()
          const frame = root && getTransitionBackdrop(root)?.transitionFrame()
          if (frame) {
            renderer.resize(2, 2)
            renderer.draw(.5, frame.time, frame.stops)
            const rect = root.getBoundingClientRect()
            if (rect.width >= 1 && rect.height >= 1) renderer.resize(rect.width, rect.height)
          }
        } catch { /* Navigate directly if WebGL2 is unavailable. */ }
      }
      if (typeof window.requestIdleCallback === 'function') {
        warmupIdle = window.requestIdleCallback(run, { timeout: 1800 })
      } else {
        warmupTimer = setTimeout(run, 120)
      }
    }
    if (delayMs > 0) warmupTimer = setTimeout(queueIdle, delayMs)
    else queueIdle()
  }
  scheduleWarmup(0)

  async function capture(root, rect, signal, fast = true) {
    if (signal.aborted || disposed || rect.height < 1) return null
    const key = captureKey(root, rect)
    const isCurrent = () => !disposed && root.isConnected && sameCapture(key, captureKey(root, rect))
    try {
      const image = await queueCapture(key, async () => {
        if (!isCurrent()) return null
        const { snapdom } = await loadSnapdom()
        if (!isCurrent()) return null
        const density = Math.min(.85, canvas.width / rect.width, canvas.height / rect.height)
        return snapdom.toCanvas(root, sceneCaptureOptions(rect, density, window.scrollX, window.scrollY, fast))
      }, {
        signal,
        timeoutMs: CAPTURE_BUDGET_MS,
        skipBusy: true
      })
      if (!isCurrent()) return null
      return image && matchesSceneAspect(image, rect) ? image : null
    } catch { return null }
  }

  async function prepare({ signal }) {
    cancelWarmup()
    const root = getScene()
    const backdrop = root && getTransitionBackdrop(root)
    if (disposed || document.hidden || !backdrop?.transitionFrame()) return null
    const rect = root.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return null
    renderer ||= createLiquidRenderer(canvas)
    renderer.resize(rect.width, rect.height)
    const outgoing = await capture(root, rect, signal, false)
    if (signal.aborted || disposed || !root.isConnected ||
      document.hidden || !sameSceneRect(rect, root.getBoundingClientRect())) return null
    const source = backdrop.transitionFrame()
    if (!source) return null

    let raf
    let active = true
    let completed = false
    let startedAt
    let pausedAt
    let holdMs = 0
    let incomingDone = false
    let handedOff = false
    let destination
    let destinationBackdrop
    let releaseSource
    let releaseDestination
    let finish
    const finished = new Promise(resolve => { finish = resolve })

    function cleanup() {
      if (!active) return
      active = false
      disposeSurface = null
      cancelAnimationFrame(raf)
      signal.removeEventListener('abort', cleanup)
      window.removeEventListener('resize', cleanup)
      document.removeEventListener('visibilitychange', cleanup)
      canvas.hidden = true
      try {
        renderer?.clear()
      } finally {
        releaseSource?.()
        releaseDestination?.()
        if (completed && !disposed) scheduleWarmup(450)
        finish()
      }
    }

    function tick(now) {
      if (!active) return
      startedAt ??= now
      let elapsed = now - startedAt - holdMs
      if (!incomingDone && elapsed >= INCOMING_GATE * LIQUID_DURATION) {
        pausedAt ??= now
        elapsed = INCOMING_GATE * LIQUID_DURATION
      } else if (pausedAt !== undefined) {
        holdMs += now - pausedAt
        pausedAt = undefined
        elapsed = now - startedAt - holdMs
      }
      const time = liquidProgress(elapsed)
      const phase = source.time + liquidPhase(time, source.speed)
      const stops = destination
        ? blendFlowStops(source.stops, destination.stops, time, 1)
        : source.stops
      try {
        if (time >= HANDOFF_POINT && !handedOff) {
          handedOff = true
          // Sync and wake the live backdrop right before the final fade-out so handoff has zero pop.
          destinationBackdrop?.syncTransitionTime(phase)
          releaseSource?.()
          releaseSource = null
          releaseDestination?.()
          releaseDestination = null
        }
        renderer.draw(time, phase, stops)
        if (time === 1) {
          completed = true
          cleanup()
        }
        else raf = requestAnimationFrame(tick)
      } catch {
        cleanup()
      }
    }

    try {
      if (outgoing) renderer.setScene(outgoing, 'outgoing')
    } catch (error) {
      renderer?.clear()
      throw error
    }
    for (const key of ['left', 'top', 'width', 'height']) canvas.style[key] = rect[key] + 'px'
    disposeSurface = cleanup
    signal.addEventListener('abort', cleanup, { once: true })
    window.addEventListener('resize', cleanup, { once: true })
    document.addEventListener('visibilitychange', cleanup, { once: true })

    return {
      play() {
        if (!active) return Promise.resolve()
        releaseSource = backdrop.holdTransition()
        if (outgoing) {
          renderer.draw(0, source.time, source.stops)
          canvas.hidden = false
        }
        return Promise.resolve()
      },
      async reveal() {
        if (!active) return
        const next = getScene()
        if (!next || !sameSceneRect(rect, next.getBoundingClientRect())) return cleanup()
        destinationBackdrop = getTransitionBackdrop(next)
        destination = destinationBackdrop?.transitionFrame()
        if (destinationBackdrop !== backdrop) releaseDestination = destinationBackdrop?.holdTransition()
        if (canvas.hidden) {
          renderer.draw(0, source.time, source.stops)
          canvas.hidden = false
        }
        // Start the diagonal wave immediately: incoming isn't sampled until u_progress > 0.24.
        raf = requestAnimationFrame(tick)
        try {
          const incoming = await capture(next, rect, signal, false)
          if (active && incoming && sameSceneRect(rect, next.getBoundingClientRect())) {
            // Yield a frame between SVG rasterization and WebGL mipmap upload so opening frames stay smooth.
            await new Promise(resolve => requestAnimationFrame(resolve))
            if (active && sameSceneRect(rect, next.getBoundingClientRect())) {
              renderer.setScene(incoming, 'incoming')
            }
          }
        } catch {
          // The same moving flow can uncover the live page if its texture cannot be uploaded.
        } finally {
          incomingDone = true
        }
        await finished
      },
      dispose: cleanup
    }
  }

  return {
    prepare,
    dispose() {
      disposed = true
      disposeSurface?.()
      cancelWarmup()
      renderer?.dispose()
      renderer = null
    }
  }
}
