# 设定模块增强方案 —— Worldset Studio 功能移植

> 来源：对 <https://myworldstudio.cn/p/prj_ashes>（Worldset Studio）的逆向拆解
> 拆解报告：[世界观设定管理器逆向拆解报告.md](世界观设定管理器逆向拆解报告.md) ｜ 技术档案：`docs/调研证据/worldset逆向技术档案/`
> 目标：用其**可复用的设计与算法**（非代码）增强 `小说工坊 / novel-studio` 的设定模块
> 版本：v1.0.26 为基线 ｜ 撰写日期：2026-10-15

---

## 0. 先明确一个前提：两个产品的设定模型哲学不同

| | novel-studio（现状） | Worldset Studio |
| --- | --- | --- |
| 设定单元 | **幕布式统一节点树**（`mubu`）：`{text, html, tags, parentId, sortOrder, fold}`，任意节点平权，层级即结构 | **分类 + 条目**：条目 = 属性 + 档案字段 + 正文 + 关系边 |
| 设计取向 | 零建模成本、捕捉快、可当大纲用 | 结构先行、可被结构视图与检查引擎消费 |
| 代价 | 无状态、无字段、无引用卡、无结构视图、无检查（**标签已有**） | 前期要先想清楚分类与用途 |

`src/db/database.js` 的 v3 迁移注释写得很清楚：「设定模块改为幕布式统一节点树（取消文件夹/条目二分，任意节点平权）」。**本方案不推翻这个决定** —— 下面所有设计都以「保持统一节点树 + 渐进式增加结构」为前提。

### 核心移植原则

1. **渐进式结构化**：结构是**可选**的。节点可以永远只是一个纯文本条目；一旦给它标上「角色 / 势力 / 地点 / 事件」这类**角色标记（kind）**，它才开始获得建议字段、结构视图席位与检查规则。不设分类树，不做强制建模。
2. **复用而非新造**：图谱、画布、pan/zoom、正交路由、双链与悬停预览、多窗口面板，novel-studio 已有且**强于原站**。移植的是「增量能力」，不是重写。
3. **保住既有 ABI**：`服务/双链` 的 `.dl-link[data-dl-target]` / `[[标题]]` 契约、AI 读模型的 `SOURCE_TABLES` 投影、Dexie 增量版本、验收脚本范式 —— 新增能力必须挂进这些既有管道，否则会出现「设定模块能用、AI 看不见」的断层。

---

## 1. 差距对照

| 能力 | Worldset | novel-studio 现状 | 差距 |
| --- | --- | --- | --- |
| 节点属性（状态/重要度/可见性/别名/摘要/封面） | 7 态状态、5 级重要度、4 级可见性、标签表、别名、摘要、封面+焦点 | **标签已有**（`mubuSetTags`，≤12 个）；**状态/重要度/别名/摘要/封面均无** | ❗结构性缺口 |
| 档案字段 | 模板组 + `fields{}` 扁平表 + 每条目「此字段不适用」 | `characters` 已有 `fields{}` + `tags[]`；mubu 无 | 有先例可循 |
| 正文语义块 | callout×6 / 折叠 / 剧透块 / 行内剧透 / 脚注 / 时间标记 / 批注 / 5 种语义高亮 | 设定节点是 execCommand（仅 B/I/U/S/前景色/背景色）；正文 TipTap 仅有双链与批注两个 mark | ❗表现力缺口 |
| 引用卡与提及 | 块级引用卡 + 行内提及 chip（带状态色） | 仅 `.dl-link` 行内 mark（无块级卡片、无状态色） | 中等 |
| **未绑定引用检测 + 一键全部绑定** | 有 | **无**（只有 `findBacklinks` 反向查） | ❗高性价比缺口 |
| 关系图谱 | 全域条目图谱 + ego 聚焦 + 谱系边投影 + 双渲染 | 仅**人物**关系图，但引擎更成熟（可拖拽建边/边标签编辑/端口/持久布局） | 只需泛化节点域 |
| 时间线 | 四视图 + 纪元（含分段纪年）+ 分支/挂载支线 + 时间树 | **无** | ❗完全空白 |
| 谱系图 | 确定性世代布局引擎 + SVG 渲染层 + 亲属录入 + relations 迁入 | **无** | ❗完全空白 |
| 地点地图 | 多图 + 图钉 + 百分比坐标 + 压缩上传 + 控制势力推导 | **无** | 完全空白 |
| 版本历史 | 条目级、三态触发、canonical 哈希去重、星标保护、字节上限、恢复前自动快照、逐字段 diff | 仅**章节**，30 份/实体、5 分钟节流、无 diff、无星标 | 需泛化 + 补算法 |
| 完整度与一致性检查 | 100 分评分模型 + 17 条规则 + 项目级指标 | 仅大纲 `olBroken`（断链/缺铺垫） | ❗完全空白 |
| 作品仪表盘 | 七块派生组件 | 有字数统计（`StatsModal`） | 中等 |
| 灵感 | 灵感表 + 成熟度 + 两个出口 | 有 `snippets` 表，单一形态 | 低 |

