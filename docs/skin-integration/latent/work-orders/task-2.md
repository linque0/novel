# Task 2：先建立数据兼容与统计事务

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

## Task 2：先建立数据兼容与统计事务

**Files:** Modify `src/db/repo.js`、`src/db/database.js`、`src/services/autosave.js`、`src/stores/work.js`、必要时 `src/services/ai/application.js` / `memory-queue-core.js`；Create `src/services/writing-word-delta.js`、`src/services/latent/character-preferences.js`、`tools/latent-data-compat.test.mjs`、`tools/latent-save-verify.mjs`。从来源 writing-stats-core 提取纯字数计算，完整分析在 Task 8 接入。

**Interfaces:** 保留 `putRow(table,row,opts)`，增加 `opts.recordWordDelta?: boolean`；`writing-word-delta.js` 导出 `chapterWords(row):number`、`chapterWordChange(previous,next):number`，只依赖 wordcount；保留 `addRevision(entityType,entityId,content,fmt?)` 的旧调用；保留 `loadCharGraph()/saveCharGraph(positions)` 平铺坐标契约；新增 `loadCharCamera(key): Promise<Camera|null>`、`saveCharCamera(key,cam): Promise<void>`。`Camera={x:number,y:number,z:number}`，相机存 `latent:charCamera:<workId>`。

- [ ] 编写真实事务失败/重试用例：正文增加 10 字，模拟 wordlog 或 airuns 写失败，正文和日志均不提交；重试只记一次 +10；删除/恢复、跨作品不能误记其他作品字数。
- [ ] 写旧图谱和未知字段往返用例：平铺坐标保持不变，相机写入不包装旧 key，包含 positions/camera 的旧导入记录能读取但不在打开页面时自动改写。
- [ ] 写 autosave 错误和 AI 记忆撤销用例：维持现有错误文字；显式 memoryIntent:null 取消合并队列里的旧意图；普通 undefined 不取消。先跑失败再实施。
- [ ] 合并插件原子统计方案到桌面共享保存路径，停用 installWordLogHook / prevCounts 的旧计量，逐一核对 AI 应用、撤销、正式稿确认与库同步写入路径；未经作者正文保存的导入/远端 hydrate 不假装当天创作。
- [ ] 加入可选 fmt 与事务完成后的历史通知；不把历史表加入 SOURCE_TABLES，不增加 schema，不自动重算旧日志。
- [ ] 新事务、兼容和现有记忆/工作流测试全部通过后提交。

**Verification:** `node tools/latent-data-compat.test.mjs`、隔离 Electron 中 `node tools/latent-save-verify.mjs`、`node tools/memory-queue-unit-verify.mjs`、`node tools/workflow-save-unit-verify.mjs`、`node tools/writing-application-race-verify.mjs`。运行前核对旧脚本的前提与 profile；不盲连 9222 正式实例。
