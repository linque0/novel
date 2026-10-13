# 恍然梦「书库读模型」数据架构方案（纯方案交付 · 不实施）

> 本方案为设计交付物：**批准仅代表方向确认，不写文件、不改代码**；如需落盘为 docs/ 正式文档（与 v2/v3 方案并列）或分阶段实施，请另行指示。
> 关联：docs/AI助手接入方案.md（v1 基线）、docs/AI助手优化方案-恍然梦v2.md（知识库 K 线）、docs/AI助手优化方案-恍然梦v3-酒馆式注入引擎.md（W 线）。本方案定位为二者的**公共数据底座**；v3 §14.4 边界（不引入框架/MCP/向量库）继续有效。
> 定位假设（可指正）：恍然梦与应用同进程 → 核心是**应用内投影层**；磁盘镜像列为可选阶段 P3。

## 一、现状问题（代码证据）

| # | 问题 | 证据 | 后果 |
|---|---|---|---|
| 1 | 无「模型可读文本」一等公民 | 章节是 TipTap HTML（content + fmt）；各消费点用 `plainChapter()` 即时剥离 | 重复解析；证据偏移在临时文本上计算（knowledge.js:103 `text.indexOf(quote)`），改文即失效 |
| 2 | 无统一文档层 | 章节 HTML／幕布树(text+html)／大纲图(olnodes+rels)／人物(fields)／批注(span 锚)／灵感，六种形态 | novel-context.js 每槽一套读取逻辑；agent 与外部解析成本高、易漂移 |
| 3 | 无分块层 | 提取按 4500 字符硬切（knowledge.js:13-26，无 token 折算/无重叠/无稳定块 id） | v3 已录 P0：长章系统性失败；无块级增量、无段落级引用 |
| 4 | 摘要断线 | aisum 表与失效协议齐备，但所有调用点传 `provider=null`（novel-context.js / tools.js） | 运行时**从不生成摘要**；「前情摘要」槽长期为空 |
| 5 | 检索只覆盖实体卡 | retrieval.js 只查 LLM 提取的 aikb 卡；正文未嵌入；中文分词弱、未命中归零（v3 P0 #4） | 「主角为什么离开」这类正文级问答召回不到 |
| 6 | 磁盘零可读产物 | 数据全在 LevelDB（`%APPDATA%\小说工坊[-profile]\IndexedDB`） | 外部工具/Obsidian/其他 agent 无法读取；云同步与 SQLite 迁移缺透明中间层 |

## 二、设计原则
1. **源表零改动**：27 张表仍唯一事实源；投影与派生资产全部可重建、可丢弃。
2. **读写分离**：agent 只读投影；写入仍走提案制与既有 store 路径。
3. **零成本基线**：不调模型即可全文检索与装配上下文；LLM 提取/摘要/向量是增强层，可关。
4. **增量幂等**：按源 hash 失效，按块缓存；版本号变更可一键重建。
5. **多窗口纪律**：派生构建由主窗口唯一执行（复用 `isMain` 判定 + airuns 租约模式）。
6. **隐私统一降级**：隐私模式在投影/分块层统一裁剪，不再逐调用点处理。

## 三、目标架构

```
源数据（27 表 · 唯一事实源 · 零改动）
   │ 投影管线：脏信号(防抖) → 按作品重建受影响文档 → hash/版本失效
   ▼
① 文档投影层   aidoc（文档）/ aichunk（分块）      ← 新表（Dexie v11）
   轻 Markdown 文本 · 标题路径 · 阅读序 · token 数 · hash
   ▼
② 派生知识资产（现有表强化接线）
   aisum 摘要接线（章/卷/全书=书卡）· aikb 提取改分块 · 分块向量(可选)
   ▼
③ 消费面（agent 唯一读取入口）
   装配槽/kbQuery 改读投影（引用到段）· buildContextPack 预算化上下文包
   ▼（可选 · 阶段 P3）
④ 磁盘镜像：每本书一个文件夹（Markdown + JSON manifest）
```

## 四、详细设计