---

## 2. 移植清单（按推荐实施顺序）

成本口径：**S** ≈ 0.5 天内、**M** ≈ 1–2 天、**L** ≈ 3 天以上（单人，含自测）。

### 第 1 期 · 表现力底座（建议先做，决定后面一切）

#### P1-1 节点属性扩展（成本 S，风险低）

给 `mubu` 节点增加**全部可选**字段，老节点保持 `undefined`，全链路 `??` 兜底。注意 **`tags` 已存在**（`work.js:1006 mubuSetTags`，≤12 个、单个 ≤20 字，模板已在渲染 `.ob-tag` 芯片），本项只是补齐其余属性：

```js
// mubu 行已有：{ id, workId, parentId, sortOrder, text, html, fold, tags, deletedAt, createdAt, updatedAt }
// 新增（全部可选）：
{ kind:null,              // 'character'|'faction'|'geography'|'event'|'item'|'concept'|… 角色标记
  status:null,            // 'idea'|'draft'|'refining'|'settled'|'conflict'|'verify'|'dropped'
  importance:null,        // 'core'|'major'|'normal'|'background'|'optional'
  aliases:[], summary:'',
  coverAssetId:null, coverFocus:{x:50,y:50},
  fields:{},              // 扁平字符串表（与 characters.fields 同形态）
  mutedFields:[] }
```

- **`kind` 这个模式项目里已经有了**：`olnodes` 用 `kind: 'event'|'container'|'volume'|'anchor'|'cite'|…`（`work.js:1238`，配 `KIND_META` 的形状/配色表）。给 mubu 加 `kind` 与现有约定一致，不需要发明新概念。
- 迁移：`database.js` 追加 `db.version(12).stores({ mubu: 'id, workId, parentId, kind, [workId+deletedAt], [workId+parentId]' })`（仅新增 `kind` 索引，其余字段无索引需求）。注意本项目惯例是**每个版本列出全部表**。
- 枚举值建议沿用原站语义（译名一致便于后续对照）：状态 7 态、重要度 5 级（含权重 5/4/3/2/1）、可见性 4 级。
- 表现：`MubuTree.vue` 节点前缀色点（按 status）、重要度用字号/字重或用「核心」角标；`MubuView.vue` 顶部工具条（模板 `762-939`，工具条 `773-804`）增加状态/重要度/别名/摘要的快捷编辑。
- 搜索联动：把 `GlobalSearch.vue` 的 `lore` 作用域从「节点文本」扩展到 `aliases + summary + fields`（`tags` 已覆盖）。

#### P1-2 档案字段与「角色标记 → 建议字段」（成本 M）

