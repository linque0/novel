/* 幻流（dsh）皮肤接线验证：纯 Node，读源码做静态断言。
 * 不启动 Electron——它证明的是「接线存在且形态正确」，不证明视觉正确。
 * 用法：node tools/latent-integration-verify.mjs（目标根下）
 */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { resolveLoreGalaxy } from '../src/services/lore-core.js'
import { characterBiographies, characterBiographyText, createCharacterDraft, characterDraftPatch } from '../src/services/character-biographies.js'
import { fingerprint, matchesSnippetContent, snippetContentFingerprint } from '../src/services/snippet-history.js'
import { moveBefore, normalizeSnipState, noteView, pickSnipCardColor, snippetDropPlacement, snippetNavGroups, tagsAfterGroupMove } from '../src/components/skins/latent/snippets/snippet-model.js'
import { networkModel, orbitPoint, rotation, scaleOrbitRadius, spacePlanets, TUNING, withOrbitSpacingReference } from '../src/components/skins/latent/lore/planets/planet-scene.js'
import { paintNetwork } from '../src/components/skins/latent/lore/planets/draw-planets.js'
import { entryCircleGlyphs, entryCircleScale, entryDisplayRadius, entryRadiusLimit, entryReferenceRadius, layoutEntryCircleText } from '../src/components/skins/latent/lore/planets/entry-circles.js'
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

check('灵感：编辑正文时修改标签和关联不触发正文冲突', () => {
  const row = { id: 'snippet', content: '标题\n\n正文', tags: [], links: [], deletedAt: null }
  const bases = [fingerprint(row), snippetContentFingerprint(row)]
  for (const base of bases) {
    assert.ok(matchesSnippetContent({ ...row, tags: ['标签'], links: [{ kind: 'mubu', id: 'note' }] }, base))
    assert.equal(matchesSnippetContent({ ...row, content: '外部改写' }, base), false)
    assert.equal(matchesSnippetContent({ ...row, deletedAt: 123 }, base), false)
    assert.equal(matchesSnippetContent(null, base), false)
  }
})

check('灵感：标题正文、标签和关联显示在同一详情面板', () => {
  const panel = read('src/components/skins/latent/snippets/SnipInspector.vue')
  assert.match(panel, /v-if="!note\.deletedAt"\s+class="snip-edit-form"/)
  assert.doesNotMatch(panel, /!note\.deletedAt && !editing|编辑片段/)
  assert.match(panel, /name="title"[\s\S]*name="body"[\s\S]*已有关联/)
})

check('灵感：跨组移动只替换来源标签，兼容已有目标标签与未标记组', () => {
  assert.deepEqual(tagsAfterGroupMove(['场景', '伏笔'], '场景', '对白'), ['对白', '伏笔'])
  assert.deepEqual(tagsAfterGroupMove(['场景', '伏笔', '对白'], '场景', '对白'), ['伏笔', '对白'])
  assert.deepEqual(tagsAfterGroupMove([], null, '对白'), ['对白'])
  assert.deepEqual(tagsAfterGroupMove(['场景', '伏笔'], '场景', null), [])
  assert.equal(tagsAfterGroupMove(['人物', '对白'], '场景', '对白'), null)
  assert.equal(tagsAfterGroupMove(['人物'], null, '对白'), null)
})

check('灵感：拖拽插入线对应提交位置，跨组已有副本保留原位', () => {
  const notes = ['source', 'first', 'last'].map(id => ({ id }))
  const order = notes.map(note => note.id)
  const before = snippetDropPlacement(notes, 'source', 'last', false, true)
  assert.deepEqual(before, { beforeId: 'last', markerId: 'last', edge: 'before' })
  assert.deepEqual(moveBefore(order, 'source', before.beforeId), ['first', 'source', 'last'])
  const after = snippetDropPlacement(notes, 'source', 'last', true, true)
  assert.deepEqual(after, { beforeId: '', markerId: 'last', edge: 'after' })
  assert.deepEqual(moveBefore(order, 'source', after.beforeId), ['first', 'last', 'source'])
  assert.deepEqual(snippetDropPlacement(notes, 'source', undefined, false, false), after)
  assert.deepEqual(snippetDropPlacement([], 'source', undefined, false, false), { ...after, markerId: '' })
  assert.equal(snippetDropPlacement(notes, 'source', 'source', false, true), null)
  assert.equal(snippetDropPlacement(notes, 'source', 'first', false, true), null)
  assert.equal(snippetDropPlacement(notes, 'last', undefined, false, true), null)
  assert.deepEqual(snippetDropPlacement(notes, 'source', 'source', false, false), { ...after, markerId: 'source', edge: 'existing' })
})

