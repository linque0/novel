/* 正文批注全链路验证（开发调试版实例 --profile=dev）：
 * 右键添加批注 → 正文彩色下划线锚点 → 右侧批注栏对应 → 与双链共存不冲突 → 侧栏定位 →
 * 改用途色同步正文 → 批注外补写不破坏锚点 → 删字转失效并可清理 → 删除批注保留文字 → 落库持久化
 * 运行前提：vite dev(5173) 已起 + electron . --profile=dev --remote-debugging-port=9222
 * 用法：node tools/annotation-verify.mjs
 */
import { connect } from './_cdp-lib.mjs'

const c = await connect('app://')
await c.sleep(2500)
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  —— ' + String(detail).slice(0, 400) : ''))
}
const rclick = async (x, y) => {
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(x), y: Math.round(y), button: 'right', buttons: 2, clickCount: 1 })
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.round(x), y: Math.round(y), button: 'right', buttons: 0, clickCount: 1 })
}

/* 选中一段文字并返回屏幕坐标。
 * 注意：domAtPos 对带标记的文字返回的是外层 span（元素节点），必须在子树里找到真正含目标
 * 文字的文本节点——直接拿 element 去建 Range 会抛错（曾致本脚本 9 项假失败）。 */
const mkSel = (kw) => `(() => {
  const ed = window.__ns.editor
  let p = null
  ed.state.doc.descendants((n, pos) => {
    if (!p && n.isText && n.text && n.text.includes(${JSON.stringify(kw)})) {
      const i = n.text.indexOf(${JSON.stringify(kw)})
      p = { from: pos + i, to: pos + i + ${JSON.stringify(kw)}.length }
    }
  })
  if (!p) return 'not found'
  ed.chain().setTextSelection(p).run()
  const at = ed.view.domAtPos(p.from)
  let tn = null, off = 0
  const pick = (root) => {
    if (!root || tn) return
    if (root.nodeType === 3) {
      const i = root.textContent.indexOf(${JSON.stringify(kw)})
      if (i >= 0) { tn = root; off = i }
      return
    }
    for (const ch of root.childNodes || []) pick(ch)
  }
  pick(at.node)
  if (!tn) return 'text node not found'
  const r2 = document.createRange()
  r2.setStart(tn, off); r2.setEnd(tn, Math.min(off + ${JSON.stringify(kw)}.length, tn.textContent.length))
  const rect = r2.getBoundingClientRect()
  return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, empty: ed.state.selection.empty, selText: ed.state.doc.textBetween(p.from, p.to) }
})()`

/* 按引用文字在右侧批注栏找条目 */
const findItem = (quoteKw) => `(() => {
  const items = [...document.querySelectorAll('.right-panel .note-item')]
  const it = items.find(i => (i.querySelector('.note-quote')?.textContent || '').includes(${JSON.stringify(quoteKw)}))
  return it ? { found: true, orphan: it.className.includes('orphan'), kind: it.querySelector('.note-kind-label')?.textContent, body: it.querySelector('.note-body')?.textContent } : { found: false, all: items.map(i => i.querySelector('.note-quote')?.textContent) }
})()`

/* 在右键菜单里点「添加批注」并填写内容 / 用途色 */
async function addNote(kw, body, kindLabel = null) {
  const sel = await c.evalx(mkSel(kw))
  if (!sel || sel.cx == null) return { err: 'selection failed: ' + JSON.stringify(sel) }
  await rclick(sel.cx, sel.cy)
  await c.sleep(550)
  const clicked = await c.evalx(`(() => {
    const it = [...document.querySelectorAll('.ctx-menu .ctx-item')].find(i => i.textContent.includes('添加批注'))
    if (!it) return 'no item'
    it.click(); return 'ok'
  })()`)
  if (clicked !== 'ok') return { err: 'menu item: ' + clicked }
  await c.sleep(450)
  const filled = await c.evalx(`(() => {
    const ta = document.querySelector('.ctx-notedit textarea')
    if (!ta) return 'no textarea'
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(ta, ${JSON.stringify(body)})
    ta.dispatchEvent(new Event('input', { bubbles: true }))
    ${kindLabel ? `const k = [...document.querySelectorAll('.ctx-notedit .note-kind')].find(b => b.textContent.includes(${JSON.stringify(kindLabel)})); k?.click()` : ''}
    return 'ok'
  })()`)
  if (filled !== 'ok') return { err: 'fill: ' + filled }
  await c.sleep(280)
  await c.evalx(`[...document.querySelectorAll('.ctx-notedit .ctx-btn')].find(b => b.textContent.includes('添加批注'))?.click()`)
  await c.sleep(750)
  return { ok: true, sel }
}

