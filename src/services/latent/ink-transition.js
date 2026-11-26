/**
 * 11-21 原版（4019e618）「流波」转场调度器（按需懒加载）：
 * 仅在设置页显式选择「流波」时由 FlowTransitionOverlay 动态导入；
 * 100% 保持原版 WebGL2 双纹理融墨/聚墨视觉（ink-transition-gl.js 零改动），
 * 在采集与缓存层消除卡顿根因：
 * 1. 阻断 snapdom v3.8.1 Hc() 对 backdrop-filter 元素的 N 倍整页深克隆爆炸；
 * 2. 严格叶级视口外卡片剪枝（绝不触碰定位背景外壳）；
 * 3. 导航区域 pointerdown 与顶栏瞬态属性不误杀预采缓存 + 5 槽 LRU 指纹校验纹理池；
 * 4. play() 立即启动离场波浪并等待首帧绘制后再提交路由，消除 t=0 死冻窗口。
 */
import { getTransitionBackdrop } from './flow.js'
import { blendFlowStops } from './flow-color-stops.js'
import { createInkCaptureQueue } from './ink-capture-queue.js'
import { createInkLiquidRenderer, INK_LIQUID_DURATION, inkLiquidPhase } from './ink-transition-gl.js'

const CAPTURE_BUDGET_MS = 850
const HANDOFF_POINT = .86
const GLIDE_START = .15
const INCOMING_GATE = .24
const GLIDE_RATE = .20
const PRECAPTURE_IDLE_MS = 350
const VIEWPORT_MARGIN_PX = 40
const SCENE_CACHE_MAX = 5
const NAV_CONTROL_SELECTOR = '.app-topbar, .wb-header, .ls-card, .ls-open, .ls-resume, [data-flow-nav]'
const PRUNABLE_LEAF_SELECTOR = '.snip-lane, .snip-note, .snip-nav-notes > li, .oc-node, .oc-card'
const TOPBAR_TRANSIENT_ATTRS = new Set(['class', 'style', 'aria-current', 'aria-pressed', 'aria-expanded', 'data-active'])

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

function resolveView(root) {
  return root?.querySelector?.('.workbench-shell[data-module], .latent-shelf') || root
}

