# 隐现（latent）移植对照表

> 按两仓实际文件内容哈希生成，不是方案写作时的快照。
> 目标 `d6feddc` · 来源 `unknown` · 判定：逐文件 SHA-256 比对

## 判定口径

- **相同**：两仓逐字节一致。目标可直接复用，无需迁入。
- **不同**：同名但内容不同。必须手工合并，保留桌面原有分支与全部桌面能力。
- **仅来源**：只有插件版存在。按模块整目录迁入目标。

## 总览

| 模块 | 相同 | 不同 | 仅来源 | 处理方式 | 对应 Task |
|---|---|---|---|---|---|
| `components/settings` | 0 | 0 | 19 | 整目录迁入 | Task 7 |
| `components/stats` | 0 | 0 | 13 | 整目录迁入 | Task 8 |
| `components/lore` | 0 | 0 | 11 | 整目录迁入 | Task 5 |
| `services` | 23 | 4 | 11 | 整目录迁入 | Task 2 / 8 |
| `components/snippets` | 0 | 0 | 9 | 整目录迁入 | Task 6 |
| `styles` | 1 | 4 | 9 | 整目录迁入 | Task 3 |
| `components/characters` | 0 | 0 | 8 | 整目录迁入 | Task 6 |
| `components/outline` | 6 | 1 | 6 | 整目录迁入 | Task 5 |
| `services/latent` | 0 | 0 | 5 | 整目录迁入 | Task 3 |
| `components` | 7 | 30 | 2 | 手工合并 | Task 4 |
| `styles/skins` | 0 | 0 | 2 | 整目录迁入 | 待定 |
| `assets` | 131 | 1 | 1 | 整目录迁入 | Task 3 |
| `App.vue` | 0 | 1 | 0 | 手工合并 | Task 1 / 3 |
| `components/agent` | 10 | 0 | 0 | 整目录迁入 | Task 4 |
| `components/ai` | 17 | 2 | 0 | 手工合并 | Task 4 |
| `db` | 6 | 2 | 0 | 手工合并 | Task 2 |
| `dev` | 1 | 0 | 0 | 整目录迁入 | 待定 |
| `main.js` | 0 | 1 | 0 | 手工合并 | Task 3 |
| `services/ai` | 43 | 2 | 0 | 手工合并 | 待定 |
| `services/project` | 5 | 2 | 0 | 手工合并 | 待定 |
| `skins` | 0 | 2 | 0 | 手工合并 | Task 1 / 3 |
| `stores` | 6 | 2 | 0 | 手工合并 | Task 1 / 2 |

合计：相同 **256** · 不同 **54** · 仅来源 **96**

## 一、仅来源文件（需整批迁入）

### `components/settings`（19 个 · Task 7）

- `src/components/settings/SettingsAboutPage.vue`
- `src/components/settings/SettingsAppearance.vue`
- `src/components/settings/SettingsDataPage.vue`
- `src/components/settings/SettingsDialog.vue`
- `src/components/settings/SettingsPreview.vue`
- `src/components/settings/SettingsSearchResults.vue`
- `src/components/settings/SettingsSidebar.vue`
- `src/components/settings/SettingsWorkspace.vue`
- `src/components/settings/dialogs/SettingsExportDialog.vue`
- `src/components/settings/dialogs/SettingsHelpDialog.vue`
- `src/components/settings/dialogs/SettingsRestoreDialog.vue`
- `src/components/settings/dialogs/SettingsStatsDialog.vue`
- `src/components/settings/dialogs/SettingsTrashDialog.vue`
- `src/components/settings/settings-catalog.js`
- `src/components/settings/settings-data-actions.js`
- `src/components/settings/settings-prefs.js`
- `src/components/settings/settings-summary.js`
- `src/components/settings/settings-toast.js`
- `src/components/settings/settings-version.js`

### `components/stats`（13 个 · Task 8）

- `src/components/stats/StatsBreakdown.vue`
- `src/components/stats/StatsChapterChart.vue`
- `src/components/stats/StatsInspector.vue`
- `src/components/stats/StatsMetrics.vue`
- `src/components/stats/StatsModules.vue`
- `src/components/stats/StatsPagination.vue`
- `src/components/stats/StatsRevision.vue`
- `src/components/stats/StatsSectionHead.vue`
- `src/components/stats/StatsTrend.vue`
- `src/components/stats/WritingStatsAnalysis.vue`
- `src/components/stats/WritingStatsDialog.vue`
- `src/components/stats/WritingStatsEntry.vue`
- `src/components/stats/use-stats-motion.js`

### `components/lore`（11 个 · Task 5）

- `src/components/lore/LoreDivider.vue`
- `src/components/lore/LoreHead.vue`
- `src/components/lore/LoreInspector.vue`
- `src/components/lore/LoreLinkComposer.vue`
- `src/components/lore/LoreNavNode.vue`
- `src/components/lore/LorePeek.vue`
- `src/components/lore/LoreReferences.vue`
- `src/components/lore/LoreTreeMap.vue`
- `src/components/lore/LoreWorkspace.vue`
- `src/components/lore/lore-kinds.js`
- `src/components/lore/lore-layout.js`

### `services`（11 个 · Task 2 / 8）

- `src/services/lore-core.js`
- `src/services/lore-editor-dom.js`
- `src/services/settings-entry.js`
- `src/services/snippet-commands.js`
- `src/services/snippet-history.js`
- `src/services/snippet-links.js`
- `src/services/snippet-persistence.js`
- `src/services/writing-analysis-data.js`
- `src/services/writing-analysis-model.js`
- `src/services/writing-stats-core.js`
- `src/services/writing-stats-motion.js`

### `components/snippets`（9 个 · Task 6）