/* ---------- 0) 种子：一本含双链的测试书 ---------- */
const seed = await c.evalx(`(async () => {
  const { db, uid, now } = window.__ns
  // 幂等：清掉本脚本历次运行与临时探针留下的测试书，避免脏数据跨轮干扰
  for (const title of ['批注验证书', '批注探针书']) {
    const old = (await db.works.toArray()).find(w => w.title === title)
    if (!old) continue
    for (const t of ['annotations','chapters','volumes','outlines','mubu','characters','snippets']) {
      const rows = await db.table(t).where('workId').equals(old.id).toArray().catch(() => [])
      for (const r of rows) await db.table(t).delete(r.id)
    }
    await db.works.delete(old.id)
  }
  const t = now()
  const workId = uid()
  await db.works.add({ id: workId, title: '批注验证书', author: '', genre: '', status: '', intro: '', createdAt: t, updatedAt: t, deletedAt: null })
  const volId = uid()
  await db.volumes.add({ id: volId, workId, title: '第一卷', sortOrder: 0, createdAt: t, updatedAt: t, deletedAt: null })
  // 正文含一个双链（铜刻星辰），用于验证批注与双链共存
  await db.chapters.add({
    id: uid(), workId, volumeId: volId, title: '第一章 · 初雪', fmt: 'html',
    content: '<p>他抬头看去，三百六十枚<span class="dl-link" data-dl-target="mubu:x1" data-dl-title="星图">铜刻星辰</span>缓缓归位，雪落在界脊之上。</p>',
    wordCount: 0, status: 'draft', sortOrder: 0, createdAt: t, updatedAt: t, deletedAt: null
  })
  await db.mubu.add({ id: uid(), workId, parentId: null, sortOrder: 0, text: '星图', html: null, fold: false, deletedAt: null, createdAt: t, updatedAt: t })
  return workId
})()`)
console.log('seed:', seed)
await c.evalx(`location.reload()`)
await c.sleep(2600)
await c.evalx(`[...document.querySelectorAll('.book-card')].find(x => x.textContent.includes('批注验证书'))?.click()`)
await c.sleep(1800)
check('打开测试书', await c.evalx(`!!document.querySelector('.rich-host .tiptap')`))

/* ---------- 1) 右键「雪落在界脊之上」→ 添加批注（伏笔紫） ---------- */
const sel1 = await c.evalx(mkSel('雪落在界脊之上'))
check('建立正文选区', sel1 && sel1.cx > 0 && !sel1.empty, JSON.stringify(sel1))
await rclick(sel1.cx, sel1.cy)
await c.sleep(600)
const m1 = await c.evalx(`(() => {
  const it = [...document.querySelectorAll('.ctx-menu .ctx-item')].find(i => i.textContent.includes('添加批注'))
  return { open: !!document.querySelector('.ctx-menu'), found: !!it, cls: it?.className }
})()`)
check('右键快捷栏出现「添加批注」且可用', m1.open && m1.found && !String(m1.cls).includes('disabled'), JSON.stringify(m1))
await c.evalx(`[...document.querySelectorAll('.ctx-menu .ctx-item')].find(i => i.textContent.includes('添加批注'))?.click()`)
await c.sleep(500)
const pan = await c.evalx(`(() => {
  const ta = document.querySelector('.ctx-notedit textarea')
  return { hasTa: !!ta, kinds: [...document.querySelectorAll('.ctx-notedit .note-kind')].map(b => b.textContent.trim()), quote: document.querySelector('.ctx-note-quote')?.textContent }
})()`)
check('批注面板含内容框与用途色块', pan.hasTa && pan.kinds.length >= 4, JSON.stringify(pan))
await c.evalx(`(() => {
  const ta = document.querySelector('.ctx-notedit textarea')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
  setter.call(ta, '界脊的雪暗示时间凝滞，需与第三章呼应')
  ta.dispatchEvent(new Event('input', { bubbles: true }))
  ;[...document.querySelectorAll('.ctx-notedit .note-kind')].find(b => b.textContent.includes('伏笔'))?.click()
  return true
})()`)
await c.sleep(300)
await c.evalx(`[...document.querySelectorAll('.ctx-notedit .ctx-btn')].find(b => b.textContent.includes('添加批注'))?.click()`)
await c.sleep(800)

