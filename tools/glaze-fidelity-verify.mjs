/* 琉光画境视觉保真验收（v1.1.1）：把「真实版对齐 C 版设计稿」的三处关键表现变成可回归断言。
 * 覆盖：人物关系图（页头/提示条/节点卡/边标签/端口/画布/芯片）、设定详情关系图谱
 *      （卡片节点/纯文字标签/光晕画布）、大纲文本视图（元信息 chip/条目标题/正文排版/工具条提示）。
 *
 * 运行前提：
 *   1) npm run dev（vite 5173）
 *   2) 隔离实例：.\node_modules\electron\dist\electron.exe . --dev --profile=glaze-skin-verify \
 *        --remote-debugging-port=9224 --disable-backgrounding-occluded-windows
 * 用法：node tools/glaze-fidelity-verify.mjs      截图：tools/_shot-glaze-fidelity-*.png
 *
 * 口径说明（对齐 docs/开发流程.md §5.2）：
 *  - 断言读 getComputedStyle，不比对图像；图谱画布带缩放，故不断言受缩放影响的 px 宽度，
 *    改断言颜色、圆角、形态这类缩放无关值。
 *  - 夹具作品由本脚本自建自删（隔离 profile），不碰注册表验证书与用户数据。
 *  - 窗口需可见（隐藏窗口下截图会挂起）；脚本会把窗口提到前台。
 */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { connect } from './_cdp-lib.mjs'

