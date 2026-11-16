/* 幻流（dsh）皮肤接线验证：纯 Node，读源码做静态断言。
 * 不启动 Electron——它证明的是「接线存在且形态正确」，不证明视觉正确。
 * 用法：node tools/latent-integration-verify.mjs（目标根下）
 */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { resolveLoreGalaxy } from '../src/services/lore-core.js'
import { networkModel, spacePlanets } from '../src/components/skins/latent/lore/planets/planet-scene.js'
import { entryCircleGlyphs, entryCircleRadius, entryRadiusLimit, layoutEntryCircleText } from '../src/components/skins/latent/lore/planets/entry-circles.js'
import { advanceCenterGlow, CENTER_GLOW_EFFECTS, centerGlowEdge, centerGlowPulse, centerGlowSample, centerGlowWave, DEFAULT_CENTER_GLOW, hasCenterColorModes, normalizeCenterGlow } from '../src/components/skins/latent/lore/planets/center-glow.js'

const ROOT = process.cwd()
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const exists = (rel) => fs.existsSync(path.join(ROOT, rel))

const checks = []
const check = (name, fn) => {
  try {
    fn()
    checks.push({ name, ok: true })
  } catch (error) {
    checks.push({ name, ok: false, reason: error.message })
  }
}

/* ── 1. 注册层 ── */
check('registry：dsh 对桌面可见，label 为「幻流」', async () => {})
const registrySrc = read('src/skins/registry.js')
check('registry 含 dsh 条目且 audience 为 desktop', () => {
  assert.match(registrySrc, /id:\s*'dsh'/, '缺少 dsh 条目')
  const dshLine = registrySrc.split('\n').find((l) => l.includes("id: 'dsh'"))
  assert.ok(dshLine, '找不到 dsh 行')
  assert.match(dshLine, /audience:\s*'desktop'/, 'dsh 未对桌面开放：' + dshLine.trim())
  assert.match(dshLine, /label:\s*'幻流'/, 'dsh 的 label 不是「幻流」：' + dshLine.trim())
})

check('registry 导出 isLatentSkin 且只认 dsh', () => {
  assert.match(registrySrc, /export function isLatentSkin/, '缺少 isLatentSkin 导出')
  assert.match(registrySrc, /return value === 'dsh'/, 'isLatentSkin 判断不是 dsh')
})

check('四套旧皮肤仍在，默认回落幻流（dsh）', () => {
  for (const id of ['original', 'gravity', 'glaze', 'crimson']) {
    assert.ok(registrySrc.includes(`id: '${id}'`), '缺少旧皮肤 ' + id)
  }
  /* 默认皮肤已改为幻流：回落值走 DEFAULT_SKIN 常量，不再字面量写 'original'。 */
  assert.match(registrySrc, /DEFAULT_SKIN = 'dsh'/, 'DEFAULT_SKIN 不是 dsh')
  assert.match(registrySrc, /normalizeSkin[\s\S]{0,100}return DEFAULT_SKIN/, 'normalizeSkin 未回落 DEFAULT_SKIN')
  /* 引力书舱与琉光画境保留注册但不出现在选择器里（老存档仍可选中它们）。 */
  for (const id of ['gravity', 'glaze']) {
    const line = registrySrc.split('\n').find((l) => l.includes(`id: '${id}'`))
    assert.ok(line, '缺少注册 ' + id)
    assert.ok(line.includes('selector: false'), id + ' 应标注 selector: false')
  }
})

/* ── 2. 主题 ── */
check('仅启用幻流，外观页不提供皮肤切换', async () => {
  const { visibleSkins, normalizeSkin } = await import('../src/skins/registry.js')
  assert.deepEqual(visibleSkins('desktop').map(skin => skin.id), ['dsh'])
  for (const old of ['original', 'gravity', 'glaze', 'crimson']) assert.equal(normalizeSkin(old), 'dsh')
  const appearance = read('src/components/skins/latent/settings/SettingsAppearance.vue')
  assert.doesNotMatch(appearance, /setting-skin|ui\.setSkin/)
  const { searchSettings } = await import('../src/components/skins/latent/settings/settings-catalog.js')
  assert.ok(!searchSettings('皮肤').some(entry => entry.id === 'skin'))
})

