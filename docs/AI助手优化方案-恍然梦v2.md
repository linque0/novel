# AI 助手「恍然梦」v2 优化方案：作品知识库 + 四能力提示词升级

> 定位版本建议：v1.3.0（v1.2.x 为《AI助手接入方案.md》P0–P3 已交付能力的收尾与打磨）
> 起草日期：2026-10-11
> 关联文档：docs/AI助手接入方案.md（v1 方案，四能力与上下文装配器的基础设计；本文档在其之上演进，不推翻既有红线）

## 一、定位与目标

v1 的恍然梦已具备五能力（正文发展 / 大纲规划 / 设定扩展 / 人物丰富 / 自由问答），上下文采用「L0 骨架 + L1 锚点 + L2 人物名 includes 反查」的**即时拼接**模式。它有两个结构性短板：

1. **没有记忆**：每次任务都从零装配，对「全书前情脉络、埋了哪些伏笔、人物走到了哪一步」只能靠 150–250 字章节摘要与人物名反查片段，长篇下严重失真；
2. **提示词偏骨架**：四能力提示词只约束了字段格式，对「线路如何保证实质差异」「扩展如何与既有设定对齐」「建议依据从何而来」缺乏可执行的生成约束。

v2 的目标：

- **构建「作品知识库」**——从工坊内作品数据（章节正文、人物档案、大纲树、设定树）提取并持久化的结构化知识数据库，作为五能力的共同记忆层，供检索召回与按需查询；
- **全面重写四能力 + 问答提示词**——注入知识库召回，增加线路策略差异化、一致性自检、依据标注三类生成约束；
- **可选增强**：embeddings 语义检索（OpenAI 兼容 `/embeddings` 端点，默认关闭）；
- **更新触发双模式**：手动构建（默认）与自动增量（可选），由用户在设置中选择。

**红线不变：agent 永不直接改库，一切写入走「卡片应用」→ 现有 store 写入路径；知识库条目属于 agent 的私有资产（不影响作品内容本身），其提取与检索仍只读作品库。**

## 二、总体架构（v2 增量）

```
渲染层
  ├─ AiAssistantPanel.vue      新增「知识库」tab（统计 / 构建 / 浏览 / 伏笔登记表）
  ├─ services/ai/knowledge.js  【新增】知识库流水线：单章提取 → 实体对齐 → 聚合卡 → 脏章失效
  ├─ services/ai/retrieval.js  【新增】知识库检索：内存索引 + 按任务定制召回 + 邻近度排序
  ├─ services/ai/context.js    新增 L1.5 知识库召回层（L1 之后、L2 之前；L2 降级保留）
  ├─ services/ai/prompts.js    v2 全面重写（人设基底 + 四能力 + 问答 + 知识库提取模板）
  ├─ services/ai/agent.js      chat 工具循环注册知识库工具；runCardTask 传入 kb 召回结果
  ├─ services/ai/provider.js   扩展 embed()（OpenAI 兼容 /embeddings，可选）
  └─ stores/ai.js              知识库状态（统计/脏章/构建进度）+ 新设置项
数据层
  ├─ src/db/database.js        v8 迁移：新增 aikb 表（+可选 aikbvec 向量表）
  └─ src/db/repo.js            aikb CRUD（全部 where() 参数化查询）
外部
  └─ OpenAI 兼容 API（chat/completions 沿用；embeddings 可选）
```

与 v1 的关系：`summarize.js` 的 aisum 章节摘要**保留**（L1 前情摘要仍用，成本低、无结构），知识库是结构化增强层而非替代；L2 人物名 includes 反查**降级为后备**（知识库未构建时完全回落到 v1 行为）。

## 三、作品知识库

### 3.1 数据模型（Dexie schema v8 新表 `aikb`）

```js
// v8 迁移新增（src/db/database.js）
aikb: 'id, workId, kind, [workId+kind], [workId+chapterId], [workId+refType+refId], updatedAt'
// 可选 embeddings 向量表（E1 阶段，随 embeddings 开关启用）
aikbvec: 'id, workId, cardId, [workId+cardId], [workId+model]'
```

