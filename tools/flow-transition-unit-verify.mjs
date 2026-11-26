import assert from 'node:assert/strict'
import { createFlowTransitionController } from '../src/services/latent/flow-transition.js'
import {
  PAGE_TRANSITION_MODES,
  SETTINGS_DEFAULTS,
  normalizePageTransition,
  normalizeSettingsPrefs,
  resetAppearancePrefs
} from '../src/components/skins/latent/settings/settings-prefs.js'
import { createInkCaptureQueue } from '../src/services/latent/ink-capture-queue.js'
import {
  createSceneCache,
  createViewportPruner,
  isNavigationControl,
  stripBackdropFilterNodes
} from '../src/services/latent/ink-transition.js'
import {
  applyForegroundBlur,
  clearForegroundBlur,
  foregroundElements,
  liquidFrame,
  liquidProgress,
  sameSceneRect
} from '../src/services/latent/liquid-transition.js'
import {
  COVER_END,
  HANDOFF_POINT,
  LIQUID_DURATION,
  liquidForegroundBlur,
  liquidMaskOpacity,
  liquidPhase,
  MAX_FOREGROUND_BLUR,
  REVEAL_START
} from '../src/services/latent/liquid-transition-gl.js'

const rect = { left: 23, top: 41, width: 1400, height: 800 }
assert(!sameSceneRect(rect, { ...rect, left: 28 }))
assert(sameSceneRect(rect, { ...rect, width: 1400.4 }))

assert.equal(LIQUID_DURATION, 1000)
assert.equal(liquidProgress(0), 0)
assert.equal(liquidProgress(150), .15)
assert.equal(liquidProgress(500), .5)
assert.equal(liquidProgress(1000), 1)
assert.equal(liquidProgress(2000), 1)

// 相位积分严格单调递增，且与原版 11-21（4019e618）终值一致（0.35 + 4.8 * 0.5 = 2.75）。
const phase = Array.from({ length: 1001 }, (_, i) => liquidPhase(i / 1000, .35))
assert.equal(phase[0], 0)
assert(Math.abs(phase[1000] - 2.75) < 1e-9)
assert(phase.slice(1).every((value, i) => value > phase[i]))
assert(liquidPhase(COVER_END, .35, .1) > liquidPhase(COVER_END, .35, 0))
const start = 100
const mid = liquidFrame(600, start, .35)
assert.equal(mid.time, .5)
assert(mid.phase > 0)
assert.equal(liquidFrame(1100, start, .35).time, 1)

// 纯程序化对角线波前不透明度边界校验：
// 1. 离场（stage=0）：progress=0 全屏全透（零起跳闪烁），progress=COVER_END 全屏严密遮盖（=1），且右上（sweep=0）先于左下（sweep=1）合拢；
// 2. 进场（stage=1）：progress<=REVEAL_START 全屏严密遮盖（=1，绝不提前露底），progress=1 全屏全透（=0），且右上先于左下显露。
assert(COVER_END > .3 && COVER_END < REVEAL_START)
assert(HANDOFF_POINT >= COVER_END && HANDOFF_POINT <= REVEAL_START)
for (const sweep of [0, .25, .5, .75, 1]) {
  for (const crest of [0, .5, 1]) {
    for (const fiber of [0, .5, 1]) {
      assert.equal(liquidMaskOpacity({ progress: 0, sweep, crest, fiber, stage: 0 }), 0)
      assert.equal(liquidMaskOpacity({ progress: COVER_END, sweep, crest, fiber, stage: 0 }), 1)
      assert.equal(liquidMaskOpacity({ progress: COVER_END, sweep, crest, fiber, stage: 1 }), 1)
      assert.equal(liquidMaskOpacity({ progress: REVEAL_START, sweep, crest, fiber, stage: 1 }), 1)
      assert.equal(liquidMaskOpacity({ progress: 1, sweep, crest, fiber, stage: 1 }), 0)
    }
  }
}
assert(
  liquidMaskOpacity({ progress: .18, sweep: 0, crest: .5, fiber: .5, stage: 0 }) >
  liquidMaskOpacity({ progress: .18, sweep: 1, crest: .5, fiber: .5, stage: 0 })
)
assert(
  liquidMaskOpacity({ progress: .68, sweep: 0, crest: .5, fiber: .5, stage: 1 }) <
  liquidMaskOpacity({ progress: .68, sweep: 1, crest: .5, fiber: .5, stage: 1 })
)