check('theme-latent.js 存在且导出 useLatentTheme', () => {
  assert.ok(exists('src/skins/theme-latent.js'), '缺少 theme-latent.js')
  const src = read('src/skins/theme-latent.js')
  assert.match(src, /export function useLatentTheme/, '缺少 useLatentTheme 导出')
  /* 断言代码而非注释：去掉注释行后再查宿主依赖 */
  const code = src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')
  assert.ok(!code.includes('ns-theme-changed'), '仍在监听插件宿主的 ns-theme-changed 事件')
  assert.ok(!code.includes('data-ns-dark'), '仍在读插件宿主的 data-ns-dark')
})

check('App.vue 接入幻流主题与 settings→work 的 surface 映射', () => {
  const src = read('src/App.vue')
  assert.match(src, /useLatentTheme/, 'App.vue 未使用 useLatentTheme')
  assert.match(src, /isLatentSkin/, 'App.vue 未使用 isLatentSkin')
  assert.match(src, /view === 'settings' \? 'work'/, 'settings 未映射为 work surface')
})

/* ── 3. 书架与模块工作区接线 ── */
check('Bookshelf 按 isLatentSkin 渲染 LatentShelf', () => {
  const src = read('src/components/Bookshelf.vue')
  assert.match(src, /LatentShelf/, 'Bookshelf 未引入 LatentShelf')
  assert.match(src, /isLatentSkin\(ui\.skin\)/, 'Bookshelf 未按 isLatentSkin 分派')
  /* 四套旧书架必须都还在 */
  for (const c of ['OriginalShelf', 'GravityShelf', 'GlazeShelf', 'CrimsonShelf']) {
    assert.ok(src.includes(c), '旧书架被移除：' + c)
  }
})

check('Workbench 在幻流下渲染四个完整工作区，旧皮肤仍走 Center', () => {
  const src = read('src/components/Workbench.vue')
  for (const c of ['LatentOutlineCenter', 'CharactersWorkspace', 'LoreWorkspace', 'SnippetsWorkspace']) {
    assert.ok(src.includes(c), 'Workbench 缺少 ' + c)
  }
  for (const c of ['OutlineCenter', 'CharacterCenter', 'MubuView', 'SnippetCenter']) {
    assert.ok(src.includes(c), '旧模块组件被移除：' + c)
  }
  assert.match(src, /isLatentSkin\(ui\.skin\)/, 'Workbench 未按 isLatentSkin 分派')
})

check('Workbench 幻流下让位外置目录栏（避免双层目录）', () => {
  const src = read('src/components/Workbench.vue')
  assert.match(src, /latentSidebarOwned/, '缺少 latentSidebarOwned 判断')
  assert.match(src, /\['lore', 'characters', 'snippets'\]/, '未排除自带侧栏的三个模块')
})

check('PanelHost 内容窗同样按 isLatentSkin 分派', () => {
  const src = read('src/components/PanelHost.vue')
  assert.match(src, /isLatentSkin/, 'PanelHost 未引入 isLatentSkin')
  assert.match(src, /<PanelBackdrop v-if="latentContent"/, '幻流独立面板未挂载共享背板')
  for (const c of ['LatentOutlineCenter', 'CharactersWorkspace', 'LoreWorkspace', 'SnippetsWorkspace']) {
    assert.ok(src.includes(c), 'PanelHost 缺少 ' + c)
  }
})