check('灵感：旧手札设置仍保留筛选，异常的拼板显示设置回退到有效值', () => {
  const legacy = normalizeSnipState({ view: 'journal', tag: '场景', sort: 'manual' })
  assert.equal(legacy.tag, '场景')
  assert.equal(legacy.sort, 'manual')
  assert.equal(legacy.cardSize, 100)
  assert.equal(legacy.sidebarWidth, 220)
  assert.deepEqual(legacy.expandedGroups, [])
  const saved = normalizeSnipState({ cardSize: 'large', sidebarWidth: 500, expandedGroups: ['all', 'all', null, 'tag:场景'] })
  assert.equal(saved.cardSize, 125)
  assert.equal(saved.sidebarWidth, 420)
  assert.deepEqual(saved.expandedGroups, ['all', 'tag:场景'])
  assert.equal(normalizeSnipState({ cardSize: 'small' }).cardSize, 80)
  assert.equal(normalizeSnipState({ cardSize: 112 }).cardSize, 112)
  assert.equal(normalizeSnipState({ cardSize: 0 }).cardSize, 80)
  assert.equal(normalizeSnipState({ cardSize: 150 }).cardSize, 125)
})

check('灵感：分组目录列出全部未删除卡片，保留颜色与排序', () => {
  const notes = [
    noteView({ id: 'a', tags: ['场景', '对白'], createdAt: 2, cardColor: 'moss' }),
    noteView({ id: 'b', createdAt: 1, cardColor: 'invalid' }),
    noteView({ id: 'c', tags: ['场景'], deletedAt: 3 })
  ]
  const groups = snippetNavGroups(notes, ['对白', '场景'], 'old', [])
  assert.deepEqual(groups.map(group => [group.id, group.notes.map(note => note.id)]), [
    ['all', ['b', 'a']], ['untagged', ['b']], ['linked', []], ['tag:对白', ['a']], ['tag:场景', ['a']]
  ])
  assert.equal(groups[0].notes[0].cardColor, 'default')
  assert.equal(groups[0].notes[1].cardColor, 'moss')
})

check('灵感：新建卡片随机取色，默认色留给已有卡片和手动设置', () => {
  const colors = [0, 0.25, 0.5, 0.75, 0.99].map(pickSnipCardColor)
  assert.deepEqual(colors, ['rose', 'amber', 'moss', 'blue', 'lilac'])
  assert.equal(noteView({ id: 'legacy' }).cardColor, 'default')
})

