# 工作流设计：构建 AI 助手并推送分支

获批后我将调用 `CreateWorkflow` 启动该动态工作流（届时还会弹出确认窗，展示完整脚本与命令集）。

## 拓扑（8 个子代理、7 个阶段）

实现范围：docs/AI助手接入方案.md 的 **P0–P3**（P4 打磨项不做，写入 notCovered）。

1. **创建功能分支并提交基线** — `git checkout -b feature/ai-assistant`（已确认分支未被占用）；工作区现有未提交改动先做一次基线提交（保留在分支上，不污染 AI 提交）
2. **并行搭建服务层与数据层** — 「服务与主进程工程师」（provider.js + electron credential IPC + preload + tools/mock-ai.mjs）∥「数据与上下文工程师」（database.js v7 aisum 表 + context.js 装配器 + summarize.js 摘要缓存 + prompts.js）
3. **实现任务编排与状态层** — 「编排与状态工程师」（agent.js 任务编排 + stores/ai.js，读取前两位的产出对接 API）
4. **并行实现界面组件、工作台集成与模块入口** — 「界面组件工程师」（components/ai/ 五个组件）∥「工作台集成工程师」（Workbench/SettingsPanel/repo.js 备份过滤/autosave 钩子）∥「模块入口工程师」（编辑器×2、大纲×2、幕布、人物中心六个入口）；三者文件所有权互不重叠
5. **独立核对实现与方案的差距** — 「独立核对员」只读对照方案与 `git diff HEAD` 找缺口/接缝/红线问题（发现问题即 report 留档）→「修复工程师」修复
6. **构建验证并修复** — 门禁 `node node_modules/vite/bin/vite.js build`（实测 vite 入口存在；绕开 win32 无法直接 spawn npm 的问题），失败交修复工程师，最多 4 轮
7. **提交 AI 助手实现并推送分支** — `git add -A` + 提交（构建通过与否写入提交信息）+ `git push -u origin feature/ai-assistant`（推送失败如实记入 findings，不影响本地提交）

## 关键决策

- **门禁选型**：仓库最强的可机检检查是 `npm run build`（各版本验收纪律），用 node 直拉 vite.js 等价执行；CDP 实机验收（tools/ai-verify.mjs）需要 dev+Electron 环境，无法在无人值守运行里可靠执行 → 写入 notCovered，建议合并前单独跑
- **成果交付**：发布一份「AI 改动文件清单」markdown 主产物；`report()` 逐条留档核对发现（运行失败也不丢）；最终按 WorkflowReport 四字段返回
- **红线约束**：所有子代理的 ask 中明令——零新 npm 依赖、不执行 git 操作、不自己跑构建、写入走现有 store 路径

请批准后我开始启动工作流。