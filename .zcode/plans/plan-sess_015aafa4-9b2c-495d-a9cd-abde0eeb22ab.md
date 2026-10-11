# 设置面板新增「存储位置」功能（数据可迁移出 C 盘）

## 功能形态（设置面板内）
在 `src/components/SettingsPanel.vue` 的「数据 Data」分组中新增一块**存储位置设置区**（仅 Electron 桌面版显示，网页版自动隐藏）：

- **当前位置行**：显示当前数据目录路径（超长截断中段）+ NTag 状态标签「默认 / 自定义」；若自定义目录启动时不可用，显示回退警示
- **「更改存储位置…」** 菜单行：弹系统目录选择框 → 确认弹窗 → 迁移并重启
- **「恢复默认存储位置」** 菜单行（仅当前为自定义时显示）：迁回默认位置并重启
- **「打开数据文件夹」** 菜单行：在资源管理器中打开当前数据目录
- 确认弹窗文案要点：迁移会关闭并重启应用；迁移前自动保存全部未落盘数据；原位置数据保留作备份（恢复默认时默认位置旧数据将被当前数据替换）

交互沿用面板现有惯例：`.g-item` 菜单行 + OIcon，确认框用 `window.$dlg`，消息用 `window.$msg`。

## 技术实现

### 原理
全部小说数据存在 Dexie/IndexedDB（渲染进程独占），磁盘位置由 Electron `userData` 目录决定（现为 `%APPDATA%\小说工坊[-profile]\IndexedDB`）。已有先例：`electron/main.js:8-13` 启动最早期用 `--profile` 调 `app.setPath('userData', ...)`。方案 = **指针文件 + 启动重定向 + 全量拷贝迁移 + app.relaunch()**。IndexedDB 无法热迁移（Chromium 限制），更改位置需重启一次应用。数据层 `src/db/*` 零改动。

### 1. electron/main.js
**(a) 启动期重定向**（扩展现有第 8-13 行 profile 逻辑）：
- 显式计算 `defaultUserData = appData + '小说工坊'[-profileName]`
- 指针文件固定在 `<defaultUserData>/data-dir.json`，内容 `{ dir, at }`（指针不随迁移移动，是启动时唯一可信读取点；避免鸡生蛋——主进程须在 IndexedDB 可用前完成重定向）
- 有效指针（目录存在且 ≠ default）→ `app.setPath('userData', dir)`；无效/目录消失 → 忽略并回退默认，记 `dataDirFallback = true` 供设置面板提示

**(b) 新增 4 个 IPC**（沿用 `export:save` 路径加固风格）：
- `data:location` → `{ current, isCustom, defaultDir, fallback }`
- `data:pickDir` → `dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })`
- `data:openFolder` → `shell.openPath(当前数据目录)`
- `data:move { targetDir }` 迁移编排：
  - **先校验全部通过才动手**（失败返回 `{ ok:false, error }`，应用继续运行）：绝对路径、无 `\0`、无 `..`；目标 ≠ 当前且互不嵌套；实际落地目录 = `<target>/小说工坊`（固定子目录，不污染所选盘根）；落地目录已含 `IndexedDB` → 拒绝「该目录已包含小说工坊数据」；mkdir + 探针测写权限；落地 == defaultUserData 时走恢复默认分支
  - 通过后先回复 `{ ok:true }`（渲染层显示「正在迁移」），异步执行：`win.close()`（既有 flush→关闭流程）→ `closed` 级联关闭全部面板（各自 flush）→ 等窗口全销毁（≤8s）→ `fs.cpSync` 递归复制旧 userData 到暂存目录（排除 `Cache / Code Cache / GPUCache / Dawn*Cache / ShaderCache / Crashpad / Crash Reports / logs / lockfile / DevToolsActivePort`）→ 换位（恢复默认：删旧 default → rename 暂存，避免新旧 LevelDB 混杂）→ 写/删指针 → 校验 `<new>/IndexedDB` 存在 → `app.relaunch(); app.exit(0)`（argv 继承，`--profile`/`--remote-debugging-port` 保留）
  - 失败路径：删暂存、`dialog.showErrorBox`、不改指针、relaunch —— 原位置数据完好

### 2. electron/preload.cjs
`native` 增加 `getDataLocation / pickDataDir / openDataFolder / moveDataDir`。

### 3. src/services/fileio.js
追加 4 个包装函数（web 版返回 null/false）。

## 验收（遵循本仓 CDP 验收纪律）
- 新增 `tools/dataDir-verify.mjs`（复用 tools/_cdp-lib，验证书走 verify-seeds 注册表）：阶段1 经 IPC 迁移到 %TEMP% → 等退出 → 脚本重启 dev → 断言位置自定义 + 书架数据完整 + 章节正文可读；阶段2 恢复默认 → 重启 → 断言位置默认 + 数据完整
- `npm run build` 通过；回归 shelf-verify 15/15、dl 抽查
- dev 特性：迁移后应用退出时 concurrently 连带终止 vite，脚本负责重启；生产安装版 relaunch 自动完成

## 取舍说明
- 迁移采用**复制**（原位置保留作备份），避免不可逆移动风险；旧目录由用户自行清理
- 设置面板所有设置即时生效的现有惯例中，本项是首个需重启生效的设置，确认弹窗会明确告知