/* ---------- 2) 正文锚点 + 下划线颜色 ---------- */
const mark = await c.evalx(`(() => {
  const el = [...document.querySelectorAll('.rich-host .tiptap span[data-note-id]')].find(s => s.textContent.includes('雪落在界脊之上'))
  if (!el) return 'no mark'
  const cs = getComputedStyle(el)
  return {
    noteId: el.getAttribute('data-note-id'), color: el.getAttribute('data-note-color'), text: el.textContent,
    decorationLine: cs.textDecorationLine, decorationStyle: cs.textDecorationStyle,
    decorationColor: cs.textDecorationColor, underlineOffset: cs.textUnderlineOffset, cls: el.className
  }
})()`)
check('正文生成批注锚点（span[data-note-id]）', typeof mark === 'object' && !!mark.noteId, JSON.stringify(mark))
check('下划线为「伏笔」紫 #8e44ad 实线（可编辑颜色）', typeof mark === 'object' && mark.color === '#8e44ad' && mark.decorationStyle === 'solid', JSON.stringify(mark))

/* ---------- 3) 右侧批注栏条目 ---------- */
const side = await c.evalx(findItem('雪落在界脊之上'))
check('右侧批注栏出现对应条目', side.found === true, JSON.stringify(side))
check('侧栏引用文字 / 批注内容 / 用途标签正确', side.found && side.kind === '伏笔' && String(side.body).includes('时间凝滞'), JSON.stringify(side))

/* ---------- 4) 与双链共存：给双链文字「铜刻星辰」加批注 ---------- */
const addB = await addNote('铜刻星辰', '此处双链与批注叠加')
check('给双链文字添加批注（右键流程可完成）', addB.ok === true, JSON.stringify(addB))
const coexist = await c.evalx(`(() => {
  const html = window.__ns.editor.getHTML()
  const noteSpans = [...document.querySelectorAll('.rich-host .tiptap span[data-note-id]')]
  return {
    notes: noteSpans.length,
    dls: document.querySelectorAll('.rich-host .tiptap span[data-dl-target]').length,
    bothAttrs: html.includes('data-note-id') && html.includes('data-dl-target'),
    // 双链文字上的批注应渲染为「含 dl-link 子 span 的 note-mark」
    nested: noteSpans.filter(s => s.querySelector('.dl-link')).length,
    dlsStillLinked: [...document.querySelectorAll('.rich-host .tiptap .dl-link')].map(s => s.getAttribute('data-dl-target')),
    sideCount: document.querySelectorAll('.right-panel .note-item').length
  }
})()`)
check('批注与双链并存（两类锚点均保留）', coexist.notes >= 2 && coexist.dls >= 1 && coexist.bothAttrs, JSON.stringify(coexist))
check('同一段文字可同时承载双链与批注（嵌套不塌陷）', coexist.nested >= 1, JSON.stringify(coexist))
check('双链目标未被批注覆盖（仍指向原目标）', JSON.stringify(coexist.dlsStillLinked) === JSON.stringify(['mubu:x1']), JSON.stringify(coexist))
check('侧栏累计 2 条批注', coexist.sideCount === 2, JSON.stringify(coexist))