- 字段描述符：`{key, label, type:'text'|'textarea'|'select', options?, placeholder?}`。
- 每种 `kind` 配一组**建议字段**（可整套关闭，可逐字段「本条目不适用」→ `mutedFields`）：
  - `character`：种族 / 职业 / 年龄 / 阵营 / 状态（存活·死亡·失踪·封印·转生…）/ 首次出场
  - `faction`：类型 / 领袖 / 势力范围 / 立场 / 资源
  - `geography`：地点类型（19 项）/ 所属区域 / 危险度（5 级）/ 气候 / 资源 / 人口
  - `event`：发生时间 / 时间性质 / 地点 / 参与方（与时间线共用一份语义）
  - `item`：类别 / 持有者 / 来源 / 效力
  - `concept`（法则/体系/语言等）：自由字段
- 关键：kind 决定的是**建议**而非约束。节点切换 kind 时不销毁已填值（换回即恢复），只改变呈现的建议字段组。
- 显示策略：作品级开关「只读视图隐藏未填字段」（对应原站 `fieldDisplay.hideEmpty`，默认关）。

> **为什么不做原站的分类树**：novel-studio 的节点树已经是层级；再叠一层「分类」会与树冲突（节点该归哪？）。用「角色标记 + 建议字段」能拿到同样收益（结构视图按 kind 找节点、字段按 kind 建议），且不需要用户先建分类。原站「一个分类可担任多用途」的思想在这里化为「一个节点一个 kind，可用 tags 表达多属性」。

#### P1-3 节点级版本历史（成本 M，风险低）

**做法：泛化现有 `revisions`，不建新表。** 现有 `revisions: 'id, [entityType+entityId], createdAt'` 已经是多实体结构（`src/db/repo.js:118-124`，`src/services/autosave.js:75-84`），只需：

1. `entityType` 从 `'chapters'` 扩展到 `'mubu'` / `'characters'` / `'olnodes'`；
2. 行内补字段：`trigger:'auto'|'manual'|'restore'`、`note`、`hash`（canonical JSON + FNV-1a 32 位）、`bytes`、`starred`、`payload`（多字段快照，章节可只存 content）；
3. 补三条算法（这是原站真正的增量价值）：
   - **哈希去重**：内容未变不写（原站用 canonical JSON，键递归排序）；
   - **恢复前自动记录**：恢复前先写一条 `trigger:'restore'` 的当前状态，于是恢复可撤销；
   - **星标保护 + 体积上限**：每条目保留「最新 + 全部星标 + 最新 N 条非星标」，超项目体积上限时从最旧的非星标开始删。
4. `RevisionsModal.vue` 增加**逐字段 diff**（原站固定 13 个键的对比与 `新增/清空/修改` 三色标注，可直接照搬语义）。
5. 节流：保留现有章节的 5 分钟逻辑作为「自动」档默认值，允许按作品配置。

#### P1-4 完整度评分与项目级指标（成本 S）

纯函数，落成 Pinia getters 即可（原站公式极简单）：

```
单节点 0–100 = 摘要 10 + 正文 20（≥100 字满分，>0 得 8）+ 标签 10 + 关联 20（有任一关系/双链）+ 字段 40×已填比
项目指标 = 平均完整度 / 关联密度(关系数÷节点数) / 孤立节点数 / 未完成数(<70) / 冲突数
```
展示位置建议：设定 tab 侧栏顶部一条细指标条（原站是仪表盘卡片，novel-studio 没有作品仪表盘，可先落在设定面板内）。

---

### 第 2 期 · 内容表现力与结构视图

#### P2-1 语义块（成本 M，**不建议为此引入 TipTap**）

原站用 TipTap 自定义节点实现；novel-studio 的设定节点**本身就是 html 字符串**，因此建议先用「**HTML 契约 + CSS + 工具栏插入**」落地，保留 `MubuView.vue` 的行内 outliner 交互（这是 novel-studio 的差异化资产，不要为了块能力牺牲它）：

