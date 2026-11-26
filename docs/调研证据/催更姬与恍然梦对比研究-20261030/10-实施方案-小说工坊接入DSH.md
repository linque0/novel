# 10 · 实施方案：把小说工坊作为 DSH 插件接入，用 DSH 平替恍然梦

> 本文是**施工方案**，不是可行性讨论。可行性见 [05-方案C-小说工坊插件化.md](05-方案C-小说工坊插件化.md)；本文回答"具体怎么接、先做什么、凭什么这么做"。
> 目标：在 DSH 里打开小说工坊的完整界面，同时让 **DSH 的 Agent 直接对作品做建议、编辑、审稿、续写**——即 07/08 里恍然梦那套能力，由宿主 Agent + 插件工具承接。

## 一、目标与成功判据

| # | 判据（可验） |
| --- | --- |
| 1 | 在 DSH 侧边栏/工作区里能打开小说工坊完整界面（七模块、画布、皮肤），不是阉割版 |
| 2 | DSH 会话里说"把第 12 章按这个方向续写"，Agent 能读到正确的前文与设定，产出的候选可在界面里逐字对照、确认后落库 |
| 3 | 所有写入仍然经过"提案 → 作者确认 → 落库 → 可撤销"，**Agent 没有直接改库的通道** |
| 4 | 桌面版的既有能力（备份/恢复/版本/统计）在插件版可用；两版数据**不会双向乱写** |
| 5 | 恍然梦的自研循环可以关掉，作者改由 DSH 会话驱动，且质量不降（审稿仍有证据、复核仍全覆盖） |

## 二、三个已验证的技术支点（这条路线成立的原因）

1. **插件可以托管任意 HTTP 响应**：`ctx.connection.fetch.register({ path, methods, requestBody, fetch: async request => Response })`——`adapters/dsh/rpc.js:81-108` 里催更姬用它做 POST+JSON 的 RPC；但签名给的是一个标准 `Request`/`Response`，**返回什么内容类型由插件自己决定**。所以"插件自己托管 `dist/` 静态资源 + 自己渲染 iframe"在机制上成立（⚠️ 静态托管未实测，P0 第一件事就是打这个）。
2. **小说工坊的构建产物天生可子路径托管**：`vite.config.mjs` 里 `base: './'`，`dist/index.html` 引用的是 `./assets/...`（相对路径）。**不需要重新构建就能挂到 iframe 的任意子路径下**。
3. **写入点是集中的**：全库 `db.<table>.<write>` 共 **97 处**，其中 `stores/work.js`(24)、`db/repo.js`(16)、`stores/ai.js`(10)、`db/ai-repo.js`(8)、`db/project-repo.js`(7) 五个文件占 **65 处（67%）**；读点 135 处。**这意味着"同步层"只需先接五个热点，不需要动 309 处 `db.` 调用。**

## 三、三条路线，为什么选 A

| 路线 | 做法 | 代价 | 致命问题 |
| --- | --- | --- | --- |
| **A（推荐）App-in-DSH** | 插件托管 `dist/`，槽位内 iframe 跑完整 SPA；服务端持有权威文件库；op-log 同步 | UI 零改动；数据层加同步层 | iframe 内拿不到 Electron 独占能力（多窗、全局快捷键） |
| B 桌面端 API 桥 | 桌面版主进程开本地 HTTP，渲染进程当数据持有者；插件调它 | 桌面 App 必须常开 | 数据仍锁在渲染进程，工具面一样要从零做；且两套宿主两套同步 |
| C 替换 Dexie 为 RPC repo | 把 `src/db` 换成远程实现 | 26 个文件直连 `db/database`、309 处 `db.` 调用要重写 | 等价重写数据层，最快也要 1 个月且回归面巨大 |

**选 A**：它把"UI 迁移"成本降到接近零（`base:'./'` 已就绪），把工作量集中在真正需要的地方——**服务端权威库 + 同步层 + 工具面**。

