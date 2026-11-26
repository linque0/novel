# Task 8：写作速览、分析与历史明细

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

## Task 8：写作速览、分析与历史明细

**Files:** Create `src/components/skins/latent/stats/`（来源完整 stats 目录）、`src/services/writing-stats-core.js`（导入并复用 Task 2 的 writing-word-delta.js，不保留第二份算法）、`writing-analysis-data.js`、`writing-analysis-model.js`、`writing-stats-motion.js`；Modify `src/db/repo.js`、`src/stores/ui.js`、`src/App.vue`、新顶栏/面板统计入口；Create `tools/latent-writing-stats.test.mjs`、`tools/latent-writing-analysis.test.mjs`、`tools/latent-analysis-verify.mjs`。

**Interfaces:** `readWritingStats(workId,days=30): Promise<{choices,stats}>`；`readWritingStatsRevision(id,workId,chapterId)` 二次校验归属并按需加载 content；`ui.statsWorkId=null` 表示全库。保留旧 statsOpen 的调用，旧皮肤只渲染原 StatsModal，新皮肤只渲染一个 WritingStatsDialog。

- [ ] 迁入来源纯分析测试，加入同名作品/重复局部 ID、未分卷/孤立节点、删除来源、负数与净零日、缺 fmt 版本、跨日/本地日期、无历史日志用例。
- [ ] 复用 Task 2 已建立的字数写入链路，接入事务读取与已提交历史刷新；概览不加载全部历史正文，点版本明细才加载并校验作品/章节归属。
- [ ] 迁入当前速览与完整分析，保持截图中的动效/布局/比较；关闭、ESC、焦点恢复、退出皮肤、html 滚动锁和异步请求清理都测试。
- [ ] 新入口覆盖书架、正文、其他模块、设置和内容面板；对没有当前作品的 AI/应用窗口使用确定范围，不能残留上一个作品上下文。
- [ ] 核对旧 StatsModal 在共享统计算法更新后无双计数；数据测试、原生分析与旧统计回归通过后提交。

**Verification:** `node tools/latent-writing-stats.test.mjs`、`node tools/latent-writing-analysis.test.mjs`；隔离 `node tools/latent-analysis-verify.mjs`；重复 Task 2 的事务重试断言，核对 7/30/90 日日期边界、长章节分页及版本按需加载。
