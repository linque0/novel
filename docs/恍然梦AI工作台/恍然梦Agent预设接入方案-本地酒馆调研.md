# 恍然梦 Agent 预设接入方案：本地 SillyTavern 调研

日期：2026-10-12。依据当前工作区源码、v3.1 方案及用户指定的 SillyTavern 1.15.0 本地目录。本文为研究与设计交付，不是已经实现的功能清单。

## 1. 建议结论

把预设做成“可保存、切换和分享的任务执行配置”：通过提示块、选项、作者注、文风档案和采样参数调整 Agent 的创作倾向与表达方式，同时保持现有 JSON 卡片、证据校验和作者确认机制。

建议调整 v3 的实施顺序：**先上线原生预设，再接入世界书和人格卡，最后提供酒馆兼容导入。** 第一阶段直接复用现有上下文和知识库，不必等待世界书完整实现。作者能够先用“悬疑推进”“对白驱动”“轻润色”等预设获得不同内容。

预设负责“怎么写、关注什么、以什么粒度给建议”；知识库和世界书负责“依据哪些材料”；任务协议负责“交付哪些字段、如何校验和应用”。这三层在配置及界面中分别表达。

## 2. 本地调研结果

### 2.1 核实范围与依据

已读取 [v3.1 方案](<F:/deepseek workplace/novel-studio/docs/AI助手优化方案-恍然梦v3-酒馆式注入引擎.md>)，检查本地酒馆的 Prompt Manager、消息编排、预设管理、宏变量、正则扩展与世界书相关源码，并解析四个实际预设的结构统计。酒馆的 [package.json](<E:/SillyTavern/SillyTavern-1.15.0/SillyTavern-1.15.0/package.json:116>) 标明版本为 1.15.0。

本次以本地源码为证据，不将 v3 引用的第三方产品评价、模型质量和成本倍率作为已验证结论。没有调用真实模型，也没有执行这些社区预设或扩展脚本。

### 2.2 酒馆预设的实际机制

| 机制 | 本地实现 | 恍然梦适配建议 |
|---|---|---|
| 提示块与启用状态 | `prompts` 保存内容；`prompt_order` 保存块顺序与启用状态；不是遍历所有块直接拼接 | 使用稳定块 ID，按实际启用顺序编译，未启用块不占请求预算 |
| 动态占位槽 | `marker` 表示世界书、人物描述、历史、示例等动态内容 | 将现有章节锚点、知识卡、前情、大纲和文风档案定义为动态槽 |
| 相对与深度注入 | `injection_position=0/1`；深度注入作用于消息历史，另有 `injection_order` | 普通创作任务使用语义位置；问答可提供消息深度；正文段落位置另设独立字段 |
| 按生成类型触发 | `injection_trigger` 过滤 normal/continue 等生成类型 | 改为 `tasks`、`roles`、`stages`，分别筛选任务、专业角色和流程阶段 |
| 宏变量 | `setvar/addvar/getvar` 读写变量，并非简单字符串替换 | 原生使用选项组和受控模板；兼容导入可在单次编译内支持少量局部变量 |
| 采样与上下文 | 生成配置包含采样参数、上下文窗口和输出预留 | 参数单独合并与验证，不能只在预设 JSON 中保存却不进入请求 |
| 正则扩展 | 支持输入、输出、世界书、推理等位置，且区分显示与提示；预设可携带规则 | 恍然梦只处理允许的提案字段，默认标记，修改须可预览及复核 |
| 导入导出 | 完整 API 预设和 Prompt Manager 提示块导出是两种不同结构 | 导入器识别格式并出具兼容报告，不承诺原样执行全部社区预设 |