```html
<!-- 6 种语义提示块（type 决定色与图标） -->
<div class="callout" data-callout="info|caution|warning|conflict|secret|note">
  <div class="callout-label" contenteditable="false">提示</div>
  <div class="callout-body">…</div>
</div>
<!-- 折叠块 / 剧透块 -->
<details data-collapse data-title="详细内容" open><summary contenteditable="false">详细内容</summary><div class="collapse-body">…</div></details>
<details data-spoiler-block><summary contenteditable="false">该内容为剧透，点击展开</summary><div class="spoiler-body">…</div></details>
<!-- 行内 -->
<span data-spoiler-mark title="剧情遮罩">…</span>
<sup data-footnote data-content="…">※</sup>
<span data-time-tag data-era="…" data-year="…" data-fuzzy="0">…</span>
```

- 工具栏：`MubuView.vue` 模板里现有的 `.ob-toolbar`（`773-804`）追加「提示 / 注意 / 警告 / 冲突 / 秘密 / 作者注释 / 折叠 / 剧透」按钮；插入即写入上述 HTML，`contenteditable` 区域（`806-867`，每行 `.ob-text[contenteditable]`）靠 CSS 呈现。**保留行内 outliner 的既有键位**（回车新建 / Tab 升降级 / Alt+↑↓ 排序 / 点圆点折叠 / 拖圆点移动 —— 见 `867` 的提示文案）。
- 语义高亮 5 预设（常规 / 待确认 / 冲突 / 隐藏设定 / **重要伏笔**）直接映射到现有 execCommand 的 `hiliteColor`，零结构成本。
- 交互细节照搬原站：`secret` 类型默认折叠 + 「隐藏/显示」切换；剧透块展开后显示「剧透」徽章 + 「重新隐藏」；折叠块标题可内联改写。
- ⚠️ 原站缺陷不要复刻：隐藏态内容仍在 DOM（`opacity-0 h-0`）—— 若把它当"防止读者看到"，应在导出/阅读模式真正过滤。
- 若后续确实需要更强的块编辑体验（嵌套、拖拽排序、slash 菜单），再评估把**节点展开态**换成 TipTap 实例（而非整棵树）。

#### P2-2 引用卡与提及芯片（成本 M）

扩展现有双链 ABI，而不是新造一套：

| 形态 | 现有 | 新增 |
| --- | --- | --- |
| 行内提及 | `.dl-link[data-dl-target][data-dl-title]` → 可点击跳转 | 加一行 `data-dl-status`，CSS 按状态上色（芯片带状态点） |
| 块级引用卡 | 无 | `div.dl-card[data-dl-target][data-dl-title]`，内含标题 / 类型 / 状态 / 摘要 / 更新时间；空摘要显示「暂无摘要」；目标失效加 `.dl-card-broken` |

- 复用：`DLinkPicker.vue`（选目标）、`DLinkPopover.vue`（悬停预览，需扩展 `.dl-card` 选择器）、`services/doublelinks.js` 的 `targetById/previewFor/jumpTo/findBacklinks`。
- 插入语法建议：命令面板/工具栏「插入引用卡」，或在 `DLinkPicker` 里区分「插入为链接 / 插入为引用卡」。

#### P2-3 未绑定引用检测 + 一键全部绑定（成本 S，性价比最高）

在设定面板加一个「引用检查」侧签：

1. 用现有 `findBacklinks` 的扫描能力反向做：遍历正文（章节 html/text）与设定节点文本，找出**出现了设定节点名称/别名但没有对应的 `.dl-link`/`[[…]]`** 的位置；
2. 按节点聚合出现次数，列出「疑似未绑定：{名称} × {n} 处」；
3. 「全部绑定」= 对每个位置插入 `[[名称]]`（纯文本场景）或包一层 `.dl-link`（html 场景），**跳过已有链接覆盖的范围**（原站的重叠检测逻辑值得照搬）；
4. 加一条对应的检查规则（见 P3-2）。