check('写作分析：完整分析使用通用流动背景', () => {
  const dialog = read('src/components/skins/latent/stats/WritingStatsDialog.vue')
  const styles = read('src/styles/skins/latent/writing-stats-fusion.css')
  assert.match(dialog, /<StatsFlowBackdrop v-if="expanded && ui\.statsOpen" :work-id="s\.work"/)
  const backdrop = read('src/components/skins/latent/stats/StatsFlowBackdrop.vue')
  assert.match(backdrop, /mountFlowBackdrop\(canvas\.value,/)
  assert.match(backdrop, /effectiveFlowSpeed/)
  assert.match(backdrop, /resolveFlowPalette/)
  assert.doesNotMatch(styles, /writing-stats-backdrop\.webp|writing-stats-ambient/)
})

check('人物小传：兼容旧正文，独立标题及草稿确认', () => {
  const legacy = { name: '旧姓名', content: '旧正文\n[[旧链接]]', fields: { 一句话: '原文' }, tags: ['旧标签'] }
  const original = createCharacterDraft(legacy)
  const draft = createCharacterDraft(legacy)
  assert.equal(original.biographies[0].title, '人物小传')
  draft.name = '新姓名'
  draft.fields.一句话 = '修改'
  draft.tags.push('新标签')
  draft.biographies[0].title = '经历'
  draft.biographies.push({ id: 'extra', title: ' 动机 ', content: '新增正文\n[[新链接]]' })
  assert.equal(legacy.name, '旧姓名')
  assert.deepEqual(legacy.tags, ['旧标签'])
  assert.equal(legacy.fields.一句话, '原文')
  assert.deepEqual(characterDraftPatch(original, createCharacterDraft(legacy)), {})
  const saved = { ...legacy, ...characterDraftPatch(original, draft) }
  assert.equal(saved.content, legacy.content)
  assert.deepEqual(characterBiographies(saved).map(({ title, content }) => [title, content]),
    [['经历', legacy.content], ['动机', '新增正文\n[[新链接]]']])
  assert.ok(characterBiographyText(saved).includes('动机\n新增正文\n[[新链接]]'))
  const reopened = createCharacterDraft(saved)
  reopened.biographies.shift()
  const promoted = characterDraftPatch(createCharacterDraft(saved), reopened)
  assert.equal(promoted.content, '新增正文\n[[新链接]]')
  assert.equal(promoted.biographyTitle, '动机')
  assert.deepEqual(promoted.biographies, [])
})

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

check('关系星图：轨道间距直接调整自动轨道留白，保留手动半径和并轨', () => {
  const sets = ['a', 'b', 'c', 'd'].map(id => ({ id, title: id }))
  const entries = Array.from({ length: 20 }, (_, index) => ({ id: 'entry' + index, setId: 'b' }))
  const { planets } = networkModel(sets, entries, []).system('')
  for (const spacing of [0, 100, 250]) {
    const layout = spacePlanets(planets, {}, spacing)
    const gap = TUNING.orbitGap * spacing / 100
    const [first] = layout
    assert.ok(Math.abs(first.orbitRadius - first.shellRadius - TUNING.workRadius - TUNING.workClearance - gap) < 1e-9)
    for (let i = 1; i < layout.length; i++) {
      const a = layout[i - 1], b = layout[i]
      assert.ok(Math.abs(b.orbitRadius - a.orbitRadius - a.shellRadius - b.shellRadius - gap) < 1e-9)
    }
    const edited = spacePlanets(planets, {}, spacing, { independent: true, radii: { b: 7 }, joins: { c: 'b' } })
    assert.deepEqual(edited.slice(1, 3).map(body => [body.orbitId, body.orbitRadius]), [['b', 7], ['b', 7]])
  }
})

check('关系星图：手动布局在原百分比保持原位，改变百分比后整组轨道伸缩', () => {
  const sets = Array.from({ length: 10 }, (_, index) => ({ id: String(index), title: String(index) }))
  const { planets } = networkModel(sets, [], []).system('')
  const radii = Object.fromEntries(sets.slice(0, 9).map(({ id }, index) => [id, 2.8 + index * .62]))
  const legacy = { independent: true, radii, joins: { 9: '8' } }
  const settings = withOrbitSpacingReference(legacy, 268)
  assert.equal(settings.spacingReference, 268)
  assert.equal(withOrbitSpacingReference(settings, 450), settings)
  const layout = spacing => spacePlanets(planets, {}, spacing, settings)
  const [compact, original, loose] = [100, 268, 450].map(layout)
  assert.deepEqual(original.slice(0, 9).map(body => body.orbitRadius), Object.values(radii))
  assert.ok(original.every((body, index) => compact[index].orbitRadius < body.orbitRadius && loose[index].orbitRadius > body.orbitRadius))
  for (const result of [compact, original, loose]) {
    assert.equal(result[9].orbitId, '8')
    assert.equal(result[8].orbitRadius, result[9].orbitRadius)
    const firstGap = result[1].orbitRadius - result[0].orbitRadius
    const outerGap = result[8].orbitRadius - result[7].orbitRadius
    assert.ok(Math.abs(firstGap - outerGap) < 1e-9)
  }
  const editedRadius = loose[0].orbitRadius + .6
  const edited = { ...settings, radii: { ...radii, 0: scaleOrbitRadius(editedRadius, 450, settings.spacingReference) } }
  const reopened = spacePlanets(planets, {}, 450, edited)
  assert.ok(Math.abs(reopened[0].orbitRadius - editedRadius) < 1e-9)
  assert.equal(reopened[1].orbitRadius, loose[1].orbitRadius)
})

check('关系星图：紧凑和宽松改变屏幕上的轨道间距', () => {
  const sets = Array.from({ length: 6 }, (_, index) => ({ id: String(index), title: String(index) }))
  const system = networkModel(sets, [], []).system('')
  const positions = {}
  const layout = spacing => ({ ...system, planets: spacePlanets(system.planets, positions, spacing) })
  const baseline = layout(100)
  const scene = { view: rotation(0, 0), zoom: 1, time: 0 }
  const canvas = new Proxy({
    measureText: () => ({ width: 8 }),
    createRadialGradient: () => ({ addColorStop() {} })
  }, { get: (target, key) => target[key] ?? (() => {}) })
  function gap(data) {
    const frame = paintNetwork(canvas, { width: 960, height: 600 }, data, scene,
      { names: new Map(), positions, framingPositions: positions, spacingFramingData: baseline, reduced: true })
    const inner = frame.camera.project(orbitPoint(data.planets[0].orbitRadius, 0)).x
    const outer = frame.camera.project(orbitPoint(data.planets.at(-1).orbitRadius, 0)).x
    return outer - inner
  }
  const normal = gap(baseline)
  assert.ok(gap(layout(0)) < normal * .86)
  assert.ok(gap(layout(300)) > normal * 1.12)
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

check('关系星图：紧凑名称和手动扩容排版', () => {
  const text = entryCircleGlyphs('  星图观测记录\n' + '界'.repeat(70) + '  ')
  assert.equal(text.join('').startsWith('星图观测记录 '), true)
  assert.equal(entryRadiusLimit(900, 40), 16)
  const measure = str => Array.from(str).length * 8
  const auto = layoutEntryCircleText(measure, text, 30, false, 10)
  assert.equal(auto.length, 1)
  assert.ok(auto.join('').endsWith('…'))
  const resized = layoutEntryCircleText(measure, text, 55, true, 10)
  assert.ok(resized.length > 3)
  assert.ok(Array.from(resized.join('')).length > 15)
  assert.equal(layoutEntryCircleText(measure, entryCircleGlyphs('银湾'), 18, false, 10).join(''), '银湾')
})

check('关系星图：自动圆上限、手动圆无上限及拖拽换算', () => {
  const zooms = [3, 1.57, 1, .8, .65]
  for (const overview of [false, true]) {
    const capped = overview ? 9 : 17
    const radii = zooms.map(zoom => entryRadiusLimit(900, 500, zoom, overview))
    const expected = [1.5, 3.14 / 2.57, 1, .8 ** 1.5, .65 ** 1.5]
    assert.ok(radii.every((radius, index) => Math.abs(radius - capped * expected[index]) < 1e-8))
    for (const zoom of zooms) {
      const scale = entryCircleScale(zoom)
      for (const base of [1, 6, capped, 480]) {
        const displayed = entryDisplayRadius(base, scale)
        assert.equal(displayed, base * scale)
        assert.ok(Math.abs(entryReferenceRadius(displayed, scale) - base) < 1e-8)
      }
    }
  }
  const measure = text => Array.from(text).length * 8
  assert.deepEqual(layoutEntryCircleText(measure, entryCircleGlyphs('星图观测站'), 8, false, 9.6, 8), ['星'])
  assert.deepEqual(layoutEntryCircleText(measure, entryCircleGlyphs('星图观测站'), 4, false, 9.6, 8), [])
})

check('关系星图：自动圆和手动圆随倍率缩小，小圆收起文字', () => {
  const sets = [{ id: 'root', title: '设定', color: '#bcc7c5' }]
  const canvas = new Proxy({
    measureText: text => ({ width: Array.from(text).length * 8 }),
    createRadialGradient: () => ({ addColorStop() {} })
  }, { get: (target, key) => target[key] ?? (() => {}) })
  function render(title, detail, zoom, entryRadii) {
    const data = networkModel(sets, [{ id: 'node', setId: 'root', title, summary: title + '。' + '概要'.repeat(20) }], [])
      .system(detail ? 'root' : '')
    const names = new Map()
    const painted = paintNetwork(canvas, { width: 960, height: 600 },
      { ...data, planets: spacePlanets(data.planets, {}, 100, {}) },
      { view: rotation(.24, -.15), zoom, time: 0 },
      { positions: {}, framingPositions: {}, names, entryRadii, reduced: true, workTitle: '作品' })
    const hit = painted.hits.find(item => item.id === 'node')
    assert.ok(hit)
    return { radius: hit.radius, lines: names.get('node').lines }
  }
  for (const detail of [false, true]) {
    for (const entryRadii of [undefined, { node: 60 }]) {
      const zooms = [3, 1.57, 1, .8, .65, 1]
      const sequence = zooms.map(zoom => render('星图观测记录'.repeat(10), detail, zoom, entryRadii))
      assert.ok(sequence.slice(1, 5).every((point, index) => point.radius < sequence[index].radius))
      assert.equal(sequence[5].radius, sequence[2].radius)
      assert.ok(sequence.every((point, index) => Math.abs(point.radius / sequence[2].radius - entryCircleScale(zooms[index])) < 1e-8))
      assert.ok(sequence[4].lines.length <= 1)
      assert.equal(render('星', detail, .65, entryRadii).radius, sequence[4].radius)
      if (!detail && !entryRadii) {
        assert.ok(sequence[1].radius >= 8 * entryCircleScale(1.57) - 1e-9)
        assert.ok(sequence[1].radius * 2 <= 19.6)
        assert.ok(sequence[1].radius < sequence[0].radius * .82)
      }
    }
  }
  assert.deepEqual(render('星', false, .65).lines, [])
  for (const detail of [false, true]) {
    assert.equal(render('星', detail, 1, { node: 480 }).radius, 480)
    assert.equal(render('星', detail, 1, { node: 1 }).radius, 1)
  }
})

check('关系星图：四个条目构成正四面体', () => {
  const graph = networkModel([{ id: 'set' }], Array.from({ length: 4 }, (_, index) => ({
    id: String(index), setId: 'set'
  })), [])
  const { entries, weave } = graph.bySet.get('set')
  const expectedEdge = Math.sqrt(8 / 3)
  assert.equal(weave.length, 6)
  for (const [index, a] of entries.entries()) {
    assert.ok(Math.abs(a.position.length() - 1) < 1e-10)
    for (const b of entries.slice(index + 1)) {
      assert.ok(Math.abs(a.position.distanceTo(b.position) - expectedEdge) < 1e-10)
    }
  }
})

check('关系星图：星体尺寸变化同步更新球面、命中和中心星体', () => {
  const sets = [{ id: 'set', title: '设定' }]
  const nodes = [{ id: 'entry', setId: 'set', title: '条目' }]
  const graph = networkModel(sets, nodes, [])
  const canvas = new Proxy({
    measureText: () => ({ width: 8 }),
    createRadialGradient: () => ({ addColorStop() {} })
  }, { get: (target, key) => target[key] ?? (() => {}) })
  function render(planetSizes, center = '', entryRadii) {
    const system = graph.system(center)
    const data = { ...system, planets: spacePlanets(system.planets, {}, 100, {}) }
    return paintNetwork(canvas, { width: 960, height: 600 }, data,
      { view: rotation(.24, -.15), zoom: 1, time: 0 },
      { planetSizes, entryRadii, positions: {}, framingPositions: {}, names: new Map(), reduced: true })
  }
  const standard = render({})
  const enlarged = render({ set: 175, '': 125 })
  const current = enlarged.projected.get('entry')
  const original = standard.projected.get('entry')
  assert.equal(current.sphereRadius, original.sphereRadius * 1.75)
  assert.ok(current.center.equals(original.center))
  assert.ok(Math.abs(current.world.distanceTo(current.center) / original.world.distanceTo(original.center) - 1.75) < 1e-9)
  assert.ok(enlarged.hits.find(hit => hit.kind === 'planet' && hit.radius).radius >
    standard.hits.find(hit => hit.kind === 'planet' && hit.radius).radius)
  assert.equal(enlarged.work.radius, standard.work.radius * 1.25)
  const leaf = frame => frame.hits.find(hit => hit.id === 'entry' && hit.resizable)
  assert.equal(leaf(render({ entry: 50 }, 'set')).radius, leaf(render({}, 'set')).radius / 2)
  assert.equal(leaf(render({ entry: 50 }, 'set', { entry: 12 })).radius, 6)
})

check('关系星图：重叠时保留投影，按深度绘制和命中', () => {
  const sets = [{ id: 'set', title: '设定' }]
  const nodes = ['near', 'far'].map(id => ({ id, setId: 'set', title: id }))
  const base = networkModel(sets, nodes, []).system('')
  const data = { ...base, planets: spacePlanets(base.planets, {}, 100, {}) }
  const scene = { view: rotation(0, 0), zoom: 1, time: 0 }
  const canvas = new Proxy({
    measureText: () => ({ width: 8 }),
    createRadialGradient: () => ({ addColorStop() {} })
  }, { get: (target, key) => target[key] ?? (() => {}) })
  const render = (positions, nodeId) => paintNetwork(canvas, { width: 720, height: 420 }, data, scene,
    { positions, framingPositions: {}, names: new Map(), reduced: true, nodeId })
  const initial = render({})
  const anchor = initial.bodyPoints.get('set')
  const orientation = initial.projected.get('near').orientation.clone().invert()
  const ray = initial.camera.unproject(anchor.x, anchor.y, anchor.z + 1).sub(anchor.world).normalize()
  const local = ray.applyQuaternion(orientation).multiplyScalar(TUNING.detailRadius)
  const positions = { set: { near: local.toArray(), far: local.clone().negate().toArray() } }
  const frame = render(positions, 'far')
  const hits = frame.hits.filter(hit => hit.kind === 'node')
  assert.deepEqual(hits.map(hit => hit.id), ['far', 'near'])
  assert.ok(Math.hypot(hits[0].x - hits[1].x, hits[0].y - hits[1].y) < 1e-8)
  for (const hit of hits) {
    const expected = frame.camera.project(frame.projected.get(hit.id).world)
    assert.equal(hit.x, expected.x)
    assert.equal(hit.y, expected.y)
  }
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
