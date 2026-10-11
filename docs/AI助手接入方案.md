# AI 助手（Agent）接入方案

> 定位版本建议：v1.2.0（v1.1.x 预留给云同步；本方案的 credential IPC 设计与《云同步功能实现计划》共享）
> 起草日期：2026-10-11
> 关联文档：docs/云同步功能实现计划.md（safeStorage 凭证设计、mock 服务器验收模式可复用）

## 一、定位与目标

在现有纯本地应用（Vue 3 + Pinia + Dexie/IndexedDB + Electron，当前**零网络调用、零 AI 代码**）上新增「AI 助手」：agent 以**只读**方式阅读作品全库（正文、人物、大纲、设定、灵感片段），按任务分层装配上下文调用大模型，产出**提案卡片**，用户确认后才写入。能力清单：

1. **正文发展**：在当前章节位置给出 2–4 条剧情线路选项（梗概 + 张力点 + 涉及人物 + 200–400 字起笔示例）
2. **大纲规划**：对选中大纲节点给出 2–3 套分支线路方案树，一键挂载为子节点
3. **设定扩展**：对幕布节点给出新增条目草案或扩写草案，diff 确认后写入
4. **人物丰富**：字段补全、小传扩写、别名建议、关系建议，diff 确认后写入
5. **自由问答**（附带）：带只读检索工具的对话，回答关于本书的任何问题

**红线：agent 永不直接改库。一切写入走「卡片应用」→ 现有 store 写入路径，修改类产出必须 diff 预览。**

## 二、总体架构

```
渲染层
  ├─ 入口：编辑器/大纲画布/人物中心/幕布 的右键与按钮 + 右栏「AI 助手」侧栏
  ├─ stores/ai.js             会话、任务状态、设置、用量统计
  ├─ services/ai/context.js   上下文装配器（分层取数 + 预算裁剪 + 发送范围报告）
  ├─ services/ai/agent.js     任务编排（装配 → 调用 → JSON 解析 → 卡片）
  ├─ services/ai/prompts.js   四能力提示词模板 + 结构化输出 schema
  ├─ services/ai/provider.js  OpenAI 兼容调用（SSE 流式 / 超时 / 重试 / usage）
  └─ services/ai/summarize.js 摘要缓存（aisum 表，autosave 钩子惰性更新）
主进程
  └─ credential:put/get IPC（safeStorage 加解密，密文存 appconfig，复用云同步计划凭证设计）
外部
  └─ OpenAI 兼容 API（DeepSeek / GLM / OpenAI / Ollama 本地 / 自定义）
```

## 三、模型接入

- **协议**：OpenAI 兼容 `POST {baseURL}/chat/completions`，`stream: true` SSE。零新依赖（fetch + ReadableStream）；`app://` 协议已注册 `supportFetchAPI: true` 且无 CSP（electron/main.js:31-33），桌面版渲染层直连可行。
- **服务商预设**：DeepSeek（默认，deepseek-chat / deepseek-reasoner）、智谱 GLM、OpenAI、Ollama 本地（`http://127.0.0.1:11434/v1`）、自定义。一套协议全覆盖，后续换模型零改代码。
- **密钥**：设置面板输入后经主进程 safeStorage（Windows DPAPI）加密，密文存 appconfig 键 `ai.credential`；渲染层仅运行时内存解密，不落 localStorage、**不进 JSON 备份**（`exportBackupJson` 导出 appconfig 时过滤该键）。设置面板不回显明文，只显示「已配置」。
- **可配置项**：baseURL / model / temperature / 上下文预算（默认约 8k tokens）/ 摘要可选用轻量模型（独立 model 字段）。
- **错误分类**：未配置 / 网络失败 / 401 / 限流 / 余额不足 → 助手栏统一提示条；未配置时全部 AI 入口置灰。设置区提供「连接测试」按钮。
- **网页版限制**（server.mjs:18688）：第三方 API 多无 CORS 头，网页版明示「AI 助手仅桌面版可用」（与云同步计划取舍一致）。

## 四、上下文装配器（核心）

长篇不可能全量投喂，按三层装配，按 token 预算自上而下填充，超限先砍 L2：

