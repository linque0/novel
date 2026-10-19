# 大纲重置 · 设计稿接入记录（v1.1.3）

把 `docs/outline-workbench-preview/` 的分层画布、纸面素材与编辑体验接入正式 `src/components/OutlineCanvas.vue`，同时保留原有画布能力。设计口径以 `docs/outline-workbench-preview/README.md` 为准，本文只记录正式版落点与验收证据。

## 接入内容

- **分层视图**：`canvasPrefs.scopeId` 为 `null` 时是全书根层，否则是当前容器 id；根层只渲染直接子节点，子容器以章节卡呈现。面包屑、侧栏定位、搜索定位与断线定位都会先进入节点父层。
- **两种编辑入口**：容器卡「进入容器」进入次级自由画布；「就地展开」在卡片内生成递归两列迷你卡网格（窄容器单列）。迷你卡可原位编辑标题/正文、打开抽屉、拖端口连线；展开时同列模块做 220ms 让位。
- **关系投影**：真实关系 id 与 `rels` 数据不变。收起的端点投影到最近可见祖先，层外端点进入「前接/后续」接续卡；同端点同类关系合并为 `类型 · N`，单条边继续支持原有连线编辑与连接点。
- **状态与操作**：事件状态 `done / writing / revise / planned`，进度只统计 `done`；容器章节标签、六色线框、多选封装（一次 undo）、搜索（Ctrl+K）、总览、展开一层、收起已完成、整理布局。
- **素材与皮肤**：正式资源在 `src/assets/outline-paper/`，样式在 `src/styles/outline-paper.css` 与 `src/styles/outline-workbench.css`；四套皮肤通过 CSS 变量覆盖纸面明度/文字色，未改皮肤骨架。素材库只展示纹理，不提供原图下载。

## 兼容边界

- 旧作品不迁移坐标与状态：打开后位于根层，后代通过就地展开或进入容器到达。
- 迷你卡是自动网格，不支持自由拖拽/缩放；需要自由摆放时进入次级画布。
- 合并边不提供逐条手动路径手柄；单条边保留全部原有塑形能力。
- 旧版 Electron 验收脚本（`tools/olcanvas-verify.mjs`、`tools/outline-routing-verify.mjs`）仍按“全量平铺”语义编写，尚未改写为分层语义；本次以纯逻辑测试、构建和四皮肤根层截图作为验收证据。

## 验证

| 命令 | 结果 |
|---|---|
| `node tools/outline-scope-test.mjs` | 29/29 |
| `node tools/canvas-model-test.mjs` | 48/48 |
| `node tools/canvas-routing-test.mjs` | 57/57 |
| `node tools/canvas-relations-test.mjs` | 11/11 |
| `node tools/outline-paper-size-test.mjs` | 5/5 |
| `npm run build` | 通过 |

## 截图

根层四皮肤（正式 Electron，1440 宽）：

- [原版](screenshots/root-original.png)
- [引力书舱](screenshots/root-gravity.png)
- [琉光画境](screenshots/root-glaze.png)
- [赤月戏](screenshots/root-crimson.png)

设计稿中的就地展开、进入容器、抽屉、素材库与窄屏状态见 `docs/outline-workbench-preview/screenshots/`。该目录是原型证据，不是正式应用截图。
