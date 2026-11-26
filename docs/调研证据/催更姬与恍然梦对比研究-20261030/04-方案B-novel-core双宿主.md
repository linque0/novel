# 04 · 方案 B：抽取 novel-core（双宿主架构）

> 目标：让**同一份领域逻辑**既能跑在今天的 Electron/Vue 桌面里，也能跑在明天的 DSH 插件（Node 侧）里。
> 方案 B 不直接产出插件；它是方案 C 的**前置条件**，也是方案 A 的**收口方式**（A 的四项改造做完后，正好可以把它们的公共部分下沉）。

## 1 · 为什么现在做不到双宿主

| 障碍 | 证据 | 后果 |
| --- | --- | --- |
| 存储锁死在浏览器 | `src/db/database.js` 用 Dexie（IndexedDB）；`server.mjs` 明说网页版数据与桌面版**互相独立** | Node 侧看不到任何作品数据，插件工具无从下手 |
| 领域模型藏在 UI 目录 | 大纲画布模型在 `src/components/outline/canvas-model.js`、`canvas-relations.js` | 想复用必须先把它从 Vue 组件树里摘出来 |
| AI 层直接依赖 UI 框架 | `src/services/ai/application.js:1` `import { nextTick } from 'vue'`、`:15` `@tiptap/pm/history` | 这套逻辑无法在 Node 里 import |
| 反应式对象跨层 | stores（Pinia）+ Dexie live objects 直接进 AI 层 | 下沉后需要显式快照/拷贝边界，否则宿主环境拿不到 Proxy |
| 无版本语义出口 | `entityHash`/`sourceHash` 是事后校验 | 外部宿主无法参与并发控制（见方案 A3） |

## 2 · 目标分层

```
novel-core/                 ← 纯 TS/JS，零 Vue、零 Dexie、零 Electron、零 DSH
  domain/                   章/卷/人物/设定/大纲节点/关系/规划事务/预设（纯数据 + 不变式）
  ports/                    StoragePort、BlobPort、ClockPort、IdPort、EmbedPort
  usecases/                 readBook / searchBook / applyProposal / arrangeOutline / compilePreset...
  tools/                    工具定义（名称 + JSON Schema + 执行器），宿主无关
  revision/                 revision 分配、expectedRevision 校验、requestId 幂等
adapters-dexie/             StoragePort 的 IndexedDB 实现（今天的桌面/网页版）
adapters-fs/                StoragePort 的 Node 文件实现（对齐催更姬的"分文件索引 + 锁 + 事务恢复"）
hosts/electron-app/         现有 Vue UI（`src/components`、`src/stores`），只通过 stores 调 usecases
hosts/dsh-plugin/           未来的 DSH 插件（工具 + React UI）
```

**关键约束**：`novel-core` 的任何文件都不允许 import `vue`、`dexie`、`electron`、`@deepseek-ai/*`、`@tiptap/*`。用一条 lint 规则 + CI 断言守住（`node tools/core-purity-verify.mjs`）。

## 3 · 端口契约（草案签名）

```ts
interface StoragePort {
  readIndex(kind: 'works'|'volumes'|'chapters'|'characters'|'lore'|'outline'|'planning'): Promise<IndexEntry[]>
  readEntity(kind: Kind, id: string): Promise<Entity | null>          // 含 revision
  writeEntity(kind: Kind, id: string, patch: Patch,
              expect: { expectedRevision: number; requestId: string }): Promise<WriteResult>
  applyBatch(ops: Op[], expect: { requestId: string }): Promise<BatchResult>   // 原子：全成或全败
  history(kind: Kind, id: string, revision?: number): Promise<HistoryEntry[]>
  restore(kind: Kind, id: string, targetRevision: number,
          expect: { expectedRevision: number }): Promise<WriteResult>
}
type WriteResult =
  | { ok: true; revision: number; replayed?: boolean }        // replayed = requestId 命中
  | { ok: false; conflict: true; currentRevision: number; currentHash: string }
  | { ok: false; error: string }
```

