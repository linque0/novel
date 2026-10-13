# AI 助手「恍然梦」v3 优化方案：酒馆式注入引擎（世界书 + 卡 + 预设）

> 定位版本建议：v1.4.0（v1.3.0 为 v2 方案的作品知识库与提示词 v2）
> 起草日期：2026-10-12 ｜ 修订 v3.1：2026-10-12（依据四个酒馆实战预设/角色卡样本解剖修订，新增异同分析与选项系统/CoT/提案清洗器三项特性）
> 修订 v3.2：2026-10-12（依据《恍然梦Agent能力评估.md》体检结论，新增第十三章「Agent 能力缺口补全」：规划器、反思闭环、统一循环、工作记忆持久化、高优缺陷修复清单）
> 修订 v3.3：2026-10-12（行业调研修订：检索 2026 主流 agent 框架/记忆/规划/评估工程，新增第十四章「行业成熟 Agent 项目参考与架构校准」——运行轨迹、质量回归集、hooks 规范化、子代理规范、上下文工程、双时态记忆等可迁移模式；只借鉴模式不引入框架依赖）
> 关联文档：docs/AI助手优化方案-恍然梦v2.md（作品知识库 aikb 与提示词 v2 是本文档的演进基础）、docs/AI助手接入方案.md（v1 五能力基线）、docs/恍然梦Agent能力评估.md（v3.2 新增缺口的评估依据）

## 一、调研依据（2026-10 联网调研 + 实战样本解剖）

### 1.1 联网调研结论

