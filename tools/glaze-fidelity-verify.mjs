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
    w.addChapter(w.volumes[0] && w.volumes[0].id, '第一章 星海来信')
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

  /* ── 书架：左栏排版 + 封面舞台（v1.1.1 第三轮） ── */
  await ev(`(async()=>{await __g.work.closeWork();return true})()`).catch(() => {})
  /* 用 1440×900 视口：设计稿按这个尺寸标注（标题 clamp 5.3vw 在此正好到 76px） */
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  /* 指针挪开：停在卡片上会命中 :hover，量到的变换就不是静止姿态 */
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 8, y: 8 })
  await c.sleep(1200)
  const shelfReady = await wait('!!document.querySelector(".glaze-shelf-hero")')
  check(shelfReady, '书架渲染（含 hero 区）', '')
  if (shelfReady) {
  const sb = await ev(`(() => {
    const g = (s, p) => { const el = document.querySelector(s); return el ? getComputedStyle(el)[p] : null }
    const box = (s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), l: Math.round(b.left), t: Math.round(b.top) } }
    const card = (n) => {
      const el = document.querySelector('.glaze-stage-book.pose-' + n)
      if (!el) return null
      const cs = getComputedStyle(el)
      const cover = el.querySelector('.glaze-cover')
      const strong = el.querySelector('.glaze-cover strong')
      const cr = cover ? cover.getBoundingClientRect() : null
      const ar = strong ? strong.getBoundingClientRect() : null
      const kicker = el.querySelector('.glaze-cover-kicker')
      const author = el.querySelector('.glaze-cover-author')
      const kcs = kicker ? getComputedStyle(kicker) : null
      const acs = author ? getComputedStyle(author) : null
      return {
        box: box('.glaze-stage-book.pose-' + n), width: cs.width, height: cs.height, transform: cs.transform.slice(0, 9), z: cs.zIndex,
        padding: cs.paddingTop, radius: cs.borderTopLeftRadius, bg: cs.backgroundColor, border: cs.borderTopColor, shadow: cs.boxShadow.slice(0, 40),
        /* 用计算样式的布局尺寸：getBoundingClientRect 会被卡的旋转/透视投影放大，量不准比例 */
        cover: cover ? (() => {
          const ccs = getComputedStyle(cover)
          const w = parseFloat(ccs.width)
          const h = parseFloat(ccs.height)
          return { w: Math.round(w), h: Math.round(h), ratio: Number((h / w).toFixed(3)) }
        })() : null,
        coverBorder: cover ? getComputedStyle(cover).borderTopWidth : null,
        title: strong ? { size: getComputedStyle(strong).fontSize, lh: getComputedStyle(strong).lineHeight, ls: getComputedStyle(strong).letterSpacing, color: getComputedStyle(strong).color, mt: getComputedStyle(strong).marginTop, lines: strong.querySelectorAll('.glaze-cover-line').length, text: strong.textContent } : null,
        kicker: kcs ? { size: kcs.fontSize, ls: kcs.letterSpacing, border: kcs.borderBottomWidth, color: kcs.color } : null,
        author: author ? { size: acs.fontSize, gap: cr ? Math.round(cr.bottom - author.getBoundingClientRect().bottom) : null } : null
      }
    }
    const note = document.querySelector('.glaze-chapter-note')
    return JSON.stringify({
      hero: box('.glaze-shelf-hero'), copy: box('.glaze-feature-copy'), eyebrowBox: box('.glaze-eyebrow'), stack: box('.glaze-feature-stack'),
      h1: g('.glaze-shelf-tools h1', 'fontSize') + '/' + g('.glaze-shelf-tools h1', 'fontWeight') + '/' + g('.glaze-shelf-tools h1', 'display') + '/gap ' + g('.glaze-shelf-tools h1', 'gap'),
      pill: g('.glaze-shelf-tools h1 small', 'borderTopColor') + '/r' + g('.glaze-shelf-tools h1 small', 'borderRadius') + '/' + g('.glaze-shelf-tools h1 small', 'fontSize') + '/' + g('.glaze-shelf-tools h1 small', 'fontFamily').slice(0, 18),
      eyebrow: g('.glaze-eyebrow', 'fontSize') + '/ls ' + g('.glaze-eyebrow', 'letterSpacing') + '/' + ((document.querySelector('.glaze-eyebrow') || {}).textContent || '').trim(),
      title: g('.glaze-feature-copy h2', 'fontSize') + '/' + g('.glaze-feature-copy h2', 'fontWeight') + '/lh ' + g('.glaze-feature-copy h2', 'lineHeight') + '/ls ' + g('.glaze-feature-copy h2', 'letterSpacing'),
      line2: g('.glaze-title-line + .glaze-title-line', 'paddingLeft'),
      intro: g('.glaze-feature-intro', 'fontSize') + '/lh ' + g('.glaze-feature-intro', 'lineHeight'),
      actions: g('.glaze-feature-actions', 'gap') + '/mt ' + g('.glaze-feature-actions', 'marginTop'),
      meta: g('.glaze-feature-meta', 'gap') + '/strong ' + g('.glaze-feature-meta strong', 'fontSize') + '/small ' + g('.glaze-feature-meta small', 'fontSize'),
      search: box('.glaze-shelf-tools .n-input'),
      placeholder: (document.querySelector('.glaze-shelf-tools input') || {}).placeholder || null,
      deck: box('.glaze-glass-deck'), perspective: g('.glaze-glass-deck', 'perspective'),
      pose: [card(0), card(1), card(2)],
      note: note ? { text: note.textContent.trim(), box: box('.glaze-chapter-note'), radius: getComputedStyle(note).borderRadius, font: getComputedStyle(note).fontSize, inStack: !!note.closest('.glaze-feature-stack') } : null,
      orb: box('.glaze-orb'),
      sectionH2: g('.glaze-collection h2', 'fontSize') + '/' + g('.glaze-collection > header > span', 'fontSize'),
      bottom: g('.glaze-library-open > span:not(.glaze-cover) > strong', 'fontSize') + '/small ' + g('.glaze-library-open small', 'fontSize'),
      thumb: box('.glaze-library-open > .glaze-cover'),
      scroll: (() => { const el = document.querySelector('.glaze-shelf-scroll'); return el.scrollWidth <= el.clientWidth ? 'ok' : 'OVERFLOW' })()
    })
  })()`)
  const s = JSON.parse(sb)
  check(s.h1 === '26px/400/flex/gap 20px', '「我的作品」26px 且与数量成一行两元素', s.h1)
  check(s.pill === 'rgb(175, 200, 204)/r50px/14px/ui-monospace,Conso'.slice(0, s.pill.length) || /rgb\(175, 200, 204\)\/r50px\/14px/.test(s.pill), '数量是独立药丸（描边 #afc8cc / 圆角 50px / 14px 等宽）', s.pill)
  check(s.eyebrow.startsWith('13px/ls 1px/') && /今天|昨天|\d+月\d+日/.test(s.eyebrow), '元信息 13px / 字距 1px，且日期是相对时间', s.eyebrow)
  check(s.hero?.h === 410, '首屏主体固定为设计稿 410px 双栏舞台', JSON.stringify(s.hero))
  const copyTop = s.eyebrowBox && s.hero ? s.eyebrowBox.t - s.hero.t : null
  check(copyTop != null && copyTop >= 10 && copyTop <= 16, '左侧信息组整体上移，最近编辑紧随标题区', JSON.stringify({ copyTop, hero:s.hero, copy:s.copy, eyebrow:s.eyebrowBox }))
  check(s.title === '62px/400/lh 66.96px/ls 2px', '六字标题降级为 62px，保持两行但不压垮舞台', s.title)
  check(s.line2 === '58px', '标题第二行缩进 58px', s.line2)
  check(s.intro === '17px/lh 29.24px', '简介 17px / 行高 1.72', s.intro)
  check(s.actions === '22px/mt 17px', '按钮行 gap 22 / 上距 17', s.actions)
  check(s.meta === '22px/strong 17px/small 13px', '统计行 gap 22、数字 17px、单位 13px', s.meta)
  check(s.search?.w === 210 && s.placeholder === '搜索作品', '搜索框 210px 且占位「搜索作品」', `${JSON.stringify(s.search)} / ${s.placeholder}`)
  check(s.deck?.h === 410 && s.perspective === '1050px', '舞台 410px 高、透视 1050px', `${JSON.stringify(s.deck)} / ${s.perspective}`)
  const poses = s.pose
  check(poses.every((p) => p && p.transform === 'matrix3d(' && p.coverBorder === '0px'), '三张卡都带 3D 变换（rotateY 生效）且封面不再吃 8px 白边', JSON.stringify(poses.map((p) => p && [p.transform, p.coverBorder])))
  check(poses[0]?.padding === '10px' && poses[0]?.radius === '16px' && /rgba\(255, 255, 255/.test(poses[0]?.bg || '') && /rgba\(124, 164, 174|rgba\(59, 108, 122/.test(poses[0]?.shadow || '') + '', '卡片是白纸垫材质（10px 内边距 / 圆角 16 / 半透明白底 / 深投影）', JSON.stringify([poses[0]?.padding, poses[0]?.radius, poses[0]?.bg, poses[0]?.shadow]))
  /* 比的是「声明宽度」（228/190/158，设计稿值）；旋转+透视后的外框不单调，不能用来判大小 */
  check(poses[0]?.width === '228px' && poses[1]?.width === '190px' && poses[2]?.width === '158px', '三张卡按设计稿声明宽度 228 / 190 / 158px', JSON.stringify(poses.map((p) => p?.width)))
  check(poses[0]?.z === '3' && poses[1]?.z === '2' && poses[2]?.z === '1', '层叠顺序 3 / 2 / 1', JSON.stringify(poses.map((p) => p?.z)))
  const overlap = (a,b) => a && b ? Math.min(a.l+a.w,b.l+b.w)-Math.max(a.l,b.l) : -1
  check(overlap(poses[0]?.box,poses[1]?.box) >= 45 && overlap(poses[1]?.box,poses[2]?.box) >= 35, '三本书有连续的实际遮挡，不再并排散开', JSON.stringify(poses.map((p) => p?.box)))
  check((poses[0]?.box?.w||0) > (poses[1]?.box?.w||0) && (poses[1]?.box?.w||0) > (poses[2]?.box?.w||0), '投影后的封面仍保持前大后小', JSON.stringify(poses.map((p) => p?.box?.w)))
  check(poses[0]?.title?.size === '34px' && poses[1]?.title?.size === '28px' && poses[2]?.title?.size === '22px', '封面书名按设计稿分级 34 / 28 / 22px', JSON.stringify(poses.map((p) => p?.title?.size)))
  /* 封面排版（设计稿 .cover-type / .glass-book）：竖幅 2:3、书名两行贴顶、内部三层字号 */
  check(poses.every((p) => p?.cover?.ratio === 1.5), '封面是竖幅 2:3（卡高由比例驱动，不再是写死的 300px）', JSON.stringify(poses.map((p) => p?.cover)))
  const near = (v, want) => Math.abs(v - want) <= 1
  check(poses[0]?.cover?.w === 206 && near(poses[0]?.cover?.h, 309) && near(poses[1]?.cover?.h, 252) && near(poses[2]?.cover?.h, 204), '封面内径与设计稿一致（206×309 / 168×252 / 136×204，容差 1px）', JSON.stringify(poses.map((p) => p?.cover)))
  check(poses.every((p) => p?.title?.lines === 2 && p?.title?.mt === '22px'), '书名拆两行且 margin-top 22px（贴顶，不再垂直居中）', JSON.stringify(poses.map((p) => p?.title && [p.title.lines, p.title.mt])))
  check(poses[0]?.title?.lh === '42.5px' && poses[0]?.title?.ls === '3px' && poses[0]?.title?.color === 'rgb(23, 63, 73)', '书名行高 1.25 / 字距 3px / 字色 #173f49', JSON.stringify(poses[0]?.title))
  check(poses.every((p) => !p?.title?.text || p.title.text === p.title.text.trim()), '书名两个行元素拼回的文本无多余空白', JSON.stringify(poses.map((p) => p?.title?.text)))
  check(poses[0]?.kicker?.size === '13px' && poses[0]?.kicker?.border === '0px', '顶行小字 13px 且去掉下划线', JSON.stringify(poses[0]?.kicker))
  check(poses[0]?.author?.size === '13px' && poses[0]?.author?.gap >= 12 && poses[0]?.author?.gap <= 30, '作者行 13px 且贴底（margin-top:auto）', JSON.stringify(poses[0]?.author))
  check(!!s.note && s.note.text.includes('第一章') && s.note.radius === '12px' && s.note.inStack, '首章白卡：真实章节名、12px 圆角，并归入主书簇 DOM', JSON.stringify(s.note))
  const noteOverlap = s.note?.box && poses[0]?.box ? {
    x: overlap(s.note.box,poses[0].box),
    y: Math.min(s.note.box.t+s.note.box.h,poses[0].box.t+poses[0].box.h)-Math.max(s.note.box.t,poses[0].box.t)
  } : null
  check(!!noteOverlap && noteOverlap.x >= 55 && noteOverlap.y >= 12, '首章白卡压住主书右下边界，归属关系可见', JSON.stringify(noteOverlap))
  check(s.orb?.w === 82 && s.orb?.h === 82, '玻璃球 82px', JSON.stringify(s.orb))
  check(s.sectionH2 === '23px/13px', '底部区题 23px、右侧行 13px', s.sectionH2)
  check(s.bottom === '17px/small 13px' && s.thumb?.w === 58, '底部卡题 17px / 副信息 13px / 缩略封面 58px', `${s.bottom} / ${JSON.stringify(s.thumb)}`)
  check(s.scroll === 'ok', '书架滚动区无横向溢出（1440）', s.scroll)
  await shot('shelf-1440')
  }

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
