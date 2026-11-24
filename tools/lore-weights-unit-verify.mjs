/**
 * 条目五级权重（Entry Weight）全链路纯逻辑单元自测：
 * - 验证五档常量、向后兼容与标签推导优先级（核心 > 关键 > 点缀 > 末节；标准不压制非标准）
 * - 验证 lorePlanetData / networkModel / relaxSetEntries 径向层级与手拖位置保留
 * - 验证 paintNetwork 零 shadowBlur、五级命中半径（末节 >= 10px）、LOD 阈值与防碰撞占坑顺序
 */
import assert from 'node:assert/strict'
import {
  DEFAULT_ENTRY_WEIGHT,
  ENTRY_WEIGHTS,
  ENTRY_WEIGHT_ORDER,
  deriveWeightFromTags,
  entryWeightMeta,
  entryWeightRank,
  normalizeEntryWeight,
  resolveEntryWeight,
  tagMetaCreatedAt,
  tagMetaWeight
} from '../src/services/lore-weights.js'
import { lorePlanetData } from '../src/components/skins/latent/lore/planets/lore-planet-data.js'
import { networkModel, overviewView, relaxSetEntries, spacePlanets, TUNING } from '../src/components/skins/latent/lore/planets/planet-scene.js'
import { paintNetwork } from '../src/components/skins/latent/lore/planets/draw-planets.js'

const checks = []
function test(name, fn) {
  try {
    fn()
    checks.push({ name, ok: true })
  } catch (err) {
    checks.push({ name, ok: false, err })
  }
}

test('五级权重常量与规格倍率', () => {
  assert.equal(DEFAULT_ENTRY_WEIGHT, 'standard')
  assert.deepEqual(ENTRY_WEIGHT_ORDER, ['core', 'key', 'standard', 'accent', 'trivial'])
  assert.deepEqual(
    ENTRY_WEIGHTS.map(w => [w.id, w.label, w.value, w.scale]),
    [
      ['core', '核心', 5, 1.38],
      ['key', '关键', 4, 1.18],
      ['standard', '标准', 3, 1.0],
      ['accent', '点缀', 2, 0.8],
      ['trivial', '末节', 1, 0.62]
    ]
  )
  assert.equal(normalizeEntryWeight(undefined), 'standard')
  assert.equal(normalizeEntryWeight('legacy-unknown'), 'standard')
  assert.equal(normalizeEntryWeight('core'), 'core')
})

test('历史 mubuTagMeta 兼容与标签推导优先级', () => {
  const tagMeta = {
    旧标签: 1700000000000,
    常规: { createdAt: 1700000001000, weight: 'standard' },
    支柱: { createdAt: 1700000002000, weight: 'core' },
    枢纽: { createdAt: 1700000003000, weight: 'key' },
    风物: { createdAt: 1700000004000, weight: 'accent' },
    注脚: { createdAt: 1700000005000, weight: 'trivial' }
  }
  assert.equal(tagMetaCreatedAt(tagMeta.旧标签), 1700000000000)
  assert.equal(tagMetaWeight(tagMeta.旧标签), 'standard')
  assert.equal(deriveWeightFromTags([], tagMeta), 'standard')
  assert.equal(deriveWeightFromTags(['旧标签', '常规'], tagMeta), 'standard')
  // 非标准标签（即便为末节）应覆盖默认标准
  assert.equal(deriveWeightFromTags(['常规', '注脚'], tagMeta), 'trivial')
  // 多个非标准标签取优先级最高者：核心 > 关键 > 点缀 > 末节
  assert.equal(deriveWeightFromTags(['注脚', '风物'], tagMeta), 'accent')
  assert.equal(deriveWeightFromTags(['风物', '枢纽'], tagMeta), 'key')
  assert.equal(deriveWeightFromTags(['枢纽', '支柱', '注脚'], tagMeta), 'core')
  // 条目显式 weight 覆盖标签推导
  assert.equal(resolveEntryWeight({ tags: ['支柱'] }, tagMeta), 'core')
  assert.equal(resolveEntryWeight({ tags: ['支柱'], weight: 'accent' }, tagMeta), 'accent')
  assert.equal(resolveEntryWeight({ tags: ['支柱'], weight: 'standard' }, tagMeta), 'standard')
  assert.equal(resolveEntryWeight({ tags: [], weight: 'invalid' }, tagMeta), 'standard')
})

