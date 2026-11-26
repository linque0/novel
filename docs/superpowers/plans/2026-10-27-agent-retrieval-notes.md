# Task 1 · 检索与材料预算实施记录

实施在原工作目录增量完成；未提交、未重置、未升版本。Hindsight 未在工具注册表出现，未调用记忆工具。

- `buildRetrievalRequest(work,frozen,question,{privacy})` 输出任务、锚点、复合查询、截至章节和段内边界。正文/灵感映射 plot，审稿/复核/记忆映射 consistency，其余映射 outline/character/lore/chat。查询结合作者问题、人物规范名、章名、相关章纲、所选方向、位置前文；不以位置后文查询事实。隐私查询不包含正文或章纲原文。
- `assembleSlots` 第六参数为 `{embeddings,opts}`，prepareDialogue 传入已配置 opts；`search_kb` 使用父集成提供的 `env.retrievalOptions={embeddings,opts,taskType,anchorId}`。截至章节、段内边界及隐私参数不被工具配置覆盖。
- `kbQuery.vectorStatus={mode:'lexical'|'hybrid',reason}` 可观察 disabled/privacy/missing-provider/empty-query/no-current-vectors/embedding-unavailable；`vectorFallback` 保留兼容。隐私模式绝不调用 embedding。取消不转为静默降级。
- `assembleSlots` 返回 `budget={limit,used,remaining,included,omitted}`、`materials={included,omitted,sourceVersions}`、`retrieval`。清单条目包含 id、token 估算、必要性及来源版本；省略包含原因。检索层预算省略也并入 materials.omitted。
- 原始任务输入（含完整选段/锚点/前驱）、章节锚点、作品约束、阶段文本 Skill 必须整体适配预算，否则明确拒绝；可选材料按完整条目省略。`opts.stageSnapshot.skill.text` 在 protected requiredContext 注入，标记为“阶段写作规则（低于作品事实/作者要求；不授予工具权限）”。
- 设定源行可选 `rulePolicy={scope:'global'|'local',status:'confirmed',chapterId,outlineId,targetIds,keywords}`。确认全局规则必保留；local 仅匹配目标或关键词时进入；未分类旧规则保守必保留，仍标候选而非自动确认。无新增数据库 schema 或 UI 分类编辑器。

验证：新增 `node tools/creative-retrieval-unit-verify.mjs` 首次红灯为缺失检索策略，最终绿灯覆盖任务映射、复合查询、真实检索代码的向量接线/隐私/缺索引/网络失败/取消、材料接线与来源清单、完整必需输入和阶段 Skill 超限拒绝、真实规则分层。仅持久化/网络边界使用确定性替代，不属于模型质量验证。相关既有回归：writing-workflow-unit 15/15、agent-task-unit 15/15、project-unit 13/13。生产构建通过；保留既有 Node 模块类型、npm mirror 配置及 Vite 大块警告。父集成后需再次执行构建与工作流回归。