- **Dexie 适配器**：`applyBatch` 用 `db.transaction('rw', ...)`；`requestId` 存 `airequests`（即方案 A3 的表）。
- **Node 文件适配器**：`applyBatch` 用"暂存目录 + 索引提交 + 恢复日志"，语义与催更姬同构（`docs/architecture.md` 的「事务与升级」一节），但**独立实现**，不复制其代码。
- 两个适配器必须通过**同一套契约测试**（`tools/storage-port-conformance.mjs`，参数化跑两遍）。

## 4 · 迁移分期（每期都可回退）

| 期 | 内容 | 判据 | 回退 |
| --- | --- | --- | --- |
| P1 抽取纯函数 | 把 `services/ai` 里的无副作用模块（`presets`/`retrieval`/`knowledge`/`contracts`/`task-profiles`）搬进 `novel-core`，原位置改成 re-export | 既有单测全绿、`npm run build` 通过 | 保留 re-export 层，随时切回 |
| P2 端口化读 | 新增 `StoragePort` 只读方法；桌面走 Dexie 适配器 | 读路径全部经 port，无直接 `db.xxx` | port 内可临时直连 Dexie |
| P3 端口化写 | 写路径改经 `writeEntity`/`applyBatch`（= 方案 A3 落地） | 并发回归 `writing-application-race-verify` 全绿 | 开关回 `mode: 'legacy'` |
| P4 领域模型出组件目录 | `canvas-model.js`/`canvas-relations.js` 移入 `novel-core/domain/outline`，组件只消费 | 画布回归全绿 | 保留旧文件转发 |
| P5 Node 适配器 | 实现 `adapters-fs`，跑通契约测试 | `storage-port-conformance` 两适配器同结果 | 不影响桌面 |
| P6 插件宿主 | 才轮到方案 C | 见 05 | — |

## 5 · 守门条件（不满足就不许进下一期）

1. `node tools/core-purity-verify.mjs`：`novel-core` 零 UI/存储/宿主依赖。
2. `node tools/storage-port-conformance.mjs`：两个适配器行为一致（含冲突、幂等、回滚、历史）。
3. 既有 156 项纯逻辑回归 + `npm run build` 全绿。
4. 桌面版真实作品（脱敏副本）在双适配器上读出的索引与 hash 完全一致。
5. 每次迁移动 `db.version` 都必须幂等重跑两次结果相同（`migration-idempotency-verify.mjs`）。

## 6 · 风险与失败模式

| 风险 | 触发条件 | 处理 |
| --- | --- | --- |
| 双写不一致 | P3 期桌面写 Dexie、Node 写文件同时存在 | 严格串行：同一作品同一时刻只允许一个宿主写；锁在 port 层，不在 UI |
| 事务语义差 | Dexie 事务是短事务，文件适配器是"暂存+提交" | 契约测试强制覆盖"提交中途失败"用例，两适配器都必须整体回滚 |
| 反应式丢失 | 组件依赖 Dexie liveQuery 自动刷新 | port 增加 `subscribe(kind)`，Dexie 适配器用 liveQuery，Node 适配器用 fs.watch，UI 只订 port |
| 性能回退 | port 边界引入额外拷贝 | 只读大正文走"游标流"接口，不整本返回 |
| 范围失控 | 想一次把 3.6 万行全搬 | 硬边界：只搬 `services/ai` + `db` + 画布领域模型（约 8k 行），`components/*.vue` 一律不动 |

## 7 · 工作量

| 期 | 估算（人日） |
| --- | --- |
| P1 | 4–6 |
| P2 | 4–6 |
| P3 | 5–8（含方案 A3） |
| P4 | 6–10（画布是硬骨头） |
| P5 | 10–16（文件适配器 = 锁 + 事务 + 恢复 + 迁移） |
| P6 | 见 05 |
| **合计（到 P5）** | **29–46** |

## 8 · 非目标

- 不做跨宿主实时同步（两台机器/两个进程同时写同一作品）——本地优先软件不需要，成本极高。
- 不改数据语义（章/卷/设定/大纲的关系不动），只搬位置。
- 不为了"看起来像催更姬"而改成文件存储；Dexie 适配器是一等公民。
