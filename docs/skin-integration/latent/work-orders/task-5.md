# Task 5：大纲与完整设定工作区

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

## Task 5：大纲与完整设定工作区

**Files:** Create `src/components/skins/latent/outline/`（来源 OutlineWorkspace、OutlineTopbar、OutlineNodeDetail、Glyph/layout 等及新 LatentOutlineCenter）、`src/components/skins/latent/lore/`（来源 lore 目录及局部版 MubuView/MubuTree/LoreDetail/LoreGraph/LoreEntryList）；Create `src/services/latent/lore-core.js`、`lore-editor-dom.js`；Modify `src/components/OutlineCanvas.vue`、`src/components/outline/canvas-model.js`、`src/stores/work.js`、`src/stores/ui.js`、`src/services/doublelinks.js`、`src/services/graphview.js` 及 Workbench/PanelHost 模块选择；Create `tools/latent-lore-compat.test.mjs`，迁入 layout/core 测试到 tools。

**Interfaces:** 新视图继续使用现有 outlines/olnodes/mubu/lorelinks；`graphview.fit(bounds,{minZoom=0.3,maxZoom=1.2}={})` 保留单参行为；新增 mubuPath/mubuCheckpoint/mubuUndo 及 focusLoreNode(id,path) 边界，旧 jumpTo/parseTarget 签名不变。双链以 ID 为主，同名标题歧义不自动选错目标。

- [ ] 迁入纯函数 layout/core 测试，新增老作品缺 heading/kind、自定义字段、深层树、重复标题、断链/循环、跨作品引用隔离用例，运行确认新增契约未实现。
- [ ] 大纲新视图复用共享画布与文本模型；容器展开、选择、缩放、结构栏和详情布局按皮肤启用，不改旧皮肤默认 outlineView。
- [ ] 大纲专用顶栏复用 Task 4 桌面动作；明确分开画布设置与应用设置，保留入梦/浅眠/拆窗。独立大纲窗不复制插件 outlineNavigate 本地改 type 的行为，跨模块操作走窗口服务；验证大纲窗内不能绕过设定/人物的编辑锁。
- [ ] 设定迁入新三种视图与引用/预览，局部改造版组件留在 latent/lore；旧 MubuView 等继续给四套皮肤用。补入 work/ui 必需动作时保留旧公开字段及行为。
- [ ] 默认根节点补齐仅在用户主动操作时执行；读旧树不重排/写回。撤销按作品隔离并保存完整对象；切肤、跨作品、异步加载用 workId/请求序号阻止旧请求写新状态。
- [ ] 设定局部富文本在离开/切肤/拆窗前提交，失败阻止移交；完成引用跳人物/正文/大纲和回退路径测试。
- [ ] 写入 JSON 备份→恢复→桌面 packages/novel-core 同步→重启的往返测试；来源插件 lore-persistence 测试不能直接证明桌面链路，需换目标真实库实现。
- [ ] 新视图与四套旧大纲/设定通过后提交。

**Verification:** `node tools/latent-outline-layout.test.mjs`、`node tools/latent-lore-core.test.mjs`、`node tools/latent-lore-layout.test.mjs`、`node tools/latent-lore-compat.test.mjs`；原生新 `tools/latent-lore-verify.mjs`，旧 `tools/outline-skin-integration-verify.mjs`、`tools/lorelink-verify.mjs`、`tools/mubu-tags-verify.mjs`、`tools/line2line-verify.mjs` 按隔离前提执行。要求字段往返不丢失、坐标/结构不因切肤改变。