对应源码：[块字段](<E:/SillyTavern/SillyTavern-1.15.0/SillyTavern-1.15.0/public/scripts/PromptManager.js:80>)、[启用与触发](<E:/SillyTavern/SillyTavern-1.15.0/SillyTavern-1.15.0/public/scripts/PromptManager.js:1518>)、[宏展开](<E:/SillyTavern/SillyTavern-1.15.0/SillyTavern-1.15.0/public/scripts/PromptManager.js:1278>)、[消息深度注入](<E:/SillyTavern/SillyTavern-1.15.0/SillyTavern-1.15.0/public/scripts/openai.js:756>)、[输出预算](<E:/SillyTavern/SillyTavern-1.15.0/SillyTavern-1.15.0/public/scripts/openai.js:1458>)、[变量宏](<E:/SillyTavern/SillyTavern-1.15.0/SillyTavern-1.15.0/public/scripts/macros/definitions/variable-macros.js:7>)、[正则执行位置](<E:/SillyTavern/SillyTavern-1.15.0/SillyTavern-1.15.0/public/scripts/extensions/regex/engine.js:281>)、[提示块导出封装](<E:/SillyTavern/SillyTavern-1.15.0/SillyTavern-1.15.0/public/scripts/PromptManager.js:1795>)。

一个容易误读的字段是 `prompt_order.character_id`：当前 Chat Completion 配置采用 `strategy: 'global'` 和 `dummyId: 100001`，不是按 system/user/assistant 角色分别编排。导入不能把 100000、100001 当作恍然梦人物 ID。[配置依据](<E:/SillyTavern/SillyTavern-1.15.0/SillyTavern-1.15.0/public/scripts/openai.js:634>)

### 2.3 实际预设样本

以下统计为文件中的全部提示块，含禁用块；不等于单次请求全部注入。

| 本地文件 | 提示块 | `100001` 顺序条目 / 启用条目 | 预设内正则 | 主要宏依赖 |
|---|---:|---:|---:|---|
| 梦境空想家 Alpha 1.5（实验性） | 55 | 52 / 40 | 0 | user、getvar |
| 梁元 lunareclipse 1.9（Mj 二创版） | 109 | 88 / 43 | 13 | setvar 210 次、addvar 69 次、getvar 34 次 |
| 梁元 lunareclipse 2.0 | 88 | 58 / 38 | 12 | setvar 155 次、addvar 46 次、getvar 31 次 |
| 双人成行 v7.0—长风渡（DS 鲸鱼特化版） | 180 | 175 / 84 | 26 | setvar 170 次、getvar 78 次，另有扩展宏 |

文件位于 [本地 OpenAI Settings 目录](<E:/SillyTavern/SillyTavern-1.15.0/SillyTavern-1.15.0/data/default-user/OpenAI Settings>)。这些样本与 v3 中的“双人成行 V6.1”等样本版本不同，不能混用统计数字。

梁元及双人成行样本把正则保存在 `extensions.regex_scripts`；另外可见 SPreset、tavern_helper 等扩展字段。兼容层应按实际文件结构识别依赖，不能只支持文档提到的 RegexBinding 名称。

**含义：**只导入块文本，会丢失变量聚合、扩展功能和启用顺序。复杂预设应显示“部分兼容”，让作者选取可用的文风与创作规则。

## 3. 与当前恍然梦接线的关系

当前代码已经具备五类原始任务、知识库、审稿、文风分析、改稿和专业流程。AI 设置里的 `PRESETS` 只是服务商地址与默认模型快捷配置，不是创作预设。[设置定义](<F:/deepseek workplace/novel-studio/src/components/ai/AiSettings.vue:18>)

| 当前接点 | 现状 | 需要的变化 |
|---|---|---|
| `prompts.js` | `SYSTEM_BASE_V2`、`V2_PROMPTS`、`ROLE_PROMPTS` 是固定提示词 | 拆出受保护协议与可编辑任务策略，生成默认预设 |
| `agent.js` | 卡片任务及问答构造 messages；解析失败重试一次 | 使用统一编译结果；重试和工具轮次复用同一预设快照 |
| `professional.js` | 文风分析、审稿、改稿、复核自行构造消息 | 同样接入编译器，按照专业角色限制可变内容 |
| `knowledge.js` | 提取和聚合直接调用 provider，并未全部经过 `callModel` | 纳入统一预算与请求报告，但使用固定事实提取配置 |
| `context.js` | 有锚点、骨架、前情、知识库与旧检索 | 先保留现有能力，再提供结构化块出口，供预设排序 |
| `contracts.js` | `fitMessages` 按固定消息下标删除中间轮次 | 改为按块身份、保护属性和轮次组裁剪，否则新预设块可能被误删 |
| `provider.js` | 当前显式发送 temperature、max_tokens | 逐项加入受支持采样参数和实际生效报告 |
| store / repository | 已有作品隔离、配置广播、来源版本和检查点 | 增加预设绑定、版本快照、跨窗口事件及备份资产 |

