# 测试脚本兼容表

> 「是否需要隔离才能运行」的判定依据：脚本是否命中全局进程终止、固定 CDP 端口、固定 dev profile、用户数据目录、Electron 依赖。

> **本表是某次自动扫描的快照，不代表表内脚本仍在维护。** 2026-11-12 仓库整理时已有 15 个脚本停用并移入 `tools/retired/`（10 个依赖已归档目录或仓库外绝对路径，5 个依赖已归档的校准页），停用清单见 [docs/验收记录.md](../../验收记录.md)。表内这些条目的「可跑」结论已失效。

## 扫描统计

- 扫描脚本：**167** 个
- 命中风险：**44** 个

| 风险类型 | 命中处数 |
|---|---|
| 依赖 Electron | 29 |
| 固定 CDP 端口 9222 | 35 |
| 固定 dev profile | 13 |
| 用户数据目录 | 3 |
| 全局进程终止 | 8 |
| 删除文件/目录 | 4 |

## 判定口径

- **可跑**：纯 Node，无风险命中。可直接作为回归闸。
- **需隔离**：命中风险，必须指定独立端口/临时 profile/临时数据目录后才能运行。
- **禁止跑**：会终止其他进程或写用户数据目录。本工作流绝不调用。

## 按脚本

| 脚本 | 可用性 | 依据 |
|---|---|---|
| `tools/_ai-test-profile.mjs` | 可跑 | 未命中任何风险 |
| `tools/_capture-main.mjs` | 需隔离 | 依赖 Electron @56；依赖 Electron @73 |
| `tools/_cdp-lib.mjs` | 需隔离 | 固定 CDP 端口 9222 @1；固定 CDP 端口 9222 @2 |
| `tools/agent-chat-ui-unit-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/agent-chat-ui-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/agent-chat-ui-visual-verify.mjs` | 需隔离 | 依赖 Electron @27；依赖 Electron @30 |
| `tools/agent-chat-ui-window-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/agent-task-unit-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/agent-task-verify.mjs` | 需隔离 | 固定 CDP 端口 9222 @31 |
| `tools/agent-workbench-unit-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/agent-workbench-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/ai-entry-unit-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/ai-entry-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/annotation-verify.mjs` | 需隔离 | 固定 dev profile @1；固定 CDP 端口 9222 @4；固定 dev profile @4 |
| `tools/book-electron-verify.mjs` | 需隔离 | 依赖 Electron @15 |
| `tools/book-poster-queue-test.mjs` | 可跑 | 未命中任何风险 |
| `tools/book-theme-layout-test.mjs` | 可跑 | 未命中任何风险 |
| `tools/book-worker-client-test.mjs` | 可跑 | 未命中任何风险 |
| `tools/book-worker-lifecycle-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/book-worker-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/book3d-interaction-test.mjs` | 可跑 | 未命中任何风险 |
| `tools/bugfix-verify.mjs` | 需隔离 | 固定 CDP 端口 9222 @4；固定 CDP 端口 9222 @14；固定 CDP 端口 9222 @226 |
| `tools/build-folia-page.mjs` | 可跑 | 未命中任何风险 |
| `tools/builtin-skill-sources-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/builtin-skills-ui-verify.mjs` | 禁止跑 | 依赖 Electron @51；用户数据目录 @52；依赖 Electron @62 |
| `tools/builtin-skills-unit-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/canvas-appearance-test.mjs` | 可跑 | 未命中任何风险 |
| `tools/canvas-model-test.mjs` | 可跑 | 未命中任何风险 |
| `tools/canvas-relations-test.mjs` | 可跑 | 未命中任何风险 |
| `tools/canvas-routing-benchmark.mjs` | 可跑 | 未命中任何风险 |
| `tools/canvas-routing-test.mjs` | 可跑 | 未命中任何风险 |
| `tools/canvasctx-verify.mjs` | 需隔离 | 固定 CDP 端口 9222 @4；固定 dev profile @4 |
| `tools/cdp-test.mjs` | 需隔离 | 固定 CDP 端口 9222 @7 |
| `tools/chapter-title-wrap-verify.mjs` | 需隔离 | 依赖 Electron @18 |
| `tools/chargraph-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/creative-benchmark.mjs` | 可跑 | 未命中任何风险 |
| `tools/creative-quality-fixtures.mjs` | 可跑 | 未命中任何风险 |
| `tools/creative-quality-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/creative-retrieval-unit-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/creative-workflow-unit-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/creative-workflow-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/crimson-book-depth-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/crimson-book-viewer-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/crimson-v3-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/crimson-volume-entry-verify.mjs` | 需隔离 | 依赖 Electron @13；依赖 Electron @27；依赖 Electron @40 |
| `tools/crimson-writing-rail-verify.mjs` | 需隔离 | 依赖 Electron @12；依赖 Electron @32 |
| `tools/dataDir-verify.mjs` | 禁止跑 | 固定 CDP 端口 9222 @6；全局进程终止 @7；全局进程终止 @8；用户数据目录 @19；固定 dev profile @19；全局进程终止 @37 |
| `tools/dl-verify.mjs` | 需隔离 | 固定 dev profile @1 |
| `tools/dlpop-verify.mjs` | 需隔离 | 固定 CDP 端口 9222 @2 |
| `tools/dual-book-art-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/edgeedit-ctx-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/edgepanel-avoid-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/folia-design-capture.mjs` | 可跑 | 未命中任何风险 |
| `tools/freeze-repro-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/gen-blue-noise.mjs` | 可跑 | 未命中任何风险 |
| `tools/glaze-evidence.mjs` | 可跑 | 未命中任何风险 |
| `tools/glaze-fidelity-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/glaze-gallery-demo.mjs` | 可跑 | 未命中任何风险 |
| `tools/glaze-gallery-redesign-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/glaze-gallery-unit-test.mjs` | 可跑 | 未命中任何风险 |
| `tools/glaze-gallery-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/glaze-museum-demo.mjs` | 可跑 | 未命中任何风险 |
| `tools/glaze-museum-shelf-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/glaze-museum-verify.mjs` | 需隔离 | 依赖 Electron @16 |
| `tools/glaze-painting-preference-test.mjs` | 可跑 | 未命中任何风险 |
| `tools/glaze-regression.mjs` | 可跑 | 未命中任何风险 |
| `tools/glaze-shelf-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/glaze-workbench-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/gravity-compile-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/gravity-outline-verify.mjs` | 需隔离 | 固定 dev profile @4；固定 dev profile @51 |
| `tools/gravity-refinement-compile.mjs` | 可跑 | 未命中任何风险 |
| `tools/gravity-refinement-evidence.mjs` | 可跑 | 未命中任何风险 |
| `tools/gravity-refinement-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/gravity-shelf-refinement-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/gravity-workbench-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/html-to-page-png.mjs` | 可跑 | 未命中任何风险 |
| `tools/html-to-pdf.mjs` | 可跑 | 未命中任何风险 |
| `tools/junction-fix-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/knowledge-verify.mjs` | 需隔离 | 固定 CDP 端口 9222 @3；固定 CDP 端口 9222 @5 |
| `tools/library-ipc-unit-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/library-sync-unit-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/line2line-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/lorelink-verify.mjs` | 需隔离 | 固定 CDP 端口 9222 @6 |
| `tools/memory-queue-unit-verify.mjs` | 可跑 | 已实跑验证通过 |
| `tools/mock-ai.mjs` | 可跑 | 未命中任何风险 |
| `tools/mubu-tagpanel-verify.mjs` | 需隔离 | 固定 CDP 端口 9222 @4 |
| `tools/mubu-tags-verify.mjs` | 需隔离 | 固定 CDP 端口 9222 @3 |
| `tools/multiwindow-verify.mjs` | 需隔离 | 固定 CDP 端口 9222 @4；固定 dev profile @4 |
| `tools/olcanvas-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/opencil-mcp.mjs` | 可跑 | 未命中任何风险 |
| `tools/opencil-place.mjs` | 可跑 | 未命中任何风险 |
| `tools/opencil-render.mjs` | 可跑 | 未命中任何风险 |
| `tools/opencil-rpc.mjs` | 可跑 | 未命中任何风险 |
| `tools/opencil-textshot.mjs` | 可跑 | 未命中任何风险 |
| `tools/opencil-tokens.mjs` | 可跑 | 未命中任何风险 |
| `tools/original-booklist-browser.mjs` | 可跑 | 未命中任何风险 |
| `tools/original-booklist-production.mjs` | 可跑 | 未命中任何风险 |
| `tools/original-booklist.test.mjs` | 可跑 | 未命中任何风险 |
| `tools/original-shelf-browser.mjs` | 可跑 | 未命中任何风险 |
| `tools/original-shelf-hit.test.mjs` | 禁止跑 | 用户数据目录 @8 |
| `tools/original-shelf-v2-browser.mjs` | 可跑 | 未命中任何风险 |
| `tools/original-shelf-v2-production.mjs` | 可跑 | 未命中任何风险 |
| `tools/original-shelf-v2.test.mjs` | 可跑 | 未命中任何风险 |
| `tools/original-shelf.test.mjs` | 可跑 | 未命中任何风险 |
| `tools/original-workspace-browser.mjs` | 可跑 | 未命中任何风险 |
| `tools/original-workspace-unit.test.mjs` | 可跑 | 已实跑验证通过 |
| `tools/outline-container-drag-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/outline-mini-drag-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/outline-paper-size-test.mjs` | 可跑 | 未命中任何风险 |
| `tools/outline-routing-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/outline-scope-test.mjs` | 可跑 | 未命中任何风险 |
| `tools/outline-skin-integration-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/pack-smoke.mjs` | 可跑 | 未命中任何风险 |
| `tools/preset-experience-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/preset-unit-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/preset-verify.mjs` | 需隔离 | 固定 CDP 端口 9222 @3；固定 CDP 端口 9222 @5 |
| `tools/preset-windows-verify.mjs` | 需隔离 | 固定 CDP 端口 9222 @3；固定 CDP 端口 9222 @23；固定 CDP 端口 9222 @58 |
| `tools/project-unit-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/project-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/readmode-verify.mjs` | 需隔离 | 固定 CDP 端口 9222 @2 |
| `tools/relation-knowledge-unit-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/relation-knowledge-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/relfollow-verify.mjs` | 需隔离 | 固定 CDP 端口 9222 @5；固定 dev profile @5 |
| `tools/review-cycle-unit-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/rp-fold-verify.mjs` | 需隔离 | 固定 CDP 端口 9222 @5；固定 dev profile @5 |
| `tools/rule-scope-unit-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/seed-demo.mjs` | 需隔离 | 固定 CDP 端口 9222 @8 |
| `tools/seed-verify.mjs` | 需隔离 | 固定 dev profile @51 |
| `tools/settings-startup-verify.mjs` | 需隔离 | 依赖 Electron @19 |
| `tools/settings-verify.mjs` | 需隔离 | 固定 CDP 端口 9222 @2 |
| `tools/shape-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/shelf-flip-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/shelf-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/shot-docs-crimson.mjs` | 需隔离 | 固定 CDP 端口 9222 @8；固定 CDP 端口 9222 @21；依赖 Electron @70；依赖 Electron @336；依赖 Electron @402 |
| `tools/shot-docs.mjs` | 需隔离 | 固定 CDP 端口 9222 @13；依赖 Electron @70；依赖 Electron @264 |
| `tools/sidebar-verify.mjs` | 需隔离 | 固定 CDP 端口 9222 @4；固定 dev profile @4 |
| `tools/skin-unit-verify.mjs` | 可跑 | 已实跑验证通过 |
| `tools/skin-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/stage-budget-unit-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/stage-config-unit-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/stop.mjs` | 可跑 | 未命中任何风险 |
| `tools/story-authoring-unit-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/story-authoring-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/story-context-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/story-rich-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/story-ui-interaction-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/studio-topbar-nav-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/studio-writing-skins-layout.mjs` | 需隔离 | 依赖 Electron @15；依赖 Electron @49；依赖 Electron @62；依赖 Electron @67 |
| `tools/studio-writing-skins-verify.mjs` | 需隔离 | 依赖 Electron @14 |
| `tools/topbar-autohide-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/unified-topbar-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/verify-seeds.mjs` | 需隔离 | 固定 dev profile @4 |
| `tools/visual-fix-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/volume-entry-verify.mjs` | 需隔离 | 依赖 Electron @13 |
| `tools/whole-chapter-apply-unit-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/wordgoal-verify.mjs` | 需隔离 | 固定 CDP 端口 9222 @2 |
| `tools/workflow-save-unit-verify.mjs` | 可跑 | 已实跑验证通过 |
| `tools/writing-application-race-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/writing-experience-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/writing-paper-unit-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/writing-paper-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/writing-paper-visual-verify.mjs` | 需隔离 | 依赖 Electron @18 |
| `tools/writing-paper-window-verify.mjs` | 需隔离 | 依赖 Electron @20 |
| `tools/writing-position-test.mjs` | 可跑 | 未命中任何风险 |
| `tools/writing-workflow-unit-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/writing-workflow-verify.mjs` | 可跑 | 未命中任何风险 |
| `tools/writing-workflow-visual-verify.mjs` | 需隔离 | 依赖 Electron @11 |

## 本工作流回归闸实际调用

只调用以下脚本，且全部已在启动前实跑通过：

- `tools/skin-unit-verify.mjs`
- `tools/original-workspace-unit.test.mjs`
- `tools/memory-queue-unit-verify.mjs`
- `tools/workflow-save-unit-verify.mjs`
- `tools/*.test.mjs` 全量（新增测试按此命名即自动纳入）

其余脚本一律不调用。Electron / CDP 类验收脚本因本环境无 Electron 测试装置，全部未执行。

## 明确禁止

- `tools/dataDir-verify.mjs`：固定 dev profile 且会结束其他 Electron / Vite 进程，禁止原样运行。
- 所有固定 CDP 端口 9222 的脚本：会连到用户正在运行的实例，未隔离前禁止。
- 所有依赖 Electron 运行时的脚本：本环境未提供。