| 层 | 内容 | 来源 |
|---|---|---|
| L0 常驻骨架 | 作品元信息（title/genre/intro/status）、人物卡（姓名/别名/角色/标签/核心字段，每人 1–2 行）、设定幕布树前 2 层标题、大纲树骨架（olnodes 标题树） | `loadWorkBundle` |
| L1 任务锚点 | 正文任务 = 当前章全文（或末 N 字）+ 前 3 章摘要 + 后 1 章摘要；大纲任务 = 选中节点子树 + 祖先链 + 兄弟节点；设定任务 = 选中节点子树 + 同分类条目；人物任务 = 该人物全字段 + 关系 + 出场章节清单 | store/work.js |
| L2 检索召回 | 人物反查出场章节（RightPanel 同款 `includes` 匹配 name/aliases）取相关片段、双链目标实体、相关灵感片段 | chapters / mubu / characters / snippets |

- **摘要缓存**：新增 Dexie v7 表 `aisum`（id / workId / entityType / entityId / contentHash / summary / updatedAt）。章节经 autosave 落盘时 contentHash 变化则标记待更新，下次相关任务前由 AI 生成 150–250 字章节摘要写入缓存——仅变化章节重算，长篇成本可控。
- **发送范围报告**：装配器返回「本次将发送：章节X全文、人物Y卡、设定Z子树…」清单，显示在发送按钮上方；隐私模式开关可只送摘要不送原文。

## 五、四大能力设计

统一交互流：触发入口 →（可选补充指令）→ 装配 + 流式调用 → 结构化 JSON 解析为卡片 → 用户「应用」→ 现有 store 写入。解析失败附错误回喂自动重试 1 次，仍失败降级为纯文本展示。

### 1. 正文线路选项
- 入口：编辑器右键「AI：剧情选项」/ 工具条；锚点 = 光标所在章
- 输出 2–4 张 **BranchCard**：线路名、一句话梗概、张力点/风险、涉及人物、200–400 字起笔示例、对既有伏笔与大纲的影响
- 操作：①「落到大纲」→ 在 olnodes 当前章锚点下新增章纲子节点；②「以示例起笔续写」→ 迭代生成 800–1200 字段落草稿插入编辑器（不覆盖，用户润色定稿）

### 2. 大纲线路规划
- 入口：OutlineSidebar / OutlineCanvas 节点右键「AI：规划线路」
- 输出 2–3 套 **PlanCard**，每套含 2–6 个子节点草案（标题 + 要点 + 连线语义建议：因果/伏笔/冲突）
- 应用 = 批量写入 olnodes 挂到选中节点下，画布自动布局落位，按建议生成 rel 连线

### 3. 设定扩展
- 入口：MubuView 节点右键「AI：扩展设定」
- 两类卡：**新增条目草案**（子节点树）与**现有节点扩写**（DiffCard 左右对照 text/html 变更）
- 应用 = 写入 mubu（新增子节点 / diff 确认后更新节点）

### 4. 人物丰富
- 入口：CharacterCenter「AI：丰富」按钮
- 输出 **DiffCard**：fields 缺项建议（依据出场章节文本反推）、小传扩写、别名建议、新增关系建议（对端人物 + 关系名）
- 应用 = diff 确认后更新 characters 行 / relations 表

### 5. 自由问答
- 助手栏常驻输入框；小工具循环，仅暴露只读工具（search_chapters / get_character / get_outline_subtree / get_lore_subtree / list_recent_chapters），按需取数回答
- 模型若表达写入意图则提示改用对应能力卡片

### 界面形态
- P2 起为工作台右侧「AI 助手」侧栏（与批注侧栏并列，随当前模块自动携带上下文）
- P4 支持拆出为独立面板窗口（`PANEL_META` 新增 `ai` 类型，复用 panel:open 体系；助手不改实体，锁键 entityId 取 `*`）

## 六、写入安全与数据纪律