依据：[固定任务提示](<F:/deepseek workplace/novel-studio/src/services/ai/prompts.js:158>)、[任务生成](<F:/deepseek workplace/novel-studio/src/services/ai/agent.js:81>)、[专业任务](<F:/deepseek workplace/novel-studio/src/services/ai/professional.js:79>)、[记忆提取调用](<F:/deepseek workplace/novel-studio/src/services/ai/knowledge.js:125>)、[预算裁剪](<F:/deepseek workplace/novel-studio/src/services/ai/contracts.js:46>)、[请求参数](<F:/deepseek workplace/novel-studio/src/services/ai/provider.js:140>)。

## 4. 预设怎样改变输出内容

### 4.1 作者可控制的内容

| 控制项 | 例子 | 生效范围 |
|---|---|---|
| 叙述方式 | 第三人称限知、第一人称、克制叙述 | 起笔示例、改稿替换文、小传；不改证据摘引 |
| 表达倾向 | 对白驱动、动作驱动、心理描写、意象描写 | 可生成的文学文本字段 |
| 节奏 | 紧凑、舒缓、适度留白、减少解释 | 起笔、改稿；大纲用相应叙事节拍描述 |
| 剧情关注 | 冲突升级、关系变化、伏笔推进、人物成长 | 线路取舍、大纲节点目的、建议重点 |
| 建议粒度 | 简洁说明、详细理由、风险说明优先 | summary、points、reason、answer 等说明字段 |
| 作者偏好 | 禁用套话、减少形容词、避免新增支线 | 任务指令和提案字段检查 |
| 文风参照 | 指定已确认文风档案 | 生成和改稿；样本发送仍遵循隐私策略 |
| 生成参数 | 温度、输出预留、可支持的 top_p | 当前任务实际模型调用 |

“对白加强”“节奏紧凑”是模型目标，不能保证精确占比；可在提案上给出可解释的检测提示。“线路数为 3”等结构范围可通过程序校验。界面需要区分内容偏好与硬性校验。

### 4.2 输出协议与内容预设分离

预设不能删除 JSON 字段、修改实体 ID、伪造证据、解除来源版本检查或直接修改作品。以下内容由程序固定：任务身份、作品隔离、隐私、截至章限制、工具协议、证据和输出契约。

允许设置 `outputPreferences`，但只能在当前契约范围内：例如 plot 线路数 2–4、起笔 200–400 字；outline 方案数 2–3、节点数 2–6。有效值必须同时进入任务提示和校验器，不能只改提示词。需要更长续写时，应增加独立任务或升级契约，而不是让预设突破现有卡片范围。

同一个悬疑预设可以要求“至少一条线路侧重误导或反转”，仍须保留线路策略差异；不能要求所有线路都用 twist，从而违反当前不同 strategy 的校验。[当前结构校验](<F:/deepseek workplace/novel-studio/src/services/ai/agent.js:44>)

### 4.3 建议内置预设

| 预设 | 适用任务 | 主要规则 |
|---|---|---|
| 恍然梦·默认 | 原有五任务 | 保持现有行为，迁移后可回归比较 |
| 悬疑推进 | plot / outline | 控制信息披露，优先未解冲突，反转必须有事实支撑 |
| 对白驱动 | plot / rewrite | 用人物互动推进，减少解释性旁白，保持各人物说话差异 |
| 人物弧线 | plot / outline / character | 优先动机、选择、代价及关系变化，标明事实与推断 |
| 设定考据 | lore / character | 约束、成本、例外和引用优先；文风强度较低 |
| 轻润色·保留原声 | rewrite | 优先修冗句与衔接，保留视角、事实和作者用词习惯 |
| 一致性审稿·严格 | consistency | 扩大核对维度；“严格”不降低证据要求，仍标疑似问题 |

知识提取、摘要、聚合和结果复核使用系统配置。创作预设的“更戏剧化”“多反转”不能进入事实记忆。审稿和文风分析仅接受相应任务的关注维度与表达选项。

## 5. 数据与编译设计

### 5.1 原生预设结构示例

以下为建议的数据契约，不是现有配置格式。