## 四、路线 A 的架构

```
DSH 宿主（Node）
├─ Agent 循环（dsh-agent-loop，替代恍然梦的 dialogue.js）
├─ 插件工具面 studio_*  ──────────────┐
└─ 插件 HTTP 路由                      │
   ├─ GET  /api/novelstudio/app/**  → dist/ 静态资源（iframe 用）
   ├─ POST /api/novelstudio/rpc     → 与界面同构的 dispatch（UI 用）
   └─ POST /api/novelstudio/sync    → op-log 提交 / delta 拉取（同步层用）
                                        │
                       ┌────────────────┴──────────────┐
                       │  novelist 核心（Node，权威）  │
                       │  store（文件+索引+事务+版本） │
                       │  proposal（提案/校验/审计）    │
                       │  compose（预设编译/上下文装配）│
                       └────────────────┬──────────────┘
                                        │
DSH 浏览器端（宿主 Web 客户端）
└─ 插件槽位：<iframe src="/api/novelstudio/app/index.html">
   └─ 小说工坊 SPA（原样 dist/）
      ├─ Dexie（本地投影，库名 novel-studio@dsh）
      ├─ 读：日常渲染全走 Dexie（零改动，135 处读点不动）
      └─ 写：97 处写点经 sync 层提交（热点 5 文件先接）
```

**两条通路，一套权威**：
- `studio_*` 工具（Node）与 `/rpc`（界面）都走同一组用例函数，因此"作者在界面里点"和"Agent 调工具"遵守同一套 `expectedRevision`/`requestId`/提案规则——这正是催更姬 `dispatch(action,args,actor)` 的形状。
- iframe 与宿主**同源**（同一 DSH Web 服务），所以 SPA 可以直接 `fetch('/api/novelstudio/sync')`，不需要 postMessage。

## 五、数据层设计

### 5.1 权威库：直接复用"备份 JSON"的实体形状

不新造领域模型。`db/repo.js` 已有 `exportBackupJson()`，导出的是 `{works, volumes, chapters, outlines, characters, relations, lorecats, lore, snippets, assets, links, revisions, wordlog}` 的表集合——**服务端存这同一份形状**，映射到文件就是"每表一个索引 + 每实体一个文件"，与催更姬的布局同构（`docs/architecture.md` 的存储布局 5 可参考，但不必对齐其业务字段）。

收益：桌面版 `备份/恢复` 与插件版**天然互通**；P0 期可以直接拿备份文件当种子数据。

### 5.2 Dexie 的新角色：视图缓存 + 离线草稿

- 库名改为 `novel-studio@dsh`，避免与同源下的其它插件错过（同源共享 IndexedDB）。
- 读路径完全不动：135 处读点继续读 Dexie，界面刷新不受网络/同步影响。
- 写路径：Dexie 先本地写（保留现有手感与自动保存），同时把 op 提交服务端；服务端确认后回一个 `revision`，Dexie 记录到本地。

### 5.3 op-log（同步层的全部复杂度所在）

```ts
type Op = {
  requestId: string           // 幂等键（催更姬同款语义）
  workId: string
  kind: 'put' | 'softDelete' | 'restore' | 'purge' | 'batch'
  table: TableName
  id: string
  baseRevision: number        // 客户端认为的版本
  payload: object             // 与导入导出同形状
  actor: { kind: 'human' | 'agent'; sessionId?: string }
}
type SubmitResult =
  | { ok: true; revision: number; replayed?: boolean }
  | { ok: false; conflict: true; currentRevision: number; current: object }
  | { ok: false; error: string }
```

服务端**唯一提交入口**是一个 `applyBatch(ops, {requestId})`（催更姬 `planning.apply` 的教训：写路径必须只有一条，否则幂等/撤销/审计要写四遍）。

### 5.4 冲突：单写者租约优先于合并

