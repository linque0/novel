/* 隐现正文界面（伏案静水）验证：静态断言样式挂载方式与 DOM 契约。
 * 用法：node tools/latent-studio-verify.mjs（目标根下）
 */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const ROOT = process.cwd()
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const exists = (rel) => fs.existsSync(path.join(ROOT, rel))

const results = []
function check(name, fn) {
  try {
    fn()
    results.push({ name, ok: true })
  } catch (e) {
    results.push({ name, ok: false, reason: e.message })
  }
}

/* ── 1. 样式挂载方式（插件版挂在组件上，不是全局） ── */
check('latent-studio.css 由 Workbench 组件挂载（保证排在其他样式之后）', () => {
  const wb = read('src/components/Workbench.vue')
  assert.match(wb, /<style src="\.\.\/styles\/skins\/latent\/latent-studio\.css"><\/style>/,
    'Workbench 未以 <style src> 挂载 latent-studio.css')
})

check('latent-studio.css 不再由全局 index.js 导入（避免被后续样式覆盖）', () => {
  const idx = read('src/styles/skins/latent/index.js')
  assert.ok(!/^import '\.\/latent-studio\.css'/m.test(idx),
    'index.js 仍在导入 latent-studio.css，会与组件级挂载重复且顺序更早')
})

/* ── 2. 流动背板 ── */
check('Workbench 渲染流动背板的四层结构', () => {
  const wb = read('src/components/Workbench.vue')
  assert.match(wb, /class="st-backdrop-wrap"/, '缺背板容器')
  assert.match(wb, /class="st-backdrop" ref="flowCanvas"/, '缺 flowCanvas 画布')
  for (const layer of ['dots', 'vignette', 'grain']) {
    assert.ok(wb.includes('st-layer ' + layer), '缺背板图层 ' + layer)
  }
})