```json
{
  "schemaVersion": 1,
  "id": "plot-suspense-v1",
  "name": "悬疑推进",
  "revision": 1,
  "scope": "global",
  "workId": null,
  "tasks": ["plot", "outline"],
  "notes": "控制信息披露，保留人物与事实约束。",
  "blocks": [
    { "id": "task", "kind": "task", "enabled": true },
    { "id": "style", "kind": "custom", "enabled": true, "text": "保持{{work.title}}的叙事氛围。{{opt:focus}}" },
    { "id": "knowledge", "kind": "knowledge", "enabled": true },
    { "id": "anchor", "kind": "anchor", "enabled": true },
    { "id": "author-note", "kind": "authorNote", "enabled": true },
    { "id": "check", "kind": "checklist", "enabled": true },
    { "id": "schema", "kind": "schema", "enabled": true }
  ],
  "options": {
    "groups": [
      {
        "id": "focus",
        "mode": "radio",
        "default": "conflict",
        "items": [
          { "id": "conflict", "label": "冲突推进", "text": "优先推进已有未解冲突。" },
          { "id": "relationship", "label": "关系变化", "text": "优先通过选择与代价推进人物关系。" }
        ]
      }
    ]
  },
  "outputPreferences": { "plot": { "lineCount": 3, "openingChars": [200, 400] } },
  "sampling": { "temperature": 0.8, "maxTokens": 2048 },
  "bindings": { "styleProfileRef": null, "personaRef": null, "loreBookRefs": [] },
  "engine": { "historyChapters": 3, "recursionSteps": 0 },
  "cleaners": { "enabled": true, "mode": "flag", "rules": [] }
}
```

块定义与排序可按任务覆盖；适用两个任务的预设，不能把 plot 数量要求直接注入 outline。动态槽缺失则为空；没有启用预设时使用系统默认配置。

块启用条件使用明确的 `when: {groupId, equals}`，避免 v3 中 `enabled='option:<groupId>'` 无法区分单选组具体选项的问题。原生模板支持固定清单，例如 `{{work.title}}`、`{{chapter.title}}`、`{{opt:focus}}`；缺失变量报告，不递归解释展开后的作品文本。

### 5.2 存储与绑定

当前数据库已经是 [Dexie v9](<F:/deepseek workplace/novel-studio/src/db/database.js:155>)。应追加新迁移，例如 v10；不再修改 v8 的已发布结构。

建议新增 `aipresets`（全局模板及作品专用模板）、`aipresetbindings`（作品与任务默认绑定）、`aiauthornotes`（作品/章节作者注）。世界书、人格卡另加自己的资产表，不塞进同一个大型 appconfig JSON。表索引依据实际查询设计，所有作品专用查询带 workId。

预设选择优先级：本次显式选择 → 作品任务绑定 → 应用任务默认 → 系统内置默认。选项值由“预设默认 → 作品保存值 → 本次覆盖”逐层解析。完整结果在启动时冻结。

本次指令可以覆盖普通内容偏好；与明确选择的视角、文风档案等互斥时，在发送预览中提示并让作者选择，不能静默混合两个互相矛盾的要求。系统契约与隐私限制始终执行。采样参数独立按“全局 → 当前角色模型配置 → 预设显式值 → 本次显式值”合并，之后执行模型能力与预算限制。

预设导出不包含 API 密钥、地址、凭据或执行代码。对人格/文风/世界书的引用需使用可移植引用，导入时重映射或提示缺失；引用缺失不可错误地指向另一个作品的同 ID 资产。

### 5.3 单次编译流程

```mermaid
flowchart LR
  A[任务与作品快照] --> B[解析预设和选项]
  B --> C[获取上下文与动态槽]
  C --> D[隐私及截至章过滤]
  D --> E[模板展开与块装配]
  E --> F[完整预算与裁剪报告]
  F --> G[模型调用]
  G --> H[解析与结构证据校验]
  H --> I[提案检查及可选修改]
  I --> J[最终校验与事实复核]
  J --> K[待确认卡片]
```

编译器内部保留块 ID、来源、任务、角色、保护属性、预算优先级和轮次组。对外返回 `{messages, generationOptions, report, dropped, tokens, presetSnapshot}`；不要只返回一个长字符串，否则角色、排序和裁剪理由无法验证。