#### P2-4 时间线（成本 L，**小说场景价值最高**）

分两步，第一步就能用：

**第一步（建议先做）**：新增 `events` 表 + 竖向/横向两个视图。
```js
// events: 'id, workId, era, [workId+deletedAt], [workId+branchId]'
{ id, workId, name, era:'未分纪元', timeType:'confirmed|uncertain|legend|secret',
  startYear, startMonth, startDay, endYear, endMonth, endDay,
  locationRefId, participantRefs:[], relatedRefs:[], summary, content, inWorld:true,
  manualOrder, createdAt, updatedAt, deletedAt }
```
可直接照搬的细节（原站做得很好且零依赖）：
- **日期工具**：`YQ/fmtYM/dB/TA/NV/rY/IC`（含公历闰年校验、`前 N 年` 表达、`rY = 年*10000+月*100+日` 排序键）；
- **横向视图**：年份轴 `nice(span/6)` 刻度、纪元年带贪心排行（≥0.5% 间隙）、事件条泳道占用避让、点事件 `minSpan` 最小宽度、标签「内/右/左」三态避让、**指针处显示年份 + 点击即新建**、拖动到视口边缘自动滚动；
- **竖向视图**：左轴 + timeType 贯穿色彩/线型（非确定时间用虚线 + 徽章）；
- **时间性质四态**贯穿全部颜色与线型，是"一眼看出哪些是传说/秘史"的关键。
- 复用 `services/graphview.js` 的 `usePanZoom` 处理横向缩放。

**第二步（可后置）**：`branches` 表 + 挂载支线 + 时间树（SVG，复用 `OutlineCanvas.vue` 的绝对定位节点 + `svgBox` 负象限方案），以及双线对比。分支/挂载是原站最强的差异化设计（"if 线""多结局"），但对多数作品不是刚需。

#### P2-5 实体图谱泛化（成本 M，收益高）

现有 `CharacterGraph.vue` + `graphview.js` + `canvas-model.js` 已经具备：pan/zoom、四向锚点、正交/贝塞尔路由、避障、拖动建边、边标签与样式编辑、手动布局持久化、1 跳悬停高亮、角色/标签过滤、适应视图、发到大纲为引用卡。

**只需把节点域从「人物」泛化为「人物 + 设定节点（可按 kind 筛选）」**，边来源为：
1. `relations`（现有，人物之间）；
2. **设定节点之间新增的关系边**（建议新增 `lorelinks` 表，形态照抄 `relations`：`{id, workId, fromId, toId, label, reverseLabel, bidirectional, description, status, color, style, fromSide, toSide}`）;
3. 双链隐含边（可选，虚线弱化）；
4. 父子层级（可选，弱化显示）。

同时补齐原站有而 novel-studio 缺的**图谱增量**：
- **ego 一度/二度聚焦 + 非成员变暗**（原站 0.08 透明度）；
- **关系名显示开关**；
- **详情轨**：选中节点的分类/状态/摘要 + 关系行列表（`←/→` 方向 + 本端视角标签 + 对端 + 「⇄ 对方视作…」双向不同名提示）；
- 分类多选 chips（带层级缩进与「另有 N 个未显示」）。

> 不建议做的：原站的 3D「星球」视图（Canvas 2D 手写球面投影 + 相机）。它是纯视觉噱头，成本约 300 行且需要持续调参。若要做，常数已在 `03-关系图谱.md` 里备齐。

#### P2-6 地点与地图（成本 M）

