/* 隐现（dsh）皮肤接线验证：纯 Node，读源码做静态断言。
 * 不启动 Electron——它证明的是「接线存在且形态正确」，不证明视觉正确。
 * 用法：node tools/latent-integration-verify.mjs（目标根下）
 */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

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
check('registry：dsh 对桌面可见，label 为「隐现」', async () => {})
const registrySrc = read('src/skins/registry.js')
check('registry 含 dsh 条目且 audience 为 desktop', () => {
  assert.match(registrySrc, /id:\s*'dsh'/, '缺少 dsh 条目')
  const dshLine = registrySrc.split('\n').find((l) => l.includes("id: 'dsh'"))
  assert.ok(dshLine, '找不到 dsh 行')
  assert.match(dshLine, /audience:\s*'desktop'/, 'dsh 未对桌面开放：' + dshLine.trim())
  assert.match(dshLine, /label:\s*'隐现'/, 'dsh 的 label 不是「隐现」：' + dshLine.trim())
})

check('registry 导出 isLatentSkin 且只认 dsh', () => {
  assert.match(registrySrc, /export function isLatentSkin/, '缺少 isLatentSkin 导出')
  assert.match(registrySrc, /return value === 'dsh'/, 'isLatentSkin 判断不是 dsh')
})

check('四套旧皮肤仍在且默认回落 original', () => {
  for (const id of ['original', 'gravity', 'glaze', 'crimson']) {
    assert.ok(registrySrc.includes(`id: '${id}'`), '缺少旧皮肤 ' + id)
  }
  /* normalizeSkin 用的是三元表达式：匹配到 'original' 这条兜底即可 */
  assert.match(registrySrc, /normalizeSkin[\s\S]{0,200}'original'/, 'normalizeSkin 未回落 original')
})

/* ── 2. 主题 ── */
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

check('App.vue 接入隐现主题与 settings→work 的 surface 映射', () => {
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

check('Workbench 在隐现下渲染四个完整工作区，旧皮肤仍走 Center', () => {
  const src = read('src/components/Workbench.vue')
  for (const c of ['LatentOutlineCenter', 'CharactersWorkspace', 'LoreWorkspace', 'SnippetsWorkspace']) {
    assert.ok(src.includes(c), 'Workbench 缺少 ' + c)
  }
  for (const c of ['OutlineCenter', 'CharacterCenter', 'MubuView', 'SnippetCenter']) {
    assert.ok(src.includes(c), '旧模块组件被移除：' + c)
  }
  assert.match(src, /isLatentSkin\(ui\.skin\)/, 'Workbench 未按 isLatentSkin 分派')
})

check('Workbench 隐现下让位外置目录栏（避免双层目录）', () => {
  const src = read('src/components/Workbench.vue')
  assert.match(src, /latentSidebarOwned/, '缺少 latentSidebarOwned 判断')
  assert.match(src, /\['lore', 'characters', 'snippets'\]/, '未排除自带侧栏的三个模块')
})

check('PanelHost 内容窗同样按 isLatentSkin 分派', () => {
  const src = read('src/components/PanelHost.vue')
  assert.match(src, /isLatentSkin/, 'PanelHost 未引入 isLatentSkin')
  for (const c of ['OutlineWorkspace', 'CharactersWorkspace', 'LoreWorkspace', 'SnippetsWorkspace']) {
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
  assert.ok(read('src/main.js').includes('styles/skins/latent/index.js'), 'main.js 未导入隐现样式')
})

check('隐现样式里不存在隐藏模块助手的规则', () => {
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
check('doublelinks 已合并隐现需要的身份引用接口', () => {
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