固定系统协议放在 system 层。可编辑的作者指令按配置进入受控指令区；小说正文、知识卡、范文等作为来源明确的数据区，不能因动态槽被拖动而升级为系统指令。首版可编译为一个 system 和一个 user；以后展开多条消息时仍保留块身份。

预留输出与协议预算后，再分配上下文预算。任务锚点和关键证据优先保留；可选块按保留优先级裁剪，整条知识卡或整个块移除。显示顺序 `order` 与预算保留优先级 `priority` 分开。世界书、人物和知识库的分桶比例只作用于可选上下文，不作用于全部请求预算。

聊天工具循环在每轮重新预算，保留原问题、系统协议、当前工具请求及对应结果。依轮次组移除旧交换，不能继续用固定下标 `splice(2, ...)`。工具结果和历史内容不做模板求值。

### 5.4 运行快照与多阶段流程

每次任务记录 `presetId/revision/hash`、选项值、文风/人格引用版本、作者注哈希、契约版本、实际采样参数及编译报告。重试复用快照，只增加修复指令；修改预设影响下一次新任务。

问答、批量审稿和工作流都复用这一快照。检查点的 scopeKey 加入 presetHash、有效选项、文风版本和作者注版本，避免暂停后更换预设却复用旧完成记录。阶段可绑定专用预设；复核阶段保持固定事实审查规则。

保存、删除、绑定和导入通过 repository/store 事务完成；广播 `ai-presets-changed` 或在现有 `ai-settings-changed` 事件中带资产范围。冲突写入检查 revision；其他窗口刷新后，新任务使用新版本，正在运行的任务继续原快照。

新增表明确加入 [备份清单](<F:/deepseek workplace/novel-studio/src/db/repo.js:169>)；旧备份没有预设表时恢复默认。删除预设后绑定回落默认，历史记录仍保留生成时快照。

## 6. 酒馆导入与边界

### 6.1 首期识别两种文件

1. **完整 Chat Completion 预设**：顶层包含 prompts、prompt_order 和采样参数；prompt_order 通常为多个 `{character_id, order}` 对象。
2. **Prompt Manager 导出**：`{version,type,data:{prompts,prompt_order}}`；内部 prompt_order 可直接为顺序数组，没有完整采样配置。

导入步骤：识别格式 → 选择有效顺序列表 → 解析块及宏依赖 → 映射动态槽 → 参数适配 → 展示报告 → 保存草稿预设。内置协议不允许被同名 ID 覆盖，导入块使用独立命名空间。

| 酒馆字段/槽 | 建议转换 |
|---|---|
| name/content/identifier | 名称、文本、外部来源 ID，生成独立本地 ID |
| order[].enabled | 实际启用状态；不以 prompts 内 enabled 替代顺序条目 |
| worldInfoBefore / worldInfoAfter | 世界书槽位；未实现世界书时提示缺失并输出空 |
| charDescription / charPersonality | 人物档案或人格卡候选，要求作者选择用途 |
| personaDescription | 作者身份说明候选；不能自动假定等于 AI 写作人格 |
| dialogueExamples | 参考样本候选，按样本隐私规则处理 |
| chatHistory | 任务前情；问答场景才映射真实会话历史 |
| scenario | 创作背景说明候选，不登记为已发生事实 |
| main / jailbreak 等自定义指令 | 可编辑候选文本，不能替换系统协议或工具定义 |
| assistant 角色提示 | 不直接导入为既有模型回答；可转参考样本或停用待适配 |
| injection_trigger | 转换报告中列出；由作者映射恍然梦任务与阶段 |
| temperature/top_p/openai_max_tokens | 转为对应参数，经模型能力和全局上限验证 |
| top_k/top_a/惩罚参数 | 仅兼容模型明确支持时启用，否则提示未生效 |
| extensions.regex_scripts | 转为禁用的提案检查草稿，逐条选择字段作用域 |
| 扩展脚本、联网、function_calling 开关 | 保留依赖说明，不执行，也不更改工具权限 |

### 6.2 宏兼容采用两档

**原生档：**选项组与模板，无跨轮次可变状态。**导入档：**可选支持单次编译内的 setvar/getvar/addvar，只处理可解析的字面量与局部变量，每次请求从空环境求值，限定宏长度、数量和展开尺寸，保存求值轨迹。