| 字段 | 说明 |
|---|---|
| `id` | uid()，与全库一致 |
| `workId` | 所属作品 |
| `kind` | 知识卡类型：`event` / `foreshadow` / `charstate` / `loreterm` / `arc`（见 3.2） |
| `refType` / `refId` | 关联实体：`chapter:<id>` / `character:<id>` / `mubu:<id>` / `volume:<id>` / `work:<id>`（聚合卡用） |
| `chapterId` / `orderIdx` | 卡片锚定章节与章内全局序（邻近度排序用；arc 卡为空） |
| `title` | 卡片标题（事件概述短语 / 伏笔名 / 词条名），检索主字段 |
| `body` | 结构化 JSON（按 kind 定 schema，见 3.2） |
| `keywords` | 检索关键词数组（人物名、地名、专有名词，提取时由模型给出 + 提取后追加实体名） |
| `contentHash` | 来源内容哈希（cyrb53，复用 summarize.js 的 hashContent）——章节重提失效判定 |
| `model` | 生成该卡的模型名（质量溯源） |
| `createdAt` / `updatedAt` / `deletedAt` | 惯例字段，软删 |

**数据纪律：aikb 的所有查询一律使用 Dexie `where()` / `collection` 结构化条件与参数绑定（如 `db.aikb.where('[workId+kind]').equals([workId, kind])`），严禁字符串拼接查询条件。**

### 3.2 知识卡五类（kind）

| kind | 名称 | body 结构 | 锚定 |
|---|---|---|---|
| `event` | 情节事件卡 | `{ 概述, 时间线标记, 地点, 参与人物[], 冲突, 结果, 悬念 }` | 单章可多条 |
| `foreshadow` | 伏笔卡 | `{ action: 'set'\|'progress'\|'payoff', 内容, 指向, 状态: 'active'\|'paid', 关联事件卡id[], 回收章 }` | set/payoff 锚章 |
| `charstate` | 人物状态卡 | `{ charId, 变化维度: '伤势'\|'能力'\|'情感'\|'立场'\|'关系', 变化描述, 依据摘引 }` | 人物×截至章 |
| `loreterm` | 设定词条 | `{ 名称, 类别, 描述, 首现章, 关联幕布节点id|null }` | 正文暴露的设定要点，与幕布既有设定对齐 |
| `arc` | 聚合卡 | subtype：`volume`（卷摘要 300–500 字）/ `main`（全书主线脉络）/ `chararc`（人物弧线：起点→转变→当前）/ `foreshadow_index`（伏笔登记总表） | 卷 / 全书 / 人物 |

设计要点：

- **event 是骨架**：逐章提取，是其他卡与聚合卡的原料；
- **foreshadow 是状态机**：`set` 建卡（active），`progress` 追加关联事件卡，`payoff` 置为 paid 并记录回收章——「活跃伏笔清单」= active 状态卡，是 plot / outline 任务最有价值的召回物；
- **charstate 按人物聚合**：同一人物同一章多条变化合并为一张卡，人物中心可按 `refId` 拉出完整状态时间线；
- **loreterm 与幕布对齐**：提取时传入幕布词条名单，正文暴露的设定若与既有幕布节点同名/近义则 `关联幕布节点id` 指过去，否则新建（供 lore 任务做一致性约束，不反向写幕布）；
- **arc 是聚合层**：由下层卡片生成（见 3.4），全书主线脉络卡替代 v1 风险章节里「卷级摘要」的备选方案。

### 3.3 提取流水线（`services/ai/knowledge.js`）

**单章提取**（核心模板，随章节正文 + 实体名单发送）：

```
【任务：知识库提取】
从下面的章节正文中提取结构化知识。已登记实体名单（人物、设定词条、活跃伏笔）随消息提供：
- 事件参与人物只能引用名单内的名字（含别名）；
- 名单外的新命名实体（人物/组织/地点/物品）一律放入 new_entities，由软件与既有档案做归并确认，不要自行并入既有实体；
- foreshadows 的 action 取 set（新埋设）/ progress（推进既有伏笔，须引用伏笔编号）/ payoff（回收，须说明回收了哪条伏笔）；
- 只提取正文实际发生、明确呈现的内容，不推测、不补写；宁缺毋滥。

【输出 JSON schema】
{
  "events": [ { "summary": "", "timeline": "", "place": "", "characters": [], "conflict": "", "result": "", "suspense": "" } ],
  "foreshadows": [ { "action": "set|progress|payoff", "content": "", "target": "", "ref": "" } ],
  "charstates": [ { "name": "", "dimension": "伤势|能力|情感|立场|关系", "change": "", "evidence": "正文关键句摘引" } ],
  "lore_terms": [ { "name": "", "category": "", "desc": "" } ],
  "new_entities": [ { "name": "", "type": "人物|组织|地点|物品", "hint": "" } ]
}
```

