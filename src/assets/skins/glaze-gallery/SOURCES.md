# 琉光画廊素材来源

2026-10-29 为「琉光画境」书架首屏新增。世界名画均为公版作品，取自 Wikimedia Commons；工坊画作由项目内置 image_gen 生成，压缩后复用在这里，不再作为书封贴图。

## 世界名画

| 文件 | 作品 | 作者 | 年代 | 收藏 / 版本 | Commons 文件页 | 原图 | 输出 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `world/impression-sunrise.webp` | 印象·日出 / Impression, Sunrise | 克劳德·莫奈 | 1872 | 巴黎马尔莫坦莫奈美术馆 | https://commons.wikimedia.org/wiki/File:Monet_-_Impression,_Sunrise.jpg | 5773×4478 | 3200×2482 |
| `world/poppy-field.webp` | 罂粟花田 / Poppy Field | 克劳德·莫奈 | 1873 | 巴黎奥赛博物馆 | https://commons.wikimedia.org/wiki/File:Claude_Monet_-_Poppy_Field_-_Google_Art_Project.jpg | 5586×4258 | 3200×2440 |
| `world/starry-night.webp` | 星月夜 / The Starry Night | 文森特·梵高 | 1889 | 纽约现代艺术博物馆（MoMA） | https://commons.wikimedia.org/wiki/File:Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg | 44567×35291 | 3200×2534 |
| `world/great-wave.webp` | 神奈川冲浪里 / The Great Wave off Kanagawa | 葛饰北斋（原作） | 约 1831 | Commons 修复版；Adachi 昭和时期复刻，原作公版 | https://commons.wikimedia.org/wiki/File:Great_Wave_off_Kanagawa2.jpg | 8242×5640 | 3200×2190 |
| `world/fighting-temeraire.webp` | 被拖去解体的战舰无畏号 / The Fighting Temeraire | J. M. W. 透纳 | 1839 | 伦敦英国国家美术馆 | https://commons.wikimedia.org/wiki/File:The_Fighting_Temeraire,_JMW_Turner,_National_Gallery.jpg | 5684×4223 | 3200×2378 |
| `world/view-of-delft.webp` | 代尔夫特风景 / View of Delft | 约翰内斯·维米尔 | 约 1660–1661 | 海牙莫瑞泰斯皇家美术馆 | https://commons.wikimedia.org/wiki/File:Vermeer-view-of-delft.jpg | 3000×2491 | 3000×2492 |

全部为 Public domain（忠实复制 2D 公版画作，PD-Art）。缩略图位于 `world/thumbs/`，宽 480px。

## 工坊画作（工坊印象）

| 文件 | 对应封面款式 | 来源 | 输出 |
| --- | --- | --- | --- |
| `studio/novel.webp` | 虚构 · 克莱因蓝 | `../glaze-art/novel.png` | 1086×1448 |
| `studio/note.webp` | 非虚构 · 象牙白 | `../glaze-art/note.png` | 1086×1448 |
| `studio/cedar.webp` | 文集 · 松绿 | `../glaze-art/cedar.png` | 1086×1448 |
| `studio/violet.webp` | 诗辑 · 藤紫 | `../glaze-art/violet.png` | 1086×1448 |
| `studio/claret.webp` | 别藏 · 绛红 | `../glaze-art/claret.png` | 1086×1448 |
| `studio/ink.webp` | 特殊 · 墨黑 | `../glaze-art/ink.png` | 1086×1448 |

来源与生成提示词见 `../glaze-art/SOURCES.md`。原 PNG 保留作源文件，但已不再被前端 import，因此不会进入构建产物。缩略图位于 `studio/thumbs/`，宽 320px。

## 处理命令

2026-10-29 美术馆产品接入增加 `display/world/`（1280px 宽）和
`display/studio/`（720px 宽）的 WebP q86 展示版本，均由对应现有完整图像
等比缩放，未裁切。书架只载入展示版本，侧栏载入原有完整构图缩略图；
点击完整预览才载入原有高清文件。避免将3200px图像反复送入小画幅栅格化。
这些派生文件沿用上表对应原图的来源与许可。

原图先按 Commons API 返回的 3840px 预览下载（维米尔使用 3000px 原图），再用 ffmpeg 缩放并转 WebP：

```bash
ffmpeg -y -i raw.jpg -vf "scale=3200:-2:flags=lanczos" -frames:v 1 -map_metadata -1 \
  -c:v libwebp -quality 86 -compression_level 6 world/<id>.webp

ffmpeg -y -i raw.jpg -vf "scale=480:-2:flags=lanczos" -frames:v 1 -map_metadata -1 \
  -c:v libwebp -quality 82 -compression_level 6 world/thumbs/<id>.webp

ffmpeg -y -i ../glaze-art/<kind>.png -vf "scale=1086:-2:flags=lanczos" -frames:v 1 -map_metadata -1 \
  -c:v libwebp -quality 88 -compression_level 6 studio/<kind>.webp
```

具体尺寸、字节数和来源元数据见同目录 `manifest.json`。画面中没有水印、边框或文字；作品信息由界面里的馆藏标签展示。