/* 视觉可分：双链点线（3px）/ 批注实线（5px）错位共存 */
const vis = await c.evalx(`(() => {
  const dl = document.querySelector('.rich-host .tiptap .dl-link')
  const note = [...document.querySelectorAll('.rich-host .tiptap span[data-note-id]')].find(s => s.textContent.includes('雪落在界脊之上'))
  const a = getComputedStyle(dl), b = getComputedStyle(note)
  return { dlStyle: a.textDecorationStyle, dlOff: a.textUnderlineOffset, dlColor: a.textDecorationColor, noteStyle: b.textDecorationStyle, noteOff: b.textUnderlineOffset, noteColor: b.textDecorationColor }
})()`)
check('双链=点线贴字 / 批注=实线偏移（视觉不冲突）', vis.dlStyle === 'dotted' && vis.noteStyle === 'solid' && vis.dlOff !== vis.noteOff, JSON.stringify(vis))

/* ---------- 5) 侧栏点击定位 ---------- */
await c.evalx(`(() => {
  const items = [...document.querySelectorAll('.right-panel .note-item')]
  const it = items.find(i => (i.querySelector('.note-quote')?.textContent || '').includes('雪落在界脊之上'))
  it?.click()
  return true
})()`)
await c.sleep(700)
const locate = await c.evalx(`(() => {
  const ed = window.__ns.editor
  const attrs = ed.getAttributes('annotation')
  const item = [...document.querySelectorAll('.right-panel .note-item')].find(i => (i.querySelector('.note-quote')?.textContent || '').includes('雪落在界脊之上'))
  return { selNoteId: attrs?.noteId || '', active: item?.className.includes('active'), selText: ed.state.selection.empty ? '' : ed.state.doc.textBetween(ed.state.selection.from, ed.state.selection.to) }
})()`)
check('侧栏点击条目 → 编辑器选区落到该批注', !!locate.selNoteId && locate.active && locate.selText.includes('雪落在界脊之上'), JSON.stringify(locate))

/* ---------- 6) 侧栏改用途色 → 正文下划线同步 ---------- */
await c.evalx(`(() => {
  const it = [...document.querySelectorAll('.right-panel .note-item')].find(i => (i.querySelector('.note-quote')?.textContent || '').includes('铜刻星辰'))
  ;[...it.querySelectorAll('.note-actions .n-button')].find(b => b.textContent.includes('编辑'))?.click()
  return true
})()`)
await c.sleep(500)
const recolorClick = await c.evalx(`(() => {
  const row = document.querySelector('.right-panel .note-item .note-kind-row')
  if (!row) return 'no color row'
  ;[...row.querySelectorAll('.note-kind')].find(b => b.textContent.includes('灵感'))?.click()
  return 'ok'
})()`)
await c.sleep(700)
const recolor = await c.evalx(`(() => {
  const el = [...document.querySelectorAll('.rich-host .tiptap span[data-note-id]')].find(s => s.textContent.includes('铜刻星辰'))
  if (!el) return 'no mark'
  const item = [...document.querySelectorAll('.right-panel .note-item')].find(i => (i.querySelector('.note-quote')?.textContent || '').includes('铜刻星辰'))
  return { attr: el.getAttribute('data-note-color'), decorationColor: getComputedStyle(el).textDecorationColor, kind: item?.querySelector('.note-kind-label')?.textContent }
})()`)
check('侧栏改用途色 → 正文下划线颜色同步为灵感绿', recolorClick === 'ok' && recolor.attr === '#27ae60', JSON.stringify({ recolorClick, recolor }))

/* 退出编辑态：颜色是即时预览，点「保存」提交并收起编辑面板（否则后续步骤找不到「删除」按钮） */
await c.evalx(`(() => {
  const it = [...document.querySelectorAll('.right-panel .note-item')].find(i => (i.querySelector('.note-quote')?.textContent || '').includes('铜刻星辰'))
  ;[...it.querySelectorAll('.note-actions .n-button')].find(b => b.textContent.includes('保存'))?.click()
  return true
})()`)
await c.sleep(800)
const editClosed = await c.evalx(`document.querySelectorAll('.right-panel .note-item .note-kind-row').length`)
check('保存后退出批注编辑态', editClosed === 0, String(editClosed))