**流水线规则**：

1. **串行按章顺序提取**（跨卷全局序，`repo.collectExportChapters` 同口径）：活跃伏笔名单随进度滚动更新，后章才能正确 progress/payoff 前章伏笔；
2. **实体对齐**：`new_entities` 与人物档案（name + aliases）、幕布词条做精确/包含匹配，命中则归并（卡 refId 指向既有实体），未命中标 `[新]`，在知识库 tab 中由用户一键确认归并或登记为新人物/词条（走现有 store 动作，仍是提案制）；
3. **失效机制**：章节 autosave 落盘钩子（现有 aisum 标脏同款位置）对 `contentHash(chapter.content)` 变化的章节标脏；重提该章时**删除该章锚定的旧 event/foreshadow 动作/charstate/loreterm 卡再重建**，并级联把受影响的 arc 卡（所在卷摘要、主线脉络、相关人物弧线、伏笔登记总表）标脏；
4. **聚合卡生成**：某卷全部章节均已有 event 卡 → 生成/更新该卷摘要卡；全书就绪 → 主线脉络卡 + 伏笔登记总表 + 各主要人物弧线卡（按出场频率取 Top-N 人物）。聚合也调用模型（输入为该卷全部事件卡摘要而非原文，成本低）；
5. **批量执行**：进度 X/Y、暂停/继续、单章失败重试 1 次后跳过并标记，usage 累计；中途关闭面板不中断任务（stores/ai.js 持有进度状态）；
6. **隐私模式联动**：提取必须发送正文原文——隐私模式开启时自动模式整体禁用，手动构建需弹窗确认。

### 3.4 检索层（`services/ai/retrieval.js`）

- **内存索引**：打开作品时（loadWorkBundle 之后）全量载入该作品 aikb 存活条目，建两张 Map：`byKeyword`（keywords/title/参与人物名 → 卡 id 倒排）、`byRef`（refType:refId → 卡列表）。作品数据变更时增量刷新；
- **查询入口** `kbQuery({ task, anchor, currentChapterIdx, keywordSeeds, limitTokens })`：

| 任务 | 召回策略 |
|---|---|
| plot | 当前章 event 卡（必含）+ 全部活跃 foreshadow 卡（按埋设章邻近度排序，Top 8）+ 出场人物最新 charstate 卡（Top 6）+ 前后 3 章 event 卡 |
| outline | `arc:main` 主线脉络卡（必含）+ 活跃 foreshadow 卡（Top 8）+ 选中节点祖先链绑定章节的 event 卡 |
| lore | 与选中节点标题/文本匹配的 loreterm 卡 + keywordSeeds 命中的 event 卡（取「正文引用」侧面印证） |
| character | 该人物全部 charstate 卡（按章序全量，超 12 条截断）+ 出场 event 卡（Top 6）+ 涉及该人物的活跃 foreshadow 卡 |
| chat | 不预装，由工具循环按需查询（见 5.5） |

- **排序分**（简单可解释，便于报告展示）：`score = w_kind × w_proximity × (1 + 0.1 × keywordHits)`。`w_kind` 按任务定制（如 plot 中 active 伏笔 1.2 / event 1.0 / charstate 0.9）；`w_proximity = 1/(1+0.15×章节距离)`（arc 卡不衰减）；keywordHits 为 keywords/title 命中数（封顶 0.5）。Top-K 按剩余 token 预算截断；
- **降级红线**：知识库为空（未构建 / 全部提取失败）时 `kbQuery` 返回空，装配器完全回落 v1 的 L2 includes 反查——四能力在无知识库时必须照常可用。

### 3.5 可选增强：embeddings 语义检索（默认关）

