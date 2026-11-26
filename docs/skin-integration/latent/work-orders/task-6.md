# Task 6：人物与灵感

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

## Task 6：人物与灵感

**Files:** Create `src/components/skins/latent/characters/`（来源完整 characters 目录）；必要局部版 SnippetCenter/SnippetList 放 `src/components/skins/latent/snippets/`；Modify Workbench/PanelHost、`src/stores/ui.js`、`src/stores/work.js`、`src/skins/graph-presentation.js`；Create `tools/latent-char-layout.test.mjs`、`tools/latent-character-verify.mjs`。

**Interfaces:** 保持 `work.charView='list'|'graph'`，新壳内部转换 profile；`setCharView(next)` 对非法值回落 list；隐现 graph geometry 增加普通 134×84、选中 156×103、scaleX/Y=1 的专用分支；旧三种艺术投影不变。新 charPrefs/charstate 状态映射至 latent 命名空间。

- [ ] 写旧坐标正反投影、新节点端口/选中尺寸、相机分档、不同作品状态隔离、异步切书与卸载延时保存用例，先运行失败。
- [ ] 搬入完整名录/卷宗/上下文/检查器/关系图，接 Task 2 的旧坐标与独立相机接口；保存节流必须捕获 workId，不能在卸载时把旧图写入新作品。
- [ ] 复用桌面人物图片导入与 AI；人物文本离开/切肤前提交。测试关系方向、拖拽/框选、删除、双链定位和编辑锁。
- [ ] 灵感使用原有 store/action，迁入插件现有展示差异与统一外壳，保留标签、导出/引用、AI 与拆窗。
- [ ] 人物/灵感全流程、新旧图谱互切和源码数据不变测试通过后提交。

**Verification:** `node tools/latent-char-layout.test.mjs`、`node tools/skin-unit-verify.mjs`；隔离 `node tools/latent-character-verify.mjs`，旧 `tools/chargraph-verify.mjs`。新人物三列按 1100 边界及 800px 内容面板验证。