- 租约：`lease { owner:'iframe'|'agent', sessionId, expiresAt }`。界面侧编辑前取租约（自动续），Agent 写入时若租约被界面持有且未过期 → 返回 `BUSY` 并提示"作者正在编辑这一章"。
- 冲突兜底：即使绕过租约，`baseRevision !== currentRevision` 也只会 `CONFLICT` 并回传 `current`，由调用方重读合并——**永不静默覆盖**。
- 这直接复用恍然梦已验证的 `sourceVersions`/`sourceHash` 思路，只是把"事后发现"提前成"事前拒绝"。

### 5.5 delta 回推

服务端每次提交产生 `sequence++`；iframe 侧长轮询 `/sync?after=<seq>`（或 `EventSource`），拿到 delta 后用**现有 repo 写入 API** 应用到 Dexie，并触发 `notifySourceChanged`（`db/database.js` 已有该事件）。**不新增任何 UI 刷新逻辑**，因为界面本来就是响应 store/Dexie 的。

## 六、工具面设计（Agent 侧）

原则：**工具数少、每个工具 schema 强、读写分离、写操作必须是提案**。命名沿用 `studio_` 前缀避免与其它插件撞。

| 工具 | 作用 | 对应恍然梦能力 | 关键参数 |
| --- | --- | --- | --- |
| `studio_works` | 列书 / 打开（会话级焦点） | `workId` 选择 | `{op:'list'|'open', workId?, query?}` |
| `studio_outline` | 读目录树 / 画布节点 | `read_document`/`get_outline_subtree` | `{workId, nodeId?, cursor?, limit?}` |
| `studio_read` | 读正文/设定/人物片段 | `read_chapter`/`get_character`/`get_lore_subtree` | `{kind:'chapter'|'character'|'lore', id, cursor?, maxChars?}` |
| `studio_search` | 全文/结构化检索 | `search_book`/`search_chapters`/`search_kb` | `{query, sourceType?, limit?, cursor?}` |
| `studio_state` | 截至某章的人物状态回放 | `get_entity_state`/`get_char_timeline` | `{entityId, asOfChapterId}` |
| `studio_review` | **结构化审稿**（新） | `chapter.review` + `review-cycle` 契约 | `{scope, asOf, items?}` → `findings[]` 带 `quote/start/evidence.verified` |
| `studio_propose` | 产出候选/提案（不落库） | `chapter.draft/continue/rewrite` | `{kind, anchor, text, basis:[{table,id,revision}]}` |
| `studio_apply` | 应用提案 | `applyProposal` | `{proposalId, action, requestId, expectedRevision}` |
| `studio_undo` | 撤销一次应用 | `undoApplication` | `{auditId, requestId}` |
| `studio_canvas` | 画布批操作 | 大纲批量 | `{ops:[...], expectedSequence}`（对齐 `applyBatch`） |
| `studio_preset` | 读/预览预设编译结果 | `compilePreset` | `{workId, generationType, preview:true}` |

**与催更姬的关键差异**：催更姬有 66 个 action、4 个工具，模粒度很细；工坊只需要 11 个工具——因为**范围库更大的是"读"**，而"写"收敛成 `propose → apply → undo` 三步。细粒度不应暴露给模型，应藏在用例函数里。

**为什么必须有 `studio_review`**：这是 08 文档里恍然梦最不可替代的资产（唯一定位 + 证据反查 + 复核全覆盖）。如果只做读写不做审稿，DSH 平替恍然梦就只是"能改"，不是"能看住"。

## 七、智能迁移：恍然梦的 14 个部件归谁