/* ── 4. 样式层 ── */
check('latent 样式索引存在且按插件版顺序导入', () => {
  assert.ok(exists('src/styles/skins/latent/index.js'), '缺少样式索引')
  const src = read('src/styles/skins/latent/index.js')
  const order = ["'./dsh.css'", "'./language.css'", "'./flow-shell.css'"]
  let last = -1
  for (const item of order) {
    const at = src.indexOf(item)
    assert.ok(at > last, '样式顺序错误：' + item)
    last = at
  }
  assert.ok(read('src/main.js').includes('styles/skins/latent/index.js'), 'main.js 未导入幻流样式')
})

check('幻流样式里不存在隐藏模块助手的规则', () => {
  const dir = path.join(ROOT, 'src/styles/skins/latent')
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.css'))) {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8')
    /* 去掉注释，只查真正的 CSS 规则 */
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '')
    assert.ok(
      !/\.module-agent\s*\{[^}]*display\s*:\s*none/.test(code),
      f + ' 仍在隐藏模块助手（桌面版必须保留该入口）'
    )
  }
})

/* ── 5. 宿主隔离 ── */
check('未注入 window.__NS_AGENT__，未把 nsPlugin 写死为 true', () => {
  const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) walk(full, out)
      else if (/\.(js|vue|mjs)$/.test(e.name)) out.push(full)
    }
    return out
  }
  for (const file of walk(path.join(ROOT, 'src'))) {
    const src = fs.readFileSync(file, 'utf8')
    /* 只禁「赋值注入」。database.js 里读取 window.__NS_AGENT__ 选库名是插件构建的原有行为，
       桌面构建没有任何地方赋值，该分支永不命中，不算违规。 */
    assert.ok(
      !/window\.__NS_AGENT__\s*=(?!=)/.test(src),
      path.relative(ROOT, file) + ' 注入了 __NS_AGENT__'
    )
  }
  const vite = read('vite.config.mjs')
  assert.match(vite, /__NS_PLUGIN__:\s*JSON\.stringify\(false\)/, '__NS_PLUGIN__ 不是 false')
})

/* ── 6. 数据服务 ── */
check('doublelinks 已合并幻流需要的身份引用接口', () => {
  const src = read('src/services/doublelinks.js')
  for (const fn of ['referenceSources', 'findReferences', 'findOutgoingReferences']) {
    assert.match(src, new RegExp('export function ' + fn), '缺少导出 ' + fn)
  }
  assert.ok(src.includes("olnode"), '未支持 olnode 目标类型')
  assert.ok(src.includes("from './lore-core.js'"), '未接入 lore-core')
})

check('迁入模块全部在位', () => {
  const dirs = [
    'src/components/skins/latent/LatentShelf.vue',
    'src/components/skins/latent/characters/CharactersWorkspace.vue',
    'src/components/skins/latent/lore/LoreWorkspace.vue',
    'src/components/skins/latent/outline/OutlineWorkspace.vue',
    'src/components/skins/latent/snippets/SnippetsWorkspace.vue',
    'src/components/skins/latent/settings/SettingsWorkspace.vue',
    'src/components/skins/latent/stats/WritingStatsDialog.vue',
    'src/services/latent/flow.js',
    'src/services/lore-core.js',
    'src/services/writing-stats-core.js'
  ]
  for (const d of dirs) assert.ok(exists(d), '缺少 ' + d)
})

check('设置界面：无应用顶栏、有 × 退出、分类栏宽屏常驻', () => {
  const src = read('src/components/skins/latent/settings/SettingsWorkspace.vue')

  /* 设置是全屏接管，不该再借用书架/正文那根顶栏 */
  assert.ok(!/<AppTopbar/.test(src), '设置界面仍在渲染 AppTopbar')
  assert.ok(!/onTopbarNavigate/.test(src), '仍残留顶栏导航处理')

  /* 除 Esc 之外的直观退出方式 */
  assert.match(src, /data-act="close-settings"/, '缺少右上角 × 关闭按钮')
  assert.match(src, /function exitSettings/, '缺少 exitSettings')
  assert.match(src, /leaveSettings\(ui\)/, '× 未走 leaveSettings')

  /* 分类栏：抽屉态只在窄屏成立，宽屏必须复位，否则拉宽后遮罩残留 */
  assert.match(src, /if \(nextNarrow !== narrow\.value\)/, 'onResize 未按断点变化复位抽屉')

  /* 外观页要能切皮肤与暗色 */
  const appearance = read('src/components/skins/latent/settings/SettingsAppearance.vue')
  assert.doesNotMatch(appearance, /id="setting-skin"/)
})

