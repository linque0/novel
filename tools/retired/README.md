# 停用的验收脚本

本目录存放**已停用**的验收脚本。文件保留是为了让历史验收过程可追溯、必要时可复跑，**不是日常工具**，不要把它们加进 npm scripts 或 CI。

## 停用原因分类

### 一、依赖已归档的目录（9 个）

验收页面、对照素材或输出目录已移出仓库，脚本跑必失败。

| 脚本 | 依赖路径 | 归档位置 |
|---|---|---|
| `outline-mini-drag-verify.mjs` | `docs/outline-calibration-validation/` | tag `pre-cleanup-20261112` |
| `outline-container-drag-verify.mjs` | 同上（`?skin=gravity`） | tag |
| `outline-skin-integration-verify.mjs` | 同上（四皮肤） | tag |
| `studio-topbar-nav-verify.mjs` | 同上 | tag |
| `topbar-autohide-verify.mjs` | 同上 | tag |
| `outline-routing-verify.mjs` | `docs/outline-routing-validation/` | tag |
| `glaze-evidence.mjs` | `docs/前端美化/琉光画境-验收/`、`oil-ui-v3-功能对齐/gallery/c/` | tag |
| `glaze-regression.mjs` | `docs/前端美化/琉光画境-验收/logs/` | tag |
| `gravity-refinement-evidence.mjs` | `docs/前端美化/引力书舱-优化验收/`、`gallery/a/` | tag |

### 二、依赖仓库外的本机绝对路径（6 个）

首行都是 `import { Browser } from 'file:///C:/Users/linque/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs'`，换机器/换用户就跑不了。它们对应的 3D 书架方案（`original-shelf-scene.mjs` 等）已于 2026-11-12 移除。

`original-shelf-browser.mjs`、`original-shelf-v2-browser.mjs`、`original-shelf-v2-production.mjs`、`original-booklist-browser.mjs`、`original-booklist-production.mjs`、`original-workspace-browser.mjs`

**仓库内替代**：`tools/_cdp-lib.mjs`（CDP 公共库，90 个脚本在用）。改造方式是把首行换成 `import { connect } from '../_cdp-lib.mjs'`，并按 `connect()` 接口调整调用。

## 复跑方法

```bash
# 1. 取回被依赖的归档目录
git checkout pre-cleanup-20261112 -- docs/outline-calibration-validation

# 2. 把脚本移回 tools/（相对导入才会指向正确位置）
git mv tools/retired/<script>.mjs tools/

# 3. 按脚本文件头的说明准备环境（Vite 5173 / 隔离 Electron profile / CDP 端口）后运行
node tools/<script>.mjs
```

## 验收结论

这些脚本当初的验收结果全部为**通过**，结论与证据位置见 [docs/验收记录.md](../../docs/验收记录.md)。

## 不要做的事

- 不要把本目录脚本加进 `package.json` 的 scripts
- 不要用它们做新功能的回归——它们验证的是历史状态，可能对当前实现产生假失败
- 需要新的验收时，在 `tools/` 下新建脚本，参照 `_cdp-lib.mjs` 的接口
