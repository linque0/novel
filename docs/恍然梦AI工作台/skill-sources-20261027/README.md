# 恍然梦 Skill 来源档案（2026-10-27）

本目录用于离线查证，不在应用运行时加载或执行上游代码。

- `manifest.json`：11 份选中上游文本、固定 Git commit、原始文件 SHA-256 与 3 份 MIT 许可。
- `novel/`：leemain88/novel-skills 原始文本与许可。
- `story/`：danjdewhurst/story-skills 原始文本与许可。
- `context/`：muratcankoylan/Agent-Skills-for-Context-Engineering 原始文本与许可。
- `adaptations.json`：5 项中文改编的身份、适用阶段、源文件关联和文本哈希。
- `adapted/*/SKILL.md`：中文改编快照，可单独用现有文本导入器预览；产品实际使用 `src/services/ai/builtin-writing-skills.js`，核查脚本保证快照与代码一致。

保留全部上游版权和许可。中文改编不是原文直装；具体删改理由、未入选候选和生效方式见产品方向方案第 13 节。没有引入这些仓库的执行器、脚本、多代理、框架依赖或外部语料。

在项目根目录运行：

```powershell
node tools/builtin-skill-sources-verify.mjs
node tools/builtin-skills-unit-verify.mjs
node tools/builtin-skills-ui-verify.mjs
```

更新前重新审查固定提交与引用，更新适配版本和全部哈希；不要让远程分支变化自动替换已审查文本。当前质量效果尚待固定样本、同模型的真实生成对比。