### 4.1 文档投影层（新表，派生可重建）
```js
aidoc:   'id, workId, [workId+sourceType], [workId+orderIdx], hash'
aichunk: 'id, workId, docId, [docId+idx], hash'
```
**aidoc**（每本书的每个可读单元一条）：`id` 稳定（`doc:<workId>:<sourceType>:<sourceId>`）；`sourceType` = chapter/volume/mubu/olnode/character/relation/snippet/annotation/work；`headingPath`（如「卷二 / 第 14 章《雾港夜航》」「设定 / 世界观 / 地理」）；`orderIdx`（阅读序用 collectExportChapters 同口径；树用前序 DFS）；`text`（轻 Markdown）；`tokens/hash/sourceHash`；`meta`（章 status/字数、人物 role/tags、大纲 kind/连线等源字段投影）。

**aichunk**：`{ id, docId, workId, idx, headingPath, text, tokens, hash, offset }`；分块 = 段落聚合 + token 预算（默认 ~640，可配）+ 相邻 ~15% 重叠 + 句界切分 + 稳定 id。

**文本规范化（轻 Markdown）**：章节 HTML→MD 复用 `importers.htmlToMd`，双链 `span[data-dl-target]` → `[[类型:名]]` 可解析形态，批注 span 移出正文另成文档并按段归位；幕布树前序 DFS 路径化；大纲含 rels 连线语义（label/kind/arrows → 「—(因果)→」）；人物=档案字段表+小传+别名+关系行。

**管线**：全量重建 + 增量（autosave 批次收尾收集脏 `(workId,table,id)`，复用 autosave.js:47-51 既有广播；防抖 3s；主窗口唯一执行；卷重排/拆并章按卷重建 orderIdx）；`db-restore` 暂停作废→完成后重建；`PROJECTION_VERSION` 不匹配自动重建。**投影不进 JSON 备份**（免费可重建），aikb/aisum 等付费资产照旧进备份。

### 4.2 派生知识资产
- **aisum 接线**（修断线）：生成时机 = 手动构建顺带 / 自动增量（每日上限护栏）/ 打开作品后空闲补齐；`entityType` 扩 `volume`、`work` → 卷摘要与**书卡**（题材/主线/主要人物/活跃伏笔/目录）＝「每本书作为知识库」的门面。
- **提取改分块**：extractChapter 从 aichunk 取块（修 v3 P0 #1 长章失败）；块级缓存（块 hash 未变且已成功→跳过），成本随改动面积线性化。
- **分块向量（可选）**：aikbvec 由 `cardId` 泛化为 `refType(card|chunk)`（该表仍在未发布分支，随 v11 一并调整）；单块失败跳过并计数。
- **统一读取 API**（新 `services/ai/booksource.js`）：`readBook(workId)`（书目清单/统计/新鲜度）、`queryBook({workId,query,scope,asOfChapterId,limitTokens})`（关键词 2-gram + 可选向量 + RRF，覆盖六类源，含引用）、`bookKnowledge(workId,asOf)`（与现有 knowledgeSnapshot 兼容的聚合视图）。

### 4.3 消费面
- novel-context.js 各槽改读投影（API 兼容、降级红线不变）；发送范围报告附引用（「《卷二》第 14 章 · 第 5 段」）。
- `buildContextPack(workId,{budget,asOfChapterId,scope})`：书卡+大纲骨架+人物表+活跃伏笔+近章摘要+检索块 → 单份 markdown/JSON（含 tokens 与来源清单）；既作装配注入源，也可导出投喂外部模型。
- tools.js 的 search_chapters/read_chapter 底层改走 queryBook（契约不变，召回增强）。