- **provider.js 扩展** `embed(texts[])`：OpenAI 兼容 `POST {baseURL}/embeddings`（`input` 数组、`model` 独立配置），返回 Float32 向量；错误分类复用 `AI_ERROR_CODES`，无该端点/参数不兼容时报错归类为 `api` 并**静默回落关键词检索**（不阻塞主流程）；
- **设置项**：`ai.embeddings.enabled`（默认 false）、`ai.embeddings.model`（如 DeepSeek/GLM 对应向量模型、Ollama 本地 `nomic-embed-text`）、`ai.embeddings.dim`（模型维度，自动探测记录）；
- **向量入库**：event/loreterm 卡的 `title + body 概述字段` 拼接后按约 500 字分块，写入 `aikbvec`（`vec` 存 ArrayBuffer）；章节正文不做全量嵌入（成本不可控，语义召回以知识卡粒度为主）；`model` 或 `dim` 变更 → 该作品全量重嵌（进度提示，可暂停）；
- **融合排序**：查询文本（当前章末 300 字 / 选中实体描述）→ 查询向量 → 余弦 Top 20，与关键词召回结果做 **RRF（倒数排名融合）**：`score = Σ 1/(60 + rank)`；embeddings 关闭或失败时纯关键词排序；
- **成本提示**：embeddings 开启时在知识库 tab 显示「需嵌入卡片数 × 单价估算」，构建/重嵌前确认。

### 3.6 管理 UI（AiAssistantPanel 新增「知识库」tab）

与「设置」并列的顶部 tab，内容：

1. **状态行**：已提取章数 / 总章数、event ×N、活跃伏笔 ×N（共 M 条）、charstate ×N、loreterm ×N、聚合卡 ×N、**脏章数**（「N 章待更新」红色提示）；
2. **构建/更新按钮**：显示待处理数（脏章 + 未提取章），点击执行批量流水线（进度条 + 暂停/继续 + usage 累计）；旁边「重建全部」（清空该作品 aikb 重来，二次确认）；
3. **条目浏览**：按 kind 过滤的列表，点开卡片详情（body 字段表格化展示）；事件卡可跳转对应章节（复用 jumpTo）；
4. **伏笔登记表视图**：foreshadow 卡的表格式呈现（埋设章 / 内容 / 指向 / 状态 / 回收章），是全书中最值得单独一屏的结构；
5. **归并确认区**：`[新]` 实体列表 → 「登记为新人物 / 并入既有… / 忽略」；
6. **设置联动**：`AiSettings.vue` 新增「知识库」区：更新模式（手动 / 自动增量）、自动模式每日 usage 上限、embeddings 开关 + 模型名。

### 3.7 更新触发（双模式，设置项 `ai.kb.auto`）

| 模式 | 行为 | 成本 |
|---|---|---|
| **手动（默认）** | 章节落盘只标脏计数；用户在知识库 tab 点「更新」才执行 | 完全可控 |
| **自动增量** | autosave 章节落盘钩子 → contentHash 变化 → 空闲队列静默提取该章 + 受影响 arc 卡标脏重建；**每日 usage 上限护栏**（`ai.kb.usageCap`，超出自动暂停并在面板提示次日恢复或手动继续） | 有不可预期调用，故默认关 |

自动模式仅处理**单章增量**（该章提取 + 聚合卡重建），不做全书扫描；隐私模式下自动模式禁用（3.3 第 6 条）。

## 四、上下文装配器改造（context.js）

- **新增 L1.5 知识库召回层**：位于 L1 锚点之后、L2 检索之前。装配顺序调整为 `L0 → L1 → L1.5(kb) → L2(降级保留)`，超限裁剪顺序：先砍 L2 → 再压缩 L1.5（整组放弃）→ 最后压缩 L1/L0。预算：`DEFAULT_BUDGET` 8000 → **10000**（仍可配置）；
- **知识库区块格式**（进 prompt 的文本形态，作为 SYSTEM_BASE v2 中「【知识库】区块」约定的实体）：

```
【知识库】（以下为从作品正文提取的结构化事实，可能存在更新滞后）
◆ 事件卡 · 第12章《xxx》：……
◆ 伏笔卡 · 「玄铁令」（第3章埋设，未回收）：……
◆ 人物状态 · 林昭（截至第12章）：立场——……（依据：……）
◆ 设定词条 · 「洗脉」：……
◆ 主线脉络：……
```