// 原地雾化曲线边界校验：零位移零缩放，起止点均为 0，尾段在 progress=0.90 提前归零避免结束跳变。
assert.equal(liquidForegroundBlur(0, 0), 0)
assert.equal(liquidForegroundBlur(COVER_END, 0), MAX_FOREGROUND_BLUR)
assert.equal(liquidForegroundBlur(COVER_END, 1), MAX_FOREGROUND_BLUR)
assert.equal(liquidForegroundBlur(.9, 1), 0)
assert.equal(liquidForegroundBlur(1, 1), 0)

// 前景节点筛选与内联样式零残留校验：排除流动背板层，仅触达 filter/willChange，清理后彻底还原。
const makeEl = (tag, classes = []) => ({
  nodeType: 1,
  tagName: tag,
  classList: { contains: name => classes.includes(name) },
  style: { filter: '', willChange: '', transform: '' }
})
const backdropWrap = makeEl('DIV', ['st-backdrop-wrap'])
const topbar = makeEl('HEADER', ['app-topbar'])
const body = makeEl('DIV', ['wb-body'])
const styleTag = makeEl('STYLE')
const mockView = { children: [backdropWrap, topbar, body, styleTag] }
const mockRoot = { querySelector: () => mockView }
const targets = foregroundElements(mockRoot)
assert.deepEqual(targets, [topbar, body])
const tracker = new Set()
applyForegroundBlur(tracker, targets, 2.5)
assert.equal(topbar.style.filter, 'blur(2.5px)')
assert.equal(body.style.filter, 'blur(2.5px)')
assert.equal(topbar.style.transform, '')
assert.equal(body.style.transform, '')
assert.equal(backdropWrap.style.filter, '')
clearForegroundBlur(tracker)
assert.equal(topbar.style.filter, '')
assert.equal(topbar.style.willChange, '')
assert.equal(body.style.filter, '')
assert.equal(body.style.willChange, '')
assert.equal(tracker.size, 0)

// 状态机全链路校验：遮盖后提交、绘制后揭示、无障碍/关闭开关直切、连点复用、提交串行、揭示可打断、异常安全清理。
const control = () => createFlowTransitionController({
  isReducedMotion: () => false, hasDocument: () => true
})
const route = { skin: 'dsh' }
const ctrl = control()
const steps = []
let finishCover
let coverStarted
let finishPaint
let paintStarted
let finishReveal
let revealStarted
const covering = new Promise(resolve => { coverStarted = resolve })
const painting = new Promise(resolve => { paintStarted = resolve })
const revealing = new Promise(resolve => { revealStarted = resolve })
ctrl.attach(async () => {
  steps.push('prepare')
  return {
    play: () => new Promise(resolve => {
      steps.push('play')
      finishCover = resolve
      coverStarted()
    }),
    reveal: () => new Promise(resolve => {
      steps.push('reveal')
      finishReveal = resolve
      revealStarted()
    }),
    dispose: () => { steps.push('dispose') }
  }
})
const switching = ctrl.run(() => { steps.push('commit'); return 'ok' }, {
  ...route,
  afterCommit: () => new Promise(resolve => {
    steps.push('paint')
    finishPaint = resolve
    paintStarted()
  })
})
await covering
assert.deepEqual(steps, ['prepare', 'play'])
finishCover()
await painting
assert.deepEqual(steps, ['prepare', 'play', 'commit', 'paint'])
finishPaint()
await revealing
assert.deepEqual(steps, ['prepare', 'play', 'commit', 'paint', 'reveal'])
finishReveal()
assert.equal(await switching, 'ok')
assert.deepEqual(steps, ['prepare', 'play', 'commit', 'paint', 'reveal', 'dispose'])

steps.length = 0
await ctrl.run(() => steps.push('direct'), { ...route, reducedMotion: true })
await ctrl.run(() => steps.push('crimson'), { skin: 'crimson' })
ctrl.setEnabled(false)
await ctrl.run(() => steps.push('disabled'), route)
ctrl.setEnabled(true)
assert.deepEqual(steps, ['direct', 'crimson', 'disabled'])

const failing = control()
failing.attach(() => { throw Error('prepare failed') })
assert.equal(await failing.run(() => 'arrived', route), 'arrived')
failing.attach(() => ({ play: () => { throw Error('context lost') }, dispose() {} }))
assert.equal(await failing.run(() => 'arrived', route), 'arrived')
await assert.rejects(failing.run(() => { throw Error('commit failed') }, route), /commit failed/)
await assert.rejects(failing.run(() => 'ok', {
  ...route, afterCommit: () => { throw Error('after commit failed') }
}), /after commit failed/)

