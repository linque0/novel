/* 设定标签卡片 + 设定检索验收：右键设置标签（DOM）/ 行尾卡片 / 标签池 / 侧栏按内容或标签检索 →
 * 点击定位闪烁 / 点标签卡片联动筛选 / 移除收缩 / 持久化 / 全局搜索纳入标签。
 * 运行前提：npm run dev（CDP 9222）。fixture 自建（mt-work）并在结束时清理。 */
import { connect } from './_cdp-lib.mjs'

const c = await connect('app://')
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  —— ' + String(detail).slice(0, 340) : ''))
}
const S = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s`
const W = `${S}.get('work')`
const U = `${S}.get('ui')`

await c.evalx('location.reload()')
await c.sleep(3200)
const origWork = await c.evalx(`(${W}.work?.id || null)`)

/* ---------- 0) fixture：作品 + 设定节点树（器物 › 铜符 / 地点 › 石门） ---------- */
const fixture = await c.evalx(`(async () => {
  const { db } = window.__ns
  const now = Date.now()
  await db.mubu.bulkDelete(['mt-n1', 'mt-n2', 'mt-n3', 'mt-n4']).catch(() => {})
  await db.works.bulkDelete(['mt-work']).catch(() => {})
  await db.works.put({ id: 'mt-work', title: '设定标签验证书', genre: '', intro: '', status: '构思', kind: 'novel', createdAt: now, updatedAt: now, deletedAt: null })
  const n = (id, parentId, text, sortOrder) => ({ id, workId: 'mt-work', parentId, sortOrder, text, html: null, fold: false, tags: [], deletedAt: null, createdAt: now, updatedAt: now })
  await db.mubu.bulkPut([
    n('mt-n1', null, '器物', 0),
    n('mt-n2', 'mt-n1', '铜符', 0),
    n('mt-n3', null, '地点', 1000),
    n('mt-n4', 'mt-n3', '石门', 0)
  ])
  const w = ${W}
  await w.open('mt-work')
  w.tab = 'lore'
  await new Promise((r) => setTimeout(r, 400))
  return { ok: true }
})()`)
check('fixture 写入（设定节点树）', fixture?.ok === true)
await c.sleep(700)

/* ---------- 1) 右键「设置标签…」→ 面板输入两个标签 → 保存 ---------- */
const tagFlow = await c.evalx(`(async () => {
  const fire = (el, type) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
  const row = document.querySelector('.ob-row[data-node="m:mt-n2"]')
  if (!row) return { err: 'row absent' }
  const rect = row.getBoundingClientRect()
  row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window, clientX: rect.left + 60, clientY: rect.top + rect.height / 2 }))
  await new Promise((r) => setTimeout(r, 350))
  const menu = document.querySelector('.ob-ctx')
  if (!menu) return { err: 'ctx not open' }
  const tagItem = [...menu.querySelectorAll('.ctx-item')].find((i) => i.textContent.includes('设置标签'))
  if (!tagItem) return { err: 'no tag menu item' }
  fire(tagItem, 'mousedown')
  fire(tagItem, 'click')
  await new Promise((r) => setTimeout(r, 400))
  const panel = document.getElementById('mubu-tag-panel')
  if (!panel) return { err: 'no tag panel' }
  const setVal = (el, v) => { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
  const enter = (el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }))
  /* 创建栏：回车路径建「物品」 */
  const inp = panel.querySelector('.mtp-create input')
  inp.focus(); setVal(inp, '物品'); await new Promise((r) => setTimeout(r, 150)); enter(inp)
  await new Promise((r) => setTimeout(r, 380))
  /* 创建栏：「创建」按钮路径建「伏笔」 */
  const inp2 = panel.querySelector('.mtp-create input')
  inp2.focus(); setVal(inp2, '伏笔'); await new Promise((r) => setTimeout(r, 150))
  ;[...panel.querySelectorAll('.mtp-create button')].find((b) => b.textContent.includes('创建'))?.click()
  await new Promise((r) => setTimeout(r, 380))
  const chipCount = [...panel.querySelectorAll('.mtp-card')].filter((b) => b.classList.contains('on')).length
  /* 关闭面板 */
  panel.querySelector('.mtp-close')?.click()
  await new Promise((r) => setTimeout(r, 250))
  /* 用页面内实例的 flush（window.__flushNow，autosave.js 注册）：动态 import 可能因 HMR 时间戳拿到另一实例 */
  if (window.__flushNow) await window.__flushNow()
  const { db } = window.__ns
  const rowDb = await db.mubu.get('mt-n2')
  return { chipCount, saved: rowDb?.tags || null, panelClosed: !document.getElementById('mubu-tag-panel') }
})()`)
check('右键「设置标签…」创建栏建两标签并落库（回车 + 按钮双路径）',
  Array.isArray(tagFlow.saved) && tagFlow.saved.join(',') === '物品,伏笔' && tagFlow.chipCount === 2 && tagFlow.panelClosed === true, JSON.stringify(tagFlow))

const cards = await c.evalx(`(() => {
  const row = document.querySelector('.ob-row[data-node="m:mt-n2"]')
  return { chips: [...(row?.querySelectorAll('.ob-tag') || [])].map((b) => b.textContent.trim()) }
})()`)
check('行尾标签卡片渲染（铜符：物品 / 伏笔）', cards.chips.join(',') === '物品,伏笔', JSON.stringify(cards))

/* ---------- 2) 标签池：count 与同名同色 ---------- */
const pool = await c.evalx(`(async () => {
  const w = ${W}
  w.mubuSetTags('mt-n4', ['物品'])
  await new Promise((r) => setTimeout(r, 300))
  const tags = w.mubuTags
  const wupin = tags.find((t) => t.name === '物品')
  const fubi = tags.find((t) => t.name === '伏笔')
  return { list: tags.map((t) => t.name + ':' + t.count).join(','), wupinColor: wupin?.color, fubiColor: fubi?.color }
})()`)
check('标签池：物品×2 / 伏笔×1 且颜色有效',
  pool.list === '物品:2,伏笔:1' && /^#[0-9a-f]{6}$/.test(pool.wupinColor || '') && /^#[0-9a-f]{6}$/.test(pool.fubiColor || ''), JSON.stringify(pool))

/* ---------- 3) 侧栏检索：按标签 / 按内容 / 无结果 ---------- */
const byTag = await c.evalx(`(async () => {
  const ui = ${U}
  ui.mubuQuery = '物品'
  await new Promise((r) => setTimeout(r, 380))
  const hits = [...document.querySelectorAll('.mt-hit')]
  return {
    count: hits.length,
    texts: hits.map((h) => h.querySelector('.mt-hit-text')?.textContent),
    allTagOn: hits.length > 0 && hits.every((h) => h.querySelectorAll('.mt-hit-tag.on').length >= 1),
    hasPath: hits.some((h) => (h.querySelector('.mt-hit-path')?.textContent || '').includes('器物') || (h.querySelector('.mt-hit-path')?.textContent || '').includes('地点'))
  }
})()`)
check('检索：按标签「物品」命中 2 节点（标签高亮 + 祖先路径）',
  byTag.count === 2 && byTag.texts.includes('铜符') && byTag.texts.includes('石门') && byTag.allTagOn === true && byTag.hasPath === true, JSON.stringify(byTag))

const byText = await c.evalx(`(async () => {
  const ui = ${U}
  ui.mubuQuery = '石门'
  await new Promise((r) => setTimeout(r, 380))
  const hits = [...document.querySelectorAll('.mt-hit')]
  return { count: hits.length, text: hits[0]?.querySelector('.mt-hit-text')?.textContent }
})()`)
check('检索：按内容「石门」命中 1 节点', byText.count === 1 && byText.text === '石门', JSON.stringify(byText))

const noHit = await c.evalx(`(async () => {
  const ui = ${U}
  ui.mubuQuery = '不存在的标签xyz'
  await new Promise((r) => setTimeout(r, 380))
  return { count: document.querySelectorAll('.mt-hit').length, empty: !!document.querySelector('.side-empty') }
})()`)
check('检索：无匹配时给空态提示', noHit.count === 0 && noHit.empty === true, JSON.stringify(noHit))

/* ---------- 4) 点击命中项 → 定位（展开 + 闪烁）且信号被消费 ---------- */
const locate = await c.evalx(`(async () => {
  const ui = ${U}
  ui.mubuQuery = '伏笔'
  await new Promise((r) => setTimeout(r, 380))
  const hit = document.querySelector('.mt-hit')
  const hitText = hit?.querySelector('.mt-hit-text')?.textContent
  hit?.click()
  await new Promise((r) => setTimeout(r, 650))
  return {
    hitText,
    flash: !!document.querySelector('.ob-row.ob-flash'),
    focusConsumed: ui.loreFocusId === null,
    selected: ui.mubuSelectedId
  }
})()`)
check('点击命中项：定位到节点（展开+闪烁）且信号被消费',
  locate.flash === true && locate.focusConsumed === true && locate.selected === 'mt-n2' && locate.hitText === '铜符', JSON.stringify(locate))

/* ---------- 5) 点行尾标签卡片 → 侧栏按该标签筛选 ---------- */
const chipClick = await c.evalx(`(async () => {
  const ui = ${U}
  ui.mubuQuery = ''
  await new Promise((r) => setTimeout(r, 300))
  const chip = document.querySelector('.ob-row[data-node="m:mt-n2"] .ob-tag')
  if (!chip) return { err: 'no chip' }
  const chipText = chip.textContent.trim()
  chip.click()
  await new Promise((r) => setTimeout(r, 380))
  return { query: ui.mubuQuery, hits: document.querySelectorAll('.mt-hit').length, chipText }
})()`)
check('点行尾标签卡片 → 侧栏按该标签筛选（2 节点联动）',
  chipClick.query === chipClick.chipText && chipClick.query === '物品' && chipClick.hits === 2, JSON.stringify(chipClick))

/* ---------- 6) 移除标签 → 卡片更新、标签池收缩 ---------- */
const removed = await c.evalx(`(async () => {
  const w = ${W}
  const ui = ${U}
  ui.mubuQuery = ''
  w.mubuSetTags('mt-n2', ['伏笔'])
  w.mubuSetTags('mt-n4', [])
  await new Promise((r) => setTimeout(r, 380))
  return {
    chips2: [...document.querySelectorAll('.ob-row[data-node="m:mt-n2"] .ob-tag')].map((b) => b.textContent.trim()),
    chips4: [...document.querySelectorAll('.ob-row[data-node="m:mt-n4"] .ob-tag')].map((b) => b.textContent.trim()),
    pool: w.mubuTags.map((t) => t.name + ':' + t.count).join(',')
  }
})()`)
check('移除标签：卡片更新、标签池收缩（物品消失）',
  removed.chips2.join(',') === '伏笔' && removed.chips4.length === 0 && removed.pool === '伏笔:1', JSON.stringify(removed))

/* ---------- 7) 持久化：reload 后标签仍在 ---------- */
await c.evalx(`(async () => { if (window.__flushNow) await window.__flushNow(); return 1 })()`)
await c.evalx('location.reload()')
await c.sleep(3200)
const persist = await c.evalx(`(async () => {
  const w = ${W}
  await w.open('mt-work')
  w.tab = 'lore'
  await new Promise((r) => setTimeout(r, 750))
  return {
    chips: [...document.querySelectorAll('.ob-row[data-node="m:mt-n2"] .ob-tag')].map((b) => b.textContent.trim()),
    pool: w.mubuTags.map((t) => t.name).join(',')
  }
})()`)
check('reload 后标签仍持久（卡片 + 标签池）', persist.chips.join(',') === '伏笔' && persist.pool === '伏笔', JSON.stringify(persist))

/* ---------- 8) 全局搜索（work.search）设定范围纳入标签 ---------- */
const gs = await c.evalx(`(() => {
  const w = ${W}
  const res = w.search('伏笔', { lore: true })
  const hit = res.find((r) => r.type === 'lore')
  return { found: !!hit, title: hit?.title || '', firstHit: hit?.hits?.[0] || '' }
})()`)
check('全局搜索设定范围按标签命中（hits 标注标签来源）',
  gs.found === true && gs.title.includes('铜符') && String(gs.firstHit).includes('标签：伏笔'), JSON.stringify(gs))

/* ---------- 9) 清理 fixture 并恢复原作品 ---------- */
await c.evalx(`(async () => {
  const { db } = window.__ns
  await db.mubu.bulkDelete(['mt-n1', 'mt-n2', 'mt-n3', 'mt-n4'])
  await db.works.bulkDelete(['mt-work'])
  await db.appconfig.delete('mubu-mig:mt-work')
  const w = ${W}
  if (${JSON.stringify(origWork)}) await w.open(${JSON.stringify(origWork)}).catch(() => {})
  else { w.work = null; w.loaded = false }
  return 1
})()`)
await c.sleep(400)
console.log('fixture 已清理，原作品状态已恢复')

const pass = results.filter(Boolean).length
console.log(`\n${pass}/${results.length} 通过`)
process.exit(results.includes(false) ? 1 : 0)