- **report / dropped 透明化**：L1.5 各块计入发送范围报告（「知识库召回：事件 ×3、活跃伏笔 ×5、人物状态 ×2」）；脏章 > 0 时报告追加一行「知识库含 N 章未更新，结构化事实可能滞后」；
- **plot 任务的文风样本**：L1 新增「章节末尾 300 字原文」块（当前章不足 300 字则全量），供起笔示例对齐文风（隐私模式不发送，报告注明）。

## 五、四能力 + 问答提示词重写（prompts.js v2，全文草案）

### 5.0 人设基底 `SYSTEM_BASE` v2

```
你是「恍然梦」，嵌入在本地小说创作软件「小说工坊」中的 AI 创作顾问——一位资深的中文小说编辑：克制、专业、尊重作者的主导权；你只提供建议与草案，把最终决定权留给作者。随消息提供的是按任务装配的只读作品上下文（作品元信息、人物卡、设定树、大纲树、章节正文或摘要、知识库卡片、检索片段），产出内容必须与既有设定、人物、时间线、伏笔保持一致。

上下文中若包含【知识库】区块（事件卡、伏笔卡、人物状态卡、设定词条、主线脉络），它们是从作品正文中提取的结构化事实：你的产出必须优先与这些事实保持一致；若知识卡与正文片段冲突，明确指出矛盾所在并提示作者知识库可能过期，不要自行取舍。

你只提供建议与草案：最终写入由用户确认后才执行，因此不要声称已经修改了任何内容。

（接 JSON_DISCIPLINE，原文不变）
```

### 5.1 正文发展（plot / BranchCard v2）

```
【任务：正文发展】
基于当前章节正文、前情摘要与知识库召回（当前章事件卡、活跃伏笔、出场人物状态卡），提出 2–4 条后续剧情线路。要求：
- 每条线路的 strategy 互不相同，从五种叙事策略中选取：steady（稳健推进）、escalate（冲突激化）、twist（意外转折）、payoff（伏笔回收）、seed（伏笔铺垫）；禁止给出同一走向的措辞变体；
- 张力点/风险要具体到情节冲突（谁与谁、争什么、代价是什么），不要空泛；
- 涉及人物只用上下文中出现过的名字；
- 起笔示例为 200–400 字小说叙述文体：直接衔接当前章节最后一句，模仿【文风样本】的叙事节奏与用词习惯，不重复已有内容；
- impact 为结构化对象：foreshadow 写该线路对既有伏笔的影响（引用伏笔卡并注明埋设章，无则写「无」）；characters 写对出场人物状态的影响；outline 写对大纲节点的影响；
- consistency 用一两句话自检：该线路与既有设定、时间线、人物状态是否存在冲突，如何规避。

【输出 JSON schema】
{
  "lines": [
    {
      "title": "线路名，不超过12字",
      "strategy": "steady|escalate|twist|payoff|seed",
      "summary": "一句话梗概",
      "tension": "张力点/风险",
      "characters": ["涉及人物名"],
      "opening": "200–400字起笔示例",
      "impact": { "foreshadow": "…", "characters": "…", "outline": "…" },
      "consistency": "一致性自检说明"
    }
  ]
}
lines 数组长度必须为 2–4。
```

卡片侧：BranchCard 显示策略徽标（五种策略五色）、impact 三行分区、consistency 折叠区。

### 5.2 大纲规划（outline / PlanCard v2）

```
【任务：大纲规划】
对选中的大纲节点给出 2–3 套分支线路方案树，结合知识库召回（主线脉络、活跃伏笔、相关事件卡）。要求：
- 每套方案包含 2–6 个子节点草案，按叙事顺序排列，能作为选中节点的直接子级挂载；
- positioning 用一句话说明该方案在主线中的定位与取舍（侧重什么、放弃什么）；
- 每个子节点草案含标题（不超过20字）、要点（1–3句）、purpose（该节点的叙事功能，取值：推进冲突/埋设伏笔/回收伏笔/人物成长/世界观展开）与连线语义建议；
- 连线语义建议 edge 只能取："cause"（因果）、"foreshadow"（伏笔）、"conflict"（冲突）或 ""（不连线）；purpose 为埋设伏笔/回收伏笔时 edge 应为 "foreshadow"；
- 2–3 套方案中至少一套应利用可回收的既有伏笔（引用伏笔卡，注明埋设章）；
- 方案间相互有实质差异；不得与现有大纲树中已存在的节点重复。

【输出 JSON schema】
{
  "plans": [
    {
      "name": "方案名，不超过12字",
      "positioning": "方案在主线中的定位与取舍",
      "idea": "该方案核心思路一句话",
      "nodes": [
        { "title": "节点标题", "points": "要点1–3句", "purpose": "推进冲突|埋设伏笔|回收伏笔|人物成长|世界观展开", "edge": "cause|foreshadow|conflict|" }
      ]
    }
  ]
}
plans 数组长度必须为 2–3，每套 nodes 长度必须为 2–6。
```

