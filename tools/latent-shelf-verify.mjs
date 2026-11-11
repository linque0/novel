/* 隐现书架界面完整度验证：静态断言「渲染链路」每一环都在，且与插件版一致。
 * 不启动 Electron —— 它证明接线与资源都在，不证明像素级观感。
 * 用法：node tools/latent-shelf-verify.mjs（目标根下）
 */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const ROOT = process.cwd()
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const exists = (rel) => fs.existsSync(path.join(ROOT, rel))
const files = (rel) => (exists(rel) ? fs.readdirSync(path.join(ROOT, rel)) : [])

const results = []
function check(name, fn) {
  try {
    fn()
    results.push({ name, ok: true })
  } catch (e) {
    results.push({ name, ok: false, reason: e.message })
  }
}

/* ── 1. 注册与主题 ── */
check('dsh 皮肤对桌面可见且 isLatentSkin 成立', () => {
  const src = read('src/skins/registry.js')
  const line = src.split('\n').find((l) => l.includes("id: 'dsh'"))
  assert.ok(line, '缺 dsh 条目')
  assert.match(line, /audience:\s*'desktop'/, 'dsh 未对桌面开放')
  assert.match(line, /label:\s*'隐现'/, 'dsh 标签不是隐现')
  assert.match(src, /export function isLatentSkin/, '缺 isLatentSkin')
})

/* ── 2. 背景引擎 ── */
check('背景引擎五件套齐备', () => {
  for (const f of ['blue-noise.js', 'cpu-backdrop.js', 'flow.js', 'latent-gl.js', 'palette.js']) {
    assert.ok(exists('src/services/latent/' + f), '缺 src/services/latent/' + f)
  }
  assert.match(read('src/services/latent/latent-gl.js'), /export function createCoverPainter/, '缺 createCoverPainter')
  assert.match(read('src/services/latent/flow.js'), /export function mountFlowBackdrop/, '缺 mountFlowBackdrop')
  assert.match(read('src/services/latent/palette.js'), /export function cssGradientOf/, '缺 cssGradientOf')
})

/* ── 3. 书架组件 ── */
check('LatentShelf 已接入 Bookshelf 且保留四套旧书架', () => {
  const src = read('src/components/Bookshelf.vue')
  assert.match(src, /LatentShelf/, '未引入 LatentShelf')
  assert.match(src, /isLatentSkin\(ui\.skin\)/, '未按 isLatentSkin 分派')
  for (const c of ['OriginalShelf', 'GravityShelf', 'GlazeShelf', 'CrimsonShelf']) {
    assert.ok(src.includes(c), '旧书架被移除：' + c)
  }
})

check('LatentShelf 的 props/emits 与插件版一致', () => {
  const src = read('src/components/skins/latent/LatentShelf.vue')
  for (const p of ['works', 'total', 'loading', 'busy', 'query', 'openStats', 'firstChapter', 'menuOptions']) {
    assert.ok(src.includes(p + ':'), '缺 prop ' + p)
  }
  for (const e of ['select-work', 'open', 'menu', 'create', 'settings', 'navigate']) {
    assert.ok(src.includes("'" + e + "'"), '缺 emit ' + e)
  }
})

check('LatentShelf 的书架样式已就位', () => {
  assert.ok(exists('src/styles/skins/latent/latent-shelf.css'), '缺 latent-shelf.css')
  const src = read('src/components/skins/latent/LatentShelf.vue')
  assert.match(src, /latent\/latent-shelf\.css/, '未引用书架样式')
})

/* ── 4. 顶栏 ── */
check('顶栏在隐现下提供完整圆钮簇', () => {
  const src = read('src/components/AppTopbar.vue')
  assert.match(src, /app-topbar-cluster/, '缺右簇容器')
  for (const cls of ['app-topbar-save', 'app-topbar-search-toggle', 'app-topbar-settings', 'app-topbar-pin']) {
    assert.ok(src.includes(cls), '缺圆钮 ' + cls)
  }
  assert.match(src, /WritingStatsEntry/, '缺统计圆钮')
})