新增 `maps` 表（每作品多张）：`{id, workId, name, assetId, pins:[{id, refId, x, y}], sortOrder}`，坐标用**容器百分比 0–100（1 位小数）**。
- 平移缩放：`zoom ∈ [1,5]`，滚轮 `factor = exp(-0.0016*deltaY)` **光标锚定**，`clampPan` 保证图铺满；按钮显示 `{percent}%`。
- 图钉：底尖对齐坐标（`translate(-50%,-100%)`），拖动 >3px 才落库，点击放置（先从下拉选节点），失效目标显示红色「未知地点」。
- 图片：**不必移植压缩逻辑** —— novel-studio 已有 `assets` 表与统一的图片处理路径，直接复用。
- 增值点照搬：层级列表里的「**控制势力**」列由 `控制`/`统治` 类边**反向推导**，并可点击就地增删这些边 —— 把关系边用成列表列，是很聪明的复用。

---

### 第 3 期 · 可维护性（设定检查与仪表盘）

#### P3-1 检查引擎骨架（成本 M）

移植**形态**而非原站的 17 条规则（那些依赖 `char_state/start_year/relationType` 等原站特有结构）：

```js
issue = { level:'error'|'warn'|'info', kind, title, detail?, hint?, refs:[…], id }
// 页面：顶部三级计数（矛盾/存疑/提示）→ 按 kind 分组（固定顺序）→ issue 卡
//       卡片 = 级别列 + 标题 + 明细 + 「处理建议：{hint}」 + 可跳转的引用 chips
```

建议为 novel-studio 重写的规则集（全部基于现有数据可判定）：

| kind | 级别 | 判定 |
| --- | --- | --- |
| `orphan` | info | 设定节点无任何关系边、无双链（入/出）、无父子（孤立） |
| `no_tag` | info | 节点无标签 |
| `incomplete` | info | 完整度 <50 |
| `unlinked_mention` | warn | 正文出现节点名/别名但未绑定（接 P2-3） |
| `dangling_link` | error | `.dl-link` / `[[…]]` 指向的目标已删除 |
| `name_conflict` | warn | 两个节点名称或别名重复（AI 检索与绑定会歧义） |
| `chapter_ref_missing` | info | 节点被标记为「已出场」但正文中找不到该名称（可选，需 AI 或字符串扫描） |
| `timeline_conflict` | warn | 事件的时间顺序与「前置」类边矛盾（P2-4 落地后启用） |
| `outline_dangling` | error | 复用现有 `olBroken`（`src/stores/work.js:107-124`）的断链检测 |
| `dead_but_active` | warn | 人物状态为死亡/失踪/封印，但大纲/正文中仍有其出场（需 AI 判定，进阶） |

- **豁免机制**照搬：给节点打上特定标签即解除对应提醒（原站是「复活/亡灵/回忆/数据体」「卧底」「争夺中」）。
- **不做「忽略」按钮**（原站的设计判断值得尊重）：要么修数据，要么打豁免标签，避免检查页被静音。

#### P3-2 设定面板指标条 + 待补全清单（成本 S）

侧栏顶部一行细指标（完整度 / 关联密度 / 孤立 / 未完成 / 冲突）+ 「待补全」列表（按完整度升序取前 6，显示缺失项摘要）。原站的仪表盘七块组件里，这两块对 novel-studio 最实用，其余（写作统计已有 `StatsModal`）可暂缓。

---

## 3. 不建议移植

| 项 | 原因 |
| --- | --- |
| 分类树 + 用途绑定 + 字段模板组 | 与「统一节点树」设计冲突；用「kind + 建议字段」替代（见 P1-2） |
| 29 套主题与 WebGL/Canvas 特效层 | novel-studio 已有 3 套主题 + 完整 token 体系（`src/styles/themes.css`）；特效层是另一条产品线 |
| 卡密 / 试用 / PRO 功能位 / 云端加密备份 | 商业化与云基础设施，novel-studio 是本地优先 Electron，无此需求 |
| 协作层（CRDT `ops` + HLC + `members` + `conflicts`） | 体量极大，且 novel-studio 的"每作品单写入者"模型更简单；若要做同步，走「文件备份 + 冲突提示」更合适 |
| 导出单文件 Wiki / PDF（PRO） | 有价值但独立；novel-studio 已有 `ImportDialog`/`ExportDialog` 体系，可后续单独评估 |
| AI 目录快照 + MCP server | novel-studio 的 AI 走 `SOURCE_TABLES → aidoc/aichunk/aientity/aiedge` 投影，二者机制不同但目的一致，**不需要并行两套**；可借鉴的是「tombstones」思路（删除也要同步） |
| 3D 星球视图 | 纯视觉，成本高（见 P2-5 注） |
| 图片分级压缩逻辑 | novel-studio 已有 `assets` 与图片处理路径，重复实现无收益 |