卡片侧：PlanCard 显示 positioning 与节点 purpose 标签；应用逻辑不变（olnodes 批量挂载 + rel 连线）。**顺手修复**：应用目标从全局 `work.selOlnodeId` 改为卡片记录的 `anchorId`（与 BranchCard/DiffCard 对齐——现状发起任务后改选节点会挂错位置）。

### 5.3 设定扩展（lore / DiffCard v2）

```
【任务：设定扩展】
针对选中的设定节点，结合知识库召回（相关设定词条、正文相关引用），给出以下两种产出之一（用 mode 字段区分）：
- mode="add"：新增条目草案——tree 为要挂到选中节点下的子树草案，与既有设定不重复、风格一致；
- mode="expand"：现有节点扩写——revised 为选中节点改写后的完整新文本（不是增量补充），note 用一句话说明改动点，便于 diff 对照。
一致性要求：
- 扩展内容必须兼容上下文中的人物、势力、地点等既有设定，不得与知识库中的设定词条、人物状态卡矛盾；
- basis 列出每条新增/改写内容的推断依据：claim 写新增了什么设定点，source 写依据出处（引自哪条既有设定节点、正文细节或知识卡）；确属无依据的原创补充，source 写「无依据原创」，并在 note 中向作者说明；
- conflict_note 指出与既有词条或知识卡的潜在冲突及处理方式，无冲突则留空字符串；
- 设定树其他节点已有的内容不要照抄。

【输出 JSON schema】
{
  "mode": "add 或 expand",
  "tree": { "text": "节点文本", "children": [ { "text": "节点文本", "children": [] } ] },
  "revised": "扩写后的完整新文本",
  "note": "改动说明",
  "basis": [ { "claim": "新增/改写的设定点", "source": "依据出处" } ],
  "conflict_note": "与既有设定的潜在冲突说明，无则空字符串"
}
mode="add" 时 tree 必填（revised 留空字符串）；mode="expand" 时 revised 必填（tree 为 { "text": "", "children": [] }）。
```

卡片侧：DiffCard 新增「依据」列表与冲突提示条（conflict_note 非空时黄色警示）。

### 5.4 人物丰富（character / DiffCard v2）

```
【任务：人物丰富】
针对选中人物，结合知识库召回（该人物的状态卡时间线、出场事件卡、关联伏笔）与出场章节文本反推，给出四类建议（均可为空）：
- fields：字段补全——只针对档案中缺失或明显薄弱的字段（如外貌、性格等），依据出场章节描写推断，不要与已有字段值重复；每条建议末尾用括号注明依据：「（见《第X章》）」或「（合理推断）」；
- bio：小传扩写——在现有小传基础上扩写的完整新小传文本（不是增量片段），按成长弧线组织：起点 → 关键转变事件（引用具体章节）→ 当前状态；无需扩写则留空字符串；
- aliases：别名建议——依据正文中对该人物的实际称呼（含未收录的称呼），最多 5 个；
- relations：新增关系建议——对端人物 name 必须是上下文中出现过的人物，label 为关系名（如「师徒」「宿敌」），basis 说明关系演变的依据（哪一章发生了什么）。
evidence 列出本次建议的主要依据（章节引用或知识卡引用），便于作者核对。

【输出 JSON schema】
{
  "fields": { "字段名": "建议内容（含依据标注）" },
  "bio": "扩写后的完整小传，无需则为空字符串",
  "aliases": ["别名建议"],
  "relations": [ { "name": "对端人物名", "label": "关系名", "basis": "关系演变依据" } ],
  "evidence": ["依据引用清单"]
}
四类建议至少给出其中一类。
```