function captureKey(root, rect) {
  const view = resolveView(root)
  return {
    root,
    view,
    module: view?.dataset?.module,
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

/**
 * 在 snapdom afterClone 阶段剔除带 backdrop-filter 且无 url() 背景图的 nodeMap 映射，
 * 阻断 snapdom 内部 Hc() 为每个毛玻璃元素执行整页 cloneNode(true) 的 N 倍克隆爆炸；
 * 流波着色器自身通过 frostedBackdrop() 渲染真实感磨砂，画面像素 100% 一致。
 */
export function stripBackdropFilterNodes(
  nodeMap,
  styleCache,
  getStyle = el => (typeof window !== 'undefined' ? window.getComputedStyle(el) : null)
) {
  if (!nodeMap || typeof nodeMap.entries !== 'function') return 0
  let stripped = 0
  for (const [cloneEl, origEl] of [...nodeMap.entries()]) {
    if (origEl?.nodeType !== 1) continue
    const cached = styleCache?.get?.(origEl)
    const cs = typeof cached?.getPropertyValue === 'function' ? cached : getStyle(origEl)
    if (!cs || typeof cs.getPropertyValue !== 'function') continue
    const bf = cs.getPropertyValue('backdrop-filter') || cs.getPropertyValue('-webkit-backdrop-filter')
    if (!bf || bf === 'none') continue
    const bg = cs.getPropertyValue('background-image') || ''
    if (bg.includes('url(')) continue
    nodeMap.delete(cloneEl)
    stripped += 1
  }
  return stripped
}

function isRectOutside(elRect, clipRect, margin = VIEWPORT_MARGIN_PX) {
  if (!elRect || !clipRect) return false
  if (elRect.width === 0 && elRect.height === 0) return true
  return elRect.bottom < clipRect.top - margin ||
    elRect.top > clipRect.bottom + margin ||
    elRect.right < clipRect.left - margin ||
    elRect.left > clipRect.right + margin
}

/**
 * 严格叶级视口剪枝谓词：
 * 绝不剪枝 root、定位背景外壳（.st-backdrop-wrap/.ls-backdrop-wrap）或活跃主区容器；
 * 仅跳过隐藏保活面板与完全滚出可视区域（含 40px 边距）的叶级卡片/泳道/节点。
 */
export function createViewportPruner(root, rect) {
  const lanesEl = root?.querySelector?.('.snip-lanes') || null
  const lanesRect = lanesEl?.getBoundingClientRect?.() || null
  const canvasEl = root?.querySelector?.('.oc-canvas') || null
  const canvasRect = canvasEl?.getBoundingClientRect?.() || null

  return function pruneOffscreen(el) {
    if (!el || el.nodeType !== 1 || el === root) return false
    if (el.classList?.contains?.('pop-lock-pane')) return true
    if (el.classList?.contains?.('center-pane') && el.style?.display === 'none') return true
    if (!el.matches?.(PRUNABLE_LEAF_SELECTOR)) return false
    const br = el.getBoundingClientRect?.()
    if (!br) return false
    if (lanesRect && el.matches?.('.snip-lane, .snip-note') && el.closest?.('.snip-lanes')) {
      return isRectOutside(br, lanesRect)
    }
    if (canvasRect && el.matches?.('.oc-node, .oc-card') && el.closest?.('.oc-canvas')) {
      return isRectOutside(br, canvasRect)
    }
    return isRectOutside(br, rect)
  }
}

/** 判断事件目标是否落在切换导航控件内，避免 pointerdown 在 click 前清空预采缓存。 */
export function isNavigationControl(target) {
  const el = target?.nodeType === 1 ? target : target?.parentElement
  return Boolean(el?.closest?.(NAV_CONTROL_SELECTOR))
}

/** 轻量级多模块 LRU 纹理缓存（按场景键 + 内容指纹校验，零脏画面风险）。 */
export function createSceneCache(maxEntries = SCENE_CACHE_MAX) {
  const entries = new Map()
  return {
    get(key, fingerprint) {
      const hit = entries.get(key)
      if (!hit || hit.fingerprint !== fingerprint) return null
      // 刷新 LRU 热度顺序
      entries.delete(key)
      entries.set(key, hit)
      return hit.image
    },
    set(key, fingerprint, image) {
      if (!key || !image) return
      if (entries.has(key)) entries.delete(key)
      entries.set(key, { fingerprint, image })
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value
        entries.delete(oldest)
      }
    },
    delete(key) {
      entries.delete(key)
    },
    clear() {
      entries.clear()
    },
    get size() {
      return entries.size
    }
  }
}

function sceneCacheKey(root, rect) {
  const view = resolveView(root)
  const kind = view?.classList?.contains?.('latent-shelf')
    ? 'shelf'
    : (view?.dataset?.module ? 'work:' + view.dataset.module : 'other')
  const theme = typeof document !== 'undefined'
    ? (document.body?.dataset?.nsPanelTheme || '') + ':' + (document.body?.dataset?.skin || '')
    : ''
  return `${kind}|${theme}|${Math.round(rect.width)}x${Math.round(rect.height)}`
}

function computeSceneFingerprint(root, rect) {
  const view = resolveView(root)
  const module = view?.dataset?.module || ''
  const scrollParts = []
  for (const sel of ['.center-pane', '.side-panel', '.oc-canvas']) {
    const el = view?.querySelector?.(sel)
    if (el) scrollParts.push(`${Math.round(el.scrollTop || 0)},${Math.round(el.scrollLeft || 0)}`)
  }
  const heading = view?.querySelector?.('.snip-crumb, .chapter-title, .char-name, .lore-title, h1, h2')?.textContent?.trim()?.slice(0, 48) || ''
  const activeSel = module === 'snippets'
    ? ''
    : (view?.querySelector?.('.ch-item.active, .char-item.active, .oc-node.selected')?.textContent?.trim()?.slice(0, 32) || '')
  const searchVal = view?.querySelector?.('input[type="search"]')?.value || ''
  const canvasTf = view?.querySelector?.('.oc-canvas-surface')?.style?.transform || ''
  const editorEl = view?.querySelector?.('.ProseMirror, textarea.chapter-editor, [contenteditable="true"]')
  const editorLen = editorEl ? (editorEl.value ?? editorEl.textContent ?? '').length : 0
  const itemCount = module === 'snippets'
    ? 0
    : (view?.querySelectorAll?.('.oc-node, .ls-card, .ch-item, .char-item, .lore-row')?.length || 0)
  return `${Math.round(rect.width)}x${Math.round(rect.height)}|${scrollParts.join(';')}|${heading}|${activeSel}|${searchVal}|${canvasTf}|${editorLen}|${itemCount}`
}

function sceneCaptureOptions(root, rect, density, scrollX, scrollY, fast = true) {
  return {
    dpr: density,
    clip: { x: rect.left + scrollX, y: rect.top + scrollY, width: rect.width, height: rect.height },
    exclude: [
      '[data-flow-transition-backdrop]',
      '.ls-card.is-out',
      '.oc-rs',
      '.oc-apt',
      '.ob-op',
      '.lore-nav-more',
      createViewportPruner(root, rect)
    ],
    excludeMode: 'hide',
    excludeStyleProps: /^--/,
    embedFonts: false,
    compress: false,
    fast,
    outerTransforms: false,
    plugins: [{
      name: 'novel-studio-transition',
      afterClone({ clone, element, nodeMap, styleCache }) {
        if (!clone) return
        stripBackdropFilterNodes(nodeMap, styleCache)
        clone.style.setProperty('box-sizing', 'border-box', 'important')
        clone.style.setProperty('width', element.offsetWidth + 'px', 'important')
        clone.style.setProperty('height', element.offsetHeight + 'px', 'important')
        clone.style.setProperty('background', 'none', 'important')
        for (const layer of clone.querySelectorAll('.latent-shelf, .workbench-shell[data-flow]')) {
          layer.style.setProperty('background', 'none', 'important')
        }
        // 定位背景外壳必须留在 afterClone 用 display:none 隐藏，严禁放进 excludeMode:'hide' 生成静态流占位盒
        for (const backdrop of clone.querySelectorAll('.ls-backdrop-wrap, .st-backdrop-wrap')) {
          backdrop.style.setProperty('display', 'none', 'important')
        }
        const style = clone.ownerDocument.createElement('style')
        style.textContent = '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'
        clone.prepend(style)
      }
    }]
  }
}

function targetCaptureDensity() {
  return Math.min(window.devicePixelRatio || 1, 1.25)
}

function waitPaintFrame(signal) {
  if (signal?.aborted || document.hidden) return Promise.resolve()
  return new Promise(resolve => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, 32)
    signal?.addEventListener('abort', done, { once: true })
    requestAnimationFrame(done)
  })
}