---

## 4. 集成约束（实施前必读，容易漏）

1. **AI 投影必须同步扩展 ⚠️ 最容易漏**
   `src/services/project/normalize.js:5` 的 `SOURCE_TABLES` 与 `projectBook()` 决定了 AI 能"看到"什么。新增 `events` / `lorelinks` / `maps` 表与 mubu 的新属性字段，**必须同时**：
   - 把新表加进 `SOURCE_TABLES`（否则 Dexie 钩子不触发增量投影）；
   - 在 `normalize.js` 里给出文档映射（mubu 现在是 `type:'mubu', semanticClass:'setting'`，加了 kind 后可按 kind 细分）；
   - 在 `project/graph.js` 里补实体与边（现有 kind 判定是名字启发式 `/势力\|组织\|门派/`，有了 kind 字段后可精确化 —— 这本身是一个顺带的质量提升）；
   - 否则会出现「设定模块能编辑、AI 任务读不到」的断层，破坏"五模块 AI 专用任务"的一致性。
2. **双链 ABI 不可破坏**
   `.dl-link[data-dl-target][data-dl-title]`、`[[标题|显示文字]]`、`[data-note-id]`（批注，priority 1000）三套契约被 `doublelinks.js` / `DLinkPopover.vue` / `findBacklinks` / `project/graph.js` 的正则共同消费。新增引用卡/提及必须**扩展**这些契约（新增属性），不要另立标记。
3. **Dexie 版本纪律**
   现在是 v11，新增一律 `db.version(12).stores({...})` 且**列出全部表**（本项目惯例是显式全量声明）；字段新增无需迁移函数，索引新增需要。
4. **验收脚本**
   本项目用 CDP E2E（`npm run dev` + `--remote-debugging-port=9222`，`tools/_cdp-lib.mjs`），seed 统一在 `tools/verify-seeds.mjs`（`VERIFY_BOOKS` 单一权威）。新功能应配套 `tools/*-verify.mjs`，并在 `verify-seeds.mjs` 注册验证书。已有的可复用脚本：`dl-verify.mjs`（双链 20 项）、`dlpop-verify.mjs`（悬停预览 19 项）、`annotation-verify.mjs`（批注 28 项）、`chargraph-verify.mjs`（关系图 12 项）、`olcanvas-verify.mjs`（画布 29 项）、`project-verify.mjs`（投影）。
5. **样式与主题**
   手写 CSS（无 Tailwind），token 在 `src/styles/themes.css` 的三套主题块里各定义 20 个变量。新组件应使用既有变量（`--bg-panel / --text-dim / --border / --accent / --danger / --success / --warning`…）并在**三套主题下各验一次**，不要引入硬编码色值。
6. **多窗口面板**
   `?panel=<type>:<workId>:<entityId>` 由 `PanelHost.vue` 承担，已支持 `lore` 类型（`PanelHost.vue:37,116,125`）。若新增「时间线」「图谱」独立窗口，需要在这里加类型并在 `panelwindows.js` 登记。
7. **软删除与级联**
   全部走 `deletedAt` + `updatedAt`；`mubuRemove` 会级联子孙。新增的 `events` / `lorelinks` / `maps` 在删除节点时必须清理引用（原站的 `deleteEntry` 会清 `participantEntryIds/locationEntryId/relatedEntryIds`，值得照抄这个级联清单）。