/* ---------- 7) 批注范围外补写不破坏锚点 ---------- */
const persist = await c.evalx(`(() => {
  const ed = window.__ns.editor
  const el = [...document.querySelectorAll('.rich-host .tiptap span[data-note-id]')].find(s => s.textContent.includes('雪落在界脊之上'))
  const id = el.getAttribute('data-note-id')
  let pos = null
  ed.state.doc.descendants((n, p) => { if (n.isText && n.text && n.text.includes('雪落在界脊之上')) pos = p + n.text.indexOf('雪落在界脊之上') + '雪落在界脊之上'.length })
  ed.chain().setTextSelection(pos).insertContent('（此处补写）').run()
  return { id, still: !!document.querySelector('.rich-host .tiptap span[data-note-id="' + id + '"]') }
})()`)
check('批注外补写不破坏批注锚点', persist.still === true, JSON.stringify(persist))

/* ---------- 8) 删除被批注文字 → 批注转「已失效」 ---------- */
await c.evalx(`(() => {
  const ed = window.__ns.editor
  const el = [...document.querySelectorAll('.rich-host .tiptap span[data-note-id]')].find(s => s.textContent.includes('雪落在界脊之上'))
  const id = el.getAttribute('data-note-id')
  let from = null, to = null
  ed.state.doc.descendants((n, p) => { if (n.isText && n.marks.some(m => m.attrs.noteId === id)) { if (from == null) from = p; to = p + n.nodeSize } })
  ed.chain().setTextSelection({ from, to }).deleteSelection().run()
  return true
})()`)
await c.sleep(800)
const orphan = await c.evalx(findItem('雪落在界脊之上'))
check('删除正文文字后批注转「已失效」', orphan.found === true && orphan.orphan === true, JSON.stringify(orphan))
const orphanTip = await c.evalx(`(() => {
  const it = document.querySelector('.right-panel .note-item.orphan')
  return { tip: it?.querySelector('.note-orphan-tip')?.textContent || '', hasPrune: !!([...document.querySelectorAll('.right-panel .rp-title-tools .n-button')].find(b => b.textContent.includes('清理失效'))) }
})()`)
check('失效批注有提示且提供「清理失效」', !!orphanTip.tip && orphanTip.hasPrune, JSON.stringify(orphanTip))

/* ---------- 9) 清理失效 ---------- */
await c.evalx(`[...document.querySelectorAll('.right-panel .rp-title-tools .n-button')].find(b => b.textContent.includes('清理失效'))?.click()`)
await c.sleep(900)
const pruned = await c.evalx(`(() => ({
  orphans: document.querySelectorAll('.right-panel .note-item.orphan').length,
  total: document.querySelectorAll('.right-panel .note-item').length,
  quotes: [...document.querySelectorAll('.right-panel .note-item .note-quote')].map(q => q.textContent)
}))()`)
check('清理失效后仅剩有效批注', pruned.orphans === 0 && pruned.total === 1 && String(pruned.quotes[0]).includes('铜刻星辰'), JSON.stringify(pruned))

/* ---------- 10) 删除批注：标记移除、文字保留 ---------- */
const beforeDel = await c.evalx(`window.__ns.editor.getText()`)
const delClicked = await c.evalx(`(() => {
  const it = [...document.querySelectorAll('.right-panel .note-item')].find(i => (i.querySelector('.note-quote')?.textContent || '').includes('铜刻星辰'))
  if (!it) return 'item not found'
  const btn = [...it.querySelectorAll('.note-actions .n-button')].find(b => b.textContent.includes('删除'))
  if (!btn) return 'no delete btn: ' + [...it.querySelectorAll('.note-actions .n-button')].map(b => b.textContent.trim()).join('|')
  btn.click()
  return 'clicked'
})()`)
await c.sleep(700)
const confirmBtns = await c.evalx(`(() => {
  const btns = [...document.querySelectorAll('.n-popconfirm .n-button, .n-popover .n-button')]
  const ok = btns.find(b => /确定|确认/.test(b.textContent)) || btns[btns.length - 1]
  ok?.click()
  return btns.map(b => b.textContent.trim())
})()`)
await c.sleep(1100)
const afterDel = await c.evalx(`(() => ({
  marks: document.querySelectorAll('.rich-host .tiptap span[data-note-id]').length,
  text: window.__ns.editor.getText(),
  side: document.querySelectorAll('.right-panel .note-item').length
}))()`)
check(
  '删除批注后正文标记移除、文字保留',
  delClicked === 'clicked' && afterDel.marks === 0 && afterDel.text.includes('铜刻星辰') && beforeDel.includes('铜刻星辰'),
  JSON.stringify({ delClicked, confirmBtns, marks: afterDel.marks, side: afterDel.side, text: afterDel.text })
)