不支持的宏、嵌套表达式、扩展模板和外部脚本应列出依赖，并停用相关块或阻止该草稿启用，不能直接删除宏后声称“完全兼容”。第一阶段不需要实现导入档变量解释器；作者可以手动把选中功能改为原生选项。

兼容报告显示：原块数、选中顺序启用数、成功映射数、缺失槽、未知宏、停用块、未支持参数和原预设角色边界。默认保留导入文本作为草稿，作者编辑成任务制要求后再启用。

## 7. v3.1 建议修订项

1. **预设先行。** 将预设编辑器和编译器从世界书 W1 的硬依赖中拆出。已有知识库与上下文足以支持首版预设。
2. **覆盖新增任务。** 当前已有 consistency/style/rewrite/verify/knowledge 等角色，不能只改四能力与问答；对事实角色设置固定配置。
3. **修正深度语义。** 酒馆深度是消息深度；工坊若提供正文段落注入，命名为 paragraphOffset，并显示来源段落锚点。首版作者注优先支持“任务前/锚点后/收尾”，避免段落漂移。
4. **区分末尾位置和约束优先级。** phi 可作收尾提醒，位置不能保证模型更高权限。硬规则由系统协议和程序校验执行；phi 不承担唯一保护职责。
5. **把 CoT 块改为检查清单。** 不要求模型输出长篇思考或 HTML 注释，只要求按现有 evidence/impact/consistency 等字段提供简明依据。原生支持独立推理流的模型可另行处理；可应用结果仍严格解析 JSON。当前 parseObject 仅去除代码围栏后 JSON.parse，不能剥离任意思考前缀。[解析依据](<F:/deepseek workplace/novel-studio/src/services/ai/contracts.js:31>) “成本翻倍”和“默认打开提高质量”应通过测量决定。
6. **清洗后再次校验。** 默认 flag；replace 提供前后对照。不得修改 original、evidence.quote、实体名/ID、枚举、来源哈希或整段序列化 JSON。改稿 replacement 变化后，事实复核必须检查最终待应用文本。破折号变逗号并非普遍安全规则，建议默认只标记。
7. **状态快照显示可信度。** 程序渲染不会额外消耗模型调用，但状态来自可能缺失、过期或提取错误的知识卡，应显示覆盖范围、截至章、来源和未知项。人名被扫描命中不等于人物在场；没有证据的具体日期或伤势不自动补全。
8. **重排预算实现。** 顺序与保留优先级分离，完整请求统一预算；避免新提示块被固定下标裁掉。常驻世界书条目同样受预算上限限制。
9. **补齐新资产的隐私过滤。** 人格样本、作者注、引用正文的世界书和导入示例记录来源类型及敏感属性；隐私模式禁用原文资产及展开路径。手写块可粘入任意内容，应明确显示实际发送文本，不能仅靠字段名过滤承诺绝无原文泄露。
10. **迁移与存储更新。** 从当前 v9 追加迁移；章节作者注按 workId/chapterId 存储；预设作为版本化资产持久化，支持独立导出、备份与多窗口同步。

正则测试与执行建议放到可终止的 Web Worker，限制文本长度、规则数和耗时，防止复杂社区规则阻塞 UI；失败规则停用并报告，不影响原始提案保留。

## 8. 界面与作者操作

任务入口增加“创作预设”选择、当前选项、临时覆盖和“发送预览”。选择只切换预设，不重设 API 地址，也不立即调用模型。

预设编辑器建议提供四个区域：

- **基本与输出偏好：**名称、说明、适用任务、视角、节奏、建议粒度、文风引用。
- **提示块与选项：**拖动顺序、启停、任务适用范围、单选/开关组；固定协议显示锁定。
- **参数与检查：**继承/覆盖采样、预算、提案规则测试与修改预览。
- **调试与导入：**当前锚点下的真实 messages、展开后选项、来源范围、实际参数、裁剪理由与兼容报告。

正常用法：选择“对白驱动” → 切换“克制心理描写”选项 → 选择已确认文风档案 → 写本章作者注 → 预览输入范围 → 生成现有卡片 → 逐项接受。卡片显示预设名称与版本，可用同一锚点切换预设重新生成作对照。

