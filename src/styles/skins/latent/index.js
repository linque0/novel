/* 隐现（dsh）皮肤样式层：顺序与插件版 plugin/dsh/index.js 一致，不能调换。
 *
 * 顺序理由（来自插件版）：
 *   dsh.css       基础令牌与模块布局，实底 + 边框的底座
 *   language.css  语言令牌与胶囊外壳，排在 dsh.css 之后才压得住同权重的底色
 *   flow-shell.css 流动背板外壳（主窗 + 拆窗面板），同样靠后写为胜
 *   *-fusion.css  各模块的融合层，最后覆盖模块级细节
 *
 * 所有选择器均以 body[data-skin='dsh'] 或唯一根类为作用域，不会泄漏到四套旧皮肤。
 * 注：插件版用 [data-ns-host] 限定宿主专属规则，桌面版不设该属性，那批规则自然失效。
 */
import './dsh.css'
import './language.css'
import './flow-shell.css'
import './topbar.css'
import './outline-fusion.css'
import './characters-fusion.css'
import './settings-fusion.css'
/* 桌面版专属设置页（模型设置 / 知识库模型）的适配层：必须排在外壳骨架之后，才压得住嵌入控件自带的旧类 */
import './settings-desktop.css'
/* 模块级样式：人物 / 设定 / 灵感 / 统计 / 书架 / 正文 */
import './chars-shell.css'
import './chars-roster.css'
import './chars-dossier.css'
import './chars-context.css'
import './chars-graph.css'
/* 设定基础层：从插件版 themes.css 迁移的 .lore-* / .ob-* / .mubu-* 底座，必须排在细化层之前 */
import './lore-base.css'
import './lore-free-tree.css'
import './snippets-fusion.css'
import './writing-stats.css'
import './writing-stats-fusion.css'
import './latent-shelf.css'
/* latent-studio.css（正文 · 伏案静水）不在这里导入：
 * 插件版把它作为 <style src> 挂在 Workbench 组件上，组件级样式在构建后排在全局样式之后，
 * 才压得住 themes.css 的 .center-pane / .editor-head 实底。见 Workbench.vue 末尾。 */
