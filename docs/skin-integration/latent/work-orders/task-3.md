# Task 3：迁入样式、资源、桌面主题桥与背景生命周期

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

## Task 3：迁入样式、资源、桌面主题桥与背景生命周期

**Files:** Create `src/styles/skins/latent/`（基础覆盖、language、flow-shell、模块样式及 index）、`src/services/latent/{blue-noise,cpu-backdrop,flow,latent-gl,palette}.js`、`src/skins/latent/theme.js`、`src/assets/writing-stats-backdrop.webp`；Modify `src/main.js`、`src/App.vue`；Create `tools/latent-theme-verify.mjs`。

**Interfaces:** `useLatentTheme(ui): ComputedRef<{dark:boolean,overrides:object}>`；runtime 负责维护局部 token 与 nsDark；保留 `mountFlowBackdrop(canvas,options)` 的 setPalette/resize/stats/dispose 等现有来源接口。

- [ ] 写主题用例：night 为暗，其余为亮；浅色无 data-ns-dark 属性；NConfigProvider 和 teleport 浮层一致；切回四种旧皮肤后 token 和样式与基线一致。
- [ ] 写背景用例：无 WebGL2、context loss、reduced motion、隐藏/销毁页面、反复换肤后引擎数与监听不增长。先运行失败。
- [ ] 搬入真实来源资源，核对 hash/字体引用/许可；CSS 保持原有效顺序，所有新通用选择器加皮肤或唯一根作用域。
- [ ] 明确移除目标迁入样式中插件专属 `.module-agent{display:none}`（来源 dsh.css 约 760–763 行），并审计其他按 dsh 皮肤隐藏 AI/拆窗/纸面控件的选择器。模块助手验证实际尺寸、可见性与点击，不只检查 DOM 存在。
- [ ] 在 App 根据 active skin 选覆盖，不把桌面 nsPlugin 改 true；不伪造 nsHost，逐条清理宿主专属 CSS 和标记依赖。维护桌面自身主题数据来源和清理权。
- [ ] 字体加载、亮暗/浮层、GPU/CPU 与退出清理用例通过后提交。

**Verification:** `npm run build`；隔离原生环境 `node tools/latent-theme-verify.mjs`，要求 theme/provider 一致、无 pageerror、切回旧皮肤无新增残留。