作者注区分预设通用规则、作品要求和章节节拍。章节要求例如“本章完成林昭与师父的第一次公开争执”；这些要求作为创作计划呈现，不作为知识库事实。

## 9. 实施阶段与代码落点

| 阶段 | 交付 | 通过条件 |
|---|---|---|
| P0 原生预设 | 资产/绑定、默认迁移、编译器、选项、任务入口选择、预览、五任务接线 | 默认行为回归；切换选项真正改变请求；JSON 和应用协议保持可用 |
| P1 专业任务 | 审稿/文风/改稿/工作流接入、运行快照、检查点、多窗口与备份 | 暂停恢复一致；事实角色不受创作预设污染；版本冲突可解释 |
| P2 世界书与卡 | 接 v3 世界书、人物卡、人格卡、作者注、状态快照、激活报告 | 历史截点、来源有效性、完整预算及缺失降级正确 |
| P3 酒馆兼容 | 两种导入格式、槽位映射、兼容报告、可选局部宏适配 | 样本导入不丢启用顺序；未知依赖报告完整；不执行扩展脚本 |
| P4 提案检查 | 字段级 flag/replace、前后对照、最终复核与规则超时 | 原文和证据不变；最终待应用文本通过原有校验与事实复核 |

P0–P1 是“通过预设调整 Agent 输出内容”的首个完整可用交付。P2–P4 可分批加入，其中基础 flag 检查可以提前，自动替换后置。

建议新增：`preset-schema.js`（资产校验）、`preset-compiler.js`（编译/预算/报告）、`preset-import.js`（酒馆转换）、`preset-defaults.js`（内置模板）、`cleaners.js`（字段检查）、`PresetPanel.vue`（编辑器）。世界书的 `injection.js` 只负责激活并返回带来源的块，编译器统一装配，避免两个模块同时控制消息顺序。

修改：`prompts.js`、`agent.js`、`professional.js`、`knowledge.js`、`context.js`、`contracts.js`、`provider.js`、AI/work store、数据库与 repository、备份、runtime 事件、现有卡片及任务面板。请求出站、格式重试、工具轮次和后台角色统一使用明确的编译调用类型；不在底层 chatStream 上无条件追加创作提示。

## 10. 验收与内容效果评估

工程验收使用现有隔离 mock/CDP 验收体系扩展，至少包含：

1. 默认预设迁移前后请求和卡片契约对照；plot/outline/lore/character/chat 以及专业任务完整回归。
2. 选项互斥、任务过滤、作者注、模板缺失、块重排和禁用效果；预览与实际出站 messages 一致。
3. 多块和工具结果超预算时，协议、原问题、关键证据不误删，报告与实际裁剪一致。
4. 预设长文本、过量宏、未知宏、无效参数和规则超时；不能无限展开或阻塞 UI。
5. 捕获真实 mock 出站请求，覆盖隐私下范文、人格 sample、作者注、世界书摘引、历史及工具；截至章不能召回后文事实。
6. 取消、作品切换、迟到返回、重复应用、目标变化与多窗口锁沿用现有回归。
7. 运行期间修改预设，重试仍用原快照；暂停恢复检查版本；另一个窗口修改预设的写入冲突可处理。
8. 原生格式往返、完整酒馆格式和 Prompt Manager 格式导入、多个 prompt_order 分支、未匹配 identifier、重复 ID、未知扩展及缺失资产。
9. 提案规则只修改允许字段；证据与 original 字节不变；修改后的 200–400 字范围和事实复核有效；修改失败保留原提案。
10. 新旧备份、作品绑定、删除回落、引用重映射、构建检查，以及涉及的编辑器/双链/批注/大纲回归。

内容效果另设固定评测章节：同一锚点、同一模型、同一任务，用默认、悬疑和对白预设分别生成，由作者评估创作倾向是否明显变化、事实是否保持、人物口吻是否稳定、方案差异是否充分。记录 JSON 有效率、引用有效率、修复重试次数、实际用量和人工接受率；不以模型自评替代人工验收。

**首版完成标准：**作者可以创建并保存预设，按任务绑定，切换选项后看到真实输入变化，生成结构正确且可按现有机制应用的卡片；默认预设可随时恢复。社区预设兼容度、全量世界书和内容质量增强分别验收。