export function createInkTransition(canvas, getScene) {
  let renderer
  let disposed = false
  let disposeSurface
  const queueCapture = createInkCaptureQueue(sameCapture)
  const moduleCache = createSceneCache(SCENE_CACHE_MAX)
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
          attachSceneObserver(root)
          scheduleIdlePrecapture(root)
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
    const key = captureKey(root, rect)
    cachedScene = { key, image }
    moduleCache.set(sceneCacheKey(root, rect), computeSceneFingerprint(root, rect), image)
  }

  function invalidateCurrentCache(root) {
    cachedScene = null
    if (!root) return
    const rect = root.getBoundingClientRect?.()
    if (rect && rect.width >= 1 && rect.height >= 1) {
      moduleCache.delete(sceneCacheKey(root, rect))
    }
  }

  function matchCachedScene(root, rect) {
    if (!root || disposed) return null
    if (cachedScene && sameCapture(cachedScene.key, captureKey(root, rect))) {
      return cachedScene.image
    }
    return moduleCache.get(sceneCacheKey(root, rect), computeSceneFingerprint(root, rect))
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
      capture(root, rect, ac.signal, false, targetCaptureDensity()).then(img => {
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
    if (event?.type === 'pointerdown' && isNavigationControl(event.target)) return
    if (event?.type === 'scroll' || event?.type === 'wheel' || event?.type === 'input' ||
      event?.type === 'keydown' || event?.type === 'pointerdown') {
      invalidateCurrentCache(observedRoot)
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
        if (r.type === 'attributes' && TOPBAR_TRANSIENT_ATTRS.has(r.attributeName) && el?.closest?.('.app-topbar')) continue
        invalidateCurrentCache(root)
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

  async function capture(root, rect, signal, fast = true, maxDensity = targetCaptureDensity()) {
    if (signal.aborted || disposed || rect.height < 1) return null
    const key = captureKey(root, rect)
    const isCurrent = () => !disposed && root.isConnected && sameCapture(key, captureKey(root, rect))
    try {
      const image = await queueCapture(key, async () => {
        if (!isCurrent()) return null
        const { snapdom } = await loadSnapdom()
        if (!isCurrent()) return null
        const density = Math.min(maxDensity, canvas.width / rect.width, canvas.height / rect.height)
        return snapdom.toCanvas(root, sceneCaptureOptions(root, rect, density, window.scrollX, window.scrollY, fast))
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
    const outgoing = cachedOutgoing || await capture(root, rect, signal, false, Math.min(targetCaptureDensity(), 1.0))
    if (outgoing && !cachedOutgoing) {
      moduleCache.set(sceneCacheKey(root, rect), computeSceneFingerprint(root, rect), outgoing)
    }
    cachedScene = null
    if (signal.aborted || disposed || !root.isConnected ||
      document.hidden || !sameSceneRect(rect, root.getBoundingClientRect())) return null
    const source = backdrop.transitionFrame()
    if (!source) return null

    let raf
    let tickRunning = false
    let active = true
    let rootToken = 0
    let targetToken = 0
    let transitionTarget
    let lastTickNow
    let virtualElapsed = 0
    let incomingDone = false
    let handedOff = false
    let destination
    let destBlendStart = 0
    let destinationBackdrop
    let releaseSource
    let releaseDestination
    let finish
    const finished = new Promise(resolve => { finish = resolve })

    function startTick() {
      if (tickRunning || !active) return
      tickRunning = true
      lastTickNow = performance.now()
      raf = requestAnimationFrame(tick)
    }

    function cleanup() {
      if (!active) return
      active = false
      tickRunning = false
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
      const blendT = destination
        ? (destBlendStart < 1 ? Math.min(1, Math.max(0, (time - destBlendStart) / (1 - destBlendStart))) : 1)
        : 0
      const stops = destination
        ? blendFlowStops(source.stops, destination.stops, blendT, 1)
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
      async play() {
        if (!active) return
        rootToken = beginTransitioning(root)
        releaseSource = backdrop.holdTransition()
        if (outgoing) {
          renderer.draw(0, source.time, source.stops)
          canvas.hidden = false
          startTick()
          await waitPaintFrame(signal)
        }
      },
      async reveal() {
        if (!active) return
        const next = getScene()
        if (!next || !sameSceneRect(rect, next.getBoundingClientRect())) return cleanup()
        transitionTarget = next
        targetToken = beginTransitioning(next)
        destinationBackdrop = getTransitionBackdrop(next)
        destination = destinationBackdrop?.transitionFrame()
        destBlendStart = liquidProgress(virtualElapsed)
        if (destinationBackdrop !== backdrop) releaseDestination = destinationBackdrop?.holdTransition()
        if (canvas.hidden) {
          renderer.draw(0, source.time, source.stops)
          canvas.hidden = false
        }
        startTick()
        try {
          const nextKey = sceneCacheKey(next, rect)
          const nextFp = computeSceneFingerprint(next, rect)
          const cachedIncoming = moduleCache.get(nextKey, nextFp)
          if (cachedIncoming && active && sameSceneRect(rect, next.getBoundingClientRect())) {
            renderer.setScene(cachedIncoming, 'incoming')
            storeCachedScene(next, rect, cachedIncoming)
            attachSceneObserver(next)
          } else {
            const incoming = await capture(next, rect, signal, false, targetCaptureDensity())
            if (active && incoming && sameSceneRect(rect, next.getBoundingClientRect())) {
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
      moduleCache.clear()
      disposeSurface?.()
      renderer?.dispose()
      renderer = null
    }
  }
}
