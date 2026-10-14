# 正文阅读模式实施计划（+ 上一任务收尾）

## 目标
在正文页新增「阅读模式」：按设计稿 B·正文形态呈现——无 rail/章节树/批注栏/工具条/章头的纯净版式，巨排章号（03）+ 章题下划短线 + 限宽正文列 + 底右字数，左侧 28px 目录细边条可滑出章节抽屉。按用户确认：**与「沉浸」并列的独立按钮；模式内只读预览；边条+抽屉切章**。

## 已确认的代码事实（调研结论）
- `ui.focusMode` 是纯 session 态（不持久、不广播），由 Workbench 顶栏按钮切换，用六处 `v-if` 隐藏 nav-rail/side-panel/side-resizer/rp-rail/RightPanel/ai-dock；`work.open()` 复位。
- 章题是 TipTap content **之外**的独立 `<input class="title-input">`（EditorPane.vue:194-201）——巨排章号+章题头部可完全加在文档外，不污染保存内容。
- 章序号无现成 getter；可靠全书序 = `work.treeData`（卷 children + 未分卷）平坦化索引+1。
- 正文排版在 `themes.css:850-858`：`.tiptap` 无 max-width、无居中，`padding: 26px clamp(40px,10%,150px) 38vh`，`font-size: var(--editor-fs)`（用户 13–24px 偏好）、`line-height: 2`。阅读列 = 加 `max-width:680px; margin:0 auto` 覆写。
- 字数直接绑 `work.activeChapter.wordCount`（EditorPane.vue:210-212 同源）；工具条唯一挂载点 `EditorPane.vue:220`（`v-if="!chapterPopped"`）。
- 抽屉无现成组件，naive-ui（`NDrawer`）已全局可用；ChapterTree 直接可嵌入。

## 落地设计

### 1. 状态与数据
- `stores/ui.js`：新增 `readMode: false`（session 级，与 focusMode 同级；不持久、不广播）。
- `stores/work.js`：新增 getter `chapterOrdinal(id)`（平坦化 `treeData` 找索引+1，找不到返回 null）；`work.open()` 复位处同步重置 `ui.readMode = false`。

### 2. Workbench.vue（壳）
- 顶栏右侧「沉浸」按钮旁新增「阅读」按钮（`v-if="work.tab === 'chapters'"`，激活态 `type=primary`，title「阅读模式：巨排章号 + 宽栏只读排版」）。
- **阅读态顶栏变体**（`ui.readMode && tab==='chapters'`）：`[← 退出阅读] [章节标题] [保存徽标] ── [搜索] [设置]`；隐藏书架/brand/拆窗/书签/沉浸/阅读按钮（与设计稿一致；← 语义为**退出阅读**而非返回书架，tooltip 注明）。
- 六处隐藏条件由 `!ui.focusMode` 扩为 `!(ui.focusMode || ui.readMode)`（阅读态同样收起两侧区域）。

### 3. EditorPane.vue（主体）
- **只读**：`reading = computed(() => ui.readMode)`；`setEditable(!chapterPopped && !reading)` 并入现有 watch；`onContextMenu` 入口在 reading 时直接返回；`EditorToolbar` / `EditorContextMenu` 加 `&& !ui.readMode`。
- **阅读头 + 限宽列**：`rich-host` 内新增条件包裹层 `div.ed-read-col`（仅阅读态）：`[.ed-read-head（.ed-read-no 巨排章号 + .ed-read-title + .ed-read-rule）] [EditorContent.rich-inner]`；`div` 承接 `max-width:680px; margin:0 auto`，阅读态 `.tiptap` 左右 padding 归零。头部随正文滚动（书页感），**不重建编辑器**（不加 :key，光标/选区/滚动锚点天然保留）。
- **底右字数**：`.editor-wrap` 设 `position:relative`，阅读态新增绝对定位 `.ed-read-count`（`{{ wordCount }} 字`，`pointer-events:none`）。
- **目录边条 + 抽屉**：阅读态 `.ed-read-edge`（28px 通栏细条 + 垂直居中箭头，hover 高亮）；点击开 `NDrawer`（placement=left、宽 300、遮罩可点关），内嵌 `ChapterTree`（补必要的容器高度样式）；`watch(selChapterId)` 在抽屉开着时切章即自动收起。
- **Esc 两级**：抽屉开 → 关抽屉；否则退出阅读。挂 window keydown（mount/unmount 清理；`.n-modal` 存在或事件已 defaultPrevented 时忽略）。
- **退出恢复**：`setEditable(true)` + `editor.commands.focus()`（选区由 PM state 保留）。
- **末尾装饰点**：阅读态 `.tiptap::after` 渲染 "···"（`--text-faint`，不可选中）——纯 CSS 装饰，如有 PM 兼容问题则弃用（不影响验收）。

