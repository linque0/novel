# 催更姬 vs 恍然梦：对比研究、机制剖析与三套落地方案

> 基线：**dsh-cuigengji-plugin v0.5.1**（本机已装）· **小说工坊 v1.1.3**（`package.json`）· **恍然梦 Agent**（`src/services/ai/` 44 个文件 6717 行 + `src/db/` 965 行）
> 范围：**纯文档交付**。本轮未修改 `src/`、`electron/`、`src/db/`、`package.json`，未装/升级任何依赖。
> 证据等级：文中 `✅` 为本轮实际读码/读文档核实，`⚠️` 为未核实并标注核实入口。

## 四条结论

1. **两者不是同类竞品，而是上下游**：催更姬把「智能」外包给 DSH 宿主（无自有 Agent 循环），自己只做数据面 + 工具面 + UI；恍然梦把智能抱在自己怀里（自有工具循环 + 22 类任务模板 + 预设编译引擎），因此拿不到宿主的规划/反思/子 Agent/模型路由。**想合并，问题不是"谁替代谁"，而是"大脑放哪一层"。**
2. **催更姬的长处可低成本移植进工坊，且不动 UI 栈与 Dexie**：Skill 渐进披露、索引式按需上下文、`requestId` 幂等 + `expectedRevision` 前置 CAS、规划事务化撤销。这四项是纯增量（方案 A）。
3. **互补点梳理出 17 条，但只有 9 条值得做**（见 `09` 的落地优先级）：最值钱的是 **C5+C6+C7（幂等 + 前置校验 + 单一写路径）一次重构三收**，以及 **C11+C12（结构化审稿与全覆盖复核）**——后者是催更姬最缺、又最容易被误以为"已经有了"的东西：它的 `cuigengji-revise` 只是行为规范，没有可校验的数据契约。
4. **「把小说工坊整个做成 DSH 插件」技术上可行但代价最重**：数据在渲染进程 IndexedDB（Node 侧工具读不到）、Vue SPA 与宿主 React 插槽栈不同、自有 Agent 循环与宿主 `dsh-agent-loop` 互斥。唯一能让「桌面 App + DSH 插件」双栖成立的架构是先把数据面下沉（方案 B），方案 C 应等 B 之后再做。

## 导航

| 文档 | 内容 |
| --- | --- |
| [01-异同对照.md](01-异同对照.md) | 双方现状档案（带 `文件:行`）、九轴对照表、各自 5 条优缺点、与既有评估文档的差异 |
| [02-双向移植清单.md](02-双向移植清单.md) | 催更姬→工坊 4 项、工坊→催更姬 4 项，每项：价值/改动落点/风险回退/工作量 |
| [03-方案A-单向移植.md](03-方案A-单向移植.md) | 开工级方案：A1 Skill 目录化、A2 上下文检索化、A3 版本并发升级、A4 规划事务化 |
| [04-方案B-novel-core双宿主.md](04-方案B-novel-core双宿主.md) | 开工级方案：领域模型/存储/工具下沉成独立包，Dexie 与 Node 文件双适配器 |
| [05-方案C-小说工坊插件化.md](05-方案C-小说工坊插件化.md) | 开工级方案 + 三条硬约束的取证与解法；含「最小可跑切片」与差距表 |
| [06-决策建议.md](06-决策建议.md) | 推荐顺序、翻转条件、明确不做清单、前置假设 |
| [07-深度剖析-催更姬.md](07-深度剖析-催更姬.md) | 机制级：提示词稳定段与幂等重装、三层渐进披露、actor 边界、`cas`、规划写路径收敛、文件事务 WAL、RPC 边界 |
| [08-深度剖析-恍然梦.md](08-深度剖析-恍然梦.md) | 机制级：上下文冻结、预算账本与覆盖报告、预设宏的延后求值、循环降级链、审稿五函数契约、写入十道闸门 |
| [09-互补点与接口设计.md](09-互补点与接口设计.md) | **17 个互补点**，分上下文/一致性/质量闭环/驾驶层四簇，每条给接口草案、吸收方、依赖与落地优先级 |
| [10-实施方案-小说工坊接入DSH.md](10-实施方案-小说工坊接入DSH.md) | **施工方案**：插件托管 `dist/` + iframe 跑完整 UI + 服务端权威库 + op-log 同步 + 11 个 `studio_*` 工具；P0–P5 分期 58–89 人日 |

## 复核命令（版本漂移后重跑，确认文档数字仍成立）

```bash
# 催更姬：版本与规模
P=~/.dsh/profiles/desktop/node_modules/dsh-cuigengji-plugin
grep -m1 '"version"' "$P/package.json"
find "$P/src" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) | wc -l
find "$P/src" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) -exec cat {} + | wc -l
# 催更姬：工具与 action 数（期望 17 / 28 / 18 / 3 = 66）
# 注意：Git Bash 的 /c/... 路径直接喂给 node 会解析失败，必须先进目录再用相对路径
(cd "$P" && node --input-type=module -e "import('./src/contracts/actions.js').then(m=>{for(const[k,v]of Object.entries(m.TOOL_ACTIONS))console.log(k,v.length)})")
ls -1 "$P/skills" | wc -l      # 期望 6
cat "$P"/skills/*/SKILL.md | wc -c   # 期望 43013（含 references 共 54825）

# 工坊：版本与规模
node -p "require('./package.json').version"
find src -name '*.vue' | wc -l; find src -name '*.vue' -exec cat {} + | wc -l
find src -name '*.js' | wc -l;  find src -name '*.js'  -exec cat {} + | wc -l
cat src/services/ai/*.js src/db/*.js | wc -l          # 期望 7682
grep -c "': profile" src/services/ai/task-profiles.js # 期望 22（任务类型）
grep -n "^  [a-z_]*: {" src/services/ai/tools.js | wc -l  # 期望 15（只读工具）
grep -n "roundLimit =" src/services/ai/dialogue.js    # 期望 283: task ? 24 : 6
```