| 部件 | 迁移后归属 | 说明 |
| --- | --- | --- |
| 1 模型接口层 | **DSH 宿主** | 供应商、流式、重试、用量全部继承，插件不再管密钥 |
| 2 上下文装配 | **插件服务端** `compose/` | `assembleSlots` + `materialBudget` + `report` 原样搬到 Node（纯函数，无 Vue 依赖） |
| 3 工作记忆 | **DSH 会话** | 宿主自带持久会话，直接修掉"刷新即失"的老问题 |
| 4 长期记忆 | 插件服务端 | `aisum/aikb/aistyle` 落地为文件 + 索引 |
| 5 检索 | 插件服务端 | `retrieval.js`（RRF/向量）纯函数可复用；嵌入模型走宿主配置 |
| 6 规划 | **DSH 宿主** | 宿主的规划/反思/子 Agent 直接替代"硬编码三步" |
| 7 工具系统 | **插件工具面** | 即第六节的 11 个工具 |
| 8 行动与执行 | 插件服务端 | 提案/校验/回滚/审计/撤销（`proposalGuard` 的逻辑整体搬） |
| 9 反思与校验 | 插件 `studio_review` + 宿主循环 | 审稿契约留插件（可验），重规划交给宿主 |
| 10 运行编排 | **DSH 宿主** | 会话/中断/预算/并发交给宿主 |
| 11 可观测性 | 宿主 + 插件 report | 用量归宿主，装配报告归插件 |
| 12 安全护栏 | 两侧 | 隐私模式/密钥归宿主；只读默认/提案制/审计归插件 |
| 13 驾驶层（预设/Skill） | 插件 | `compilePreset` 搬 Node，22 类任务变 Skills |
| 14 学习自适应 | 插件服务端 | 文风档案/作者裁决照旧 |

**一句话**：**部件 1/3/6/10/11 交给宿主，2/4/5/8/9/13/14 留在插件**——这正好等于"把恍然梦的心智内核抽出循环，独立成服务"。

## 八、UI 宿主细节（踩坑清单）

1. **iframe 尺寸**：宿主槽位给的容器高度可能不足；SPA 是整页应用，需 `100vh` 适配 + 内部滚动，不要依赖宿主滚动。
2. **主题隔离**：工坊有四套皮肤（含 `body[data-skin]` 作用域）；iframe 天然隔离 CSS，但**宿主主题不会传导**，需在桥接层把宿主是否为深色传给 iframe（可选）。
3. **同源存储**：同源意味着共享 IndexedDB/ localStorage 配额，库名必须加命名空间（`novel-studio@dsh`），否则会踩到宿主或其它插件的数据。
4. **Electron 独占能力失效**：多窗并排、拆窗、全局快捷键、`window.native.*`（拆窗预览走 IPC）在 iframe 里没有。要么屏蔽入口，要么降级为"同页并排"。
5. **文件拖入/粘贴**：iframe 内粘贴富文本可以；跨 iframe 拖拽文件需要宿主允许，需实测。
6. **打印/导出**：`ExportDialog` 走的是浏览器下载还是 Electron？iframe 内统一走"服务端生成 → 下载链接"更稳。
7. **调试**：iframe 内 SPA 与宿主不同 bundle，日志与会话要分开抓。

## 九、分期实施（每期可独立交付、可回退）

### P0 · 打通"能看见、能读"（8–12 人日）

- 插件骨架：`package.json`（`dsh.bundle.patch`、`main`、`exports["./client"]`）+ `cordis.patch.yml`。
- `fetch.register` 静态托管 `dist/`（**先做这一条，验证支点 1**）+ iframe 槽位。
- 服务端只读库：从桌面版备份 JSON 导入（`exportBackupJson` 形状）。
- 3 个只读工具：`studio_works`/`studio_outline`/`studio_read`。
- **验收**：DSH 里打开 iframe 能看到书架与正文；问"这部书写到第几章、主角叫什么"能正确回答；静态资源的 Content-Type/Cache 正确。

### P1 · 工具面补全（10–15 人日）

- `studio_search`/`studio_state`/`studio_preset`；`compose/` 搬到 Node（复用 `novel-context.js`/`retrieval.js` 纯函数）。
- **验收**：同一条问题在插件版与桌面版得到相同证据集（citation 一致）。

### P2 · 写通路（12–18 人日，最重一期）