- `src/components/snippets/SnipBoard.vue`
- `src/components/snippets/SnipCard.vue`
- `src/components/snippets/SnipDialog.vue`
- `src/components/snippets/SnipInspector.vue`
- `src/components/snippets/SnipJournal.vue`
- `src/components/snippets/SnipModal.vue`
- `src/components/snippets/SnipNav.vue`
- `src/components/snippets/SnippetsWorkspace.vue`
- `src/components/snippets/snippet-model.js`

### `styles`（9 个 · Task 3）

- `src/styles/chars-context.css`
- `src/styles/chars-dossier.css`
- `src/styles/chars-graph.css`
- `src/styles/chars-roster.css`
- `src/styles/chars-shell.css`
- `src/styles/lore-free-tree.css`
- `src/styles/snippets-fusion.css`
- `src/styles/writing-stats-fusion.css`
- `src/styles/writing-stats.css`

### `components/characters`（8 个 · Task 6）

- `src/components/characters/CharContext.vue`
- `src/components/characters/CharDivider.vue`
- `src/components/characters/CharDossier.vue`
- `src/components/characters/CharGraphPane.vue`
- `src/components/characters/CharInspector.vue`
- `src/components/characters/CharRoster.vue`
- `src/components/characters/CharactersWorkspace.vue`
- `src/components/characters/char-layout.js`

### `components/outline`（6 个 · Task 5）

- `src/components/outline/OutlineGlyph.vue`
- `src/components/outline/OutlineNodeDetail.vue`
- `src/components/outline/OutlineTopbar.vue`
- `src/components/outline/OutlineWorkspace.vue`
- `src/components/outline/outline-glyphs.js`
- `src/components/outline/outline-layout.js`

### `services/latent`（5 个 · Task 3）

- `src/services/latent/blue-noise.js`
- `src/services/latent/cpu-backdrop.js`
- `src/services/latent/flow.js`
- `src/services/latent/latent-gl.js`
- `src/services/latent/palette.js`

### `components`（2 个 · Task 4）

- `src/components/LatentShelf.vue`
- `src/components/LoreEntryList.vue`

### `styles/skins`（2 个 · 待定）

- `src/styles/skins/latent-shelf.css`
- `src/styles/skins/latent-studio.css`

### `assets`（1 个 · Task 3）

- `src/assets/writing-stats-backdrop.webp`

## 二、同名但内容不同（需手工合并）

### `services`（4 个 · Task 2 / 8）

- `src/services/autosave.js`
- `src/services/doublelinks.js`
- `src/services/exporter.js`
- `src/services/graphview.js`

### `styles`（4 个 · Task 3）

- `src/styles/outline-workbench.css`
- `src/styles/studio-writing.css`
- `src/styles/themes.css`
- `src/styles/writing-paper.css`

### `components/outline`（1 个 · Task 5）

- `src/components/outline/canvas-model.js`

### `components`（30 个 · Task 4）

- `src/components/AppTopbar.vue`
- `src/components/AutoHideTopbar.vue`
- `src/components/Bookshelf.vue`
- `src/components/ChapterTree.vue`
- `src/components/DLinkPopover.vue`
- `src/components/EditorContextMenu.vue`
- `src/components/EditorPane.vue`
- `src/components/EditorToolbar.vue`
- `src/components/ExportDialog.vue`
- `src/components/GlobalSearch.vue`
- `src/components/HelpManual.vue`
- `src/components/ImportDialog.vue`
- `src/components/LoreDetail.vue`
- `src/components/LoreGraph.vue`
- `src/components/LoreRelationPanel.vue`
- `src/components/MubuTagPanel.vue`
- `src/components/MubuTree.vue`
- `src/components/MubuView.vue`
- `src/components/OIcon.vue`
- `src/components/OutlineCanvas.vue`
- `src/components/OutlineCenter.vue`
- `src/components/OutlineSidebar.vue`
- `src/components/PanelHost.vue`
- `src/components/PrefBridge.vue`
- `src/components/RevisionsModal.vue`
- `src/components/RightPanel.vue`
- `src/components/SettingsWindow.vue`
- `src/components/TrashModal.vue`
- `src/components/Workbench.vue`
- `src/components/WritingPaperPicker.vue`

### `assets`（1 个 · Task 3）

- `src/assets/skins/SOURCES.md`

### `App.vue`（1 个 · Task 1 / 3）

- `src/App.vue`

### `components/ai`（2 个 · Task 4）

- `src/components/ai/AiAssistantPanel.vue`
- `src/components/ai/TaskLauncher.vue`

### `db`（2 个 · Task 2）

- `src/db/database.js`
- `src/db/repo.js`

### `main.js`（1 个 · Task 3）

- `src/main.js`

### `services/ai`（2 个 · 待定）

- `src/services/ai/application.js`
- `src/services/ai/memory-queue-core.js`

### `services/project`（2 个 · 待定）

- `src/services/project/graph.js`
- `src/services/project/normalize.js`

### `skins`（2 个 · Task 1 / 3）

- `src/skins/graph-presentation.js`
- `src/skins/registry.js`

### `stores`（2 个 · Task 1 / 2）

- `src/stores/ui.js`
- `src/stores/work.js`

## 三、迁移纪律

1. 「仅来源」模块整目录迁入 `src/components/skins/latent/` 等新路径，**不要覆盖**桌面同名目录。
2. 「不同」文件逐个手工合并：以插件版行为为准，保留桌面的 `nsPlugin` 分支、锁仲裁、原生 IPC 与四套旧皮肤路径。
3. 「相同」文件不改。
4. 来源仓库只读。迁入后用 `git -C "F:/deepseek workplace/novel-studio" status --porcelain` 复核改动范围。