test('星图组装与自动布局径向五层分层（保留手拖位置）', () => {
  const tagMeta = {
    核心签: { createdAt: 1, weight: 'core' },
    关键签: { createdAt: 2, weight: 'key' },
    点缀签: { createdAt: 3, weight: 'accent' },
    末节签: { createdAt: 4, weight: 'trivial' }
  }
  const entries = [
    { id: 'set1', parentId: null, text: '界脊', createdAt: 1 },
    { id: 'e-core', parentId: 'set1', text: '界脊断崖', tags: ['核心签'], createdAt: 2 },
    { id: 'e-key', parentId: 'set1', text: '领航员公会', tags: ['关键签'], createdAt: 3 },
    { id: 'e-std', parentId: 'set1', text: '白鸦深水港', tags: [], createdAt: 4 },
    { id: 'e-acc', parentId: 'set1', text: '沉眠之海', tags: ['点缀签'], createdAt: 5 },
    { id: 'e-tri', parentId: 'set1', text: '盐霜坡', tags: ['末节签'], createdAt: 6 }
  ]
  const raw = lorePlanetData(entries, [], [], { tagMeta })
  const byId = new Map(raw.nodes.map(n => [n.id, n]))
  assert.equal(byId.get('e-core').weight, 'core')
  assert.equal(byId.get('e-key').weight, 'key')
  assert.equal(byId.get('e-std').weight, 'standard')
  assert.equal(byId.get('e-acc').weight, 'accent')
  assert.equal(byId.get('e-tri').weight, 'trivial')

  const model = networkModel(raw.sets, raw.nodes, raw.links, raw.satellites)
  const planet = model.planets[0]
  const pts = relaxSetEntries(planet, undefined, 1)
  const radOf = id => {
    const idx = planet.entries.findIndex(e => e.id === id)
    return pts[idx].length() / TUNING.detailRadius
  }
  const rCore = radOf('e-core')
  const rKey = radOf('e-key')
  const rStd = radOf('e-std')
  const rAcc = radOf('e-acc')
  const rTri = radOf('e-tri')
  assert.ok(rCore < rKey && rKey < rStd && rStd < rAcc && rAcc < rTri,
    `径向分层未严格递增: core=${rCore.toFixed(3)}, key=${rKey.toFixed(3)}, std=${rStd.toFixed(3)}, acc=${rAcc.toFixed(3)}, tri=${rTri.toFixed(3)}`)
  assert.ok(rCore >= 0.10 && rCore <= 0.36, `core 径向越界: ${rCore}`)
  assert.ok(rTri >= 0.70 && rTri <= 0.87, `trivial 径向越界: ${rTri}`)

  // 手动拖拽位置优先保留
  const manualPos = [0.1, 0.1, 0.05]
  const ptsSaved = relaxSetEntries(planet, { 'e-tri': manualPos }, 1)
  const triIdx = planet.entries.findIndex(e => e.id === 'e-tri')
  assert.ok(Math.hypot(
    ptsSaved[triIdx].x - manualPos[0],
    ptsSaved[triIdx].y - manualPos[1],
    ptsSaved[triIdx].z - manualPos[2]
  ) < 0.02, '手拖自定义位置应优先保留')
})