/* ---------- 11) 重新加一条 → 落库 + 刷新后持久化 ---------- */
const addC = await addNote('缓缓归位', '复核这一段的节奏', '疑问')
check('再次添加批注（用途=疑问蓝）', addC.ok === true, JSON.stringify(addC))
await c.evalx(`window.__flushNow && window.__flushNow()`)
await c.sleep(1600)
// 按当前作品过滤：dev profile 里可能残留其它验证书的数据
const dbRow = await c.evalx(`(async () => {
  const { db } = window.__ns
  const w = (await db.works.toArray()).find(x => x.title === '批注验证书')
  const all = await db.annotations.where('workId').equals(w.id).toArray()
  const live = all.filter(r => !r.deletedAt)
  return {
    live: live.length, dead: all.length - live.length,
    sample: live[0] ? { color: live[0].color, note: live[0].note, text: live[0].text, kind: live[0].kind } : null
  }
})()`)
check(
  '批注落库（颜色 / 内容 / 用途齐全）',
  dbRow.live === 1 && dbRow.sample?.color === '#2980b9' && dbRow.sample?.kind === 'query' && dbRow.sample?.note === '复核这一段的节奏',
  JSON.stringify(dbRow)
)

await c.evalx(`location.reload()`)
await c.sleep(2800)
await c.evalx(`[...document.querySelectorAll('.book-card')].find(x => x.textContent.includes('批注验证书'))?.click()`)
await c.sleep(2000)
const afterReload = await c.evalx(`(() => {
  const el = document.querySelector('.rich-host .tiptap span[data-note-id]')
  const item = document.querySelector('.right-panel .note-item')
  return {
    marks: document.querySelectorAll('.rich-host .tiptap span[data-note-id]').length,
    side: document.querySelectorAll('.right-panel .note-item').length,
    color: el?.getAttribute('data-note-color'),
    decoration: el ? getComputedStyle(el).textDecorationColor : '',
    body: item?.querySelector('.note-body')?.textContent,
    kind: item?.querySelector('.note-kind-label')?.textContent,
    dl: document.querySelectorAll('.rich-host .tiptap span[data-dl-target]').length,
    dlTarget: document.querySelector('.rich-host .tiptap span[data-dl-target]')?.getAttribute('data-dl-target')
  }
})()`)
check('刷新后批注锚点与侧栏条目恢复', afterReload.marks === 1 && afterReload.side === 1, JSON.stringify(afterReload))
check('刷新后颜色 / 内容 / 用途保持', afterReload.color === '#2980b9' && afterReload.kind === '疑问' && String(afterReload.body).includes('节奏'), JSON.stringify(afterReload))
check('刷新后双链仍完好（批注未破坏双链）', afterReload.dl === 1 && afterReload.dlTarget === 'mubu:x1', JSON.stringify(afterReload))

/* ---------- 12) 导出不夹带批注（批注属编辑态，不入正文导出） ---------- */
const exp = await c.evalx(`(() => {
  const html = document.querySelector('.rich-host .tiptap').innerHTML
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const plain = doc.body.textContent
  return { textHasNote: /data-note-id/.test(plain), plainKeepsWords: plain.includes('缓缓归位') }
})()`)
check('批注文字仍在正文中（导出取 textContent 不带批注标记）', exp.textHasNote === false && exp.plainKeepsWords === true, JSON.stringify(exp))

const pass = results.filter(Boolean).length
console.log(`\n${pass}/${results.length} 通过`)
process.exit(pass === results.length ? 0 : 1)
