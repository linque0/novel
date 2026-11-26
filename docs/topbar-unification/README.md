# 四款皮肤统一顶栏

已实现用户确认的方案：原版工坊、引力书舱、琉光画境、赤月戏的书架与书内工作区共用 `AppTopbar`，导航定义集中在 `app-navigation.js`。

## 交付行为

- 固定顺序：书架、正文、大纲、设定、人物、灵感、设置。布局、尺寸与选中标记共用，配色、字体与品牌装饰跟随皮肤。
- 移除引力书舱书架底部胶囊栏、琉光画境书架第二排导航、各皮肤独立页头导航及原版书内左侧模块导航。
- 书架导航打开当前展示作品；无作品或搜索无结果时禁用作品入口，打开期间阻止重复操作，失败保留搜索与书架位置。
- 书架与书内共用已有 `topbarAutoHide` 持久化偏好和 `AutoHideTopbar`，支持顶部展开、固定、Esc 与键盘访问。
- 书内保存、搜索、恍然梦与更多工具使用同一工具区；窄窗通过更多菜单保留任务助手入口。拆窗、书签、沉浸和阅读仍可使用。
- 复用已有收起和颜色过渡动效；没有新增展示动画。独立面板与模块内部工具栏不改版。

## 验收结果（2026-10-23）

在独立 Electron 配置 `--profile=topbar-unification-verify --dev --remote-debugging-port=9333` 中执行，不操作日常作品数据。

| 检查 | 结果 |
| --- | --- |
| `node tools/unified-topbar-verify.mjs` | 149/149，连续三轮通过 |
| `node tools/studio-topbar-nav-verify.mjs` | 44/44，连续三轮通过，无控制台 error |
| `node tools/topbar-autohide-verify.mjs` | 40/40，连续三轮通过，无控制台 error |
| 同一作品内连续切换四款皮肤 | 三轮共 12 次，当前模块、收起偏好和唯一任务挂载点保持正确；无运行时错误 |
| `node tools/skin-unit-verify.mjs` | 通过 |
| 修改的七个 Vue 组件 | SFC 脚本及模板编译通过 |
| 修改内容的 `git diff --check` / 验证脚本语法 | 通过 |

集成检查覆盖 1440、1080、780px 及 390px 布局视口。200% 使用 780px 物理视口对应的 390px 布局宽度和 2 倍像素比例验证顶栏重排及字号；这不是对模块内部布局的全面缩放验收。

原有 `tools/skin-verify.mjs` 的底部导航选择器也已迁移为共享顶栏选择器；本次未执行其包含作品创建、编辑、删除等操作的完整旧流程，新导航行为由上述集成检查覆盖。

## 审查和证据

完成一轮独立代码审查并自行查看目标区域截图。审查发现赤月戏旧网格规则覆盖共享顶栏行高；实际几何断言复现了收起后留白，修复选择器优先级后通过。同步修正赤月戏书架收起按钮的文字颜色继承。

`checks.json` 保存主集成检查计数，`lifecycle-checks.json` 保存即时切换皮肤结果。当前目录的 `*-shelf-desktop.png`、`*-shelf.png`、`*-work.png`、`*-zoom200.png` 为四款皮肤的截图。导航和自动隐藏报告分别位于 `../outline-skin-integration/topbar-nav-checks.json`、`../outline-skin-integration/topbar-checks.json`。

保留工作区原有未提交改动，没有修改作品数据结构或偏好格式，没有创建 Git 提交。
