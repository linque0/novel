# 赤月戏（金屏夜梅）皮肤素材

来源分两类：

- 书架 / 正文 / 大纲 / 设置四张仍来自 v1 设计稿 `金屏夜梅-完整设计稿/assets/`。
- 人物 / 设定 / 灵感三张已按 v3 接入要求替换为 2026-10-18 的新背景设计稿（v6 / v3）。相关设计源目录已在清理中移除，成品文件与哈希保留在本表。

| 应用内文件 | 设计稿原文件 | 模块 | 尺寸 | 输出 SHA-256 |
|---|---|---|---|---|
| `shelf.webp` | `金屏夜梅-完整设计稿/assets/nouveau.webp` | 书架 | 1672×941 | `99fce56fd0a7aa627482a60a81edfdc45cfde78eb23630fe9fa347db2d8b0d70` |
| `editor.webp` | `金屏夜梅-完整设计稿/assets/rinpa.webp` | 正文 | 1536×1024 | `b9f2671e57e37b61385a8a1ede84e03ce01413ad912cd0835162dd99615ef689` |
| `outline.webp` | `金屏夜梅-完整设计稿/assets/outline.webp` | 大纲 | 1536×1024 | `d2f04f9d6e1767269d03a7d8a711ec84ef7060bd9aa763dfbed27d9b069631e0` |
| `world.webp` | `world-celestial-atlas-v6.png`（源目录已清理） | 设定（左侧 220px 拱顶布景列） | 724×2172 | `4e9c975e1c0579fa7fbfc6fb31c7c43dacbd2663860c356b0e09d675ec346e50` |
| `characters.webp` | `characters-03-staggered-light-v6.png`（源目录已清理） | 人物（全舞台背景） | 1672×941 | `114b14b586fdd937ddeb2067d04d0432d75ca1a8c8e4b4105d48ede8a7020c47` |
| `inspiration.webp` | `inspiration-lantern-river-v3.png`（源目录已清理） | 灵感（全舞台 + 左布景列） | 1672×941 | `246c1ae4c4d3a8679a4d9f590a176343b25fb102a77ad15e44513280ad50cc7d` |
| `settings.webp` | `金屏夜梅-完整设计稿/assets/settings.webp` | 设置 | 1536×1024 | `72dbd5f1e2a6436df5a6eee747c57cb846779fec95e6ed1b5677860f6f67d89e` |

源 PNG 与哈希：

| 源文件 | 源 SHA-256 |
|---|---|
| `characters-03-staggered-light-v6.png` | `db01dfbd346136831a1e5c2b522524cadb9f02b079392cfa071c46b85c913fe8` |
| `world-celestial-atlas-v6.png` | `81eea0fa14a6e8f3e7acfb50ece51d2b195145389c52f51a88ac03102064065f` |
| `inspiration-lantern-river-v3.png` | `c808bdda5827fdacc0ad044f7d464cac3dccef858c92337ace29c546ab8831d8` |

转换方式：Chromium canvas，WebP 质量 0.9（一次性导入脚本已清理）。人物 2.51MB→269KB，设定 3.01MB→447KB，灵感 2.79MB→384KB。

约定：

- 七张图只承担**布景、材质与光影**；文字、导航、按钮、字段与关系标签一律是真实 HTML。
- 书架 / 设置仍用 CSS `background-image`；其它模块用 Vite 导入的 `<img>`，由组件按模块挂载。
- 设定只使用竖幅天仪图；设定舞台底图改为深墨绿渐隐，不再叠旧天鹅图。
- 灵感同一张图用两次：全舞台 `object-position:left center`，左布景列 `object-position:78% center`。
- 人物全舞台 `object-position:left center`，让右侧留白承托人物卷宗。
- 字体不新增：设计稿的 OldSong（京华老宋体）与 WenKai（霞鹜文楷）应用已内置。
- 设计稿的 `cover-*.webp`、`person*.webp` 是原型参考图，应用继续使用生成式封面与首字字牌，不复制。