### 4.4 磁盘镜像（可选 · P3）
```
<镜像根>/《书名》[workId]/
  manifest.json        # 版本/计数/各文件 hash/全书 token
  book.md              # 书卡与目录
  chapters/0001-卷一-第01章-章名.md
  characters.md  settings.md  outline.md  outline.json（连线图）
  snippets.md  annotations.md  knowledge/cards.json  knowledge/summaries.json
```
- 写入：投影更新防抖 → 渲染层只生成有变化的文件（比对 manifest hash）→ 新 IPC `mirror:apply({root, files})`（root 内 confinement、拒 `..`/NUL、**临时文件+rename 原子替换**防外部读到半份）。
- 配置：设置「数据」区开关 + 选目录（复用 data:pickDir）+ 打开镜像目录；**默认关闭**并标注「书稿将复制到该目录」。
- 边界：仅单向导出；反向导入留给云同步计划（其快照设计可直接复用本产物）。

## 五、数据模型汇总（v11 迁移清单）
| 表 | 变更 |
|---|---|
| `aidoc` / `aichunk` | 新增（索引见 4.1） |
| `aisum` | entityType 放开 chapter\|volume\|work（字段复用，无索引变化） |
| `aikbvec` | cardId → refType+refId 泛化（未发布代码内调整） |

## 六、代码落点
**新增**：`src/services/project/normalize.js`（规范化）、`chunker.js`（分块）、`pipeline.js`（全量/增量/版本/生命周期）、`src/services/ai/booksource.js`（readBook/queryBook/contextPack）、`src/db/project-repo.js`（CRUD，where() 参数化）。
**改动**：`src/db/database.js`（v11）；`src/services/autosave.js`（批次尾脏收集，不占用 hooks.beforePut 单槽）；`src/services/ai/{summarize,knowledge,retrieval,novel-context,tools}.js`（接线与改读投影）；`src/stores/ai.js` + `KnowledgePanel.vue`（投影状态/书卡预览）；P3：`electron/main.js` + `preload.cjs` + `services/fileio.js`（镜像 IPC 与降级包装）。

## 七、验收设计
| 脚本 | 覆盖 |
|---|---|
| `tools/project-verify.mjs`（新） | 章序/路径/双链令牌/分块边界；改一章只重建该章；卷重排序正确；版本升级重建；restore 暂停与重建 |
| `ai-verify` 扩展 | >4500 字长章分块全成功；aisum 生成；2-gram 召回；引用（chunkId+偏移）可定位 |
| `tools/mirror-verify.mjs`（新·P3） | Node 侧断文件/manifest/原子替换；root 逃逸拒绝 |

纪律：按协作纪律第 13 条只跑相关脚本；里程碑全量回归；CDP 前确认窗口可见（第 12 条）。

## 八、实施阶段（另行排期）
| 阶段 | 内容 | 依赖 |
|---|---|---|
| P0 投影地基 | v11 表 + 规范化/分块/管线 + booksource 最小 API + project-verify | — |
| P1 知识接线 | aisum 生成接线 + 提取改分块 + 块缓存 + 装配/工具改读投影（P0 #1/#4 顺带修复） | P0 |
| P2 语义与书卡 | 分块向量（可开关）+ 卷/全书摘要 + 书卡 + contextPack | P1 |
| P3 镜像 | 目录结构 + mirror:apply + 设置 UI + mirror-verify | P0（可随时插入） |

## 九、风险与对策
| 风险 | 对策 |
|---|---|
| 投影与源漂移 | sourceHash 可校验；脏信号 + 版本号；重建按钮兜底 |
| 大书性能（数千章） | 增量为主、批量事务写、分块可惰性生成 |
| 隐私面扩大 | 隐私模式在投影层统一裁剪；镜像默认关且需显式选目录 |
| 恢复/迁移一致性 | restore 暂停作废+重建；迁移窗口关闭天然停机 |
| 与 aikb 职责混淆 | aikb=付费增强资产，投影=零成本基线，检索层融合互不替代 |
| 镜像半份文件被外部读到 | 临时文件 + rename 原子替换 |

## 十、边界（不做什么）
不改源表结构与主存储介质；不引入 agent 框架/MCP/向量库（v3 §14.4）；不做双向同步（留给云同步计划）；不默认开启章节全量嵌入（成本）。

---
**本次不实施**：以上为完整方案交付；如需将其落盘为 `docs/恍然梦数据架构方案-书库读模型.md`，或从 P0 阶段开始实施，请明确指示。