check('隐现导航排除设置项（设置改由齿轮承担）', () => {
  const src = read('src/components/AppTopbar.vue')
  assert.match(src, /item\.key !== 'settings'/, '导航未排除设置项')
  assert.match(src, /const navItems/, '缺 navItems 计算属性')
})

check('顶栏圆钮样式在隐现 skin 下生效（不再依赖 data-ns-host）', () => {
  const css = read('src/styles/skins/latent/dsh.css')
  assert.ok(!/\[data-ns-host\]\s*\.app-topbar-shell/.test(css), '仍有依赖 data-ns-host 的顶栏规则')
  assert.match(css, /\.app-topbar-round/, '缺圆钮样式')
  assert.match(css, /--nsx-topbar-h/, '缺顶栏高度令牌')
})

/* ── 5. 样式层导入 ── */
check('隐现样式按插件版顺序导入', () => {
  const idx = read('src/styles/skins/latent/index.js')
  const order = ["'./dsh.css'", "'./language.css'", "'./flow-shell.css'"]
  let last = -1
  for (const item of order) {
    const at = idx.indexOf(item)
    assert.ok(at > last, '样式顺序错误：' + item)
    last = at
  }
  assert.ok(read('src/main.js').includes('styles/skins/latent/index.js'), 'main.js 未导入隐现样式')
})

/* ── 6. 主窗结构（模块可见性根因） ── */
check('四个工作区是 .wb-body 的直接子元素（不是 center-pane 内部）', () => {
  const src = read('src/components/Workbench.vue')

  /* 定位隐现分支的四个工作区 */
  const names = ['LatentOutlineCenter', 'CharactersWorkspace', 'LoreWorkspace', 'SnippetsWorkspace']
  const positions = names.map((n) => ({ n, i: src.indexOf('<' + n) })).filter((x) => x.i > 0)
  assert.ok(positions.length === 4, '隐现四个工作区未全部渲染，找到 ' + positions.length + ' 个')

  /* 关键判断：找到「正文 center-pane」（带 v-show="!modulePopped" 的那个，
     不是拆窗占位的 pop-lock-pane），确认隐现工作区不在它的内部。 */
  const cpOpen = src.indexOf('class="center-pane paper-texture" :inert=')
  assert.ok(cpOpen > 0, '找不到正文 center-pane')

  /* 从这个开标签起配平 <div>/<\/div>，找到它自己的闭合 */
  let depth = 0
  let cpClose = -1
  const tagRe = /<div\b|<\/div>/g
  tagRe.lastIndex = cpOpen
  let m
  while ((m = tagRe.exec(src)) !== null) {
    depth += m[0] === '</div>' ? -1 : 1
    if (depth === 0) {
      cpClose = m.index
      break
    }
  }
  assert.ok(cpClose > cpOpen, '无法确定 center-pane 的闭合位置')

  const firstWorkspace = Math.min(...positions.map((p) => p.i))
  const inside = firstWorkspace > cpOpen && firstWorkspace < cpClose
  assert.ok(
    !inside,
    '隐现工作区仍包在 .center-pane 内部（工作区 @' + firstWorkspace + '，center-pane ' + cpOpen + '…' + cpClose + '）' +
      '——flex:1 的宿主在非 flex 容器里会塌成 0 高，必须移到 .wb-body 直接子级'
  )
})

/* ── 7. 统计入口 ── */
check('statsWorkId 状态已定义（WritingStatsEntry 依赖）', () => {
  assert.match(read('src/stores/ui.js'), /statsWorkId/, 'ui store 缺 statsWorkId')
})

/* ── 输出 ── */
let failed = 0
for (const r of results) {
  if (r.ok) console.log('PASS ' + r.name)
  else {
    failed++
    console.log('FAIL ' + r.name)
    console.log('     ' + r.reason)
  }
}
console.log('')
console.log(failed ? failed + ' 项未通过（共 ' + results.length + ' 项）' : '全部 ' + results.length + ' 项通过')
process.exit(failed ? 1 : 0)
