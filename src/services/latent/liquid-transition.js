/**
 * 幻流原生合成层液态转场调度器：
 * 彻底移除 DOM 截图（snapdom）与全树监听，以 0ms 延迟启动 WebGL2 纯程序化对角线流场波浪，
 * 配合前景真实 DOM 原地轻柔雾化/凝结（零位移、零缩放）完成旧页消隐 → 提交切换 → 新页浮现，
 * 并在结束或中断时同步清空全部临时合成样式与背板锁定。
 */
import { getTransitionBackdrop } from './flow.js'
import { blendFlowStops } from './flow-color-stops.js'
import {
  COVER_END,
  createLiquidRenderer,
  HANDOFF_POINT,
  LIQUID_DURATION,
  liquidForegroundBlur,
  liquidPhase
} from './liquid-transition-gl.js'

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
  if (!el || !token || transitioningTokens.get(el) !== token) return
  transitioningTokens.delete(el)
  el.removeAttribute('data-flow-transitioning')
}

export function liquidProgress(elapsed) {
  return Math.min(1, Math.max(0, elapsed / LIQUID_DURATION))
}

export function liquidFrame(now, start, speed, hold = 0) {
  const time = liquidProgress(now - start)
  return { time, phase: liquidPhase(time, speed, hold) }
}

export function sameSceneRect(a, b) {
  return ['left', 'top', 'width', 'height'].every(key => samePixel(a[key], b[key]))
}

/** 选取当前场景中除底层流动背板外的全部前景直接子层，供原地雾化/凝结与统一还原。 */
export function foregroundElements(root) {
  if (!root || typeof root.querySelector !== 'function') return []
  const view = root.querySelector('.workbench-shell[data-module], .latent-shelf') || root
  const list = []
  for (const child of view.children || []) {
    if (child.nodeType !== 1) continue
    const tag = child.tagName
    if (tag === 'STYLE' || tag === 'SCRIPT') continue
    if (child.classList?.contains('st-backdrop-wrap') ||
      child.classList?.contains('ls-backdrop-wrap') ||
      child.classList?.contains('flow-liquid-overlay')) continue
    list.push(child)
  }
  return list
}

/** 对前景层施加纯原地 filter: blur（零位移、零缩放），并记录所有触达节点确保 dispose 时彻底清除。 */
export function applyForegroundBlur(tracker, elements, blurPx) {
  const value = blurPx >= .05 ? `blur(${blurPx.toFixed(1)}px)` : ''
  const nextWillChange = value ? 'filter' : ''
  for (const el of elements) {
    if (!el?.style) continue
    if (value) tracker.add(el)
    if (el.style.filter !== value) el.style.filter = value
    if (el.style.willChange !== nextWillChange) el.style.willChange = nextWillChange
  }
}

/** 无条件清除本次转场触达过的所有前景层内联滤镜与 will-change，杜绝静止态副作用。 */
export function clearForegroundBlur(tracker) {
  for (const el of tracker) {
    if (!el?.style) continue
    if (el.style.filter) el.style.filter = ''
    if (el.style.willChange) el.style.willChange = ''
  }
  tracker.clear()
}

/**
 * 创建绑定到覆盖层画布的原生合成层液态转场实例，对外提供 prepare(signal) 与 dispose()。
 */