### 5.5 自由问答（chat v2）

- **工具循环注册新工具**（与既有 5 个只读工具并列，均只读）：
  - `search_kb({ query, kind?, limit? })` — 关键词查知识卡（走 retrieval 内存索引）；
  - `get_foreshadows({ status? })` — 伏笔登记表（active/paid 过滤）；
  - `get_char_timeline({ characterId })` — 人物状态时间线（charstate 卡按章序）；
- **提示词追加**：

```
回答优先引用【知识库】区块与工具返回的知识卡事实，并注明卡片类型与章节出处（如「据伏笔卡（第3章埋设）」）；知识卡与正文片段冲突时说明矛盾并提示知识库可能过期。若知识库未构建（上下文无【知识库】区块且 search_kb 返回空），如实说明并仅依据已有上下文回答。
```

## 六、写入安全与成本纪律（增量）

1. **知识库是 agent 私有资产**：aikb/aikbvec 只被 agent 读写，不进作品导出（`buildBookText`/docx/TXT 导出不含），但**进 JSON 备份**（`exportBackupJson` 全表 dump 自然覆盖，恢复后知识库随之恢复）；
2. **归并确认仍是提案制**：`[新]` 实体「登记为新人物/词条」走现有 `addCharacter`/`mubuAddTree` 动作，用户确认后才写；
3. **查询参数绑定**：aikb 全部查询走 Dexie `where()` 结构化条件，无字符串拼接（沿用 Mimosa 数据库约束）；
4. **成本三重护栏**：手动默认 + usage 累计显示（知识库 tab 单列「构建用量」）+ 自动模式每日上限；
5. **隐私模式**：提取/装配发送正文原文的动作在隐私模式下的行为见 3.3/四；
6. **全部任务手动或用户显式开启的自动**：不新增任何无感知后台调用（自动增量是用户显式开启的功能，且有上限护栏与暂停提示）。

## 七、代码落点

**新增**
- `src/services/ai/knowledge.js` — 知识库流水线（单章提取、实体对齐、聚合卡、脏章失效、批量执行器）
- `src/services/ai/retrieval.js` — 内存索引 + kbQuery + RRF 融合（embeddings 可选）

**改动**
- `src/db/database.js` — v8 迁移新增 `aikb`（E1 起 `aikbvec`）
- `src/db/repo.js` — aikb CRUD（where() 参数化）；备份恢复自然覆盖，无需特判
- `src/services/ai/prompts.js` — SYSTEM_BASE v2 + 四能力 + chat 重写 + 新增提取模板；`systemPromptFor` 增加 `knowledge` 任务类型
- `src/services/ai/agent.js` — runCardTask 接收 kb 召回块并注入 user 消息；chat 工具循环注册 3 个知识库工具；`validateCards` 适配新字段（strategy/positioning/purpose/basis/conflict_note/evidence/impact 对象化）
- `src/services/ai/context.js` — L1.5 层、DEFAULT_BUDGET 10000、plot 文风样本块、report/dropped 透明化
- `src/services/ai/provider.js` — `embed()`（可选阶段）
- `src/services/ai/summarize.js` — 章节落盘标脏钩子处同时触发 aikb 标脏（或挂在 autosave 同一钩子位）
- `src/stores/ai.js` — 知识库状态（统计/脏章/构建进度/暂停）+ 设置项（`ai.kb.auto`、`ai.kb.usageCap`、`ai.embeddings.*`）
- `src/components/ai/AiAssistantPanel.vue` — 「知识库」tab（状态行/构建/浏览/伏笔登记表/归并确认）
- `src/components/ai/BranchCard.vue` / `PlanCard.vue` / `DiffCard.vue` — 新字段渲染（策略徽标/定位/依据列表/冲突提示/一致性折叠区）；PlanCard 改用 `card.anchorId`
- `src/components/ai/AiSettings.vue` — 知识库与 embeddings 设置区

**验收脚本**
- `tools/ai-verify.mjs` 扩展（见八）
- `tools/mock-ai.mjs` — 增加知识库提取（固定 JSON）与 embeddings（固定向量）mock 端点

