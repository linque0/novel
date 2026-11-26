# Task 7：完整桌面设置与全局弹层

> 本页从方案自动切出，仅供本任务实施代理阅读。
> 原方案：F:/deepseek workplace/dsh-novel-studio/docs/superpowers/plans/2026-11-07-latent-desktop-skin.md

## 全局约束（摘自方案，必须遵守）
- 来源根：`F:/deepseek workplace/dsh-novel-studio/app/`；实施目标根：`F:/deepseek workplace/novel-studio/`。下文 Files 均相对目标根，明确标“来源”的除外。
- 皮肤 ID `dsh`，显示名「隐现」；桌面构建 `__NS_PLUGIN__=false`；桌面库名 `novel-studio`；不得注入 `window.__NS_AGENT__='dsh'`。
- 保留 original / gravity / glaze / crimson；默认皮肤及用户原选择不变；未知皮肤和不支持的 surface 回落 original。
- 单一作品库、单一正文编辑会话；不得 iframe 嵌入插件 SPA，不得按皮肤 key 重建 App/StudioWorkspace/EditorPane。
- 不覆盖目录、不清理已有未提交改动、不安装无关依赖、不以真实用户 profile 运行写入性验收。
- 默认不升 Dexie schema；不得自动重写旧作品或补造历史日志；不得让皮肤切换决定正文保存算法。
- 本次计划文件位于插件仓库便于当前会话审阅；实际代码、测试与发布改动进入桌面仓库，插件仓库只读作来源。
- 用户已明确要求桌面拆窗、恍然梦入口及更多设置项的前端适配；不得只保留 API、把新增入口都塞进更多菜单，或原样沿用插件三类设置。
- 拆窗模块身份必须与 URL、原生锁一致；禁止复制插件只改本地 spec.type 的跨模块导航。保存失败的窗口保持打开。
- AI/创作台/预设窗须适配实际输入、列表、工具与浮层；“只接令牌”和“入口存在”不能代替专项视觉/操作验收。

---

## Task 7：完整桌面设置与全局弹层

**Files:** Create `src/components/skins/latent/settings/`（来源完整 settings 目录并扩展为桌面五页）、`src/components/skins/latent/settings/SettingsModelPage.vue`、`SettingsKnowledgePage.vue`、`src/components/settings/DataLocationSettings.vue`、`src/services/latent/settings-entry.js`；Modify `src/components/SettingsWindow.vue`、`src/App.vue`、`src/components/PanelHost.vue`、`src/stores/ui.js`、`src/services/appbus.js`、`src/components/ai/AiAssistantPanel.vue`（定向设置入口）、`src/components/ai/AiSettings.vue`（仅必要响应式适配）、`electron/panels.js`、`vite.config.mjs`；必要时 Modify `src/services/exporter.js`；Create `tools/latent-settings-prefs.test.mjs`、`tools/latent-settings-verify.mjs`、`tools/latent-settings-routing-verify.mjs`、`tools/latent-settings-coverage.test.mjs`。

**Interfaces:** 新旧设置同用 SkinPicker 和 ui.setSkin；新增 applyPref/retryPrefs/saveSettingsUi 等只服务普通设置项，不替换 setSkin 的写成功后显示契约。`SettingsPage='appearance'|'ai'|'knowledge'|'data'|'about'`；`openSettings(ui,{page,settingId}={}):Promise<boolean>` / `leaveSettings(ui):void` 保留来处视图。模型设置用 AiSettings/useAiStore，知识库用 KnowledgeModelSettings；DataLocationSettings 复用原 fileio/native 动作，不把凭据/路径配置变成通用 appconfig。

设置统一使用 `{type:'settings',workId:'app',entityId:''}`，`settingsPage/settingId` 作为单独白名单字段经 panelOpen 传递，不参与窗口锁键。新窗在 URL 启动查询中携带定位；既有窗通过定向 `settings:navigate` 消息更新页面并聚焦；补齐 panels.js 的 spec 归一/URL/复用分支，renderer 经现有 app:event 接收。无显式 page 的普通齿轮保留最近分类。构建版本从目标 package.json 注入 `__NS_VERSION__`。

- [ ] 写五页枚举与完整覆盖测试：用补充规格第 5 节的固定项目集合核对导航、settings-catalog、data-setting 定位和旧动作映射；缺一项失败，不能沿用插件三页白名单。
- [ ] 写新设置能切出隐现、主题/纸面/字体/字号失败重试、偏好广播不顶走分类的测试。恢复默认/撤销扩展为字体/字号/纸面/theme/顶栏的桌面外观项；不改 skin、AI/知识库、作品或目录。
- [ ] 先写设置首次打开/已有窗/加载中/就地回退的定向路由用例；AI 未就绪、“管理模型”和 go-ai 均落到 ai，普通齿轮不抢页面。补测表单尚未失焦时跳页，提交失败不丢值。
- [ ] 将插件玻璃侧栏和内容语言扩为外观、模型设置、知识库模型、备份与存储、帮助与关于五类；模型页复用 AiSettings、知识库页复用 KnowledgeModelSettings，不能嵌套旧 SettingsWindow 外壳。模型内容区小于 640px 时供应商/详情改上下排列；仅 appearance 占预览列。
- [ ] 用五页元数据统一页标题、面包屑、说明、页脚和返回；替换插件仅三类的 breadcrumb/footRight 条件，扩展 settingsPage 合法值、每页滚动记忆与搜索定位；重载偏好不得把 ai/knowledge 回退成 appearance/about。
- [ ] 按覆盖表接入供应商完整 CRUD/启停、Base URL/API格式/密钥、连接测试、模型列表/逐模型参数、温度/隐私/自动记忆；知识库继承连接、开关/模型/不支持状态/go-ai 不遗漏。供应商预设与写作预设分开，后者进入原 PresetWindow。
- [ ] 数据页完整接入原生存储管理：当前路径/默认标识、打开目录、更改/迁回默认、保留旧副本选项、旧目录大小/打开/两类清理、失效路径警示与清除记录。提取 DataLocationSettings 与旧设置共用动作，隐现外观重做行和确认框，长路径不盖住操作按钮，迁移显示重启进度并防重复。
- [ ] 搜索扩展模型/API/向量/纸面/存储/清理等条目，定位真实控件；索引只存静态说明，不含真实密钥/路径。纸面选择与预览保留；页头、侧栏、分组、状态、危险动作和响应式均按隐现设计统一。
- [ ] 无框设置窗口保留 drag/no-drag 区、关闭键与 panelReady。设置打开失败就地回退时保持 StudioWorkspace 已挂载，返回后选区和位置不变；根组件将 ui.view=settings 映射为 work surface，避免 resolveSkin 意外回落 original。
- [ ] 导入导出/备份恢复继续调用桌面原生 API；取消保存不能记成功备份或更新时间；全局搜索/回收站/历史/帮助/菜单按新皮肤约束 Teleport 和焦点。
- [ ] 确认关于页显示桌面真实版本；新设置和旧设置首帧/功能回归通过后提交。

**Verification:** `node tools/latent-settings-prefs.test.mjs`、`node tools/latent-settings-coverage.test.mjs`；隔离 `node tools/latent-settings-verify.mjs`、`node tools/latent-settings-routing-verify.mjs`、`node tools/settings-startup-verify.mjs`（开发与 `--production` 两种）；D-05～D-09 均有断言。1000×700 与 800px 设置窗逐页截图及操作，模型表单/预览/长路径/确认框不溢出；数据迁移相关旧脚本先按 Task 0 改造隔离后运行。