export function createLiquidTransition(canvas, getScene) {
  let renderer
  let disposed = false
  let disposeSurface
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
      if (renderer) return
      try {
        renderer = createLiquidRenderer(canvas)
        const root = getScene()
        const frame = root && getTransitionBackdrop(root)?.transitionFrame()
        if (frame) {
          renderer.resize(2, 2)
          renderer.draw(.5, frame.time, frame.stops, 0)
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

  async function prepare({ signal }) {
    cancelWarmup()
    const root = getScene()
    const backdrop = root && getTransitionBackdrop(root)
    if (disposed || signal.aborted || document.hidden || !backdrop?.transitionFrame()) return null
    const rect = root.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return null
    const source = backdrop.transitionFrame()
    if (!source) return null

    renderer ||= createLiquidRenderer(canvas)
    renderer.resize(rect.width, rect.height)

    let raf
    let active = true
    let stage = 'idle' // 'cover' | 'hold' | 'reveal'
    let rootToken = 0
    let targetToken = 0
    let transitionTarget = null
    let lastTickNow
    let virtualElapsed = 0
    let holdSec = 0
    let lastPhase = source.time
    let handedOff = false
    let resolveCover = null
    let destination = null
    let destinationBackdrop = null
    let releaseSource = null
    let releaseDestination = null
    let cancelPaintWait = null
    let finish
    const finished = new Promise(resolve => { finish = resolve })
    const blurredTracker = new Set()
    let activeForeground = foregroundElements(root)

    function cleanup() {
      if (!active) return
      active = false
      disposeSurface = null
      cancelAnimationFrame(raf)
      cancelPaintWait?.()
      const pendingCover = resolveCover
      resolveCover = null
      pendingCover?.()
      signal.removeEventListener('abort', cleanup)
      window.removeEventListener('resize', cleanup)
      document.removeEventListener('visibilitychange', cleanup)
      canvas.hidden = true
      clearForegroundBlur(blurredTracker)
      const doneTarget = transitionTarget
      const rTok = rootToken
      const tTok = targetToken
      transitionTarget = null
      rootToken = 0
      targetToken = 0
      endTransitioning(root, rTok)
      endTransitioning(doneTarget, tTok)
      try {
        renderer?.clear()
      } finally {
        const settleBackdrop = destinationBackdrop || backdrop
        try { settleBackdrop?.syncTransitionTime?.(lastPhase) } catch { /* Backdrop may be disposed. */ }
        releaseSource?.()
        releaseSource = null
        releaseDestination?.()
        releaseDestination = null
        finish()
      }
    }

    function nextPaint() {
      return new Promise(resolve => {
        let timer
        const done = () => {
          cancelPaintWait = null
          resolve()
        }
        const frame = requestAnimationFrame(() => { timer = setTimeout(done, 0) })
        cancelPaintWait = () => {
          cancelAnimationFrame(frame)
          clearTimeout(timer)
          done()
        }
      })
    }

    function tick(now) {
      if (!active) return
      const dt = lastTickNow === undefined ? 0 : Math.min(48, Math.max(0, now - lastTickNow))
      lastTickNow = now

      if (stage === 'cover') {
        virtualElapsed = Math.min(COVER_END * LIQUID_DURATION, virtualElapsed + dt)
        const time = liquidProgress(virtualElapsed)
        const phase = source.time + liquidPhase(time, source.speed, 0)
        lastPhase = phase
        try {
          if (backdrop.backend === 'gpu') backdrop.syncTransitionTime(phase)
          applyForegroundBlur(blurredTracker, activeForeground, liquidForegroundBlur(time, 0))
          renderer.draw(time, phase, source.stops, 0)
          if (time >= COVER_END) {
            stage = 'hold'
            const done = resolveCover
            resolveCover = null
            done?.()
          }
          raf = requestAnimationFrame(tick)
        } catch {
          cleanup()
        }
        return
      }

      if (stage === 'hold') {
        holdSec += dt / 1000
        const phase = source.time + liquidPhase(COVER_END, source.speed, holdSec)
        lastPhase = phase
        try {
          renderer.draw(COVER_END, phase, source.stops, 0)
          raf = requestAnimationFrame(tick)
        } catch {
          cleanup()
        }
        return
      }

      // stage === 'reveal'
      virtualElapsed = Math.min(LIQUID_DURATION, virtualElapsed + dt)
      const time = liquidProgress(virtualElapsed)
      const phase = source.time + liquidPhase(time, source.speed, holdSec)
      lastPhase = phase
      const colorT = Math.min(1, Math.max(0, (time - COVER_END) / (.82 - COVER_END)))
      const stops = destination
        ? blendFlowStops(source.stops, destination.stops, colorT, 1)
        : source.stops
      try {
        if (time >= HANDOFF_POINT) {
          if (destinationBackdrop?.backend === 'gpu') {
            destinationBackdrop.syncTransitionTime(phase)
          } else if (!handedOff) {
            destinationBackdrop?.syncTransitionTime(phase)
          }
          handedOff = true
        }
        const blur = liquidForegroundBlur(time, 1)
        if (blur >= .05) {
          applyForegroundBlur(blurredTracker, activeForeground, blur)
        } else if (blurredTracker.size) {
          clearForegroundBlur(blurredTracker)
        }
        if (time >= 1) {
          cleanup()
        } else {
          renderer.draw(time, phase, stops, 1)
          raf = requestAnimationFrame(tick)
        }
      } catch {
        cleanup()
      }
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
        stage = 'cover'
        virtualElapsed = 0
        holdSec = 0
        lastTickNow = undefined
        lastPhase = source.time
        // Frame 0 has opacity=0 everywhere so showing the canvas introduces zero flash.
        renderer.draw(0, source.time, source.stops, 0)
        canvas.hidden = false
        return new Promise(resolve => {
          resolveCover = resolve
          raf = requestAnimationFrame(tick)
        })
      },
      async reveal() {
        if (!active) return
        const next = getScene()
        if (!next || !sameSceneRect(rect, next.getBoundingClientRect())) return cleanup()
        transitionTarget = next
        targetToken = beginTransitioning(next)
        destinationBackdrop = getTransitionBackdrop(next)
        destination = destinationBackdrop?.transitionFrame()
        if (destinationBackdrop && destinationBackdrop !== backdrop) {
          releaseDestination = destinationBackdrop.holdTransition()
        }
        clearForegroundBlur(blurredTracker)
        activeForeground = foregroundElements(next)
        applyForegroundBlur(blurredTracker, activeForeground, liquidForegroundBlur(COVER_END, 1))
        await nextPaint()
        if (!active) return
        if (!sameSceneRect(rect, next.getBoundingClientRect())) return cleanup()
        // Refresh in case async sub-views mounted on the first paint frame.
        activeForeground = foregroundElements(next)
        applyForegroundBlur(blurredTracker, activeForeground, liquidForegroundBlur(COVER_END, 1))
        stage = 'reveal'
        virtualElapsed = COVER_END * LIQUID_DURATION
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
      disposeSurface?.()
      renderer?.dispose()
      renderer = null
    }
  }
}
