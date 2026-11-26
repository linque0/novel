# 恍然梦内置写作与记忆 Skill 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按用户要求搜索、审查 GitHub Skill，将适合的文本方法改编接入恍然梦，并保存可核查来源。

**Architecture:** 复用已有阶段配置、冻结快照和请求注入。增加受信任的内置文本目录，不导入远程执行能力，不改变正式写入、证据、预算或作者采纳边界。

**Tech Stack:** Vue、Pinia、现有 JavaScript 服务和 Node 验证脚本。

**Spec:** 用户本轮要求；`docs/恍然梦AI工作台/产品方向与界面方案-20261027.md`，本轮新增研究与接入记录。

## Global Constraints

- 用户已有配置和已启动运行不被自动覆盖；推荐组合只填空白阶段。
- Skill 低于作品事实、证据、历史边界和阶段输出协议；不增加脚本、网络或工具权限。
- 保留原框架与 Dexie；不提交 Git 或升级版本，保留工作区已有修改。
- 每个来源固定 commit、文件、SHA-256、许可原文；中文适配明确标记为改编。
- Hindsight 工具发现未返回任何可调用工具，本轮依据实时源码和上游原文，不能进行要求的知识页搜索/initiative capture。

## Review Focus

- 已保存或导入的同名 ID 不得覆盖受信任内置文本或伪造来源。
- 阶段错误绑定必须拒绝，用户自定义 Skill 保持原有兼容行为。
- 推荐组合保留供应商、模型、预设和自定义绑定，支持清空内置绑定。
- 配置修改不改变已冻结 Skill 的文本和来源记录。
- 记忆指导不得改变既定 JSON、允许来源或作者确认流程。

## Task 1：来源审查与适配目录

- [x] 多角度搜索，读取上游原文和许可，固定提交。
- [x] 在 `tools/builtin-skills-unit-verify.mjs` 先写失败测试：5 个阶段有受限文本、推荐填空保留旧配置、错阶段拒绝、来源快照独立。
- [x] 新建 `src/services/ai/builtin-writing-skills.js`，包含 5 项中文适配文本、固定来源、适用阶段和版本。
- [x] 扩展 `stage-config.js`，合并内置目录、冻结来源元数据、校验适用阶段；不自动修改保存的绑定。
- [x] 执行新验证脚本及原阶段配置/预算/记忆验证。

## Task 2：阶段设置与核查记录

- [x] `StageSettings.vue` 展示内置阶段选项、实际文本与固定来源；推荐按钮只填空白阶段，保存失败恢复表单。
- [x] 保存选中来源的原文快照、许可证、文件 SHA-256 与候选取舍记录；不运行下载内容。
- [x] 产品方向方案追加本次研究、映射、接入入口、验证结果及质量限制。
- [x] 检查源码链接、来源哈希、Vue 编译和 `npm run build`；仅报告实际执行结果。

## 执行记录

- Ruling：沿用当前 `feature/恍然梦-agent` 工作区 — 本次依赖尚未全部提交的阶段/记忆实现，切到干净 checkout 会丢失任务基础；不修改其他已有改动，不新建 worktree。
- 首次目录测试明确失败于“缺少内置目录”，实现后通过；UI 验证脚本首次有嵌套模板语法错误，拆开表达式后通过，不是产品运行失败。
- 7 个定向脚本通过：builtin-skills、builtin-skill-sources、stage-config、stage-budget、memory-queue、creative-workflow（10 项）、review-cycle（10 项）。
- 隔离 Electron UI 9/9；临时 profile，无模型调用；测试 Vite 与 Electron 正常关闭。
- 生产构建通过：3632 modules，12.71 秒；既有模块/包体/npm 警告保留。49 个本地源码与档案链接存在。
- 按 executing-plans/requesting-code-review 进行一次独立审查；无 Critical/Important。修正 Minor：原阶段测试改为按自定义 Skill ID 定位，避免内置列表插入后测试失去原意；重跑通过。
- 未进行真实模型质量对比，未自动改绑用户数据库，未提交 Git 或升级版本。