## 八、验收方案

`tools/ai-verify.mjs`（CDP 9222，mock provider）新增用例：

1. **流水线**：mock 逐章返回固定提取 JSON → 断言 aikb 落库条数/类型正确、串行顺序、活跃伏笔名单滚动正确（第 3 章 set → 第 7 章 payoff 后 active 数减一）
2. **失效**：修改第 5 章正文 → 断言仅第 5 章相关卡标脏重提 + 卷摘要卡重建
3. **实体对齐**：mock 返回 new_entities → 归并确认区出现 →「并入既有人物」后 charstate 卡 refId 正确
4. **装配**：plot/outline/lore/character 四任务断言 L1.5 知识库块内容与排序（邻近度）、脏章提示行、报告清单；**清空 aikb 后断言回落 v1 L2 行为**
5. **提示词**：断言四任务 system 含 v2 新约束关键词（strategy/positioning/basis 等）、plot 的 user 消息含【文风样本】
6. **卡片**：BranchCard 策略徽标渲染、DiffCard 依据列表、PlanCard 应用到 anchorId（含「发起后改选节点」回归用例）
7. **chat 工具**：mock 触发 search_kb / get_foreshadows → 工具结果回喂正常
8. **护栏**：自动模式设 usageCap=1 → 落盘触发提取 → 断言暂停与提示；隐私模式下自动模式禁用
9. **（E1）embeddings**：mock /embeddings 返回固定向量 → 断言 aikbvec 落库与 RRF 排序变化；端点 404 时断言静默回落关键词
10. **回归**：dl / annotation / olcanvas / shelf / ai-verify v1 用例不破坏，`npm run build` 通过

真实 API 冒烟（手动可选）：DeepSeek 连接测试 + 单章提取 + plot 任务全链路。

## 九、实施阶段

| 阶段 | 内容 | 依赖 |
|---|---|---|
| K0 地基 | schema v8 aikb + repo CRUD + knowledge.js 骨架（标脏/统计）+ 知识库 tab 骨架 | — |
| K1 提取流水线 | 单章提取 prompt + 批量执行器 + 实体对齐/归并确认 + 聚合卡 + 隐私/护栏 | K0 |
| K2 检索接入 | retrieval.js + context.js L1.5 + 降级路径 + report 透明化 | K1 |
| E1 embeddings（可选） | provider.embed + aikbvec + RRF 融合 + 设置区 | K2 |
| P1 提示词 v2 | SYSTEM_BASE v2 + 四能力重写 + validateCards 适配 + 卡片新字段渲染 + PlanCard 锚点修复 | K2（提示词可先行，知识库空时行为不变） |
| P2 问答与验收 | chat 三工具 + ai-verify/mock-ai 扩展 + 真机回归 | P1 |

K 线（知识库）与 P 线（提示词）可并行：P1 在无知识库时保持 v1 行为，先上提示词升级也能独立产生价值。

## 十、风险与对策

- **提取质量不稳（漏提/编造）** → 严格 schema + 实体名单约束 + 「宁缺毋滥」指令 + 失败单章重试/跳过标记 + 条目可人工浏览纠错（删卡后该章自动视为脏，下次更新重提）
- **知识库过期误导生成** → 脏章计数常驻显示 + 装配报告提示行 + SYSTEM_BASE v2 要求模型发现冲突时主动提示 + chat 工具回答附「知识库可能过期」
- **成本失控** → 手动默认 + 构建用量单列累计 + 自动模式每日上限护栏 + 聚合卡用卡片摘要而非原文
- **embeddings 兼容性参差** → 默认关闭、独立开关 + 模型名配置 + 无端点/失败静默回落关键词检索
- **隐私泄露面扩大** → 提取需发原文，隐私模式下自动模式整体禁用、手动需确认；知识卡本身含情节事实，属本地数据不出设备（除调用 API 时）
- **aikb 膨胀** → 单章卡数量上限（提取 prompt 限制 events ≤5/章）+ 软删 + 重建按钮兜底；IndexedDB 容量远大于文本量级，暂无需清理策略
- **与 aisum 的职责混淆** → aisum 管章节摘要（L1 用、无结构、成本低），aikb 管结构化知识（L1.5 用）；不迁移不合并