const rapid = control()
const log = []
let release
rapid.attach(() => new Promise(resolve => {
  log.push('prepare')
  release = () => resolve({ play: () => log.push('play once'), dispose: () => log.push('disposed') })
}))
const first = rapid.run(() => log.push('stale commit'), route)
const second = rapid.run(() => log.push('latest commit'), route)
release()
await Promise.all([first, second])
assert.deepEqual(log, ['prepare', 'play once', 'latest commit', 'disposed'])

const ongoing = control()
let finishCommit
let nowCommitting
const didCommit = new Promise(resolve => { nowCommitting = resolve })
const a = ongoing.run(async () => {
  log.push('start A')
  nowCommitting()
  await new Promise(resolve => { finishCommit = resolve })
  log.push('finish A')
}, route)
await didCommit
const b = ongoing.run(() => log.push('B'), route)
const c = ongoing.run(() => log.push('C'), route)
finishCommit()
await Promise.all([a, b, c])
assert.deepEqual(log.slice(-3), ['start A', 'finish A', 'C'])

const repeated = control()
let signalPlaying
let releasePlaying
let didPlay
const playStarted = new Promise(resolve => { didPlay = resolve })
repeated.attach(({ signal }) => ({
  play: () => new Promise(resolve => {
    signalPlaying = signal
    releasePlaying = resolve
    didPlay()
  }),
  dispose() {}
}))
const activePlay = repeated.run(() => 'shown', route)
await playStarted
const retarget = repeated.run(() => 'latest', route)
assert.equal(signalPlaying.aborted, false)
releasePlaying()
assert.equal(await activePlay, undefined)
assert.equal(await retarget, 'latest')

const cancelled = control()
const aborts = []
cancelled.attach(({ signal }) => ({
  play: () => new Promise(resolve => {
    signal.addEventListener('abort', resolve, { once: true })
  }),
  dispose: () => aborts.push('disposed')
}))
const staying = cancelled.run(() => aborts.push('unexpected commit'), route)
await Promise.resolve()
cancelled.cancelPending()
await staying
assert.deepEqual(aborts, ['disposed'])

const interruptReveal = control()
const revealLog = []
let revealCount = 0
let revealStartedGate
const revealRunning = new Promise(resolve => { revealStartedGate = resolve })
interruptReveal.attach(({ signal }) => ({
  play: () => Promise.resolve(),
  reveal: () => {
    const idx = ++revealCount
    revealLog.push('reveal ' + idx)
    if (idx === 1) {
      return new Promise(resolve => {
        signal.addEventListener('abort', () => { revealLog.push('reveal aborted'); resolve() }, { once: true })
        revealStartedGate()
      })
    }
    return Promise.resolve()
  },
  dispose: () => revealLog.push('disposed')
}))
const firstNav = interruptReveal.run(() => revealLog.push('first commit'), route)
await revealRunning
const secondNav = interruptReveal.run(() => revealLog.push('second commit'), route)
await Promise.all([firstNav, secondNav])
assert(revealLog.includes('reveal aborted'))
assert(revealLog.includes('second commit'))
assert(revealLog.includes('reveal 2'))

// 设置项三档模式归一与历史布尔开关向后兼容校验。
assert.deepEqual(Object.keys(PAGE_TRANSITION_MODES), ['mist', 'ink', 'off'])
assert.equal(SETTINGS_DEFAULTS.pageTransitions, 'mist')
assert.equal(resetAppearancePrefs().pageTransitions, 'mist')
assert.equal(normalizePageTransition(undefined), 'mist')
assert.equal(normalizePageTransition(true), 'mist')
assert.equal(normalizePageTransition('mist'), 'mist')
assert.equal(normalizePageTransition('ink'), 'ink')
assert.equal(normalizePageTransition('off'), 'off')
assert.equal(normalizePageTransition(false), 'off')
assert.equal(normalizePageTransition('invalid'), 'mist')
assert.equal(normalizeSettingsPrefs({ pageTransitions: false }).pageTransitions, 'off')
assert.equal(normalizeSettingsPrefs({ pageTransitions: true }).pageTransitions, 'mist')
assert.equal(normalizeSettingsPrefs({ pageTransitions: 'ink' }).pageTransitions, 'ink')

// 流波懒加载队列与零妥协优化辅助函数校验（Hc 绕过、叶级视口剪枝、导航防误杀、LRU 缓存）。
const inkQueue = createInkCaptureQueue((a, b) => a === b)
const inkAc = new AbortController()
assert.equal(await inkQueue('outline', () => 'ok', { signal: inkAc.signal, timeoutMs: 200 }), 'ok')