- `applyBatch` + `requestId` 幂等 + `expectedRevision`；`studio_propose`/`studio_apply`/`studio_undo`。
- 同步层：先只接五个热点文件（`stores/work.js`、`db/repo.js`、`stores/ai.js`、`db/ai-repo.js`、`db/project-repo.js`）。
- 界面侧：沿用现有 `DiffCard`/`ReviewPanel` 做确认；提案列表改成从服务端拉。
- **验收**：Agent 提一个续写提案 → 界面逐字对照 → 确认落库 → 撤销可回原样；同一 `requestId` 重试不重复落库。

### P3 · 回推与互斥（8–12 人日）

- delta 长轮询 + `notifySourceChanged`；租约；冲突提示文案。
- **验收**：Agent 改设定后，界面 3 秒内自动刷新且不打断正在编辑的草稿；作者编辑中 Agent 写入被拒并给出可操作提示。

### P4 · 智能迁移（12–20 人日）

- 22 类任务 profile → Skills（渐进披露，见 09·C14 的共享段结论）；`compilePreset` 搬 Node；`studio_review` 落地五函数契约。
- 关掉恍然梦的自研循环（保留代码但默认不走），AI 面板改为"在 DSH 会话里继续"的入口。
- **验收**：审稿发现的问题带 `quote` 与 `verified` 证据；复核必须全覆盖，伪造 resolved 会被降级。

### P5 · 硬化（8–12 人日）

- 升级/迁移/备份/校验（对齐催更姬 `upgrade.md` 的成熟度）；大书性能（分页、索引、懒加载）；双开与租约边界。
- **验收**：10 万字作品冷启动 < 2s；备份/恢复往返后 hash 一致。

**合计 58–89 人日**（对比 05 文档的全量估算 80–128：少的是"UI 宿主化"和"替换 Dexie"这两块被 iframe + op-log 绕过了）。

## 十、风险与回退

| 风险 | 早期信号 | 处理 |
| --- | --- | --- |
| 静态托管不成立（支点 1 被推翻） | P0 首次 GET 返回 404/被中间件拦截 | 退回"插件只提供 RPC，UI 由 `dsh-resource://` 面板承载"；再不行走路线 B |
| 同步层把数据搞坏 | 往返 hash 不一致 | 服务端每次提交前存快照；任何不一致走"以服务端为准 + 本地库重建"（Dexie 可重建，因为它是投影） |
| 界面与 Agent 抢写 | 频繁 `BUSY` | 租约粒度从"作品"细化到"章节" |
| iframe 体验塌方（快捷键/多窗/性能） | 作者主观抵触 | 保留桌面版为正主，插件版定位"移动/远程/协作面" |
| 两份数据漂移（桌面版 vs 插件版） | 同一本书两处字数不同 | 明确"单一可写宿主"：插件版导入后，桌面版只读导出；反之亦然 |

## 十一、明确不做

1. **不做双向自动同步**（桌面版 ⇄ 插件版）。要共享就"一个写者 + 导出/导入"。
2. **不在这一轮重写 AI 面板**：恍然梦的 UI 保留，只是它的"大脑"不再被使用。
3. **不把 309 处 `db.` 调用改成 RPC**：那等于换掉数据层（路线 C）。
4. **不让工具直接改库**：所有写必须 `propose → apply`，与现有红线一致。
5. **不追求 Electron 独占能力等价**（多窗/全局快捷键/系统托盘）。

## 十二、假设（不成立就要重新规划）

1. `ctx.connection.fetch.register` 能返回非 JSON 的响应且支持 GET（⚠️ P0 首日验证）。
2. iframe 与宿主同源，因此可直接 `fetch` 插件的 `/api` 路由（若跨源，改走 postMessage 桥）。
3. 作者接受"插件版里没有拆窗与全局快捷键"。
4. 20 万字以内的作品，op-log + 全量索引的内存开销可接受（超过要分卷懒加载）。