const c = await connect('http://127.0.0.1:5173', '9224')
const results = []
const check = (value, message, detail = '') => {
  results.push(!!value)
  console.log((value ? 'PASS ' : 'FAIL ') + message + (value ? '' : '  —— ' + String(detail).slice(0, 300)))
}
const ev = async (code, client = c) => {
  const r = await client.evalx(code)
  if (r?.PAGE_ERR) throw new Error(r.PAGE_ERR)
  return r
}
async function wait(code, client = c) {
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    if (await ev(code, client)) return true
    await c.sleep(80)
  }
  throw new Error('Timed out: ' + code)
}
async function shot(name) {
  await ev('document.fonts.ready.then(() => true)')
  await c.sleep(350)
  const frame = await Promise.race([c.send('Page.captureScreenshot', { format: 'png' }), new Promise((_, rj) => setTimeout(() => rj(new Error('截图超时（窗口不可见？）')), 10000))])
  await writeFile(new URL(`./_shot-glaze-fidelity-${name}.png`, import.meta.url), Buffer.from(frame.data, 'base64'))
}
/* 在页面里取一批计算样式 */
const styles = (list) => ev(`(() => {
  const out = {}
  for (const [key, sel, prop] of ${JSON.stringify(list)}) {
    const el = document.querySelector(sel)
    out[key] = el ? getComputedStyle(el)[prop] : '(缺元素)'
  }
  return out
})()`)
const textOf = (sel) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); return el ? el.textContent.trim() : null })()`)

let fixtureId = null
let prefs = null
try {
  await c.send('Page.bringToFront')
  await c.send('Page.reload', { ignoreCache: true })
  await wait('!!window.__ns && !!document.querySelector(".app-root")')
  await ev(`(async()=>{const {useUiStore}=await import('/src/stores/ui.js');const {useShelfStore}=await import('/src/stores/shelf.js');window.__g={ui:useUiStore(),shelf:useShelfStore(),work:__ns.getWork()};return true})()`)
  const loc = await ev('native.getDataLocation()')
  check(String(loc.defaultDir).endsWith('小说工坊-glaze-skin-verify') && loc.current === loc.defaultDir, '只跑在隔离验收 profile 上', loc.defaultDir)
  const prefsSaved = await ev('__ns.db.appconfig.toArray()')
  prefs = prefsSaved

  /* 夹具：一本自建作品，含 2 人物 + 1 人物关系 + 设定树 + 2 条关联关系 + 1 大纲节点 */
  fixtureId = await ev(`(async()=>{
    if(__g.work.work) await __g.work.closeWork()
    const row = await __g.shelf.createWork({title:'琉光保真验收',author:'验收',genre:'科幻',status:'构思',kind:'novel',intro:'',withVolume:true})
    await __g.ui.setSkin('glaze'); await __g.work.open(row.id)
    const w = __g.work
    w.addCharacter('甲'); w.updateCharacter(w.selCharacterId,{role:'主角'})
    const b = w.addCharacter('乙'); w.updateCharacter(b.id,{role:'配角'})
    w.addRelation(w.liveCharacters.find((x)=>x.name==='甲').id, b.id, '师徒')
    const root = w.mubuAdd(null,null,'星图系统'); window.__fRoot = root.id
    const coords = w.mubuAdd(root.id,null,'失落坐标')
    w.addLoreLink({fromKind:'character',fromId:b.id,toKind:'mubu',toId:root.id,label:'研究者'})
    w.addLoreLink({fromKind:'mubu',fromId:root.id,toKind:'mubu',toId:coords.id,label:'管理'})
    const n = w.olnodeAdd(null,{kind:'event',title:'启航',text:'在黎明到来之前离开星港。',canvasX:200,canvasY:200,w:230,h:100})
    w.selOlnodeId = n.id
    return row.id
  })()`)
  await c.sleep(900)

  /* ── 人物关系图 ─────────────────────────────────────────────── */
  await ev(`(()=>{__g.work.tab='characters';__g.work.charView='graph';return true})()`)
  await wait('!!document.querySelector(".rg-node")')
  /* 悬停要用真实指针：合成 mouseover 不会触发 :hover（端口与节点态都靠 hover） */
  const nodeBox = await ev(`(() => { const r = document.querySelector('.rg-node').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } })()`)
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: nodeBox.x, y: nodeBox.y })
  await c.sleep(400)
  check((await textOf('.rg-heading h1')) === '人物关系图', '关系图补出页头标题（C 版 h1）', await textOf('.rg-heading h1'))
  check((await textOf('.rg-heading span')) === '人物与人物的关系 · 双击节点打开档案', '页头副题与设计稿逐字一致', await textOf('.rg-heading span'))
  check((await textOf('.rg-hint')) === '拖动人物排列 · 从节点边缘连线 · 双击打开详情 · 右键操作', '图谱底部提示条与设计稿逐字一致', await textOf('.rg-hint'))
  /* 顶部三处（v1.1.1 补充）：标签下拉 / 页头发送按钮 / 文案化布局按钮 */
  const pick = await ev(`(() => {
    const el = document.querySelector('.rg-toolbar .rg-tagpick')
    const holder = el?.querySelector('.n-base-selection')
    return JSON.stringify({
      exists: !!el,
      selectStillThere: !!document.querySelector('.rg-toolbar select'),
      placeholder: (el?.querySelector('.n-base-selection-placeholder')?.textContent || '').trim(),
      width: el ? Math.round(el.getBoundingClientRect().width) : 0,
      radius: holder ? getComputedStyle(holder).borderRadius : '',
      border: holder ? getComputedStyle(holder.querySelector('.n-base-selection__state-border') || holder).borderTopColor : ''
    })
  })()`)
  const pk = JSON.parse(pick)
  check(pk.exists && !pk.selectStillThere && pk.placeholder === '全部标签', '标签筛选改成下拉且占位「全部标签」（不再有原生 select）', pick)
  check(pk.width === 110 && pk.radius === '8px' && pk.border === 'rgb(175, 200, 204)', '下拉宽度 110 / 圆角 8 / 描边 #afc8cc（.af-canvas-tools select）', pick)
  const headBefore = await ev(`(() => { const b = document.querySelector('.rg-heading .rg-head-action'); return JSON.stringify({ text: (b?.textContent || '').trim(), disabled: !!b?.disabled }) })()`)
  await ev(`(() => { __g.work.selCharacterId = null; return true })()`)
  await c.sleep(260)
  const headAfter = await ev(`(() => { const b = document.querySelector('.rg-heading .rg-head-action'); return JSON.stringify({ disabled: !!b?.disabled, title: b?.getAttribute('title') || '' }) })()`)
  await ev(`(() => { __g.work.selCharacterId = __g.work.liveCharacters[0].id; return true })()`)
  await c.sleep(200)
  const hb = JSON.parse(headBefore)
  const ha = JSON.parse(headAfter)
  check(hb.text === '发送为大纲引用卡' && hb.disabled === false && ha.disabled === true && /选中/.test(ha.title), '页头右侧「发送为大纲引用卡」：选中人物时可用、未选中时禁用', headBefore + ' / ' + headAfter)
  const layout = await ev(`(() => {
    const pick = (t) => { const b = document.querySelector('button[title="' + t + '"]'); return b ? { text: b.textContent.trim(), cls: b.className, tag: b.tagName, h: Math.round(b.getBoundingClientRect().height), nowrap: getComputedStyle(b).whiteSpace } : null }
    return JSON.stringify({ circle: pick('圆形排布'), grid: pick('网格排布'), fit: pick('适应视图') })
  })()`)
  const ly = JSON.parse(layout)
  check(ly.circle?.text === '圆形' && ly.grid?.text === '网格', '布局按钮按设计稿显示文字「圆形」「网格」', layout)
  check(ly.circle?.h <= 32 && ly.circle?.nowrap === 'nowrap', '文字按钮不换行、高度不溢出（曾出现竖排两行）', layout)
  check(ly.circle?.tag === 'BUTTON' && ly.grid !== null && ly.fit !== null && /\bom-btn\b/.test(ly.circle.cls) && /\bom-btn\b/.test(ly.grid.cls), '布局按钮仍是 om-btn 且 title 原样保留（脚本按 title 点击）', layout)
  const g = await styles([
    ['nodeBorder', '.rg-node:not(.sel)', 'borderTopColor'], ['nodeStyle', '.rg-node:not(.sel)', 'borderTopStyle'],
    ['selBorder', '.rg-node.sel', 'borderTopColor'],
    ['nodeRadius', '.rg-node', 'borderRadius'], ['nodeBg', '.rg-node', 'backgroundColor'],
    ['nodeShadow', '.rg-node', 'boxShadow'], ['nameSize', '.rg-node .rg-name', 'fontSize'],
    ['metaAlign', '.rg-node .rg-meta', 'alignItems'], ['roleRadius', '.rg-node .rg-role', 'borderRadius'],
    ['roleBg', '.rg-node .rg-role', 'backgroundColor'], ['roleColor', '.rg-node .rg-role', 'color'],
    ['elabelBg', '.rg-elabel', 'backgroundColor'], ['elabelBorder', '.rg-elabel', 'borderTopWidth'],
    ['elabelSize', '.rg-elabel', 'fontSize'], ['chipOnBg', '.oc-chip.on', 'backgroundColor'],
    ['chipBorder', '.oc-chip:not(.on)', 'borderTopColor'], ['canvasBorder', '.rg-canvas', 'borderTopColor'],
    ['canvasDots', '.rg-canvas', 'backgroundSize'], ['aptDot', '.rg-apt', 'opacity']
  ])
  check(g.nodeBorder === 'rgb(255, 255, 255)' && g.nodeStyle === 'solid', '节点卡：2px 白描边（C 版 .af-graph-person）', g.nodeBorder + ' / ' + g.nodeStyle)
  check(g.selBorder === 'rgb(20, 104, 120)', '选中节点用强调色描边（设计稿 .af-graph-person.selected）', g.selBorder)
  check(g.nodeRadius === '13px', '节点卡圆角 13px', g.nodeRadius)
  check(/^rgba?\(251, 255, 255/.test(g.nodeBg), '节点卡底色 #fbffffde', g.nodeBg)
  check(/rgba\(124, 164, 174/.test(g.nodeShadow), '节点卡投影改用 #7ca4ae 系', g.nodeShadow.slice(0, 40))
  check(g.nameSize === '25px' && g.metaAlign === 'center', '姓名 25px 且居中', g.nameSize + ' / ' + g.metaAlign)
  check(g.roleRadius === '5px' && g.roleBg !== 'rgba(0, 0, 0, 0)', '角色标签改为淡填充 chip（不再是描边）', g.roleRadius + ' / ' + g.roleBg)
  check(g.roleColor === 'rgb(192, 57, 43)', '角色色仍作为字色保留（主角红）', g.roleColor)
  check(g.elabelBg === 'rgba(0, 0, 0, 0)' && g.elabelBorder === '0px' && g.elabelSize === '14px', '边标签：纯文字、无底无边、14px', `${g.elabelBg} / ${g.elabelBorder} / ${g.elabelSize}`)
  check(g.chipOnBg === 'rgb(205, 227, 229)' && g.chipBorder === 'rgba(0, 0, 0, 0)', '筛选芯片：静默无框、选中淡填充', `${g.chipBorder} / ${g.chipOnBg}`)
  check(g.canvasBorder === 'rgb(184, 206, 210)' && g.canvasDots === '22px 22px', '画布：22px 点阵 + #b8ced2 描边', `${g.canvasBorder} / ${g.canvasDots}`)
  check(g.aptDot === '1', '拖线端口在节点悬停时可见（原先因 .oc-node 选择器一直隐形）', g.aptDot)
  await shot('graph')

  /* ── 设定详情的关系图谱 ─────────────────────────────────────── */
  await ev(`(()=>{__g.work.tab='lore';return true})()`)
  await c.sleep(700)
  await ev(`(()=>{const rows=[...document.querySelectorAll('.ob-row')];const r=rows.find(n=>n.textContent.includes('星图系统'));r.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));return true})()`)
  await wait('!!document.querySelector(".ldt-page")')
  await c.sleep(700)
  const l = await styles([
    ['nodeCount', '.lg-node', 'borderRadius'], ['nodeBg', '.lg-node', 'backgroundColor'],
    ['nodeRadius', '.lg-node', 'borderRadius'], ['centerBorder', '.lg-node.center', 'borderTopColor'],
    ['centerTitle', '.lg-node.center .lg-title', 'fontSize'], ['elabelBg', '.lg-elabel', 'backgroundColor'],
    ['elabelSize', '.lg-elabel', 'fontSize'], ['canvasImg', '.lg-canvas', 'backgroundImage'],
    ['graphBg', '.ldt-graph', 'backgroundImage']
  ])
  const lgCount = await ev(`document.querySelectorAll('.lg-node').length`)
  check(lgCount >= 3, '关系图谱有真实邻居（夹具含 2 条关联关系）', lgCount + ' 个节点')
  check(l.nodeRadius === '8px' && /^rgba?\(255, 255, 255/.test(l.nodeBg), '图谱节点改为白卡片（原先走基座窄药丸）', `${l.nodeRadius} / ${l.nodeBg}`)
  check(l.centerBorder === 'rgb(20, 104, 120)', '中心节点用强调色描边（#146878）', l.centerBorder)
  check(l.centerTitle === '23px', '中心节点标题 23px 文楷（C 版 .af-map-center）', l.centerTitle)
  check(l.elabelBg === 'rgba(0, 0, 0, 0)' && l.elabelSize === '13px', '图谱关系标签改为纯文字 13px', `${l.elabelBg} / ${l.elabelSize}`)
  check(l.canvasImg === 'none' && /radial-gradient/.test(l.graphBg), '图谱画布改为径向光晕（非点阵）', `${l.canvasImg} / ${String(l.graphBg).slice(0, 40)}`)
  await shot('lore-graph')

  /* ── 大纲文本视图 ───────────────────────────────────────────── */
  await ev(`(async()=>{const {useWorkStore}=await import('/src/stores/work.js');const w=useWorkStore();if(w.work)await w.closeWork();await w.open(${JSON.stringify(fixtureId)});w.tab='outline';w.outlineView='text';const n=w.olnodes.find((x)=>x.title==='启航');if(n)w.selOlnodeId=n.id;return true})()`)
  await wait('!!document.querySelector(".ol-editor")')
  await c.sleep(900)
  check((await textOf('.ol-meta-tag')) === '未来大纲计划', '元信息行状态做成 chip（C 版 .af-text-top）', await textOf('.ol-meta-tag'))
  check((await textOf('.ol-meta-state')) === '尚未完成', '元信息行状态文字保留', await textOf('.ol-meta-state'))
  const o = await styles([
    ['metaSize', '.ol-meta', 'fontSize'], ['tagBg', '.ol-meta-tag', 'backgroundColor'],
    ['tagColor', '.ol-meta-tag', 'color'], ['titleSize', '.ol-title-input', 'fontSize'],
    ['titlePad', '.ol-title-input', 'paddingBottom'], ['titleLine', '.ol-title-input', 'borderBottomColor'],
    ['bodySize', '.ol-editor', 'fontSize'], ['bodyLine', '.ol-editor', 'lineHeight'],
    ['bodyMax', '.ol-editor', 'maxWidth'], ['bodyPad', '.ol-editor', 'paddingTop'],
    ['hintBorder', '.ol-toolbar .ol-tb-hint', 'borderTopWidth'], ['hintRadius', '.ol-toolbar .ol-tb-hint', 'borderRadius']
  ])
  check(o.metaSize === '13px' && o.tagBg === 'rgb(205, 227, 229)' && o.tagColor === 'rgb(20, 104, 120)', '元信息 13px + 淡青 chip（#cde3e5 / accent）', `${o.metaSize} / ${o.tagBg} / ${o.tagColor}`)
  check(o.titleSize === '34px' && o.titlePad === '22px', '条目标题 34px、留白 22px（C 版 .af-outline-title）', `${o.titleSize} / ${o.titlePad}`)
  check(o.titleLine === 'rgb(175, 200, 204)', '标题下划线 #afc8cc', o.titleLine)
  check(o.bodySize === '20px' && o.bodyLine === '40px' && o.bodyMax === '970px' && o.bodyPad === '30px', '正文 20px/2、限宽 970、留白 30（C 版 .af-rich）', `${o.bodySize}/${o.bodyLine}/${o.bodyMax}/${o.bodyPad}`)
  check(parseFloat(o.hintBorder) > 0 && o.hintRadius === '6px', '工具条右端提示包成工具形态（不再是裸灰字）', `${o.hintBorder} / ${o.hintRadius}`)
  check(((await textOf('.ol-toolbar .ol-tb-hint')) || '').includes('添加关系链接'), '提示文案保留（它解释的是真实功能）', '')
  await shot('outline-text')

  /* ── 隔离性：引力皮肤不应吃到这些规则 ────────────────────────── */
  await ev(`__g.ui.setSkin('gravity').then(()=>true)`).catch(() => {})
  await c.sleep(900)
  const grav = await ev(`JSON.stringify({
    heading: !!document.querySelector('.rg-heading'),
    overlay: !!document.querySelector('.rg-overlay'),
    nodeBorder: (document.querySelector('.rg-node') ? getComputedStyle(document.querySelector('.rg-node')).borderTopColor : null)
  })`)
  const gv = JSON.parse(grav)
  check(!gv.heading && !gv.overlay && gv.nodeBorder !== 'rgb(255, 255, 255)', '对齐规则只在琉光生效（引力无页头/提示条、节点描边未被改）', grav)
  await ev(`__g.ui.setSkin('glaze').then(()=>true)`).catch(() => {})
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  try {
    if (fixtureId) await ev(`(async()=>{await __g.work.closeWork();const row=await __ns.db.works.get(${JSON.stringify(fixtureId)});if(row)await __g.shelf.deleteWork(row);return true})()`)
    await ev(`(async()=>{await __ns.db.appconfig.bulkDelete(['skin','theme']);await __ns.db.appconfig.bulkPut(${JSON.stringify(prefs || [])});await __g.ui.loadPrefs();return true})()`).catch(() => {})
  } catch (error) {
    console.error('Cleanup:', error.message)
    process.exitCode = 1
  }
  const passed = results.filter(Boolean).length
  console.log(`\n琉光视觉保真：${passed}/${results.length} 通过`)
  process.exit(process.exitCode || (results.length > 0 && passed === results.length ? 0 : 1))
}