// 1. stripBackdropFilterNodes：剔除纯毛玻璃节点映射，保留 url() 背景图与普通节点。
const mockStyle = (props) => ({ getPropertyValue: k => props[k] || '' })
const origGlass = { nodeType: 1 }
const origGlassWithImg = { nodeType: 1 }
const origPlain = { nodeType: 1 }
const cloneGlass = {}
const cloneGlassWithImg = {}
const clonePlain = {}
const testNodeMap = new Map([
  [cloneGlass, origGlass],
  [cloneGlassWithImg, origGlassWithImg],
  [clonePlain, origPlain]
])
const testStyleCache = new WeakMap([
  [origGlass, mockStyle({ 'backdrop-filter': 'blur(20px) saturate(1.5)', 'background-image': 'none' })],
  [origGlassWithImg, mockStyle({ 'backdrop-filter': 'blur(12px)', 'background-image': 'url("cover.png")' })],
  [origPlain, mockStyle({ 'backdrop-filter': 'none', 'background-image': 'none' })]
])
assert.equal(stripBackdropFilterNodes(testNodeMap, testStyleCache, () => null), 1)
assert.equal(testNodeMap.has(cloneGlass), false)
assert.equal(testNodeMap.has(cloneGlassWithImg), true)
assert.equal(testNodeMap.has(clonePlain), true)

// 2. createViewportPruner：绝不误伤 root/定位背景/视口内卡片，精准跳过隐藏保活面板与视口外叶卡片。
const vpRect = { left: 0, top: 0, right: 1400, bottom: 900, width: 1400, height: 900 }
const lanesRect = { left: 300, top: 200, right: 1360, bottom: 860, width: 1060, height: 660 }
const makePruneNode = ({ classes = [], rect: r = vpRect, style = {}, closestMap = {} }) => ({
  nodeType: 1,
  style,
  classList: { contains: name => classes.includes(name) },
  matches: sel => sel.split(',').map(s => s.trim()).some(token => classes.some(c => token === '.' + c)),
  getBoundingClientRect: () => r,
  closest: sel => closestMap[sel] || null
})
const mockLanes = makePruneNode({ classes: ['snip-lanes'], rect: lanesRect })
const prunerRoot = { querySelector: sel => (sel === '.snip-lanes' ? mockLanes : null) }
const prune = createViewportPruner(prunerRoot, vpRect)
assert.equal(prune(prunerRoot), false)
assert.equal(prune(makePruneNode({ classes: ['st-backdrop-wrap'] })), false)
assert.equal(prune(makePruneNode({ classes: ['center-pane'], style: { display: '' } })), false)
assert.equal(prune(makePruneNode({ classes: ['center-pane'], style: { display: 'none' } })), true)
assert.equal(prune(makePruneNode({ classes: ['pop-lock-pane'] })), true)
assert.equal(prune(makePruneNode({
  classes: ['snip-note'],
  rect: { left: 320, top: 240, right: 540, bottom: 420, width: 220, height: 180 },
  closestMap: { '.snip-lanes': mockLanes }
})), false)
assert.equal(prune(makePruneNode({
  classes: ['snip-note'],
  rect: { left: 320, top: 1200, right: 540, bottom: 1380, width: 220, height: 180 },
  closestMap: { '.snip-lanes': mockLanes }
})), true)

// 3. isNavigationControl：导航栏/书架卡片触发不误杀缓存，正文区触发正常失效。
assert.equal(isNavigationControl({ nodeType: 1, closest: s => s.includes('.app-topbar') }), true)
assert.equal(isNavigationControl({ nodeType: 1, closest: () => null }), false)

// 4. createSceneCache：LRU 容量淘汰与指纹变更自动失配。
const cache = createSceneCache(2)
cache.set('k1', 'fp1', 'img1')
cache.set('k2', 'fp2', 'img2')
assert.equal(cache.get('k1', 'fp1'), 'img1')
assert.equal(cache.get('k1', 'fp1-changed'), null)
cache.set('k3', 'fp3', 'img3')
assert.equal(cache.size, 2)
assert.equal(cache.get('k2', 'fp2'), null)
assert.equal(cache.get('k1', 'fp1'), 'img1')
assert.equal(cache.get('k3', 'fp3'), 'img3')

console.log('雾幕与流波全链路单测通过：对角线波前、原地雾化零残留、设置三档兼容及流波零妥协缓存/剪枝')
