# 书架排序收口 + 打开时间标注

## 版本与合并结论
- 仓库**没有 `dev` 分支**；当前 `前端重置`（1.1.3）就是最新开发线。`main`（1.0.23）、`feature/ai-assistant`、`v0.4.17分支美化测试` 等所有分支都是当前分支的祖先（0 ahead），合并它们都是 no-op。
- `F:\deepseek workplace\小说工坊` 是 1.0.18 的安装产物，不是源码分支，且使用独立的 Electron profile/IndexedDB，书架数据与 dev 源码不同；不能也不应并入。
- 因此**不切换、不合并分支**，测试以当前开发源码 `npm run build` 为准。“最近编辑/最近打开作品不同”本质是排序键不同，不是两个源码版本。

## 排序逻辑
- 删除「最近编辑」「打开最多」两个排序项及所有排序下拉控件。
- 固定按 `lastOpenedAt` 倒序；从未打开的作品排在已打开作品之后，按 `updatedAt` 倒序兜底。
- 移除 `sortMode` 状态、`shelf:sortMode` 读写、相关 props/emits；`Bookshelf.filtered` 固定调用 `sortShelfWorks(base, shelf.openStats)`。
- 保留 `work.open` 中的打开记录（appconfig `shelf:openStats`）；`lastOpenedAt` 继续更新，`openCount` 保留但不再展示/排序。

## 打开时间标注
- 新增 `formatShelfOpenTime(ts)`：今天/昨天显示“今天 HH:mm / 昨天 HH:mm”，同年显示“M月D日 HH:mm”，跨年带年份；无记录显示“尚未打开”。
- 赤月戏：去掉标题旁的排序下拉；舞台 eyebrow 显示“最近打开 · 上次打开 …”；右侧“未完的剧目”每行新增“上次打开 …”；底部状态改为“上次打开 …”。
- 引力：去掉排序 NSelect；eyebrow 显示“最近打开 · 上次打开 …”；“其余的宇宙”每张卡新增“上次打开 …”。
- 琉光：去掉排序 NSelect；eyebrow 显示“最近打开 · 上次打开 …”；“其余”卡片新增“上次打开 …”。
- 原版：去掉排序 NSelect；网格卡新增“上次打开 …”。
- 搜索时仍按打开时间排序；从未打开的作品显示“尚未打开”。

## 涉及文件
- `src/services/shelf-sort.js`：简化排序 + 时间格式化。
- `src/stores/shelf.js`：移除 sortMode/setSortMode，保留 openStats/recordOpen，refresh 不再读 `shelf:sortMode`。
- `src/components/Bookshelf.vue`：固定排序、移除排序控件与透传。
- `src/components/CrimsonShelf.vue`、`GravityShelf.vue`、`GlazeShelf.vue`：移除排序控件，新增时间标注。
- `src/styles/skins/crimson-v3.css`、`gravity.css`、`glaze.css`、`themes.css`：删除排序控件样式，新增打开时间行样式。
- `src/stores/work.js`：保持不变（打开记录已接入）。

## 验证
1. `npm run build`。
2. 打开几部作品后回书架：只按最近打开排序；主书/中央书是最后打开的作品；各列表显示“上次打开 ...”。
3. 从未打开的作品显示“尚未打开”，排在已打开作品之后。
4. 搜索后结果仍按最近打开排序；重启应用后时间保留。
5. 全库不再出现「最近编辑」「打开最多」排序文案/控件。
6. 确认当前分支仍为 `前端重置`，未做分支切换或合并。