1. **提案制**：agent 全库只读；写入必须经卡片「应用」，全部走 store/work.js 现有动作（保证 UI 同步、wordCount、autosave 落盘）
2. **锁门禁**：正文插入前过 `isPopped` 检查（v1.0.22 writableEditorFor 教训：章节被拆出面板锁定时，主窗口拒绝 AI 写入）
3. **快照回滚**：大块写入（大纲子树 / 幕布新增 / 正文插入）前 `forceSnapshot` 版本快照，可经 RevisionsModal 回滚
4. **密钥安全**：safeStorage 加密、备份 JSON 过滤、设置面板不回显明文
5. **成本可见**：响应 usage 累计（本会话 + 累计两行）显示在助手栏底部；所有任务均手动触发，无后台自动调用

## 七、代码落点

**新增**
- `src/services/ai/provider.js` — OpenAI 兼容调用（SSE 解析、超时、重试、错误分类、usage）
- `src/services/ai/context.js` — 分层上下文装配器
- `src/services/ai/prompts.js` — 四能力提示词模板 + JSON 输出 schema
- `src/services/ai/agent.js` — 任务编排（含问答小工具循环）
- `src/services/ai/summarize.js` — 摘要缓存维护
- `src/stores/ai.js` — Pinia 状态（设置、会话、任务、用量）
- `src/components/ai/AiAssistantPanel.vue`（助手侧栏）、`AiSettings.vue`（并入 SettingsPanel 的 AI 区）、`BranchCard.vue` / `PlanCard.vue` / `DiffCard.vue`
- `electron/main.js` 增 `credential:put/get` IPC（safeStorage）
- `tools/mock-ai.mjs` — 本地 OpenAI 兼容假服务器（SSE 固定脚本输出，验收绝不连真实 API）
- `tools/ai-verify.mjs` — CDP 验收脚本

**改动**
- `src/db/database.js` — v7 迁移，新增 `aisum` 表
- `Workbench.vue` — 右栏挂 AiAssistantPanel
- `EditorContextMenu.vue` / `EditorToolbar.vue`、`OutlineCanvas.vue` / `OutlineSidebar.vue`、`MubuView.vue`、`CharacterCenter.vue` — 各加一个 AI 入口
- `SettingsPanel.vue` — 新增「AI 助手」区（预设 / 密钥 / 连接测试 / 预算 / 隐私模式）
- `src/db/repo.js` — `exportBackupJson` 过滤 `ai.credential`
- `src/services/autosave.js` — 钩子挂章节摘要失效标记

## 八、验收方案

`tools/ai-verify.mjs`（CDP 9222，mock provider）：
1. **设置区**：预设切换、密钥 safeStorage 后 IndexedDB 无明文、备份 JSON 不含密钥、连接测试通过
2. **装配器**：四任务各断言发送清单内容与预算裁剪行为
3. **四能力端到端**：mock 返回固定 JSON → 卡片渲染 → 应用 → 断言 olnodes / mubu / characters / 正文落库 + revisions 快照生成
4. **锁门禁**：章节拆出面板后主窗口 AI 写入被拒
5. **回归**：dl / annotation / olcanvas / shelf 等现有脚本不破坏，`npm run build` 通过

真实 API 冒烟（手动可选）：DeepSeek 连接测试按钮。

## 九、实施阶段

| 阶段 | 内容 |
|---|---|
| P0 地基 | credential IPC + SettingsPanel AI 区 + provider + 连接测试 + mock-ai |
| P1 上下文 | aisum v7 迁移 + 装配器 + 发送范围报告 + 摘要缓存 |
| P2 核心能力 | 右侧助手栏 + 正文线路选项 + 大纲规划 + 卡片应用写入 + 验收脚本 |
| P3 辅助能力 | 设定扩展 + 人物丰富（diff 卡）+ 自由问答 |
| P4 打磨 | 拆出独立面板窗口、用量统计、隐私模式、会话持久化（appconfig） |

## 十、风险与对策

- **长文上下文超限** → 分层装配 + 预算裁剪 + 摘要缓存；仍不足时 P4 备选「卷级摘要」
- **JSON 输出不稳** → 严格 schema 提示词 + 重试 1 次 + 降级纯文本
- **误覆盖正文** → 提案制 + diff + 锁门禁 + 快照四重保险
- **成本失控** → 发送范围可见 + usage 累计 + 纯手动触发
- **网页版受限** → 明示桌面版专属
