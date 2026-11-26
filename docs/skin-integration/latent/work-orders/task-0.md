# Task 0：冻结当前前端与桌面基线

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

## Task 0：冻结当前前端与桌面基线

**Files:** 来源全部 `app/src/**`、`app/plugin/dsh/**`、`app/vite.config.mjs` 及运行时参考 `src/client/iframe-shim.js`、`lib/client.js`、`src/core/**`；目标 `src/**`、`plugin/dsh/**`、`electron/**`、`packages/novel-core/**`、package/vite 配置。新增 `docs/skin-integration/latent/source-manifest.json` 和 `port-map.md`。

**Interfaces:** 产出来源/目标路径、HEAD、工作树 SHA-256、差异类别、模块归属；port-map 为每个候选文件标记复用、局部新视图、手工合并或保留桌面，不将 HEAD 当现状快照。

- [ ] 读取两仓当前 git status、适用 AGENTS.md、附着工作区；记录与本方案编写时的差异。保存现有未提交变更的可恢复副本，不自动 stash 或 commit 用户改动。
- [ ] 生成源码清单，复核本方案的 258/54/82/138 差异计数；源码变化时先重做受影响模块映射。补查 `app/docs/使用手册.md`、字体许可及 public 资源。
- [ ] 冻结构建依赖：记录存在的 package-lock/pnpm-lock/yarn.lock、app/node_modules 联接目标及 Vue/Pinia/Dexie/Tiptap/Naive UI/Vite/Electron 的实际已安装版本；没有锁文件时把本地解析结果写入基线，不先联网更新依赖。
- [ ] 先交付测试脚本兼容表：逐个检查是否纯 Node、是否支持端口/profile 参数、是否固定 dev 数据目录，以及是否存在 killAll、全局进程终止、数据目录迁移/删除。`tools/dataDir-verify.mjs` 当前会固定 dev 并结束其他 Electron/Vite，禁止原样运行；先改为测试专用入口，只操作自己启动的进程和临时目录。`tools/_ai-test-profile.mjs` 的允许列表也需适配测试 profile。复用 settings-startup-verify 的唯一 profile 启动和 getDataLocation 实际路径断言，仅更换 CDP 端口不足以证明隔离。
- [ ] 在独立测试 profile 运行目标既有构建和相关基线测试，记录现有失败。启动/截图前确认 profile 数据目录不重定向到用户目录。
- [ ] 采集来源**DSH 宿主内当前构建实际页面**的模块截图、可见按钮与交互清单；记录宿主亮暗/字号和 shim 产生的实际 --ns-* 计算令牌。裸 app 构建不能独立替代来源基线；离线复现注入采集的令牌快照。记录来源构建是否与源码一致，必要时在临时目录构建来源副本，不能覆盖用户的 assets/app。
- [ ] 将补充规格的桌面差异表转成 `port-map.md` 的覆盖清单：拆窗九类窗口、入梦/浅眠/模块助手/选区发送、五类设置全部项目；每项记录原组件、原 handler、新界面位置、状态、测试和截图。恢复默认范围按桌面外观项固定，不沿用插件仅四项快照。
- [ ] 交付可复现的 port-map 和基线报告后提交本任务文档。

**Verification:** 目标运行 `npm run build`、`node tools/skin-unit-verify.mjs`、`node tools/original-workspace-unit.test.mjs`。构建输出与测试退出码记录在报告；已有失败不得当成本次已修复。
