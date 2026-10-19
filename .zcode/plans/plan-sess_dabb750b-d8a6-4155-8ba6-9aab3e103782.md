# 人物档案：角色/别名标签化 + 关系分页

## 一、数据语义（不改数据库）

- `role` 继续用字符串存储，但允许 `/` 分隔的多值：如 `主角/导师`。新增共享工具 `src/services/character-tags.js`：
  - `rolesOf(c)`：按 `/ 、 , 空白` 拆分，去空去重；
  - `primaryRole(c)`：取第一个（页头、列表、图谱节点、搜索结果显示用）；
  - `aliasesOf(c)`：同样拆分 `aliases`；
  - `aliasTagEntries(c)`：把 `aliases` 与现有 `tags` 数组合并为一个有序标签列表（带 `kind: alias|tag`，用于删除时写回对应字段）；
  - `characterTagList(c)`：角色 + 别名 + 标签的全量派生标签（供检索/筛选）。
- 新建人物默认仍是单角色 `配角`，旧数据无需迁移；`role` 为多值时只影响显示与筛选逻辑（详见第三节）。

## 二、赤月戏人物档案的标签区（替换现有输入框）

把「角色定位」和「别名（含原「标签」栏）」做成并排的两个标签输入区：

**角色定位标签区**
- 已选角色显示为胶囊标签（沿用现有 `.role-chip.on` 金色选中样式），每个标签带 `×` 可移除。
- 原图二那排独立快捷选项**移除**，改为字段内部的快速选择：仅列出尚未选中的预设（主角/配角/反派/导师/红颜/盟友/旁观者/龙套），点击即添加。
- 输入框支持：输入文字后按 `/` 或回车创建标签（末尾的 `/` 自动吞掉）；可从其他来源粘贴 `主角/导师` 一次生成多个；输入框为空时按退格删除最后一个标签；失焦提交。
- 多角色存储为 `role = roles.join('/')`。

**别名标签区（合并原来的别名输入 + 标签选择）**
- 同一块标签区展示：`aliases` 拆出的别名标签（实线）与原有 `tags` 数组的标签（虚线，保留但不再是独立控件）。
- 输入文字后按 `/` 或回车创建别名标签，写入 `aliases`（保持 AI 的 `namesOf` 别名识别路径）；旧 `tags` 仍单独存储，删除虚线标签时写回 `tags`。
- 移除原来赤月戏的「标签（回车添加）」NSelect；引力/原版/琉光保持现有实现不变。

**布局**
- 姓名输入仍是纸面主标题（上一轮已去掉重复 h2）。
- 姓名下方一行两列：左「角色定位」标签区、右「别名」标签区；窄窗/独立窗口下自动上下堆叠。
- 「姓名」标签在赤月戏继续隐藏；两个标签区的标题沿用 12px 深棕字段标签样式。

## 三、按标签检索角色

- `CharacterList` 搜索条件增加 `c.tags`（角色与别名本来就已匹配），输入任意角色/别名/标签都能筛出人物。
- `CharacterGraph`：
  - 标签筛选池改为 `characterTagList`（角色 + 别名 + 标签全部可筛）；
  - 角色筛选由精确相等改为 `rolesOf(c).includes(roleFilter)`，选项从实际人物角色中派生（支持自定义角色）；
  - 节点上的角色徽标、颜色映射改用 `primaryRole(c)`。
- 其他角色显示点统一取首角色：赤月卷宗页头 tag、肖像签名、CharacterList 列表项、RightPanel 出场人物、全局搜索标题、双链悬浮 meta；AI 投影 `normalize.js` 的角色文本改为 `rolesOf(c).join('、')`。
- 顺手修正两处不切 `/` 的别名解析（`novel-context.js`、`task-proposals.js` 的 `aliasesOf`），使新别名在各 AI 路径下都能识别。

## 四、档案翻页（赤月戏）

- 在姓名/角色/别名区下方加一个两页页签：`档案` / `关系`，并显示 `01 / 02`。
- 第一页：自定义字段 + 人物小传（赤月 `character-sections` 改为单列上下排列）。
- 第二页：人物关系 + 关联关系（两列并排）。
- 实现方式：
  - 四个 section 用 `v-if` 按页显示（仅赤月戏启用；其他皮肤仍保持现有全量布局）；
  - `.character-sections` 增加 `is-page-profile` / `is-page-relations` 类，覆盖赤月戏的 `grid-template-areas`，避免隐藏 section 后留下空洞；
  - 页码状态为组件内 `ref('profile')`，切换人物时自动回到第一页；切换页面时把 `.crimson-dossier` 滚动回顶部；
  - 主窗口与独立窗口共用同一组件，自动一致。

## 五、涉及文件

- 新增 `src/services/character-tags.js`（拆分/合并/主角色工具）。
- `src/components/CharacterCenter.vue`：标签输入区、快速预设、页签与分页渲染。
- `src/styles/skins/crimson-v3.css`：两个标签区、标签输入、快速选择、页签、分页网格。
- `src/components/CharacterList.vue`、`src/components/CharacterGraph.vue`、`src/components/RightPanel.vue`、`src/services/doublelinks.js`、`src/stores/work.js`、`src/services/project/normalize.js`、`src/services/ai/novel-context.js`、`src/services/ai/task-proposals.js`：多角色显示、检索与筛选适配。

## 六、验证

1. `npm run build` 通过。
2. 手动核对：
   - 角色定位可添加多个标签，预设以快速选择形式出现在字段内；输入 `主角/导师/` 能一次生成两个标签；点 × 可移除。
   - 别名栏同时显示别名标签和原标签，输入 `领航员/星感/` 可创建；删除分别写回 aliases / tags。
   - 模块条搜索能按角色、别名、标签筛出人物；关系图的标签筛选包含角色/别名/标签，多角色人物在任一角色筛选下都出现。
   - 档案页签切到「关系」后只显示人物关系与关联关系；切回「档案」显示自定义字段与人物小传；切换人物自动回第一页。
   - 原版/引力/琉光的人物档案布局保持不变。