test('paintNetwork 零 shadowBlur、五级命中半径与 LOD 标签阈值', () => {
  const entries = [
    { id: 'set1', parentId: null, text: '界脊', createdAt: 1 },
    { id: 'e-core', parentId: 'set1', text: '界脊断崖', weight: 'core', createdAt: 2 },
    { id: 'e-key', parentId: 'set1', text: '领航员公会', weight: 'key', createdAt: 3 },
    { id: 'e-std', parentId: 'set1', text: '白鸦深水港', weight: 'standard', createdAt: 4 },
    { id: 'e-acc', parentId: 'set1', text: '沉眠之海', weight: 'accent', createdAt: 5 },
    { id: 'e-tri', parentId: 'set1', text: '盐霜坡', weight: 'trivial', createdAt: 6 }
  ]
  const raw = lorePlanetData(entries, [], [], {})
  const model = networkModel(raw.sets, raw.nodes, raw.links, raw.satellites)
  const sys = model.system('')
  sys.planets = spacePlanets(sys.planets, {}, 100, {}, 16 / 9)

  function runFrame(zoom, hoverId = '') {
    let shadowBlurWrites = 0
    const drawnTexts = []
    const ctx = {
      font: '12px sans-serif',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      set shadowBlur(v) { if (v) shadowBlurWrites++ },
      get shadowBlur() { return 0 },
      clearRect() {},
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      arc() {},
      ellipse() {},
      rect() {},
      roundRect() {},
      fill() {},
      stroke() {},
      fillRect() {},
      setLineDash() {},
      measureText(t) { return { width: String(t).length * 9 } },
      createRadialGradient() { return { addColorStop() {} } },
      createLinearGradient() { return { addColorStop() {} } },
      fillText(t) { drawnTexts.push(String(t)) }
    }
    const scene = { yaw: -0.28, pitch: 0.42, panX: 0, panY: 0, zoom, entryZoom: zoom, view: overviewView(), time: 0, framing: null }
    const out = paintNetwork(ctx, { width: 1280, height: 720 }, sys, scene, {
      positions: {},
      framingPositions: {},
      hoverId,
      nodeMotionTime: 1800,
      focusWeights: new Map()
    })
    return { shadowBlurWrites, drawnTexts, hits: out.hits }
  }

  // 100% 全景：零 shadowBlur、仅核心显标签、末节仍具备 >= 10px 拾取半径
  const f100 = runFrame(1.0)
  assert.equal(f100.shadowBlurWrites, 0, '绘制全程严禁设置非零 ctx.shadowBlur')
  const triHit = f100.hits.find(h => h.kind === 'node' && h.id === 'e-tri')
  assert.ok(triHit && (triHit.hitRadius ?? triHit.radius) >= 10, `末节拾取半径应 >= 10，实际 ${triHit?.hitRadius}`)
  assert.ok(f100.drawnTexts.includes('界脊断崖'), '100% 全景应显示核心条目标签')
  assert.ok(!f100.drawnTexts.includes('盐霜坡'), '100% 全景不应展开末节标签')

  // 115%：解锁关键，但未解锁标准/点缀/末节
  const f115 = runFrame(1.15)
  assert.ok(f115.drawnTexts.includes('领航员公会'), 'zoom 1.15 应解锁关键条目标签')
  assert.ok(!f115.drawnTexts.includes('沉眠之海'), 'zoom 1.15 不应展开点缀标签')
  assert.ok(!f115.drawnTexts.includes('盐霜坡'), 'zoom 1.15 不应展开末节标签')

  // 170%：深度缩放解锁末节
  const f170 = runFrame(1.70)
  assert.ok(f170.drawnTexts.includes('盐霜坡'), 'zoom 1.70 应解锁末节条目标签')

  // 100% 直接悬停末节：立即展开末节标签
  const fHoverTri = runFrame(1.0, 'e-tri')
  assert.ok(fHoverTri.drawnTexts.includes('盐霜坡'), '100% 悬停末节节点应立即显示其标签')
})

const failed = checks.filter(c => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}`)
  if (!c.ok) console.error(c.err)
}
console.log(`Total: ${checks.length - failed.length}/${checks.length} passed`)
if (failed.length) process.exit(1)