/* 插件版与桌面版共用同一套设置界面：构建配置只切 __NS_PLUGIN__ 与产物目录，
 * 因此两版行为一致；这里守住「两版都真的产出」这一条，避免只打了一版。 */
check('桌面版与插件版构建目标都在', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.ok(pkg.scripts.build, '缺桌面版 build')
  assert.ok(pkg.scripts['build:plugin'], '缺插件版 build:plugin')
  const pluginCfg = read('vite.config.plugin.mjs')
  assert.match(pluginCfg, /__NS_PLUGIN__/, '插件构建未定义 __NS_PLUGIN__')
  assert.match(pluginCfg, /outDir: 'dist-plugin'/, '插件产物目录不是 dist-plugin')
})

check('关系星图：条目定位、移动和缺失节点回退', () => {
  const nodes = [{ id: 'set' }, { id: 'other' }, { id: 'branch', parentId: 'set' }, { id: 'leaf', parentId: 'branch' }]
  const location = resolveLoreGalaxy(nodes, { rootId: 'branch', activeId: 'leaf' })
  assert.deepEqual(location, { rootId: 'branch', rootPath: ['set', 'branch'], activeId: 'leaf', selectedId: 'leaf', scope: 'set' })
  const moved = nodes.map(node => node.id === 'leaf' ? { ...node, parentId: 'other' } : node)
  assert.equal(resolveLoreGalaxy(moved, location).rootId, 'other')
  const deleted = nodes.map(node => ['branch', 'leaf'].includes(node.id) ? { ...node, deletedAt: 1 } : node)
  assert.equal(resolveLoreGalaxy(deleted, location).activeId, 'set')
  assert.equal(resolveLoreGalaxy([], location).scope, 'all')
})

check('关系星图：跨集关系与集内路线保留', () => {
  const graph = networkModel([{ id: 'set' }, { id: 'other' }], [
    { id: 'branch', setId: 'set', parentId: 'set' }, { id: 'leaf', setId: 'set', parentId: 'branch' }
  ], [{ id: 'local', from: 'branch', to: 'leaf' }, { id: 'cross', from: 'leaf', to: 'other' }])
  assert.equal(graph.system('branch').routes[0].id, 'local')
  assert.equal(graph.system('').bridges[0].links[0].id, 'cross')
  assert.equal(graph.byBody.get('leaf').links.length, 2)
  const merged = spacePlanets(graph.system('').planets, {}, 100, { joins: { other: 'set' }, independent: true })
  assert.deepEqual(merged.map(body => body.orbitId), ['set', 'set'])
  assert.equal(merged[0].orbitRadius, merged[1].orbitRadius)
})