### 4. themes.css（新块，追加在编辑器段后）
`.ed-read-head/.ed-read-no`（字号 ~88px、`var(--g-disp)` 数形、`var(--text-faint)`）`/.ed-read-title`（26px/700、`var(--editor-font)`）`/.ed-read-rule`（80×2 `var(--accent)`）`/.ed-read-col`、`.read-mode` 下 `.tiptap` padding/max-width 覆写、`.ed-read-edge`、`.ed-read-count`、`.ed-read-drawer`、末尾点；均走主题令牌（三主题自动适配）。

## 边界与决策（明确不做/不受影响）
- **不影响**：拆窗章节面板（无按钮入口、`readMode` 默认 false）、AI 停靠列逻辑、行内字号标记（用户正文内联 12–40px 保持覆盖）、双链悬停预览（只读下仍可用）。
- **只读含义**：可选中/复制/点链接；不可输入、不可改章题/状态、无格式化右键菜单；批注创建收起（退出后可加）。
- 阅读态与沉浸可叠加（都收起两侧，退出阅读回落沉浸原状）。
- 设计稿 18px 字号**不写死**：沿用用户 `fontSize` 偏好（13–24px）。

## 步骤
0. **上一任务收尾**：`node tools/settings-verify.mjs`（上轮被中断）→ 通过后做 v1.0.25 四处同步（package.json/CHANGELOG/README）。
1. 代码改动：ui.js → work.js → Workbench.vue → EditorPane.vue → themes.css（按依赖顺序）。
2. `npm run build` 通过。
3. 新增 `tools/readmode-verify.mjs`（CDP，dev 应用真机）并运行，断言：
   ① 点「阅读」后 rail/侧栏/批注栏/AI 列/章头/工具条全部隐藏，`.ed-read-head` 出现且 `.ed-read-no` 文本 = treeData 序补零章号；
   ② `window.__ns.editor.isEditable === false`，右键不弹格式化菜单；
   ③ 底右字数 = `activeChapter.wordCount`；限宽列 `.ed-read-col` 生效（宽度 ≤680）；
   ④ 边条点击 → 抽屉出现且含章节节点；点另一章 → 切章且抽屉自动关；重开抽屉 Esc 关抽屉不退出；再 Esc 退出阅读、chrome 与可编辑恢复；
   ⑤ **不重建**：进入/退出前后 `window.__ns.editor` 引用同一对象、滚动锚点保持；
   ⑥ 收尾复位（退出阅读）。
4. 更新 `docs/使用手册.md`（「沉浸」条目旁补「阅读模式」说明：入口/只读/边条抽屉/Esc）。
5. v1.0.26 四处同步（CHANGELOG 含验收计数、README 版本与最近验收行）。

## 验收口径
readmode-verify 全项通过（含硬断言：只读、章号正确、抽屉两段 Esc、编辑器不重建）+ settings-verify 6/6 + `npm run build` 通过 + 阅读态截图与设计稿目检吻合（巨排章号/下划短线/宽栏/底右字数/无 chrome）。

## 不在本轮
拆窗窗口内的阅读模式、专注打字（逐段聚焦）、阅读态批注/划词工具、阅读进度记忆。