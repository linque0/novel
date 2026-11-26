# Task 9：全量互切、多窗口、保真和发布

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

## Task 9：全量互切、多窗口、保真和发布

**Files:** Create `tools/latent-integration-verify.mjs`、`tools/latent-visual-verify.mjs`、`docs/skin-integration/latent/verification/`；Modify `package.json` 只增加必要验证入口；验证通过后移除开发门禁、更新目标 README/CHANGELOG。

**Interfaces:** 测试报告记录 profile、构建标识、来源哈希、屏幕尺寸、用例结果、控制台错误、截图路径、源数据前后摘要；任何未通过项不得只用“构建成功”替代。

- [ ] 完成新皮肤所有模块及弹层的按钮动作清单，逐条给出通过证据；AI/创作台/预设窗口完成实际工具、表单、输入、列表和浮层适配，不能以令牌统一或入口存在结项。逐条关闭补充规格 D-01～D-09，报告附新桌面区域截图及交互证据。
- [ ] 执行四个旧皮肤↔隐现的双向切换矩阵，在书架/正文/大纲/设定/人物/灵感/设置/分析中验证；包含未保存输入、输入法、弹层、图谱拖拽和异步保存。
- [ ] 主窗与正文/大纲/人物/设定/灵感/设置/AI/创作台/预设窗同时打开，验证偏好收敛、首帧、无框拖拽、锁保持、正文只读占位、关闭保存和锁释放。
- [ ] 以测试数据运行备份恢复、库同步、重启往返；“只切肤”的源表数量和规范化哈希完全一致，appconfig 只发生允许的皮肤偏好写入。
- [ ] 对照来源实际渲染核对视觉：统一测试作品、字体、主题、尺寸、DPR，流动背景定时/减动画后截取；像素差异不能代替人工检查布局、文字、遮挡和入口。
- [ ] 连续 20 轮换肤/模块/面板开关，核对编辑器身份、GPU/CPU 实例、RAF、observer、全局监听无累计。采集旧皮肤与新皮肤同环境空闲和编辑时表现，新增持续资源占用须解决或明确阻止发布。
- [ ] 执行 `npm run build`，验证打包 `app://` 中所有离线资源、动态 chunk 和相对路径；开发模式通过后仍需 production 全流程验证。
- [ ] 全部验收通过后去掉门禁，保留默认原选择。再执行 `npm run dist` 生成 Windows 产物，在隔离 profile 上做安装/启动/设置/编辑/重启/切回旧皮肤冒烟；不覆盖用户正在使用的安装目录。
- [ ] 输出验收报告、截图、已知限制、各模块提交与回退说明后提交发布改动。插件来源仓库不随桌面发布重构或同步代码。

**Verification:** `node tools/latent-integration-verify.mjs`、`node tools/latent-visual-verify.mjs`；原多窗口、四套皮肤、写作与 AI 回归按各脚本前提运行。新脚本必须自行启动/验证独立 profile；旧脚本须先通过 Task 0 兼容审计并改造固定 profile、全局终止进程和目录副作用，再接入隔离端口，不能直接使用默认 9222 写用户环境。
