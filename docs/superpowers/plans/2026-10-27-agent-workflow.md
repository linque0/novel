# 恍然梦创作工作流 Implementation Plan

> **For agentic workers:** 使用 superpowers:subagent-driven-development；已获用户实施授权，连续执行，不自动提交、不升版本。现有功能分支包含作者未提交工作，原地增量修改，不重置文件。

**Goal:** 落实已批准的 P0–P3：任务检索、材料与预算、独立审修、可靠记忆队列、章级与批量候选、阶段模型及文本 Skill。

**Architecture:** 复用 ai.send、受限工具、airuns、书库读模型和既有应用门禁；确定性工作流管理阶段，模型只生成候选。正式写入继续由作者逐章确认。

**Tech Stack:** Electron / Vue / Pinia / TipTap / Dexie；不新增运行时依赖。

**Spec:** 本会话 2026-10-27 用户完整批准的《恍然梦 Agent 优化方案》。

## Global Constraints
- 保留既有未提交修改；不提交、不推送、不升版本。
- 候选不进入正式记忆；保持章节/段内边界、隐私、来源版本、窗口锁和撤销保护。
- 批量最多 10 章，逐章采纳；自动修稿至多一轮、定向复核至多一次。
- 真实 AI 质量验证使用应用已配置 deepseek/deepseek-v4.1-flash，隔离 profile；确定性输入不冒充质量评测。
- Hindsight 工具本轮未出现在实际工具注册表，无法执行 search/read/capture；不以历史摘要代替代码事实。

## Review Focus
- 修改候选/前驱后旧审稿、修稿和应用必须失效。
- 重复引文必须有显式坐标；未定位证据只能是待核实。
- 取消/重启/恢复备份不自动发送请求，迟到结果不能发布。
- 记忆队列必须与正文保存原子登记，失败不得回滚已保存正文。
- 模型/Skill 绑定不能泄露凭据或绕过材料边界。

### Task 1: 检索与材料预算
Files: retrieval.js / novel-context.js / tools.js / constraints.js / book-memory.js / prepare-dialogue.js；新增 retrieval-policy.js、material-budget.js 及 targeted unit verifier。
Interfaces: buildRetrievalRequest(work,frozen,question)；任务映射、锚点、查询；检索配置由 prepareDialogue opts 到 assembleSlots，再到 kbQuery；工具环境由父集成传入 retrievalOptions。
- [x] 测试先红后绿：任务映射、查询、向量接线与降级、预算、规则分层、来源清单。
- [x] 实现并跑对应单测和既有边界回归。

### Task 2: 审修与场景纯协议
Files: 新增 src/services/ai/review-cycle.js、chapter-plan.js、tools/review-cycle-unit-verify.mjs。
Interfaces: freezeDraft(card) -> {id,revision,contentHash,text}; normalizeReview(data,draft,resolveEvidence?)；confirmReview(review,draft,decisions,authorGuidance)；assertReviewCurrent；normalizeRecheck；normalizeChapterPlan。
- [x] 测试先红后绿：版本、重复引用、未核实证据、作者清单、完整定向复核、场景计划。
- [x] 所有函数为纯逻辑，不修改现有任务入口，父集成负责接线。

### Task 3: 阶段配置与提示词 Skill
Files: 新增 src/services/ai/stage-config.js、src/components/ai/StageSettings.vue、tools/stage-config-unit-verify.mjs。
Interfaces: STAGES；stageForTask；normalizeStageConfig；freezeStage(config,stage,{providers,presets})；readWritingSkillFiles(files)；loadStageConfig / saveStageConfig。
- [x] 测试先红后绿：默认继承、无效绑定、阶段快照、引用路径、脚本拒绝、文本预算。
- [x] 组件自包含，父集成将其放入恍然梦弹层并接 ai.send。

### Task 4: 工作流、批次与阶段工具集成
Files: 新增 workflow-core.js / workflow-repo.js / stores/creative-workflow.js / components/ai/CreativeWorkflow.vue；修改 task-profiles.js / dialogue.js / task-proposals.js / stores/ai.js / AiAssistantPanel.vue / DraftCard.vue。
Interfaces: run record type creative-workflow, stage, artifact；新增 chapter.plan/draft/review/revise/recheck；阶段检查点/租约/恢复；前驱候选版本校验。
- [x] 测试先红后绿：状态机、10 章限制、依赖失效、恢复、自动修稿轮数和预算。
- [x] 接入审修协议、模型与 Skill 快照，候选由既有 applyProposal 写回。
- [x] 增加候选审修入口、场景编辑、运行进度、暂停/恢复和逐章采纳。

### Task 5: 正文采纳后的可靠记忆任务
Files: 新增 memory-queue.js；修改 application.js / runtime.js / ai-repo.js（如需要）/ repo.js（恢复状态）。
Interfaces: memory job 记录源正文哈希、步骤状态、来源版本；正文与任务同事务保存；主窗口派发 buildKnowledge，重试只处理失败步骤。
- [x] 测试先红后绿：原子登记、去重、失败保留正文、修改/撤销失效、恢复不自动执行。
- [x] 接入记忆状态与手动重试。

### Task 6: 验证、评测与文档
- [x] 运行新增 verifier、既有相关纯逻辑回归、生产构建。
- [x] 隔离 profile 验证真实 UI/数据库：10/10 机制检查（固定响应传输，不是模型质量）。
- [ ] 真实模型质量评测：已运行真实评测前置检查，但隔离配置 ready=false，缺少可用凭据；不得以机制结果替代。
- [x] 百万字/千章投影基准与固定质量样本工具；不报告未经执行的指标。
- [x] 独立代码审查、修复重要发现、更新实施说明和本计划完成状态。

## Rulings / Progress
- Ruling: 当前分支为“前端重置”，大量现有工作尚未提交；复用当前目录比创建仅含 HEAD 的 worktree 更能保留正确基线。
- Ruling: 首版使用 airuns schemaVersion 记录，不迁移 SQLite，不引入第三方项目代码。

- 验收：最终 13 个针对性验证脚本全部 exit 0，Electron 隔离集成 10/10，npm run build 通过；保留已有 chunk/模块与 npm 镜像配置警告。
- Ruling: 有总预算的批次暂用关键词检索，普通单项任务保留向量；避免向量请求绕过根预算，界面明确告知。
- 已修复独立审查发现的来源失效、段场景检查点混用、未选严重问题遗漏、修稿失败重试、恢复代数、多窗口广播与设定锁问题。
- Hindsight 接口仍未注册，无法登记 initiative；本计划与实施说明作为本地执行记录。
