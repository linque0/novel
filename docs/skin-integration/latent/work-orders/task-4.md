# Task 4：桌面动作外壳、拆窗、恍然梦与书架正文

> 本页从方案自动切出，仅供本任务实施代理阅读。
> 原方案：F:/deepseek workplace/dsh-novel-studio/docs/superpowers/plans/2026-11-07-latent-desktop-skin.md

## 全局约束（摘自方案，必须遵守）
- 来源根：`F:/deepseek workplace/dsh-novel-studio/app/`；实施目标根：`F:/deepseek workplace/novel-studio/`。下文 Files 均相对目标根，明确标“来源”的除外。
- 皮肤 ID `dsh`，显示名「隐现」；桌面构建 `__NS_PLUGIN__=false`；桌面库名 `novel-studio`；不得注入 `window.__NS_AGENT__='dsh'`。
- 保留 original / gravity / glaze / crimson；默认皮肤及用户原选择不变；未知皮肤和不支持的 surface 回落 original。
- 单一作品库、单一正文编辑会话；不得 iframe 嵌入插件 SPA，不得按皮肤 key 重建 App/StudioWorkspace/EditorPane。
- 不覆盖目录、不清理已有未提交改动、不安装无关依赖、不以真实用户 profile 运行写入性验收。
- 默认不升 Dexie schema；不得自动重写旧作品或补造历史日志；不得让皮肤切换决定正文保存算法。
- 本次计划文件位于插件仓库便于当前会话审阅；实际代码、测试与发布改动进入桌面仓库，插件仓库只读作来源。
- 用户已明确要求桌面拆窗、恍然梦入口及更多设置项的前端适配；不得只保留 API、把新增入口都塞进更多菜单，或原样沿用插件三类设置。
- 拆窗模块身份必须与 URL、原生锁一致；禁止复制插件只改本地 spec.type 的跨模块导航。保存失败的窗口保持打开。
- AI/创作台/预设窗须适配实际输入、列表、工具与浮层；“只接令牌”和“入口存在”不能代替专项视觉/操作验收。

---

## Task 4：桌面动作外壳、拆窗、恍然梦与书架正文

**Files:** Create `src/components/skins/latent/LatentShelf.vue`、`LatentTopbar.vue`、`LatentWorkbench.vue`、`LatentDesktopActions.vue`、`LatentPanelTopbar.vue`、`src/services/latent/desktop-actions.js`；Modify `src/components/Bookshelf.vue`、`Workbench.vue`、`EditorPane.vue`、`EditorToolbar.vue`、`EditorContextMenu.vue`、`RightPanel.vue`、`ChapterTree.vue`、`src/components/StudioWorkspace.vue`（仅必要的激活/焦点边界）、`src/components/PanelHost.vue`、`src/components/ai/AiAssistantPanel.vue`、`src/components/agent/AgentWorkbench.vue`、`src/components/ai/PresetWindow.vue`（后三者仅外观/布局与入口适配）、`electron/panels.js`、`electron/preload.cjs`；Create `tools/latent-writing-verify.mjs`、`tools/latent-window-verify.mjs`、`tools/latent-ai-ui-verify.mjs`。

**Interfaces:** LatentShelf 沿用来源 works/total/loading/busy/query/openStats/firstChapter/menuOptions props 和 open/menu/create/settings/navigate/select-work 事件；LatentWorkbench 提供 topbar/directory/default/notes/ai slots，接收 module/focusMode/readMode 和 drawer 相关状态，不负责保存业务。

`desktop-actions.js` 导出 `buildDesktopActions({surface,module,hasWork,windowType,lockState,busy}):DesktopAction[]`，`DesktopAction={key,label,disabled,reason?,active?}`；只定义动作描述，不调用生成业务。AI handler 复用 `enterDreamMode/enterLightSleepMode`；窗口动作复用 `popOut/focusPopped/isPopped/panelSetEntity`。新增原生 `panelFocusMain():Promise<{ok:boolean}>` 仅用于前往主窗，不改变当前窗锁或关闭状态。AI 停靠沿用 300–640px 偏好，净中心宽度不足 520px 时转覆盖抽屉，临时形态不写目录/批注偏好。

- [ ] 定义并写入书架空态、单书、环绕、多书筛选后焦点、CRUD 和接续章测试；正文记录编辑器对象身份、Teleport 宿主 DOM 对象身份、撤销历史、选区、滚动与 pending 内容，互切后逐项验证，不能只检查同名 ID 存在。
- [ ] 写输入法 composition 与正在打开弹层时的切肤测试；切肤不在 composition 结束前销毁输入宿主，局部提交失败保持旧界面。
- [ ] 先写桌面动作与状态用例：书架只有入梦、工作台双模式、各模块可拆、已拆出转“前往窗口”、重复点击聚焦、保存/移交中禁用、失败保持原界面；窗口身份/实体锁不能因本地模块导航改变。对应 D-01～D-03。
- [ ] 搬入书架和布局壳，接父层已有动作；用皮肤条件选择布局，不整体复制插件 Bookshelf/Workbench 覆盖桌面逻辑。
- [ ] 正文共享 EditorPane/Tiptap，只按皮肤修改展示与 toolbar slot；保持 writing-editor-host 等 Teleport 宿主 DOM 身份稳定，不在换壳时删除再创建同名目标。保留纸面选择、章节状态/目标/书签/历史、AI 选区动作、阅读/专注和双向链接。
- [ ] 新顶栏以 LatentDesktopActions 提供直接可发现的入梦/浅眠/当前模块独立窗。1080px 放不下时切紧凑模块工具行；更多按本模块/窗口/写作工具/应用分组，不能靠滚动藏关键桌面入口。大纲专用顶栏在 Task 5 复用同一动作模型。
- [ ] 内容独立窗用 LatentPanelTopbar：作品/实体标题、保存/错误、保存并关闭、聚焦主窗、模块助手。保留类型固定与 panelSetEntity 锁迁移；跨模块操作走原生打开/聚焦目标窗，不只改 spec.type。保存失败不执行 finally-close，普通/系统关闭仍走现有保存拦截。前往主窗和保存关闭使用不同文案。
- [ ] 恍然梦书架入口接 DreamLaunchDialog，工作台入梦/浅眠分别接既有 entry-modes；已拆出 AI 时浅眠聚焦原窗。模块助手与选区发送保留实际上下文及桌面文案，不能沿用 DSH 聊天桥。
- [ ] 为 AI 停靠/覆盖抽屉建立可用宽度预算与焦点管理；关闭抽屉/切肤不卸载会话、不取消流式生成。AiAssistantPanel、AgentWorkbench、PresetWindow 保留业务，在隐现下适配模型/预设/功能调整、候选、错误、输入区、列表和所有弹层，不仅改 palette。
- [ ] 保留完整模块、设置、搜索入口及所有 Teleport 目标。以 isLatentSkin 控制外观，以 nsPlugin 控制宿主行为。跨主窗/内容窗/AI窗适配可见状态，不用 display:none 误藏桌面能力。
- [ ] 验证单编辑器、无丢字及旧书架/正文回归后提交。

**Verification:** 新 `node tools/latent-writing-verify.mjs`、`node tools/latent-window-verify.mjs`、`node tools/latent-ai-ui-verify.mjs`；按隔离前提执行旧写作/AI entry/多窗口/预设脚本。覆盖 D-01～D-05、D-08～D-09。截图主窗 1080/1280/1440、内容窗 800、AI 窗 380、创作台与预设窗实际最小宽；逐项检查文字、控件、状态和弹层，布局补充 380/560/760/900/1180 边界。