---

## 5. 建议排期

| 期 | 内容 | 交付物 | 预估 |
| --- | --- | --- | --- |
| 一期 | P1-1 节点属性 · P1-2 档案字段 · P1-4 完整度 | Dexie v12 + 侧栏/节点表现 + 字段表单 + 指标条 | 3–4 天 |
| 二期 | P2-3 未绑定引用绑定 · P2-2 引用卡 · P2-1 语义块 · P1-3 版本历史泛化 | 引用闭环 + 语义块 + 设定版本历史 | 4–5 天 |
| 三期 | P2-4 时间线（第一步）· P2-5 图谱泛化 | 时间线双视图 + 设定/人物统一图谱 | 4–6 天 |
| 四期 | P3-1 检查引擎 · P3-2 待补全清单 · P2-6 地图 | 设定检查页 + 指标 + 地图 | 4–5 天 |
| 后置 | 谱系图（移植确定性布局引擎）· 时间线分支/时间树 · 3D 星球 | — | 视题材需要 |

**如果要挑一个"最小可感知"的子集先做**：`P1-1 + P1-2 + P2-3 + P1-4`。它不需要任何新表（只用 Dexie v12 加字段与一个索引），但能让设定模块立刻具备「有状态、有字段、有完整度、引用不漏绑」的表现力 —— 这是投入产出比最高的一刀。

## 6. 需要你决策的两个点

1. **是否引入「角色标记（kind）」**：这是本方案的结构基石（决定字段建议、图谱筛选、检查规则）。若你希望设定模块保持绝对自由（连 kind 都不标），那 P1-2 的"建议字段"就要改成"用户自建字段组"，成本会上升且收益下降。**我推荐引入 kind，并允许它永远是 null。**
2. **时间线的"分支/挂载支线"要不要进第一批**：它是原站最独特的设计，但对非多线叙事作品是负担。建议先做「纪元 + 时间性质 + 竖向/横向」，把分支留到实际有作品需要时。

---

## 附：可复用的算法/数据清单（供实施时直接取用）

| 目标 | 来源 | 位置 |
| --- | --- | --- |
| 力导向图谱（含全部常数） | `graph.pretty.js` | `03-关系图谱.md` §1.1 |
| 3D 球面投影与摄像机 | `graph.pretty.js` | `03-关系图谱.md` §1.2 |
| **谱系确定性布局（可直接移植）** | `chunks__3007` m52069 | `05-谱系图.md` §1 |
| 谱系 SVG 渲染契约与样式表 | `lineage.pretty.js` | `05-谱系图.md` §2/§7 |
| 时间线日期工具与排序键 | `chunks__3007` | `04-时间线.md` §10 |
| 时间线横轴几何（刻度/年带/泳道/标签避让） | `timeline.pretty.js` | `04-时间线.md` §3 |
| 时间线排序的存储语义（4 个 store 动作） | `chunks__4673` | `04-时间线.md` §9 |
| 快照：哈希/清理/恢复/diff | `chunks__9232` `chunks__4673` | `06-快照检查与字段.md` §A |
| 检查引擎形态与指标公式 | `chunks__3007` m18367 | `06-快照检查与字段.md` §B |
| 字段模板继承与**改名迁移三步** | `chunks__8594` `chunks__3007` | `06-快照检查与字段.md` §C |
| 语义块 DOM 契约与 Turndown 映射 | `chunks__6416` | `02-编辑器与引用.md` §1/§5 |
| 引用索引分桶与 tier 排序 | `chunks__7008` | `02-编辑器与引用.md` §4.1 |
| 未绑定引用扫描与批量绑定 | `chunks__6416` | `02-编辑器与引用.md` §3.4 |
| 地图 pan/zoom 与 clampPan | `locations.pretty.js` | `07-信息架构与设置.md` §6 |
| 仪表盘派生指标 | `chunks__3007` | `07-信息架构与设置.md` §2 |
