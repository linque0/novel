# 字体来源与授权

本目录是应用内置字体。全部字体均为**免费商用授权**，按 GB2312 + 常用符号子集化后转为 woff2 本地打包，运行时不请求任何外部字体服务。

## 内置字体清单

| 字体 | CSS family | 文件 | 授权 | 授权原文 |
|---|---|---|---|---|
| 思源宋体 | `Noto Serif SC` | `files/noto-serif-sc-*.woff2` | SIL Open Font License 1.1 | [`public/licenses/Noto-Serif-OFL.txt`](../../public/licenses/Noto-Serif-OFL.txt) |
| Playfair Display | `Playfair Display` | `files/playfair-display-*.woff2` | SIL Open Font License 1.1 | Google Fonts（OFL-1.1） |
| 霞鹜文楷 | `LXGW WenKai` | `files/lxgw-wenkai-sc-*.woff2` | SIL Open Font License 1.1 | [`public/licenses/LXGW-WenKai-OFL.txt`](../../public/licenses/LXGW-WenKai-OFL.txt) |
| 京華老宋体 | `KingHwa OldSong` | `files/kinghwa-oldsong-*.woff2` | 免费商用（猫啃网标注） | 原始授权说明未随子集入库 |
| 朝华标题 | `Zhaohua Title` | `files/zhaohua-title-*.woff2` | 免费商用（猫啃网标注） | 原始授权说明未随子集入库 |
| 字嶼雲遊手書 | `Ziyu Yunyou` | `files/ziyu-yunyou-*.woff2` | 免费商用（猫啃网标注） | 原始授权说明未随子集入库 |
| Montenegrin Gothic One | `Montenegrin Gothic One` | `files/montenegrin-*.woff2` | SIL Open Font License 1.1 | 原始授权说明未随子集入库 |

字体在 `fonts.css`（内置两组）与 `fonts-user.css`（用户字体素材五组）中通过 `@font-face` 声明，`src/styles/` 的皮肤样式按 family 名引用。

## 历史说明

这些字体原为设计阶段素材，曾在 `docs/前端美化/字体/` 保留原始 zip 与授权说明。该目录已归档（2026-11-12），随仓库跟踪的副本移至 `docs/archive/frontend-fonts/`（本地保留、不入库）。需要核对原始授权原文时：

```bash
git checkout pre-cleanup-20261112 -- docs/前端美化/字体
```

## 待补

京華老宋体、朝华标题、字嶼雲遊手書、Montenegrin Gothic One 四款字体的授权原文尚未落到 `public/licenses/`。若后续要做对外分发或合规审计，建议从猫啃网（maoken.com）与字体官方仓库补齐授权文件后放入 `public/licenses/`，并在上表登记。