**1. SillyTavern 世界书（World Info / Lorebook）——激活式动态注入引擎**
- 条目 = 关键词（keys，支持正则）+ 内容（content）；仅当关键词命中**扫描窗口**（最近 N 条消息，Scan Depth）才注入提示词——「动态字典」。
- 二级键逻辑四种：AND_ANY / AND_ALL / NOT_ANY / NOT_ALL；主键命中是前提。
- 三种策略：🔵 Constant（常驻，无需关键词）/ 🟢 关键词触发 / 🔗 Vectorized（嵌入相似度激活，复用 Vector Storage）。
- 注入位置：角色定义前/后（Before/After Char Defs）、作者注顶/底、**@D 指定深度**（Depth 0 = 提示词底部）；插入位置决定对输出的影响强度。
- 插入顺序 Insertion Order：数值越大越靠近上下文末尾、影响越大；token 预算耗尽即停止激活，优先级 = 常量条目最先 → Order 大者先 → 直接命中关键词的条目优先于经递归命中的条目。
- 递归扫描：已激活条目的 content 可再触发其他条目（Max Recursion Steps 控制步数；条目可标 Non-recursable / Prevent further recursion / Delay until recursion）。
- 其他：触发概率 Probability（100=必插）、包含组、定时效果（sticky/cooldown/delay）、Automation ID、Outlets——**多为对话场景特性**。
- 全词匹配（Match Whole Words）默认开，但**对中文等无空格分词语言有害，官方建议关闭**。
- 来源：[SillyTavern 官方文档 World Info](https://docs.sillytavern.app/usage/core-concepts/worldinfo/)（2026 现行版）。

**2. 角色卡 CCv3 规范（chara_card_v3）——卡是「AI 扮演的人格」，不只是数据**
- data 字段：name / nickname / description / personality / scenario / first_mes / **mes_example**（语气与行为示例）/ creator_notes / system_prompt / post_history_instructions / alternate_greetings / tags / creator / character_version / assets。
- 嵌入 **character_book**（角色专属世界书）：scan_depth / token_budget / recursive_scanning + entries（keys / secondary_keys / selective / constant / case_sensitive / position / insertion_order / priority / enabled / use_regex）。
- 来源：[kwaroran/character-card-spec-v3 SPEC_V3.md](https://github.com/kwaroran/character-card-spec-v3/blob/main/SPEC_V3.md)。

**3. 预设（Prompt Manager）——完整生成配置，远不止几段提示词**
- prompt 分块有序管理：Main Prompt（System）、Auxiliary、**Post-History Instructions（消息历史之后的末尾指令，模型通常赋予最高优先级）**等槽位，顺序可编排（prompt_order）。
- Author's Note（作者注）：插入消息历史末尾附近指定深度，克服长历史对主提示的「稀释」效应。
- 预设 = 提示块编排 + 采样参数 + 上下文模板的完整可保存/分享单元；社区预设是复杂的提示词工程产物。
- 来源：[SillyTavern 官方文档 Prompts](https://docs.sillytavern.app/usage/prompts/)。

**4. Data Bank（RAG）**：文件分块 → 嵌入 → 相似度检索注入（预算内），与关键词世界书互补。来源：[SillyTavern Data Bank](https://docs.sillytavern.app/usage/core-concepts/databank/)（对应 v2 方案已规划的 embeddings）。

**5. NovelCrafter Codex（小说领域对标）**：结构化故事圣经按关键词自动注入，2026 年对比测评中被公认为小说工具中最成熟的「世界书」实现。来源：[Sudowrite vs Novelcrafter 2026 对比](https://app.blurbbio.com/Blog/Organization)。

### 1.2 实战样本解剖（v3.1 新增；样本为本地酒馆社区预设/角色卡实文件）

| 样本 | 类型/规模 | 关键发现 |
|---|---|---|
| 双人成行 V6.1（DS 专用） | 预设，**199 个块** | ①**开关即注入**：每个功能开关块用 `{{setvar::名::内容}}` 写变量，CoT/协议块用 `{{getvar::名}}` 聚合引用——变量是预设的神经系统；②「🔪大清洗」条目先重置全部变量再按开关重建（状态清零机制）；③**八段式思维链**（壹硬性边界→贰场景扫描→叁规则召回&推演→肆导演台→伍合理性审查→陆数值&变量→柒杂务→捌输出预检），强制模型逐条核对世界书条目与规则；④「🗡锋芒未露」：要求 AI 在每个正文段落前输出 HTML 注释自我复述写作约束——对抗长上下文稀释的自检技巧；⑤快捷回复 = `<branches>` 输出 4 条模拟用户下一步的文本选项，再用正则脚本按钮化；⑥预设内置「📑使用指南」块（文档即条目，默认禁用不进上下文） |
| 梁元 lunareclipse 1.9 | 预设 + 随带正则脚本包 | ①预设可携带 **RegexBinding 正则脚本**：输入侧（用户输入包裹 `<reader-response>` 标签）、输出清洗侧（**杀八股**：「否后肯」句式、「指节/不易察觉」类八股词、破折号替换等，命中即删除/替换）、显示美化侧（思维链/选项渲染成 HTML 折叠面板与可点按钮）；②prompt_order 按角色分别编排块序；③function_calling / web_search 等能力开关随预设捆绑 |
| 梦境空想家 Alpha 1.5 | 预设 | ①**marker 槽位显式化**：worldInfoBefore/After、charDescription、charPersonality、scenario、dialogueExamples、chatHistory、personaDescription 等占位符作为块进入 prompt_order 统一排序——动态内容与静态指令同场编排；②「扮演边界」规则族（人称视角三选一、防夺舍-不做决定/不说话、认知隔离）——全部围绕 `<user>`/`<char>` 的交互边界；③同预设内互斥文风条目（沉浸长文 vs 网文短句，名字即标注「二选一」）+ 采样参数（temperature/top_k/penalty）捆绑 |
| 命定之诗与黄昏之歌 v4.2 | chara_card_v3 卡（PNG 内嵌，3.5MB） | ①**「卡即世界」**：description/personality/scenario 全空，整个世界装进 **634 条内嵌 character_book**（96 常驻 + 538 关键词触发）；②**634/634 条全部 use_regex=true**、251 条带二级键（专名 + 所属区域的精准激活模式，如「阿兹哈尔」+「萨赫拉联邦」）；③常驻「全局数据表」条目（3566 字 Markdown 表格：主角当前位置/时间/上轮时间/NPC 状态档案）**每轮由 AI 重写**——用 prompt 模拟数据库；④内嵌 JavaScript 脚本条目（31k 字 getLocalVar/setLocalVar，已禁用）；⑤first_mes=「【首页】」、6 条 alternate_greetings = 自定义开局菜单 |

## 二、酒馆 ↔ 工坊：异同分析（v3.1 新增）

### 2.1 相同点（可移植的工程同构）

同为**上下文工程**：提示分块有序装配（槽位 + prompt_order ↔ 预设块序列）；关键词触发注入（世界书机制同源）；二级键逻辑；token 预算控制与优先级截断；动态内容槽位化；预设可保存/分享/导入导出；以开关换行为（选项块）。

### 2.2 不同点（范式差异）

| 维度 | 酒馆 SillyTavern | 小说工坊 |
|---|---|---|
| 交互范式 | **回合制对话**：用户扮演 `<user>`、AI 扮演 char/叙事者；一切规则围绕 user/char 交互边界（认知隔离/防夺舍/防抢话/上帝模式） | **任务制创作**：作者即上帝，无扮演关系；入口是四能力任务而非对话轮 |
| 状态载体 | 聊天消息流，每轮回复即状态推进 | 持久化工程数据：章节/卷/实体/知识库，有数据库、版本快照、可编辑 |
| 动态状态维护 | AI 每轮重写「全局数据表」条目 + 正则回写（**prompt 模拟数据库**） | **程序化渲染状态快照**（当前章/在场人物/活跃伏笔来自真数据库）——工坊的根本优势 |
| 前端呈现 | AI 输出 HTML 模拟 UI（状态栏/载体生成法则/样式美化）+ 正则美化 | 原生卡片组件（BranchCard/DiffCard）与面板，**prompt 只管内容** |
| 剧情选项 | `<branches>` 文本选项 + 正则按钮化 | BranchCard 结构化卡片（strategy/impact/consistency），可直接落大纲/正文 |
| 输出清洗 | 正则脚本改写 AI 输出（杀八股，含删除句式） | 提案清洗器只作用于 AI 提案文本，**永不碰用户已存正文**（红线） |
| 安全边界 | 卡内可嵌 JS 脚本条目（图灵完备） | 条目/预设**永不执行代码** |
| 记忆体系 | 消息历史 + 摘要扩展 + 世界书 + Vector Storage | aisum 章节摘要 + aikb 知识卡 + 世界书三件套 |
| 内容分发 | PNG 卡单文件（3.5MB 实例）、世界书 JSON | 结构化分表存储 + 预设/清洗规则 JSON 导入导出 |
| 开场白 | first_mes + alternate_greetings（开局菜单） | 无对应概念（作品从第一章开始），不移植 |

### 2.3 移植结论

1. **不移植**：酒馆用 hack 模拟的（AI 画前端、branches 按钮化、全局数据表由 AI 重写）——工坊用原生能力（真 UI、真数据库）实现；依赖对话循环存在的（扮演边界族、回合制特性、开场白）；危险能力（卡内脚本）。
2. **移植（本次 v3.1 纳入）**：变量开关思想 → **预设选项/开关系统**（受控子集）；CoT 脚手架 → **CoT 块**（任务定制，可开关）；输出清洗正则 → **提案清洗器**（结构化、带红线）；槽位格式模板 → 块包装格式；预设内文档 → `preset.notes`。
3. **已有等价物**（无需新增）：锋芒未露的自检思想 → v2 提示词的 consistency 自检字段与 CoT 审查步；动态状态表 → 状态快照渲染（见 7.4）。

## 三、核心架构：三层资产 + 一个引擎

### 3.1 概念映射

| SillyTavern | 小说工坊 v3 | 说明 |
|---|---|---|
| World Info 条目（lorebook） | 世界书条目（全书书 + 卡专属子书） | 关键词激活式事实注入；三源：幕布绑定 / 知识卡自动 / 自由手写 |
| 角色卡（CCv3） | **卡**（两族） | ①**人物卡**：从人物数据 + 状态卡**渲染**的注入卡（数据驱动）；②**人格卡**：AI 写作人格（ST 角色卡的本义） |
| character_book（卡内嵌世界书） | 卡专属子书 | 挂在人物卡/人格卡下的世界书 |
| Prompt Manager 预设 | **预设** | 块编排 + 选项开关 + CoT + 清洗器 + 采样参数 + 引擎设置 + 作者注 |
| Post-History Instructions | phi 块（末尾硬约束） | 置于消息末尾，模型优先级最高 |
| Author's Note（@depth） | 作者注（全局 + 章节级） | 全局在预设内编辑；章节级按深度注入正文上下文 |
| Scan Depth | 扫描窗口 | 锚点文本 + 补充指令 + 近章摘要/事件卡 + 大纲祖先标题 + 作者注 |
| Data Bank / Vector Storage | v2 知识库 aikb + embeddings | 知识卡既是世界书条目源，也是向量激活源 |
| setvar/getvar 变量宏 | 预设选项/开关系统（受控子集） | 6.4 |
| 杀八股正则脚本 | 提案清洗器 | 6.6 |

### 3.2 架构图

```
任务入口（正文发展 / 大纲规划 / 设定扩展 / 人物丰富 / 自由问答）
   ↓ 每任务用一套预设执行（可绑定任务或通用，可另存/导入导出）
┌────────────────── 预设层 Preset ──────────────────┐
│ 块编排（槽位有序序列）+ 选项开关组 + CoT + 提案清洗器     │   ← ST Prompt Manager（工程化）
│ + 采样参数 + 注入引擎设置 + 作者注                      │
└──────────────────────────────────────────────────┘
   ↓ 编排时引用
┌─────── 卡层 Card ───────┐   ┌──────── 世界书层 Lore ────────┐
│ 人物卡（数据驱动渲染）        │   │ 全书世界书 + 卡专属子书            │
│ 人格卡（AI 写作人格，手写）    │   │ 条目三源：幕布 / 知识卡 / 自由      │
└─────────────────────────┘   └───────────────────────────────┘
   ↓
┌──────────── 激活引擎 injection.js ────────────────┐
│ 扫描窗口 → 关键词/向量匹配 → 递归 → 预算分桶 → 选项求值    │
│ → 按预设槽位装配（含状态快照） → 激活报告                  │
└──────────────────────────────────────────────────┘
```

**两条关键认知修正**（本方案设计前提）：
1. **预设 ≠ 四能力提示词**：四能力是任务入口；预设是「任务如何被执行」的完整配置（提示块编排 + 选项 + CoT + 清洗器 + 采样 + 引擎参数 + 作者注），可脱离任务独立保存与分享——对应社区预设生态。
2. **角色卡 ≠ 人物**：人物是作品数据实体；人物卡是从人物数据（档案 + 状态卡 + 词条）**渲染**出的注入卡；ST 角色卡的真正本义（AI 以何种身份、口吻、风格输出）由独立的**人格卡**承载。

## 四、世界书层（Lore）

### 4.1 数据模型（Dexie v8，与 v2 的 aikb 一次规划）

```js
// 书（对应 ST 的 lorebook 文件）
ailorebook: 'id, workId, name, [workId+name]'
// 条目
ailore: 'id, workId, bookId, [workId+bookId], [workId+srcType+srcId], updatedAt'
```

`ailorebook`：`id, workId, name, description, settings{scanDepth, budget, recursive, recursionSteps, caseSensitive, wholeWord=false}, createdAt/updatedAt/deletedAt`

`ailore`（条目）字段：

| 字段 | 说明 |
|---|---|
| `bookId` | 所属书 |
| `keys[]` | 主关键词（`useRegex=true` 时按正则匹配） |
| `secondaryKeys[]` / `keyLogic` | 二级键与逻辑：`AND_ANY` / `AND_ALL` / `NOT_ANY` / `NOT_ALL` |
| `content` | 激活时注入的文本（应是独立完整的描述，标题/关键词不进上下文——ST 同款纪律） |
| `constant` | true = 常驻注入，无视关键词 |
| `enabled` | 开关 |
| `position` | `before_anchor`（锚点块前）/ `after_anchor`（锚点块后）/ `depth@N`（插到正文上下文第 N 段后） |
| `order` | 插入顺序，大者靠近末尾、影响越大 |
| `priority` | 超预算时的保留优先级 |
| `probability` | 触发概率（默认 100） |
| `comment` | 备注（不进上下文） |
| `srcType` / `srcId` | 来源：`mubu:<节点id>` / `aikb:<卡id>` / `free` |
| `auto` | 知识卡自动登记的条目标记（用户可关闭/删除，重建知识库时按标记刷新） |

### 4.2 条目三源

1. **幕布绑定**（主源）：设定树节点 → 世界书条目。content 默认引用/快照节点文本（提供「同步自设定」按钮）；**一键生成 keys**：本地提取（节点文本中的专名、书名号内容、关联人物名/别名）+ 可选调用模型建议（提示词见 7.5）。
2. **知识卡自动**：v2 `knowledge.js` 提取的 event / foreshadow / charstate / loreterm 卡自动登记为条目（keys = 实体名 + 卡 keywords），`auto=true`；默认「伏笔卡」与「人物状态卡」开启、事件卡关闭（避免噪音），用户可批量调整。知识库重建时自动条目刷新，用户对其的修改（如手工补 keys）在卡片未失效时保留。
3. **自由条目**：完全手写，不挂设定树与知识库——社区「酒馆式」玩法的核心自由度。

默认建「全书世界书」一本；人物卡/人格卡可挂子书（bookId 指向子书）。多书合并：所有激活条目按 `order` 均匀排序（ST 默认 Sorted Evenly）。

### 4.3 实现范围（精简核心集，已确认）与实战校准（v3.1）

**实现**：正则 keys、二级键四逻辑、constant/触发策略、@深度插入、order/priority、分桶 token 预算、递归扫描（步数可配，默认 0；条目可标「不可被递归激活」）、触发概率、**激活报告**。
**舍弃**（对话场景特性）：定时效果、包含组与组权重、outlet 宏、Automation ID、每条目 character filter。
**实战校准**（来自命定之诗 634 条实卡）：
- 正则 keys 为**一等公民**（实卡 634/634 全量正则），`useRegex` 实现优先级提升，正则解析失败按纯文本兜底并标注；
- 二级键实战模式 =「专名 + 所属区域」：地理/组织/势力类条目用上级归属做二级键（AND_ANY）避免同名误激活——keys 生成提示词与条目编辑 UI 给出该模式建议；
- 中文适配：`wholeWord` 默认关（ST 官方明确对中文有害）；匹配不依赖分词，直接子串/正则扫描。

### 4.4 世界书 UI（AI 面板新增「世界书」tab）

- 书列表（新建/重命名/删除，子书标注挂靠卡）；
- 条目编辑表：keys、逻辑、常驻、位置、order、优先级、概率、开关、来源标记；幕布绑定条目显示「同步自设定」；
- 「一键生成 keys」按钮（单条目/批量）；
- **激活测试器**：粘贴一段文本（如某章开头）→ 本地试运行引擎 → 高亮显示激活条目与命中关键词、预算占用——对齐 ST 的调试体验，也是排查「为什么没注入」的主要工具；
- 知识库联动区：auto 条目批量开关（事件/伏笔/状态/词条四类）。

## 五、卡层（Card）

### 5.1 数据模型

```js
aicards: 'id, workId, kind, [workId+kind], [workId+refId]'
```

字段：`id, workId, kind('character'|'persona'), refId(人物id|null), title, body(JSON), bookId(子书|null), enabled, createdAt/updatedAt/deletedAt`。`characters` 表新增 `voice` 等非索引字段（Dexie 非索引字段免迁移，直接写入行对象）。

### 5.2 人物卡（数据驱动渲染，非手写）

| 卡字段 | 数据来源 |
|---|---|
| 卡头（名/角色/别名/标签） | characters 行 |
| description 描述 | fields 汇总 + content 小传 |
| **当前状态** | 该人物最新 charstate 知识卡（截至章 + 变化 + 依据） |
| 语气样本 voice | characters.voice（新字段；「AI 生成建议 → 人工编辑」，从其出场对白摘取或模型撰写） |
| 关系 | relations（对端 + 关系名） |
| 子书 | 挂靠的 ailore 子书（该人物相关条目） |

- **注入时机**：扫描窗口命中人名/别名（中文子串匹配）；任务锚点直接指定时（人物丰富任务）必注入；预算内按 order 取 Top-N 人物（默认 6）。
- **写入联动**：人物丰富卡片的建议可「落为人物卡字段 / voice / 子书条目」（仍走提案制）。
- 远期可选：CCv3 JSON 导入/导出（人物卡 ↔ 酒馆生态互通）。

### 5.3 人格卡（ST 角色卡的本义：AI 写作人格）

手写编辑的注入卡，定义恍然梦在生成类任务中「以何种身份、口吻、风格写作」：

- 模板字段：`name（人格名）/ viewpoint（叙述视角与人称）/ style（文风描述）/ sample（文风样本，可摘抄本人正文段落）/ rules（叙事规范：show don't tell、节奏偏好等）/ taboos（禁忌与偏好）`；
- 可建多张（如「冷峻第三人称」「轻快第一人称」「网文快节奏」），预设的人格槽位选用其一，或任务发起时临时指定；
- 正文发展（起笔示例续写）等生成类任务注入；大纲/设定/人物等分析类任务默认不注入（预设块可关）。

## 六、预设层（Preset）

### 6.1 块模型

```js
block = { id, kind, role('system'|'user'), text, enabled }
```

kind 内置槽位（引擎按 kind 填充动态内容，text 仅 task/phi/custom/cot 可编辑）：

| kind | 内容 | 动态/静态 |
|---|---|---|
| `persona` | 选用人格卡的渲染文本 | 动态（卡） |
| `lore` | 世界书激活条目（depth@N 条目注入正文上下文内，其余在此槽） | 动态 |
| `cards` | 人物卡渲染文本 | 动态 |
| `knowledge` | 知识库召回（主线脉络/活跃伏笔/状态时间线，v2 L1.5 内容并入此槽） | 动态 |
| `state` | **状态快照**（v3.1 新增，见 7.4）：当前章信息/在场人物/活跃伏笔，程序渲染 | 动态（程序） |
| `outline` | 大纲树骨架/选中子树 | 动态 |
| `history` | 前情摘要 / 近章事件卡 | 动态 |
| `anchor` | 任务锚点（当前章正文/选中节点/人物档案 + 文风样本） | 动态 |
| `task` | 任务指令（可编辑） | 静态可编辑 |
| `cot` | **思维链脚手架**（v3.1 新增，可开关，见 6.5） | 静态可编辑 |
| `schema` | 输出 JSON schema（**locked**，防止改坏解析） | 锁定 |
| `phi` | 末尾硬约束（Post-History 等价：不编造实体、引用须注明出处、JSON 纪律收尾） | 静态可编辑，**恒置于消息末尾** |
| `custom` | 用户自定义块 | 静态可编辑 |

### 6.2 预设对象与存储

```js
preset = {
  id, name, capability('plot'|'outline'|'lore'|'character'|'chat'|null /*通用*/),
  notes,                                  // 使用说明（社区预设「文档即条目」惯例）
  blocks: [block...],
  options: {...},                         // 选项/开关组（v3.1，见 6.4）
  cleaners: {...},                        // 提案清洗器（v3.1，见 6.6）
  sampling: { temperature, top_p?, maxTokens? },
  engine: { scanDepth, budget, loreBudget, cardBudget, knowledgeBudget,
            recursionSteps, vectorEnabled, historyChapters },
  authorNote: { global, position, depth }
}
```

存储：appconfig JSON 键 `ai.presets`；导入/导出 JSON（预设文件分享，对应社区预设生态）。

### 6.3 作者注（Author's Note）

- **全局作者注**：预设内编辑（如「全书文风要求：短句为主、每章末留钩子」），constant 注入；
- **章节作者注**：appconfig `ai.an:<chapterId>`，编辑器工具栏入口（「作者注」按钮弹窗），按 `depth@N` 注入到当前章正文上下文第 N 段后——本章节拍要求（如「本章需完成 X 与 Y 的初次冲突」）的载体。

### 6.4 预设选项/开关系统（v3.1 新增）

**来源**：双人成行 199 块预设的「开关即注入」机制——开关块 `{{setvar}}` 写变量、CoT/协议块 `{{getvar}}` 聚合引用。工坊**不做任意宏引擎**，做受控子集：

```js
preset.options = {
  groups: [
    {
      id: 'style', name: '文风倾向', mode: 'radio',        // radio 单选组
      options: [ { id: 'balanced', label: '均衡', text: '' },
                 { id: 'dialogue', label: '对白加强', text: '对白占比不低于40%，以对话推进场面…' },
                 { id: 'psycho', label: '心理描写加强', text: '增加人物内心活动描写，但不得替代动作…' } ],
      default: 'balanced'
    },
    {
      id: 'antiInterrupt', name: '防打断', mode: 'toggle',  // toggle 开关组
      options: [ { id: 'on', label: '开启', text: '结尾停在事件发展过程中，自然留白…' } ],
      default: false
    }
  ]
}
```

- **绑定块启用**：块 `enabled` 可设为 `'option:<groupId>'`——radio 组=选中项时启用，toggle 组=开启时启用；
- **模板引用**：块 text 与任务模板支持 `{{opt:<groupId>}}`（展开选中项 text，未选/空则展开为空串）与内置变量 `{{work}}/{{genre}}/{{chapter}}`；
- **UI**：预设编辑器顶部选项区（radio 单选 / toggle 开关），与块列表联动高亮绑定块；选项组可增删、改默认值；
- 与酒馆差异：无嵌套表达式、无任意命名变量、无跨块通信——只有「组→块启用」与「组→文本展开」两条受控通道，复杂度可控。

### 6.5 CoT 思维链块（v3.1 新增）

**来源**：双人成行/梦境空想家的八段式 CoT（场景扫描→规则召回→推演→导演台→合理性审查→输出预检）与「锋芒未露」的段落级自检。工坊化为**任务定制 CoT**（kind:'cot'，置于 task 之后、schema 之前；模型按脚手架推理后再输出 JSON，思考文本由解析器剥离——`extractJsonObject` 对 JSON 前缀杂讯的容忍天然兼容）。

- **默认仅 plot 开启**（生成质量最敏感），其余能力默认关、可开；token 成本约为基线的 2 倍——用成本换质量，用户自决。
- **plot CoT 全文草案**：

```
【思考脚手架——输出 JSON 前逐项完成，思考内容不进入最终输出】
1. 状态核对：逐一列出本批次线路涉及人物的当前状态（依据人物状态卡：截至章/伤势/情感/立场），
   以及全部活跃伏笔（埋设章+内容+指向）；标注哪些人物状态会被线路改变。
2. 事实摘取：从当前章与知识库摘取 3–5 条支撑后续发展的关键事实（时间线/地点/承诺/未解冲突）。
3. 线路差异设计：为每条线路确定互不相同的 strategy；自检是否存在两条线路可被读者视为同一走向；
   为每条线路分配伏笔动作（回收/推进/无）。
4. 一致性审查：逐条线路对照世界书条目与人物状态卡，标注冲突点与规避方式；确认时间线无跳跃。
5. 输出预检：lines 数量 2–4；字段齐全；每条 opening 衔接章节最后一句且不重复既有内容；impact 三字段非空。
```

- 其余能力 CoT 要点提纲（可开启时使用）：outline=①祖先链与既有节点查重→②活跃伏笔清单→③各方案 positioning 取舍→④purpose/edge 对应校验；lore=①相关词条与冲突扫描→②basis 依据逐条核对→③conflict_note 确认；character=①状态时间线梳理→②各建议的依据回查→③「合理推断」比例自检。

### 6.6 提案清洗器（v3.1 新增）

**来源**：梁元预设随带的杀八股正则脚本（否后肯句式、八股词、破折号等，作用于 AI 输出显示层）。工坊化为结构化、有红线的清洗功能：

```js
preset.cleaners = {
  enabled: true,
  wordBlacklist: ['指节', '不易察觉', '一丝', '生理性', '死死', '不容置疑'],   // 命中 → 标记
  regexRules: [
    { find: '(不再是|不像|不是|与其说|并)[^，。：；\\n]*[，。](?:只是|是|而是|而|不如说|不如|更像|更)',
      flags: 'g', action: 'flag', note: '「否后肯」八股句式' },
    { find: '，[^，。：；\\n”」…]*(?:指节|不易察|微不可|几不可|不容置)[^，。：；—\\n“？「]*',
      flags: 'g', action: 'flag', note: '逗号后八股修饰' },
    { find: '——', replace: '，', flags: 'g', action: 'replace', note: '破折号降级为逗号（对话内除外由模型自检）' }
  ]
}
```

- **两档动作**：`replace`（静默替换，仅限明确安全的规则）与 `flag`（命中不改文本，在提案卡上打黄色警示条并列出命中片段，由用户在 diff 编辑中处理）——避免正则自动改写中文造成损坏；
- **作用域红线**：仅 AI 提案文本字段（BranchCard 的 opening/summary/tension/impact/consistency、DiffCard 的 revised/bio/fields 值、PlanCard 的 points）；在 `validateCards` 之后、卡片渲染之前执行；**永不修改用户已存正文、永不触碰用户编辑器内容**；
- 存储：随预设（`cleaners` 属预设资产），导入导出随预设 JSON；默认规则集内置（可恢复默认）；
- UI：预设编辑器「清洗规则」区（规则增删、wordBlacklist 编辑、**规则测试框**——粘贴文本试跑看命中）。

## 七、注入引擎（services/ai/injection.js）

替代 v2 方案中的 L1.5 简单召回；v2 的 retrieval.js 并入本引擎。

### 7.1 流水线

1. **扫描窗口构建**（来源可配）：锚点文本（当前章纯文本 / 选中节点子树 / 人物档案）+ 补充指令 + 前 `historyChapters` 章的摘要/事件卡 + 大纲祖先链标题 + 作者注（全局+章节）。
2. **匹配**：遍历所有启用条目——constant 直通；keys 子串/正则命中（wholeWord 按书设置，中文默认关）；secondaryKeys 按 keyLogic 校验；embeddings 开启时向量激活候补（扫描窗口查询向量 → 余弦 Top-N 并入候选，沿用 v2 E1 的 `aikbvec`）。
3. **递归**：已激活条目 content 参与再匹配，步数 ≤ `recursionSteps`（默认 0）；条目可标「不可被递归激活」；防死循环：同一条目一次装配只激活一次。
4. **过滤与预算**：probability 抽样（仅自动模式，手动任务恒定注入以保可预期）→ **分桶预算**：世界书桶 `loreBudget` / 人物卡桶 `cardBudget` / 知识库桶 `knowledgeBudget`（占 `engine.budget` 百分比，默认 45/25/30）→ 桶内按 order 降序 → priority → 超桶截断（截断项进 dropped 报告）。
5. **选项求值**（v3.1）：解析块 `enabled` 的 `option:` 绑定 → 展开 `{{opt}}` 与内置变量。
6. **装配**：按预设 blocks 顺序输出；depth@N 条目注入正文上下文指定段落后；cot 块按 6.5 位置输出；phi 恒置末尾；人物卡按命中顺序排入 cards 槽。
7. **激活报告**：每个注入块标注来源与命中关键词（「世界书 · 洗脉（关键词：洗脉）」「人物卡 · 林昭（第12章状态）」），超预算/未激活的候选进 dropped——发送范围报告机制沿用，激活测试器复用同一入口。

### 7.2 降级红线（不变）

世界书无条目、卡为空、知识库未构建时，对应槽位输出空，引擎回落 v1/v2 行为：四能力照常可用。**任何一层资产缺失都不阻塞任务。**

### 7.3 context.js 改造

`assembleContext(task, anchor)` 变薄壳：取当前任务预设 → `injection.assemble(preset, anchor)` → 输出 text/report/dropped/tokens（API 兼容现有 agent.js 与报告 UI）。

### 7.4 状态快照（state 槽，对应酒馆「全局数据表」）

酒馆靠 AI 每轮重写 Markdown 状态表模拟数据库；工坊直接程序渲染：

```
【状态快照】（由工坊自动生成，非正文内容）
当前：《卷二》第 14 章《雾港夜航》｜全书记录时间线：主线第 47 天
在场：索尔希艾拉（魔纹残片·星咏·稳定期；对林缺戒备渐消）、林缺（左臂轻伤）
活跃伏笔 5 条：玄铁令去向（第3章埋设）、夜临家族追兵（第9章）…
```

内容来源：锚点章节元信息 + 扫描窗口命中人物的最新 charstate 卡 + 活跃伏笔卡计数/清单；作为独立 `state` 槽位由预设编排（默认在 knowledge 之后）。**零模型成本、永远准确、不会像酒馆那样因 AI 忘记重写而失真。**

### 7.5 keys 生成提示词（世界书条目）

```
【任务：关键词建议】为下面的设定条目生成触发关键词（keys）：当这些词出现在小说正文/大纲/对话中时，本条目应被注入。
- keys 为 2–8 个短词或短语（人名、地名、组织、术语、俗称、别称），简体中文，不要句子；
- 只给该条目内容涉及的专名，不要泛词（如「战斗」「城市」）；
- 若条目描述某人物/势力，其所有称呼变体都应包含；
- 若条目描述某地点/组织，请同时给出其上级归属（区域/母组织）作为二级键建议（配合 AND_ANY 逻辑避免同名误激活）。
【输出 JSON schema】{ "keys": ["…"], "secondaryKeys": ["…"], "reason": "一句话说明取舍" }
```

### 7.6 agent.js / chat

- `runCardTask` 消息组装改为「预设 blocks 顺序」；`systemPromptFor` 退役为「默认预设生成器」；
- **清洗阶段**（v3.1）：`validateCards` 之后、卡片渲染之前执行 `preset.cleaners`（replace/flag 两档，见 6.6）；
- chat 工具循环保留 v2 的 search_kb / get_foreshadows / get_char_timeline，新增 `list_lore_books`（列书与激活条目概况）与 `test_activation`（对任意文本试运行激活）。

## 八、四能力接线与默认预设

### 8.1 默认预设块编排（由 v2 提示词 v2 迁移为默认块）

| 任务 | 块序列 | 说明 |
|---|---|---|
| 正文发展 plot | persona → lore → cards → knowledge → state → history → anchor → task → **cot(默认开)** → schema → phi | 生成类任务，人格卡默认开；选项组示例「文风倾向」(radio) 绑定 custom 块；v2 的 strategy/impact/consistency 约束在 task/phi 块 |
| 大纲规划 outline | lore → cards → knowledge → state → outline → anchor → task → cot(默认关) → schema → phi | 人格卡默认关 |
| 设定扩展 lore | lore → knowledge → state → anchor → task → cot(默认关) → schema → phi | 产出新增「落为世界书条目」按钮：草案自动生成条目（含 keys/二级键建议） |
| 人物丰富 character | cards → lore → knowledge → state → anchor → task → cot(默认关) → schema → phi | 产出新增「落为人物卡/子书条目」（含 voice 建议） |
| 自由问答 chat | lore → cards → knowledge → state → history → anchor(可选) → task → schema → phi | 同引擎 + 工具循环；**清洗器对 chat 回答默认 flag 档** |

### 8.2 用户操作流（酒馆式体验）

1. 建「全书世界书」→ 从设定树批量生成条目（一键 keys + 二级键建议）→ 粘贴正文到激活测试器验证；
2. 预设 tab 选「正文发展·默认」→ 调块序/换人格卡/开选项组/开 CoT/配清洗规则 → 另存为「我的正文预设」；
3. 编辑器右键「恍然梦：剧情选项」→ 面板显示激活报告（哪些设定/人物卡/伏笔被注入）→ 线路卡片生成（清洗警示条按需展示）→ 应用走既有提案制。

## 九、数据模型与代码落点

**新增**
- `src/services/ai/injection.js` — 激活引擎（扫描/匹配/递归/预算/选项求值/装配/报告/测试入口）
- `src/services/ai/cards.js` — 人物卡渲染（characters + charstate + relations + voice → 卡文本）、人格卡模板、状态快照渲染
- `src/services/ai/cleaners.js` — 提案清洗器（规则执行/标记聚合/规则测试）
- `src/components/ai/LorePanel.vue`（世界书 tab）、`PresetPanel.vue`（预设 tab：块编排/选项组/CoT/清洗规则/采样/引擎设置/导入导出）

**改动**
- `src/db/database.js` — v8 迁移一次规划：`aikb`（v2）+ `ailorebook` + `ailore` + `aicards`
- `src/db/repo.js` — 各表 CRUD（全部 where() 参数化）
- `src/services/ai/knowledge.js`（v2）— 提卡自动登记 ailore 条目（auto=true，四类默认开关）
- `src/services/ai/context.js` — 薄壳化，改调 injection.assemble
- `src/services/ai/prompts.js` — 四能力提示词 v2 迁移为默认预设块；新增 keys 生成/voice 生成模板、默认 CoT 文案、默认清洗规则集；`systemPromptFor` → 默认预设生成器
- `src/services/ai/agent.js` — 按预设装配 + 清洗阶段（validateCards 后）+ chat 新工具
- `src/stores/ai.js` — 预设状态、当前预设选择、选项组状态、激活报告、清洗标记、世界书/卡 tab 状态
- `src/components/ai/AiAssistantPanel.vue` — 新增「世界书」「预设」两个 tab（与知识库/设置并列）
- `src/components/ai/BranchCard.vue` / `PlanCard.vue` / `DiffCard.vue` — 清洗警示条渲染；「落为世界书条目」「落为人物卡」操作
- `src/components/CharacterCenter.vue` — 人物卡视图（渲染预览 + voice 编辑）
- `src/components/EditorToolbar.vue` — 章节「作者注」入口
- `tools/ai-verify.mjs` / `tools/mock-ai.mjs` — 验收扩展

## 十、验收方案

`tools/ai-verify.mjs`（CDP 9222，mock provider）用例：

1. **世界书激活**：预置条目（含正则/二级键四逻辑/constant）→ 粘贴测试文本 → 断言激活集合与命中关键词、NOT_ALL 拦截、constant 恒激活；正则解析失败按纯文本兜底
2. **递归**：条目 A content 含条目 B 的 key → recursionSteps=1 时 B 激活、=0 时不激活；循环引用不死循环
3. **预算分桶**：条目超 loreBudget → 按 order 降序截断，dropped 记录正确
4. **位置**：depth@N 条目注入正文上下文第 N 段后；phi 恒在消息末尾
5. **人物卡**：命中人名/别名注入；最新 charstate 正确渲染；voice 字段进入卡文本
6. **状态快照**：state 槽内容来自 store 数据（当前章/在场人物/活跃伏笔计数），非模型输出
7. **预设选项**（v3.1）：切换 radio 组 → 绑定块启用状态变化、`{{opt}}` 展开为选中项 text；toggle 关闭 → 绑定块不进装配
8. **CoT**（v3.1）：plot 默认含 cot 块、其余默认不含；开启后 mock 输出带思考前缀 → 解析剥离后 JSON 正常；关闭后无 cot
9. **清洗器**（v3.1）：wordBlacklist 与 flag 规则命中 → 提案卡警示条与命中片段正确；replace 规则仅替换提案字段；**断言用户已存正文字节级不变**（红线用例）
10. **预设往返**：导入导出 JSON 含 options/cleaners/notes 往返一致；schema 块锁定
11. **作者注**：章节 AN 按 depth 注入；全局 AN constant 注入
12. **知识卡联动**：知识库构建后 auto 条目生成、批量开关生效
13. **四能力接线**：plot 任务断言消息含 persona/lore/cards/state/cot 槽位内容；设定扩展「落为世界书条目」走 store 写入
14. **降级**：清空 ailore/aicards/aikb → 装配回落 v1/v2 行为，任务不报错
15. **规划器**（v3.2）：mock 返回固定计划 → 断言计划卡渲染与步骤编辑（勾选/排序/删）；执行到步骤 N 失败 → 断言重规划被触发、剩余步骤被修订、已完成步骤不重跑；计划检查点续跑正确
16. **反思闭环**（v3.2）：直接「一致性审稿」断言模型复核被调用（与工作流一致）；verify warnings 出现「按复核意见重生成」入口 → 触发后重跑 1 次且带问题上下文；卡片任务开「生成后自检」→ warnings 展示、默认不自动重跑
17. **工作记忆与持久化**（v3.2）：chat 多轮后刷新窗口 → 断言历史从 aichat 表恢复、条数按上限裁剪；creativeMode 切换后重启保留；预算按作品维度记账（作品 A 消耗不影响作品 B）
18. **高优缺陷回归**（v3.2-P0）：构造 >4500 字的超长章 → 断言分块全部成功、无系统性 failed；mock 聚合调用报错 → 断言旧弧线保留且标注、不整批丢失；摘要生成报错 → 断言 plot 回退节选而非整体失败；中文自然语言提问（如「主角为什么离开」）→ 断言 2-gram 分词命中知识卡；向量构建中单卡 embed 失败 → 断言跳过该卡继续
19. **工具强化**（v3.2-P0）：非法参数（超长 query/负 limit/未知枚举）→ 断言 schema 校验拒绝并回喂错误；工具执行中 abort → 断言及时中断
20. **运行轨迹与质量回归**（v3.3）：任务完成后断言 trace 落库且 span 树完整（装配/调用/工具/解析/应用，含 tokens 与耗时）；evals 集确定性断言全绿；故意改坏清洗规则 → 断言 evals 变红（质量门禁有效）；隐私模式 trace 仅记元数据不记内容
21. **上下文工程**（v3.3）：chat 长循环后旧工具结果被回收为占位符且可重查（重查走缓存/重执行）；计划步骤变量引用（`{{step:s1}}`）生效——后续步骤收到解析值而非全量历史；子代理并发上限生效（超限排队）
22. **回归**：v1/v2 ai-verify 用例 + dl/annotation/olcanvas/shelf 不破坏，`npm run build` 通过

真实 API 冒烟（手动可选）：DeepSeek + 默认预设跑一次 plot 全链路（含 CoT 与清洗警示）。

## 十一、实施阶段

| 阶段 | 内容 | 依赖 |
|---|---|---|
| W0 资产地基 | ailorebook/ailore/aicards 表 + 世界书/卡 UI 骨架 + 一键 keys 生成（含二级键建议） | v2 K0 |
| W1 注入引擎 | 扫描窗口/匹配/递归/预算分桶/状态快照/激活报告 + 激活测试器 | W0 |
| W2 卡系统 | 人物卡渲染 + 人格卡编辑 + voice 生成 + 子书绑定 | W0（可与 W1 并行） |
| W3 预设系统 | 块模型 + 预设管理器 + **选项/开关组 + CoT 块** + 作者注 + v2 提示词迁移为默认预设 | W1 |
| W4 接线与清洗 | 四能力/chat 走引擎 + 落条目/落卡片按钮 + **提案清洗器** + ai-verify 扩展 | W1–W3 |
| **V3.2-P0 缺陷修复** | 长章提取分块按 token 折算+重叠、聚合失败降级、摘要失败回退、chat 检索 2-gram+保底、向量单卡跳过、工具 schema/中断点、审计清理（13.6） | **独立，可最先启动** |
| **V3.2-P1 反思闭环** | 直接审稿补复核、verify 驱动重生成、卡片任务可选生成后自检（13.3） | 与 W 线并行 |
| **V3.2-P2 工作记忆与统一循环** | chat 历史持久化、creativeMode/按作品预算、runAgent 接口抽取（13.4/13.5） | P1 后 |
| **V3.2-P3 规划器** | plan 元任务 + 计划卡编辑 + 执行器/重规划（13.2） | P2 后（或独立于 P2 直接基于现有 workflow 起步） |
| **V3.3-A 运行轨迹** | 每任务 trace（span 树 + tokens/耗时）+ 本地查看器；OTel GenAI 命名；隐私脱敏（14.3-A） | P0 后 |
| **V3.3-B 质量回归集** | evals 断言集（确定性优先）+ 可选 LLM-as-judge；提示词/清洗/预设变更前跑对比（14.3-B） | A 后 |

W 线与 v2 的 K 线（知识库）并行推进：知识库就绪前世界书与预设已可独立使用（幕布/自由条目 + 手写人格卡）。V3.2 线（认知闭环与缺陷修复）与 W 线无依赖，可并行——建议 P0 缺陷修复最先启动（修复现网性失败点，收益即时）。V3.3 的 C/D/E/F/G 五项不单列阶段，分别并入 13.6（P0）/13.4（P2）/13.2（P3），详见 14.5。

## 十二、风险与对策

- **keys 质量决定激活质量** → 本地提取 + 模型建议双通道（含二级键模式）+ 激活测试器快速排查 + auto 条目可人工补 keys
- **递归死循环/爆炸** → 步数上限默认 0、同条目单次装配只激活一次、预算兜底
- **预算分桶失衡（世界书挤掉锚点）** → 分桶比例可配、锚点/任务槽恒定保留不参与竞争、报告透明展示各桶占用
- **中文无分词的误命中** → 子串匹配 + 全词匹配默认关（ST 官方口径）；泛词 keys 由生成提示词约束；误命中用 NOT 逻辑或改 keys 解决
- **CoT 成本翻倍** → 默认仅 plot 开启、逐能力可关、思考文本剥离不进历史；后续可选「轻量模型跑 CoT」
- **清洗误伤** → replace 规则白名单化、句式规则一律 flag 不改文、命中片段在 diff 卡可见、清洗器一键关闭
- **选项系统复杂度** → 受控子集（组→块启用、组→文本展开两条通道），明确不做任意变量宏/嵌套表达式；默认预设零配置可用
- **预设复杂度失控** → schema 块锁定、默认预设兜底（一键恢复默认）、预设 notes 内置使用说明、导入导出可分享
- **降级红线** → 任何资产层为空均回落 v1/v2 行为，绝不阻塞任务；清洗永不触碰用户正文
- **规划器误用/失控**（v3.2）→ 计划必须经作者确认与编辑后才执行；每一步仍走提案制逐项应用；重规划次数上限可配（默认 2）；执行中可随时暂停
- **自动重生成成本**（v3.2）→ verify 驱动重生成上限 1 次、默认手动触发；费用照常计入用量报告
- **统一循环重构风险**（v3.2）→ 渐进式：先抽接口行为零变化、全量回归兜底，后逐项迁移
- **工作记忆持久化隐私面**（v3.2）→ aichat 落库沿用隐私过滤：隐私模式不写不读历史；清空入口常驻
- **运行轨迹隐私面**（v3.3）→ trace 默认仅记元数据（tokens/耗时/模型/版本/状态），内容级 span 载荷按隐私设置采集；查看器与清空入口同 aichat
- **evals 成本**（v3.3）→ 确定性断言全量免费；LLM-as-judge 项默认关闭、手动静止运行，用量计入报告
- **子代理并发**（v3.3）→ 默认串行（1），并发为显式开关；并发/总步数/总预算三重上限（对齐行业 subagent 上限实践）

## 十三、Agent 能力缺口补全（v3.2）

> 依据：docs/恍然梦Agent能力评估.md（14 项部件体检）。本章承接评估确认的五个缺口：规划器、反思闭环、统一循环、工作记忆持久化、高优缺陷修复。v3 原 W 线负责驾驶层（世界书/卡/预设/CoT/清洗器/状态快照）；本章任务与 W 线无依赖，可并行，建议 P0 缺陷修复最先启动。

### 13.1 缺口总表（对应评估报告）

| 体检缺口 | 现状（评估证据） | v3.2 任务 | 见 |
|---|---|---|---|
| 规划器缺失（自主 agent 不合格主因之一） | 唯一多阶段编排为**硬编码三步** retrieval→task→verify（stores/ai.js:525），无任务分解与重规划 | plan 元任务 + 计划卡 + 执行器 + 重规划 | 13.2 |
| 反思不闭环 | 直接审稿无模型复核（professional.js:131-134）；verify 不驱动重生成；卡片任务无生成后自检 | 复核补齐 + 重生成入口 + 可选自检 | 13.3 |
| 无统一循环 | 卡片单步（agent.js:97-113）与聊天 6 轮循环（agent.js:134-156）互不相关 | runAgent 统一接口（渐进式重构） | 13.4 |
| 工作记忆不持久 | chat 8 条仅内存（agent.js:131）；creativeMode 跨启动丢失；预算全局非按作品 | aichat 表 + 设置持久化 + 按作品预算 | 13.5 |
| 高优缺陷 1–5 及中优项 | 评估报告§四（长章提取失败/聚合连坐/摘要拖垮/检索空召/校验不一致等） | P0 修复清单 | 13.6 |

### 13.2 规划器（Planner）：半自主「计划-确认-执行-重规划」

**定位**：恍然梦目前是单任务 copilot；规划器提供「按目标自动编排多任务」的半自主形态——但计划本身仍是提案：先生成计划草案，作者确认后才执行，红线不变。

- **新元任务 `plan`**（第 6 种任务类型）：
  - 输入：作者目标（自然语言，如「把第二卷写完」）+ 作品状态快照（各章完成度、大纲树、活跃伏笔、未提取章数）+ 可用任务类型清单及约束；
  - 输出（严格 JSON，经 validateCards 同款校验）：

```json
{
  "goal": "…", "reasoning": "为什么这样拆分（一两句）",
  "steps": [
    { "id": "s1", "task": "plot|outline|lore|character|review|rewrite|knowledge",
      "scope": { "type": "chapter|volume|node|character", "id": "…", "label": "…" },
      "instruction": "该步的具体指令", "dependsOn": [], "expect": "该步产出什么" }
  ]
}
```

  - 硬约束：步骤 2–12 个；task 只能取枚举；scope 必须指向存在的实体；dependsOn 无环；**步骤不含「应用/写库」语义**（步骤只产出提案）。
- **计划卡**（新卡片类型 taskCard/planTask）：展示 reasoning 与步骤列表；作者可勾选/排序/删步骤/改 instruction；「执行」启动。
- **执行器**：按序调用现有执行路径（runCardTask / professional 流程）；每步产物摘要进入后续步骤的补充指令；每步完成写检查点（airuns `type:'plan'`，含步骤状态与产物引用）；每步产物仍逐项提案应用。
- **重规划**：步骤失败（解析降级）或作者大量放弃该步产出 → 收集「已完成步骤摘要 + 失败原因 + 原目标」重调 `plan` 修订剩余步骤（上限默认 2 次，可配）；重规划结果再次经作者确认。
- **与硬编码 workflow 的关系**：现有三模板降为「固定模板快捷方式」（不调模型生成计划）；planner 与 workflow 共用租约/检查点/阶段报告机制（workflow 即 planner 的预置计划）。
- **UI**：AiStudio 新增「计划」区：目标输入 → 计划卡编辑 → 执行/暂停/从步骤续跑/手动触发重规划；阶段报告显示每步状态与产出卡片数。

### 13.3 反思闭环（三处补齐）

1. **直接审稿补复核**：`runTask('consistency')` 路径补 `reviewProposals` 复核调用（与 workflow verify 一致，或该路径统一改走三阶段实现）——消除「校验强度取决于入口」的不一致（评估高优缺陷 5）；
2. **verify 驱动修正**：warnings 从展示项升级为修正入口——卡片/审稿结果上的 warnings 提供「按复核意见重生成」：带原产出 + warnings 重跑生成 1 次（上限），结果替换或并列对比；自动/手动可配（默认手动）；
3. **卡片任务可选生成后自检**：预设新增 `verifyAfter` 开关（默认关）——生成成功后追加一次 verify 角色调用，warnings 附加卡片；不自动重跑，作者决定是否重生成。

### 13.4 统一 Agent 循环抽象（渐进式重构）

- 目标接口：`runAgent({ kind, goal|task, scope, budget, privacy, opts, onPhase, onDelta, onUsage }) → RunResult`；card / chat / workflow / planner 为同一接口的四种实现，共享：phase 状态机、AbortController 传播、usage 累加、report/dropped、检查点/租约、降级规则；
- 渐进路径：①只抽接口与适配层（行为零变化，全量回归验证）→ ②迁移 chat 与 card → ③迁移 workflow 与 planner 接入；
- 验收锚点：迁移前后同一 mock 输入产出逐字段一致。

### 13.5 工作记忆与状态持久化

- **chat 历史持久化**：新表 `aichat`（`id, workId, sessionId, role, content, createdAt, deletedAt`；索引 `[workId+sessionId+createdAt]`）；每轮问答完成写入；打开面板加载最近 N 条（默认 50，超限裁剪）；**隐私模式不写不读**；清空入口在助手面板；
- **creativeMode 持久化**：appconfig `ai.creativeMode`（现仅内存 stores/ai.js:56）；
- **预算按作品**：daily 记账扩展为全局行 + `daily:<date>:<workId>` 作品行双记——自动知识构建按作品上限预检，全局上限继续兜底；
- **审计清理**：airuns 保留策略——应用审计保留最近 200 条/90 天（可配），任务检查点每类型保留最近 1 次；启动或空闲时清理。

### 13.6 高优缺陷修复清单（P0，可独立最先启动）

| # | 缺陷（评估证据） | 修复方案 |
|---|---|---|
| 1 | 长章提取系统性失败（knowledge.js:116 vs contracts.js:48） | 分块参数按模型输入预算折算 token（替代 4500 字符硬切）+ 相邻块 200 字重叠；失败章重试时自动降块大小 |
| 2 | 聚合失败连坐（knowledge.js:229,244） | compact 异常降级：保留上一版弧线并在报告标注「本卷摘要未更新」，不再整批清空 |
| 3 | 摘要失败拖垮 plot（context.js:185-193） | summaryLineOf 全程 catch，失败回退「节选开头」（现行隐私路径同款） |
| 4 | chat 检索空召（retrieval.js:21,45） | 查询分词化（中文 2-gram + 英文/数字整词 + 标点切段）；命中策略由「未命中归零」改为「低分保底 top-k」 |
| 5 | 校验强度不一致（professional.js:131-134） | 见 13.3-1 |
| 6 | 工具参数无 schema（tools.js:8,79-93） | TOOL_REGISTRY 参数升级 JSON Schema（类型/枚举/上下限），executeTool 前置校验 |
| 7 | 工具执行不可中断 | executeTool 传递 signal，章节遍历等长循环插入 checkAbort |
| 8 | 向量构建写放大/单点失败（retrieval.js:94） | 分批增量写替代整表重写；单卡 embed 失败跳过并计数报告 |
| 9 | 作者决定键脆弱（professional.js:126-127） | 决定键改为 `chapter.id + finding 归一化文本（去空白/标点）` 的哈希，重跑不失配 |
| 10 | 审计只增不清理（application.js:146） | 见 13.5 |

中优先级项（提案 schema 版本号、entityHash 嵌套键序、回滚探测扩展、隐私 quote 旁路、context.js 注释与实现对齐、死代码清理）随相关模块改动顺带修复，不单列阶段。

## 十四、行业成熟 Agent 项目参考与架构校准（v3.3）

> 调研日期：2026-10-12；方法：联网检索 2026 年主流 agent 框架官方文档与工程分析，提炼可迁移模式并对齐本方案。**本工坊为本地 Vue/TS + Dexie 应用、坚持零框架依赖——本章只借鉴架构模式，不引入任何运行时/框架/云服务依赖。**
> 主要来源：[Claude Agent SDK 文档（子代理/钩子/压缩）](https://code.claude.com/docs/en/agent-sdk/subagents)、[Claude 上下文工程 cookbook（compaction/tool clearing/memory）](https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools)、[LangChain Deep Agents](https://www.langchain.com/blog/deep-agents)、[LangGraph 等 2026 框架对比（Splunk）](https://www.splunk.com/en_us/blog/learn/agent-frameworks.html)、[Zep/Graphiti 论文](https://arxiv.org/abs/2501.13956)、[Mem0/Letta/Zep 记忆架构对比](https://www.digitalapplied.com/blog/open-source-agent-memory-mem0-letta-zep-compared)、[规划模块分层（Tian Pan）](https://tianpan.co/blog/2026/04/09/agent-planning-module-hidden-architectural-seam)、[Plan-and-Act](https://arxiv.org/html/2503.09572v3)、[TDP 任务解耦规划](https://arxiv.org/pdf/2601.07577)、[Agent 评估六阶段（Callsphere）](https://callsphere.ai/blog/agent-evaluation-stack-2026-trace-to-eval-score)、[LLM 可观测性 2026（OTel GenAI 约定）](https://josenobile.co/guides/llm-observability/)。

### 14.1 版图速览（提炼与本方案相关的机制）

| 项目/方向 | 2026 现状 | 核心机制 | 对恍然梦的可迁移点 |
|---|---|---|---|
| **Claude Agent SDK**（Anthropic） | 六层运行时（执行/上下文/能力/编排/治理/产品面） | subagents（独立上下文，父只收最终消息；深度/并发/预算三类上限）；skills（渐进披露能力包）；hooks（生命周期确定性拦截，在上下文之外运行、可短路）；自动 compaction（compact_boundary 事件、有损、「持久规则应放持久配置而非一次性提示」）；memory tool + tool-result clearing | 子代理规范（14.2.4）；hooks 规范化（14.3-C）；上下文组合律（14.2.5）；「计划的价值在于让模型保持轨道」——呼应 Deep Agents 的 todo 工具实为上下文工程 |
| **LangGraph / Deep Agents**（LangChain） | 图状态机；每步 checkpoint + 时间旅行调试 + HITL 持久中断 | Deep Agents = 规划工具 + subagents + 文件系统 + 详细提示词；计划工具本身可以是 no-op（纯上下文策略） | 计划检查点/续跑已有（13.2 再精化）；重规划策略（14.2.1）；trace 时间线（14.3-A） |
| **Microsoft Agent Framework 1.0** | 2026-04-03 GA，AutoGen+SK 合并 | superstep 图、中间件、OTel、HITL 持久中断、A2A | 中间件 ≈ hooks（14.3-C）；HITL 持久化（14.2.1） |
| **OpenAI Agents SDK** | agents/handoffs/guardrails/sessions 四原语 + tracing；2026-04 沙箱 | 最小抽象；guardrails 输入输出双向；session 持久 | guardrails 已覆盖；handoffs 不适用（单助手） |
| **Mastra**（TS 原生） | workflows + memory + evals + Studio 一体 | Observational Memory：observer 把历史压缩为带日期的观察日志，reflector 超预算重写 | 「章节摘要 + 状态快照」≈ 观察日志（已有雏形）；evals 一体化（14.3-B） |
| **Letta**（原 MemGPT） | core/recall/archival 三层 + 自编辑记忆 | sleep-time compute：后台第二代理在空闲时整理主代理记忆（抽象模式、解矛盾、预计算关联） | 空闲期整合：现 auto knowledge 队列已具雏形；新增「空闲压缩 chat 工作记忆」（14.2.6） |
| **Zep / Graphiti** | 双时态知识图谱 | 事实带 `valid_at`/`invalid_at`，矛盾时**失效不删除**，可答「某时间点什么是真的」；实践者证实该模式**用普通表即可实现**（facts 表 + 有效期 + 来源事件 id） | 伏笔账本双时态化（14.2.6，14.3-F） |
| **Mem0 v2** | 单遍抽取 + 混合检索 | 抽取→与既有记忆比对→ADD/UPDATE/DELETE/NOOP 四操作调和；检索 = 语义 + BM25 + 实体图经 RRF 融合（~15 行） | 知识卡实体级增量调和（14.2.6 实验项）；RRF 本方案已有（retrieval.js） |
| **规划研究**（Plan-and-Act / TDP / 规划模块分层） | 规划与执行分离成共识 | Planner 产结构化计划、Executor 执行单步；**显式依赖 DAG** + 变量替换（后步引用前步产物，避免全量历史回传，token -60%+）；重规划四策略：失败触发/观察触发/周期/有限视界；planner 与 executor 可用不同模型；>5–6 步串行任务失败率上升是「需要规划模块」的信号 | 校准 13.2（14.2.1） |
| **评估与可观测工程** | trace→dataset→evaluator→CI 门禁→在线监测六阶段；OTel GenAI 语义约定（invoke_agent/chat/execute_tool span、gen_ai.evaluation.result、token 指标） | 三层评估（结果/轨迹/组件）；确定性检查优先、LLM-as-judge 需人工校准后使用（结构化 verdict）；末尾采样：错误/超支/评估失败全留 | 新增运行轨迹与质量回归集（14.3-A/B） |

### 14.2 校准现有规划（对 v3.2 各项的精化）

**14.2.1 规划器（精化 13.2）**
- **变量替换**：步骤产物以 `{{step:<id>}}` 引用（如「审稿步骤 s1」→「改稿步骤 s3 的指令中引用 `{{step:s1}}`」），执行器只注入被引用的产物摘要而非全量历史——token 与上下文污染双降（对应 TDP 的节点域上下文）；
- **重规划策略可配**（四选，默认「失败触发 + 有限视界」）：失败触发（步骤失败/降级时）/ 观察触发（每步后）/ 周期（每 N 步）/ 有限视界（计划一次只承诺未来 K 步，K 边界处复盘）——小说任务推荐有限视界 K=3：兼顾改编性与成本；
- **规划与执行分模型**：plan 任务走「planning」角色模型（现有角色模型机制复用），执行步骤走各自任务角色——规划用强模型、执行可用快模型；
- **监控双分层**：规划失败（依赖环、无效 scope、超出枚举）与执行失败（工具错、解析失败、降级）分开进 trace/报告（14.3-A），便于定位是「计划错了」还是「执行崩了」；
- **HITL 持久化**：步骤完成后的可选确认中断落盘（airuns），应用重启后仍可「从步骤 N 继续」，对齐 LangGraph/MS 的持久中断语义（现 13.2 检查点机制已具雏形，补齐重启后自动恢复入口）。

**14.2.2 反思闭环（精化 13.3）**：verify 复核产出结构化 verdict（Schema-Guided Reasoning：`{failed_criteria[], evidence[], score, suggestion}` 字段），失败项可直接转为「按复核意见重生成」的指令输入——复核不止提示，而是修正的输入源。

**14.2.3 统一循环（精化 13.4）**：`runAgent` 接口补充 hooks 挂点（见 14.3-C）——清洗器/审计/报告/用量/压缩全部以 hooks 形式挂接，业务代码与横切行为解耦；hooks 在上下文之外运行（不占 token）、可短路由配置开关（对齐 Claude hooks 设计）。

**14.2.4 子代理规范（新增）**：把现有「独上下文单发」子任务（知识提取每块、审稿每块、文风分析、verify 复核）正式规范化：
- 定义：子代理 = 独立上下文 + 独立角色提示词 + 独立模型角色 + **父只接收结构化最终结果**（不含中间过程）；
- 落地：现有 professional.js / knowledge.js 批量路径改经统一 `runSubagent()` 契约（并 13.4 的 runAgent 接口）；
- 上限三重（对齐 Claude subagents）：并发上限（默认 1=串行，可配）、步骤/深度上限（本方案无嵌套子代理，深度=1）、预算计入总护栏；
- 收益：批量审稿可选并发（提速）；每块上下文隔离（质量稳定）；token 计量分层归因。

**14.2.5 上下文工程组合律（新增，对齐 Claude 官方「隔离→回收→压缩→持久化」）**
| 层 | 行业做法 | 恍然梦现状与动作 |
|---|---|---|
| 隔离（Subagents） | 大块工作放子代理，父上下文不承载 | 批量任务已天然隔离 → 规范化为 14.2.4 |
| 回收（Tool-result clearing） | 旧工具结果替换为占位符（保留调用记录、可重查） | **chat 循环缺失** → 14.3-D（并入 P0：长问答时旧工具结果占满预算，现仅靠成对 splice 硬删） |
| 压缩（Compaction） | 超阈值时摘要旧历史、保留近期；有损，重要规则放持久配置 | 章节摘要/知识卡已覆盖作品侧；**chat 工作记忆超出上限时压缩中段为摘要**（而非现 splice 丢弃）→ 并入 13.5 |
| 持久化（Memory tool） | 关键事实写入窗口外文件 | aichat/aikb/airuns 持久层已覆盖 → 补「任务中显式沉淀」：长流程（plan/审稿）的中间成果写入检查点而非依赖上下文携带 |

**14.2.6 记忆升级（精化 knowledge.js 与 13.5）**
- **双时态伏笔账本**（Graphiti 模式移植到表结构）：伏笔动作日志增加 `validAt/invalidAt/sourceEventId`——「撤销/更正一次伏笔判定」时旧记录失效不删除，`replayForeshadows` 支持「截至第 N 章的当时理解」与「当前理解」双视图；实现即现有 append-only 日志加两个字段（14.3-F，并入 P0）；
- **实体级增量调和**（Mem0 ADD/UPDATE/DELETE/NOOP 模式）：章节重提时不再整章删建，而是新旧卡比对后四操作调和，保留更正溯源——**风险：重度改写章节的比对可能优于也可能劣于整章替换，列为实验项**（默认保留整章替换，调和作为可选策略 + evals 对比评估后才转正）；
- **睡眠期整合**（Letta sleep-time）：空闲队列（现 auto knowledge 雏形）扩展为「整合者」：空闲时压缩 chat 工作记忆、合并重复知识卡、预计算人物弧线摘要——不在任务延迟路径上，可用轻量模型。

### 14.3 新增优化点（v3.3 独有）

| 编号 | 优化点 | 内容 | 借鉴 | 落点 |
|---|---|---|---|---|
| A | **本地运行轨迹（trace）** | 每任务一条 trace：装配→调用→工具→解析→应用全链路 span（tokens/耗时/模型/状态/版本），本地 JSON 落 airuns；简易查看器（span 树 + 时间线）；span 命名对齐 OTel GenAI 约定（`invoke_agent`/`chat`/`execute_tool`，evaluation 事件用 `gen_ai.evaluation.result` 形状）便于未来导出；采样：错误/降级/超支全留，成功按比例留 | OTel GenAI / Langfuse / 六阶段评估 | 新阶段 V3.3-A |
| B | **Evals 质量回归集** | 固定作品样本 + 断言集，确定性优先：JSON 合法性、strategy 互异、伏笔引用存在性、证据可定位、清洗误伤率、长章提取成功率、降级率、token 预算不超；可选 LLM-as-judge 项（结构化 verdict、默认关、校准后启用）；用途：提示词/清洗规则/预设/模型变更**前后对比**（本地版 CI 门禁） | trace2evals / 六阶段评估 / SGR | 新阶段 V3.3-B |
| C | **Hooks 规范化** | 生命周期挂点：`TaskStart/TaskStop/PreGenerate/PostGenerate/PreApply/PostApply/PreCompact`；清洗器、审计、报告、用量、压缩以 hooks 挂接；hooks 不占上下文、可短路由配置开关 | Claude hooks / MS 中间件 | 并入 13.4（P2） |
| D | **工具结果回收** | chat 循环旧工具结果替换为占位符（保留调用记录与缓存重查句柄），释放预算；不清除最近 N 条 | clear_tool_uses | 并入 13.6-P0 |
| E | **子代理规范与上限** | 见 14.2.4 | Claude subagents | 并入 13.4/13.6 |
| F | **双时态伏笔与更正溯源** | 见 14.2.6 | Graphiti | 并入 13.6-P0 |
| G | **计划变量替换** | 见 14.2.1 | Plan-and-Act / TDP | 并入 13.2（P3） |

### 14.4 明确不引入（边界）

- **不引入任何 agent 框架/运行时**（LangGraph、Mastra、Letta、Claude/OpenAI SDK 等）——保持零依赖与本地优先；仅移植上述模式，实现于现有 services/ai 架构内；
- **不引入多智能体协作/交接**（handoffs、Crew 群聊）——单作者单助手场景无收益，规划器已覆盖任务拆解需求；
- **不引入 MCP/A2A 协议层**——本地应用无跨运行时协作场景；
- **不引入图数据库/独立向量库/云记忆服务**（Neo4j、Zep Cloud、Mem0 Platform）——Dexie + 现有 aikbvec 足够，双时态/RRF 均可用普通表实现（行业实践已证实）；
- **不引入云端 trace/eval 平台**（Langfuse/LangSmith 服务）——本地 JSON trace 与本地 evals 集足够；OTel 仅取命名参考以便未来兼容。

### 14.5 实施并入

| 项 | 并入位置 |
|---|---|
| C hooks 规范化、E 子代理规范 | v3.2-P2（13.4 统一循环一并实施） |
| D 工具结果回收、F 双时态伏笔 | v3.2-P0（13.6 缺陷清单，均为小改动） |
| G 计划变量替换 | v3.2-P3（13.2 规划器设计的一部分） |
| A 运行轨迹、B 质量回归集 | **新阶段 V3.3-A / V3.3-B**（P0 之后、P2 之前；trace 先行，evals 依赖 trace 数据） |

一句话总结：行业 2026 的共识是「**执行与记忆可以朴素，规划与反馈必须显式**」——恍然梦的强项（执行安全、记忆失效、租约检查点）恰与行业成熟方向一致；本次补入的 trace/evals/子代理/hooks/上下文组合律/双时态记忆，把「可观测与可回归」这一最后短板补齐。
