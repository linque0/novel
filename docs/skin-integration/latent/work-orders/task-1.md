# Task 1：开放第五套皮肤与可靠切换

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

## Task 1：开放第五套皮肤与可靠切换

**Files:** Modify `src/skins/registry.js`、`src/stores/ui.js`、`src/services/appbus.js`、`src/components/SkinPicker.vue`；Create `src/services/appearance-transition.js`、`src/skins/latent/runtime.js`、`tools/latent-registry.test.mjs`、`tools/latent-preference-verify.mjs`。

**Interfaces:** 保留旧 registry 函数签名；新增 `isLatentSkin(value): boolean`；`installLatentRuntime({ui,document,window}): () => void` 安装可释放监听；切肤仍为 `ui.setSkin(value): Promise<void>`，本窗口保存屏障成功、偏好落库成功后显示并广播。`appearance-transition.js` 提供 `registerAppearanceGuard(guard:()=>Promise<void>):()=>void`、`syncSkinPreference():Promise<'applied'|'deferred'>`；远端同步只更新本窗应用状态，不反写 skin。协调器内维护每窗口最新待应用值，ui.skin 仍表示实际显示值。

- [ ] 先写注册/持久化用例：开关启用有且仅有五项，dsh 支持 shelf/work/panel，未知值和 surface 仍回落 original；关闭开关不出现正式候选项。
- [ ] 先写失败用例：appconfig.put 拒绝时 skin/theme/body 不变；连续操作不被早发迟到请求覆盖；广播后其他窗口不重复写库。另窗正在 IME 或局部提交失败时，只延期该窗应用，不反写旧值；恢复保存后重读数据库并应用最新值，普通偏好同步不被阻断。
- [ ] 运行上述新用例，确认因未实现契约而失败，再扩展 registry 与切肤入口。复用已有受众过滤接口，不把 isStudioSkin 扩成隐现判断。
- [ ] runtime 只随皮肤切换启停，不调用 installDshSkin，不创建“强制纠正 data-skin”的 observer。改造 appbus→loadPrefs 的 skin 写入路径：启动直接载入，其余本地/远端变化均经过协调器，待应用状态给出可重试提示。收到乱序事件重读最后成功落库值并丢弃过期异步结果。
- [ ] 新旧注册和偏好测试通过后提交；本任务不宣称 UI 已接入。

**Verification:** `node tools/latent-registry.test.mjs`、`node tools/skin-unit-verify.mjs`；原生隔离环境运行 `node tools/latent-preference-verify.mjs`。期望无重复广播写入、拒绝时保持原外观。
