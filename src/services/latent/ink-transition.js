/**
 * 11-21 原版（4019e618）「原版融墨」转场调度器（按需懒加载）：
 * 仅在设置页显式选择「原版融墨」时由 FlowTransitionOverlay 动态导入；
 * 保留干净原版 snapdom 透明 UI 采集与双纹理融墨/聚墨视觉，仅补充高分屏小数宽高比容差。
 */
import { getTransitionBackdrop } from './flow.js'
import { blendFlowStops } from './flow-color-stops.js'
import { createInkCaptureQueue } from './ink-capture-queue.js'
import { createInkLiquidRenderer, INK_LIQUID_DURATION, inkLiquidPhase } from './ink-transition-gl.js'

const CAPTURE_BUDGET_MS = 650
const HANDOFF_POINT = .86
const GLIDE_START = .15
const INCOMING_GATE = .24
const GLIDE_RATE = .20
const PRECAPTURE_IDLE_MS = 350
const samePixel = (a, b) => Math.abs(a - b) < 1
const transitioningTokens = new WeakMap()

function beginTransitioning(el) {
  if (!el) return 0
  const token = (transitioningTokens.get(el) || 0) + 1
  transitioningTokens.set(el, token)
  el.setAttribute('data-flow-transitioning', '')
  return token
}

function endTransitioning(el, token) {
  if (!el || transitioningTokens.get(el) !== token) return
  transitioningTokens.delete(el)
  el.removeAttribute('data-flow-transitioning')
}

function liquidProgress(elapsed) {
  return Math.min(1, Math.max(0, elapsed / INK_LIQUID_DURATION))
}

function captureKey(root, rect) {
  const view = root.querySelector('.workbench-shell[data-module], .latent-shelf') || root
  return {
    root,
    view,
    module: view.dataset.module,
    rect
  }
}

function sameSceneRect(a, b) {
  return ['left', 'top', 'width', 'height'].every(key => samePixel(a[key], b[key]))
}

function sameCapture(a, b) {
  return a.root === b.root && a.view === b.view && a.module === b.module && sameSceneRect(a.rect, b.rect)
}

function matchesSceneAspect(image, rect) {
  if (!(image.width > 0 && image.height > 0 && rect.width > 0 && rect.height > 0)) return false
  const tolerance = Math.max(2, Math.min(8, Math.ceil((image.width / rect.width) * 2.5)))
  return Math.abs(image.height - image.width * rect.height / rect.width) <= tolerance
}

function sceneCaptureOptions(rect, density, scrollX, scrollY, fast = true) {
  return {
    dpr: density,
    clip: { x: rect.left + scrollX, y: rect.top + scrollY, width: rect.width, height: rect.height },
    exclude: '[data-flow-transition-backdrop], .ls-card.is-out',
    excludeMode: 'hide',
    excludeStyleProps: /^--/,
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
        for (const idleControl of clone.querySelectorAll('.oc-rs, .oc-apt, .ob-op, .lore-nav-more')) {
          idleControl.remove()
        }
        const style = clone.ownerDocument.createElement('style')
        style.textContent = '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'
        clone.prepend(style)
      }
    }]
  }
}