check('背板在隐现皮肤下才挂载，并随皮肤/模块/模式重建', () => {
  const wb = read('src/components/Workbench.vue')
  assert.match(wb, /v-if="latentSkin" class="st-backdrop-wrap"/, '背板未按 latentSkin 条件渲染')
  assert.match(wb, /if \(!isLatentSkin\(ui\.skin\)\) return/, 'mountFlow 未守卫皮肤')
  assert.match(wb, /ui\.workbenchMode !== 'writing'/, 'mountFlow 未守卫写作模式')
  assert.match(wb, /watch\(\(\) => ui\.skin/, '切皮肤时未重建背板')
  assert.match(wb, /watch\(\(\) => work\.tab/, '切模块时未重建背板')
  assert.match(wb, /watch\(\(\) => ui\.workbenchMode/, '切工作台模式时未重建背板')
})

check('root 元素带 latent-studio 类与 data-flow', () => {
  const wb = read('src/components/Workbench.vue')
  assert.match(wb, /'latent-studio': latentSkin && work\.tab === 'chapters'/, '缺 latent-studio 类条件')
  assert.match(wb, /:data-flow="latentSkin \? 'on' : undefined"/, '缺 data-flow 属性')
})

/* ── 3. 正文 DOM 契约 ── */
check('正文样式依赖的 DOM 类名在组件中存在', () => {
  const css = read('src/styles/skins/latent/latent-studio.css')
  /* 从映射注释里取目标类名，逐个确认它们实际出现在源码里 */
  const targets = [
    ['EditorPane.vue', ['editor-head', 'title-input', 'rich-host', 'rich-inner', 'tiptap']],
    ['EditorToolbar.vue', ['editor-toolbar']],
    ['ChapterTree.vue', ['side-head', 'side-list']],
    ['RightPanel.vue', ['right-panel', 'rp-head', 'rp-title']]
  ]
  for (const [file, classes] of targets) {
    const src = read('src/components/' + file)
    for (const c of classes) {
      assert.ok(src.includes(c), file + ' 缺类名 ' + c)
      assert.ok(css.includes('.' + c), 'latent-studio.css 未针对 .' + c + ' 写规则')
    }
  }
  /* .side-panel 由 Workbench 提供（章节栏容器），不在 ChapterTree 内 */
  assert.ok(read('src/components/Workbench.vue').includes('class="side-panel"'), '缺 .side-panel 容器')
  assert.ok(css.includes('.side-panel'), 'latent-studio.css 未针对 .side-panel 写规则')
})

/* ── 4. 皮肤判断不误伤 ── */
check('isStudioSkin 未把 dsh 算进去（旧皮肤路径不受影响）', () => {
  const reg = read('src/skins/registry.js')
  const fn = /export function isStudioSkin[\s\S]{0,200}/.exec(reg)?.[0] ?? ''
  assert.ok(!fn.includes("'dsh'"), 'isStudioSkin 不应包含 dsh')
  assert.match(fn, /gravity/, 'isStudioSkin 丢了 gravity')
  assert.match(fn, /glaze/, 'isStudioSkin 丢了 glaze')
  assert.match(fn, /crimson/, 'isStudioSkin 丢了 crimson')
})

check('正文容器的显隐在隐现下只保留正文页', () => {
  const wb = read('src/components/Workbench.vue')
  assert.match(wb, /!latentSkin \|\| work\.tab === 'chapters'/, '正文容器缺少隐现下的显隐条件')
})

/* ── 5. 资源与依赖 ── */
check('背板依赖的服务与样式齐备', () => {
  assert.ok(exists('src/services/latent/flow.js'), '缺 flow.js')
  assert.ok(exists('src/services/latent/latent-gl.js'), '缺 latent-gl.js')
  assert.ok(exists('src/services/latent/palette.js'), '缺 palette.js')
  assert.ok(exists('src/styles/skins/latent/latent-studio.css'), '缺 latent-studio.css')
  const flow = read('src/services/latent/flow.js')
  assert.match(flow, /export function mountFlowBackdrop/, 'flow.js 缺 mountFlowBackdrop')
})

/* ── 6. 工具栏：隐现折叠布局 ── */
check('工具栏在隐现下把格式控件收进「更多格式」弹层', () => {
  const src = read('src/components/EditorToolbar.vue')
  assert.match(src, /const latent = computed\(\(\) => isLatentSkin\(ui\.skin\)\)/, '缺 latent 判断')
  /* 主行的字号/颜色/底色/链接被 !latent 包住 */
  assert.match(src, /<template v-if="!latent">/, '主行格式控件未被 !latent 包裹')
  /* 隐现专属「更多格式」弹层存在，且含字号 */
  assert.match(src, /v-if="latent"[^>]*trigger="click"/, '缺隐现专用更多格式弹层')
  assert.match(src, /data-act="more-formats"/, '更多格式按钮缺 data-act')
})

check('工具栏按钮带 data-act（隐现 CSS 依赖这些属性）', () => {
  const src = read('src/components/EditorToolbar.vue')
  for (const act of ['undo', 'redo', 'bold', 'italic', 'underline', 'strike', 'paragraph', 'h1', 'h2', 'h3']) {
    assert.ok(src.includes(`data-act="${act}"`), '缺 data-act=' + act)
  }
  const css = read('src/styles/skins/latent/latent-studio.css')
  assert.match(css, /\[data-act='paragraph'\]/, 'CSS 未针对 data-act 写规则')
})

check('正文/H1-H3 在隐现下全宽度可见', () => {
  const src = read('src/components/EditorToolbar.vue')
  assert.match(src, /v-if="!isCompact \|\| latent"/, '正文/H1-H3 仍受 isCompact 折叠')
})

/* ── 7. 顶栏：隐现不再叠两套控件 ── */
check('隐现顶栏只保留恍然梦入口，不重复保存态/搜索/更多', () => {
  const src = read('src/components/Workbench.vue')
  const block = /<template v-if="latentSkin">[\s\S]*?<\/template>/.exec(src)
  assert.ok(block, 'Workbench 的 actions 缺 latentSkin 分支')
  const latentActions = block[0]
  assert.ok(latentActions.includes('DreamModeEntries'), '隐现下丢了恍然梦入口')
  assert.ok(!latentActions.includes('save-badge'), '隐现下仍渲染了 save-badge（与圆钮簇重复）')
  assert.ok(!latentActions.includes('ui.searchOpen = true'), '隐现下仍渲染了搜索按钮（与圆钮簇重复）')
})

/* ── 8. 章头版式 ── */
check('章头在隐现下按设计版式（标题 + 拉丁副标题 + 朱线 + 字数目标行，无章序号轨）', () => {
  const src = read('src/components/EditorPane.vue')
  assert.match(src, /class="ed-head-latent"/, '缺章头版式容器')
  assert.match(src, /class="title-input"/, '缺章标题')
  assert.match(src, /class="ed-latin"/, '缺拉丁章号副标题')
  assert.match(src, /class="ed-rule"/, '缺朱线')
  assert.match(src, /class="ed-goal"/, '缺字数目标行')
  assert.match(src, /LATIN_ORDINALS/, '缺拉丁序数表')
  assert.match(src, /const headLatin = computed/, '缺 headLatin 计算属性')
  /* 设计里没有章序号轨：DOM 与样式都不许再出现 .ed-ordinal */
  assert.ok(!src.includes('ed-ordinal'), '章头仍渲染了设计里没有的章序号轨')
  const css = read('src/styles/skins/latent/latent-studio.css')
  for (const cls of ['ed-head-latent', 'ed-head-main', 'ed-latin', 'ed-rule', 'ed-goal']) {
    assert.ok(css.includes('.' + cls), '样式缺 .' + cls)
  }
  assert.ok(!css.includes('.ed-ordinal'), '样式里仍残留 .ed-ordinal 规则')
})

const failed = results.filter((r) => !r.ok)
for (const r of results) {
  console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name)
  if (!r.ok) console.log('     ' + r.reason)
}
console.log('')
console.log(failed.length ? failed.length + ' 项未通过（共 ' + results.length + ' 项）' : '全部 ' + results.length + ' 项通过')
process.exit(failed.length ? 1 : 0)