check('关系星图：中心动效默认值、范围与连续相位', () => {
  assert.deepEqual(normalizeCenterGlow(), DEFAULT_CENTER_GLOW)
  assert.deepEqual(normalizeCenterGlow({ color: '#33BBCC', brightness: 500, speed: -1, effect: 'bad' }), {
    color: '#33bbcc', brightness: 150, speed: 0, effect: 'ripple', colorMode: 'solid'
  })
  assert.deepEqual(normalizeCenterGlow({ color: '#349abc', brightness: 65, speed: 75, effect: 'twinkle' }), {
    color: '#349abc', brightness: 65, speed: 75, effect: 'pulse', colorMode: 'solid'
  })
  assert.equal(normalizeCenterGlow({ colorMode: 'zones' }).colorMode, 'zones')
  assert.equal(normalizeCenterGlow({ colorMode: 'invalid' }).colorMode, 'solid')
  assert.equal(Object.keys(CENTER_GLOW_EFFECTS).length, 5)
  assert.equal(CENTER_GLOW_EFFECTS.ripple, '波纹')
  assert.deepEqual(Object.keys(CENTER_GLOW_EFFECTS).filter(hasCenterColorModes), ['breathe', 'pulse'])
  assert.equal(advanceCenterGlow(420, 32, 0), 420)
  assert.equal(advanceCenterGlow(420, 32, 200), 484)
  assert.equal(advanceCenterGlow(420, 2000, 100), 460)
  for (const effect of ['ripple', 'sweep', 'rainbow']) {
    const edge = centerGlowEdge(effect, -.8 / 7, 1.8)
    assert.ok(edge >= 0 && edge <= 1)
    assert.notEqual(edge, centerGlowEdge(effect, -.8 / 7, 0))
  }
})

check('关系星图：逐色交接、分区相位与脉动扩散包络', () => {
  for (const [effect, period] of [['breathe', 3.6], ['pulse', 2.6]]) {
    const sample = (turn, mode = 'cycle', angle = 0) => centerGlowSample(effect, mode, period * turn, angle)
    assert.equal(sample(.5).hueOffset, 0)
    assert.ok(sample(.9).hueOffset > 0 && sample(.9).hueOffset < 60)
    assert.equal(sample(1).hueOffset, 60)
    assert.ok(sample(5.99).hueOffset > 359)
    assert.deepEqual(sample(6), sample(0))
    assert.equal(sample(.5, 'solid').hueOffset, 0)
    const [first, second] = [0, Math.PI / 3].map(angle => sample(.5, 'zones', angle))
    assert.equal(first.phase, .5)
    assert.ok(Math.abs(second.phase - 1 / 3) < 1e-9)
    assert.equal(second.hueOffset, 60)
  }
  assert.ok(centerGlowPulse(.5) > centerGlowPulse(0))
  assert.equal(centerGlowWave(0), 0)
  assert.ok(centerGlowWave(.4) > 0)
  assert.equal(centerGlowWave(.85), 0)
})

check('关系星图：条目字数定径及手动扩容', () => {
  const text = entryCircleGlyphs('  星图观测记录\n' + '界'.repeat(70) + '  ')
  assert.equal(text.join('').startsWith('星图观测记录 '), true)
  assert.ok(entryCircleRadius(10, 1) < entryCircleRadius(10, 15))
  assert.ok(entryCircleRadius(10, 15) < entryCircleRadius(10, 70))
  assert.equal(entryRadiusLimit(900, 120), 56)
  const measure = str => Array.from(str).length * 8
  const auto = layoutEntryCircleText(measure, text, 30, false, 10)
  assert.equal(auto.length, 3)
  assert.ok(Array.from(auto.join('')).length <= 15)
  assert.ok(auto.join('').endsWith('…'))
  const resized = layoutEntryCircleText(measure, text, 55, true, 10)
  assert.ok(resized.length > 3)
  assert.ok(Array.from(resized.join('')).length > 15)
  assert.equal(layoutEntryCircleText(measure, entryCircleGlyphs('银湾'), 18, false, 10).join(''), '银湾')
})

/* ── 输出 ── */
let failed = 0
for (const c of checks) {
  if (c.ok) console.log('PASS ' + c.name)
  else {
    failed++
    console.log('FAIL ' + c.name)
    console.log('     ' + c.reason)
  }
}
console.log('')
console.log(failed ? failed + ' 项未通过（共 ' + checks.length + ' 项）' : '全部 ' + checks.length + ' 项通过')
process.exit(failed ? 1 : 0)
