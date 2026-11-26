# 正文工作流第一阶段 Implementation Plan

> **For agentic workers:** 使用 superpowers:executing-plans 在当前会话执行；逐任务红绿验证，最后独立审查。用户已授权按细化方案开始实施，保留现有改动，不自动提交。

**Goal:** 打通位置绑定、4–6 个可编辑剧情方向、按选定编辑稿续写、正文精修/预览/采纳与记忆解耦。

**Architecture:** 新增小型正文工作流状态与纯逻辑服务，复用现有 ai.send、模型/预设和 airuns。方向生成无写回权限；正文仍经原有来源、窗口锁和审计机制应用。段内读取限制贯穿上下文与只读工具。

**Tech Stack:** Vue/Pinia、TipTap、Dexie、现有 Electron/Vite。

**Spec:** docs/agent-knowledge-fix-20261023/正文续写与改写工作流细化方案-20261024.md

## Global Constraints

- 初次方向数量 4–6，默认 5；单卡/补卡按剩余数量，方向卡可直接编辑，手动修改保留。
- 续写只消费选定方向最新编辑稿；未选方向不能进入正文历史。
- 冻结原作品、章节、编辑器范围和版本；保留全作品来源变化保护。
- 关闭 AI 不丢输入；继续使用右侧浮层，不改变正文布局。
- 保留原有未提交改动，不升版本、不自动提交，不调用真实模型、不写作者作品。
- 第一阶段不实现高级场景卡、逐段采纳或关系时间线。

## Review Focus

- 重复原文与跨段选区：按编辑器坐标写入，坐标与纯文本偏移不混用（Task 1/5）。
- 流式/迟到结果：完整卡可编辑，后续返回不能覆盖编辑稿（Task 2/3）。
- 当前章后文：摘要、状态、原文检索和证据接口均不能绕过位置边界（Task 4）。
- 切书/关闭/多窗口：旧请求和防抖保存绑定原任务，应用受原锁与版本保护（Task 3/6）。
- 编辑候选与撤销：保存用户实际编辑稿，预览无正文事务，撤销不覆盖后续编辑（Task 5/6）。

### Task 1: 写作位置与方向纯逻辑

Files: 新增 src/services/ai/writing-anchor.js、writing-directions.js；tools/writing-workflow-unit-verify.mjs。

Interfaces: captureWritingAnchor(editor,{workId,chapterId,mode,chapter}) 返回 docHash/from/to/selection/cutoff/left/right/sourceHash；validateWritingAnchor(editor,anchor) 检查文档与范围。normalizeDirectionRows(rows,expectedCount) 校验输出；mergeDirectionRows(session,rows,token) 按稳定槽位合并且保护编辑稿；selectedDirectionSnapshot(session) 返回冻结方向。

- [x] 写位置与方向的失败检查并执行，覆盖重复文本、流式完整对象、4/5/6/补卡、编辑保留、清空、过期回调。
- [x] 实现上述纯逻辑，运行纯逻辑检查通过。

### Task 2: 方向专用任务与模型接线

Files: task-profiles.js、dialogue.js、task-proposals.js、stores/ai.js。

Interfaces: chapter.directions / submit_plot_directions，仅输出 {directions:[{id,title,development}]}，正文接口消费 taskRequest.writingAnchor 和 selectedDirection。ai.send 的 onDirectionRows / onMessage 回调向工作流交付完成卡/消息，回调不参与持久化请求契约。

- [x] 增加方向无写权限、工具白名单、部分卡片回调与历史隔离的失败检查。
- [x] 实现任务、schema、输出校验、流式完整卡提取；原模块任务测试仍通过。

### Task 3: 工作流状态、持久化与方向面板

Files: 新增 stores/writing.js、db/writing-repo.js、components/ai/WritingWorkspace.vue；修改 TaskLauncher.vue、AiAssistantPanel.vue、autosave.js。

Interfaces: writing.open/startDirections/startDraft/editDirection/selectDirection/save/flush；状态按 workId+sessionId 绑定，airuns.type=writing-session；关闭前刷新挂入原 autosave 通路。首批 5 个方向，可选4/5/6，可编辑、保留、复制、自建、补卡与单卡重试。

- [x] 增加注册验证书的 UI/落盘/重启/迟到回调失败检查。
- [x] 实现正文工作区，其他模块仍用原启动器；已有 AI 浮层偏好不变。

### Task 4: 位置级上下文与工具边界

Files: novel-context.js、booksource.js、tools.js、knowledge.js、retrieval.js、state.js、prepare-dialogue.js。

Interfaces: writingBoundary={chapterId,end} 传递只读策略；bookSession 的章节文档裁剪，当前章摘要/批注/依赖当前章的总结保守排除；knowledgeSnapshot 对当前章/跨章聚合保守排除。右侧正文仅显式衔接材料；writingRequired 槽保护必要原文和选定方向。

- [x] 先验证未来秘密不能从 read/search/state/summary/evidence 路径返回；改写原文完整保留且预算不足明确失败。
- [x] 实现并通过书库与 Agent 相关回归。

### Task 5: 候选编辑、预览与定位应用

Files: DraftCard.vue、application.js、candidates.js、stores/writing.js。

Interfaces: draft.editText 与 source.taskRequest.writingAnchor；预览使用文本/临时视图不写正文；应用前验证锚点、来源、锁与方向版本，insert/append/replace 一次事务。

- [x] 写重复片段定位、候选编辑与预览不写正文、版本变化拒绝、重复点击和撤销的失败检查。
- [x] 实现 UI 和写回，采纳后只标记记忆待更新，提供单独提取入口。

### Task 6: 整体交付验证

Files: tools/writing-workflow-verify.mjs、必要的验证登记/说明，docs/writing-workflow-20261024/。

- [x] 独立 booksource-verify profile，注册《AI 验证书》，确定性输入与本地测试服务，不改真实模型配置、不请求真实模型。
- [x] 完整异步用例连续三次；四皮肤截图；章节/阅读/多窗口相关回归、关联和 Agent 回归、生产构建。
- [x] 独立审查实质缺陷，修复后重跑相关检查；记录实际结果与限制，关闭本轮测试服务。

交付记录：`docs/writing-workflow-20261024/实现与验证.md`。最终工作流 28/28 连续三次通过；保留当前未提交代码，验证服务已关闭。