export function createInkTransition(canvas, getScene) {
  let renderer
  let disposed = false
  let disposeSurface
  const queueCapture = createInkCaptureQueue(sameCapture)
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
  function scheduleBootWarmup() {
    cancelWarmup()
    if (disposed) return
    const run = () => {
      warmupIdle = undefined
      if (disposed || document.hidden || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
      loadSnapdom().catch(() => {})
      if (renderer) return
      try {
        renderer = createInkLiquidRenderer(canvas)
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
      warmupIdle = window.requestIdleCallback(run, { timeout: 1200 })
    } else {
      warmupTimer = setTimeout(run, 120)
    }
  }
  scheduleBootWarmup()

  let cachedScene = null
  let observedRoot = null
  let domObserver = null
  let precaptureTimer
  let precaptureIdle
  let precaptureAbort = null

  function cancelPrecapture() {
    if (precaptureTimer !== undefined) {
      clearTimeout(precaptureTimer)
      precaptureTimer = undefined
    }
    if (precaptureIdle !== undefined) {
      window.cancelIdleCallback?.(precaptureIdle)
      precaptureIdle = undefined
    }
    precaptureAbort?.abort()
    precaptureAbort = null
  }

  function storeCachedScene(root, rect, image) {
    if (!root || !image) return
    cachedScene = { key: captureKey(root, rect), image }
  }

  function matchCachedScene(root, rect) {
    if (!cachedScene || !root || disposed) return null
    return sameCapture(cachedScene.key, captureKey(root, rect)) ? cachedScene.image : null
  }

  function scheduleIdlePrecapture(root) {
    cancelPrecapture()
    if (disposed || !root || document.hidden || disposeSurface) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const run = () => {
      precaptureIdle = undefined
      if (disposed || document.hidden || disposeSurface || !root.isConnected) return
      const rect = root.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) return
      if (matchCachedScene(root, rect)) return
      const ac = new AbortController()
      precaptureAbort = ac
      if (!renderer) {
        try { renderer = createInkLiquidRenderer(canvas) } catch { return }
      }
      renderer.resize(rect.width, rect.height)
      capture(root, rect, ac.signal, false, 1.5).then(img => {
        if (precaptureAbort === ac) precaptureAbort = null
        if (img && !ac.signal.aborted && !disposeSurface && root.isConnected &&
          sameSceneRect(rect, root.getBoundingClientRect())) {
          storeCachedScene(root, rect, img)
        }
      }).catch(() => {
        if (precaptureAbort === ac) precaptureAbort = null
      })
    }
    precaptureTimer = setTimeout(() => {
      precaptureTimer = undefined
      if (typeof window.requestIdleCallback === 'function') {
        precaptureIdle = window.requestIdleCallback(run, { timeout: 1500 })
      } else {
        run()
      }
    }, PRECAPTURE_IDLE_MS)
  }

  function onSceneActivity(event) {
    if (disposeSurface) return
    if (event?.type === 'scroll' || event?.type === 'wheel' || event?.type === 'input' ||
      event?.type === 'keydown' || event?.type === 'pointerdown') {
      cachedScene = null
      if (observedRoot) scheduleIdlePrecapture(observedRoot)
    }
  }

  function attachSceneObserver(root) {
    if (!root || typeof MutationObserver !== 'function') return
    if (observedRoot === root) return
    detachSceneObserver()
    observedRoot = root
    domObserver = new MutationObserver(records => {
      if (disposeSurface) return
      for (const r of records) {
        if (r.type === 'attributes' && r.attributeName === 'data-flow-transitioning') continue
        const el = r.target?.nodeType === 1 ? r.target : r.target?.parentElement
        if (el?.closest?.('.flow-liquid-overlay, .st-backdrop-wrap, .ls-backdrop-wrap')) continue
        cachedScene = null
        scheduleIdlePrecapture(root)
        break
      }
    })
    domObserver.observe(root, { childList: true, subtree: true, attributes: true, characterData: true })
    for (const ev of ['scroll', 'wheel', 'input', 'keydown', 'pointerdown']) {
      root.addEventListener(ev, onSceneActivity, { capture: true, passive: true })
    }
  }

  function detachSceneObserver() {
    cancelPrecapture()
    domObserver?.disconnect()
    domObserver = null
    if (observedRoot) {
      for (const ev of ['scroll', 'wheel', 'input', 'keydown', 'pointerdown']) {
        observedRoot.removeEventListener(ev, onSceneActivity, { capture: true })
      }
      observedRoot = null
    }
  }

  async function capture(root, rect, signal, fast = true, maxDensity = .85) {
    if (signal.aborted || disposed || rect.height < 1) return null
    const key = captureKey(root, rect)
    const isCurrent = () => !disposed && root.isConnected && sameCapture(key, captureKey(root, rect))
    try {
      const image = await queueCapture(key, async () => {
        if (!isCurrent()) return null
        const { snapdom } = await loadSnapdom()
        if (!isCurrent()) return null
        const density = Math.min(maxDensity, canvas.width / rect.width, canvas.height / rect.height)
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
    cancelPrecapture()
    const root = getScene()
    const backdrop = root && getTransitionBackdrop(root)
    if (disposed || document.hidden || !backdrop?.transitionFrame()) return null
    const rect = root.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return null
    attachSceneObserver(root)
    renderer ||= createInkLiquidRenderer(canvas)
    renderer.resize(rect.width, rect.height)
    const cachedOutgoing = matchCachedScene(root, rect)
    const outgoing = cachedOutgoing || await capture(root, rect, signal, false, .85)
    cachedScene = null
    if (signal.aborted || disposed || !root.isConnected ||
      document.hidden || !sameSceneRect(rect, root.getBoundingClientRect())) return null
    const source = backdrop.transitionFrame()
    if (!source) return null

    let raf
    let active = true
    let rootToken = 0
    let targetToken = 0
    let transitionTarget
    let lastTickNow
    let virtualElapsed = 0
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
      const doneTarget = transitionTarget
      const rTok = rootToken
      const tTok = targetToken
      transitionTarget = null
      rootToken = 0
      targetToken = 0
      if (disposed) {
        endTransitioning(root, rTok)
        endTransitioning(doneTarget, tTok)
      } else {
        requestAnimationFrame(() => {
          endTransitioning(root, rTok)
          endTransitioning(doneTarget, tTok)
          const settled = getScene()
          if (settled && !disposeSurface && !cachedScene) scheduleIdlePrecapture(settled)
        })
      }
      try {
        renderer?.clear()
      } finally {
        releaseSource?.()
        releaseDestination?.()
        finish()
      }
    }

    function tick(now) {
      if (!active) return
      const dt = lastTickNow === undefined ? 0 : Math.min(48, Math.max(0, now - lastTickNow))
      lastTickNow = now
      if (incomingDone) {
        virtualElapsed += dt
      } else {
        const curProgress = liquidProgress(virtualElapsed)
        if (curProgress < GLIDE_START) {
          virtualElapsed = Math.min(GLIDE_START * INK_LIQUID_DURATION, virtualElapsed + dt)
        } else if (curProgress < INCOMING_GATE) {
          virtualElapsed = Math.min(INCOMING_GATE * INK_LIQUID_DURATION, virtualElapsed + dt * GLIDE_RATE)
        }
      }
      const time = liquidProgress(virtualElapsed)
      const phase = source.time + inkLiquidPhase(time, source.speed)
      const stops = destination
        ? blendFlowStops(source.stops, destination.stops, time, 1)
        : source.stops
      try {
        if (time >= HANDOFF_POINT && !handedOff) {
          handedOff = true
          destinationBackdrop?.syncTransitionTime(phase)
          releaseSource?.()
          releaseSource = null
          releaseDestination?.()
          releaseDestination = null
        }
        if (time === 1) {
          cleanup()
        } else {
          renderer.draw(time, phase, stops)
          raf = requestAnimationFrame(tick)
        }
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
        rootToken = beginTransitioning(root)
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
        transitionTarget = next
        targetToken = beginTransitioning(next)
        destinationBackdrop = getTransitionBackdrop(next)
        destination = destinationBackdrop?.transitionFrame()
        if (destinationBackdrop !== backdrop) releaseDestination = destinationBackdrop?.holdTransition()
        if (canvas.hidden) {
          renderer.draw(0, source.time, source.stops)
          canvas.hidden = false
        }
        raf = requestAnimationFrame(tick)
        try {
          const incoming = await capture(next, rect, signal, false, 1.5)
          if (active && incoming && sameSceneRect(rect, next.getBoundingClientRect())) {
            await new Promise(resolve => requestAnimationFrame(resolve))
            if (active && sameSceneRect(rect, next.getBoundingClientRect())) {
              renderer.setScene(incoming, 'incoming')
              storeCachedScene(next, rect, incoming)
              attachSceneObserver(next)
            }
          }
        } catch {
          // The moving wave uncovers the live page if texture upload fails.
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
      cancelWarmup()
      detachSceneObserver()
      cachedScene = null
      disposeSurface?.()
      renderer?.dispose()
      renderer = null
    }
  }
}
