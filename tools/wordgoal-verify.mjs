/* 正文字数目标底栏验收（v1.0.27）：每章目标设置 / 进度实时 / 达标态 / 换章重算 / 跨作品隔离 / 持久化 / 清除。
 * 运行前提：npm run dev（CDP 9222）。fixture 自建于 dev 库并在结束时清理（作品 wg-work-a / wg-work-b）。 */
import { connect } from './_cdp-lib.mjs'

const c = await connect('app://')
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  —— ' + String(detail).slice(0, 320) : ''))
}
const W = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work')`

await c.evalx('location.reload()')
await c.sleep(3200)
const origWork = await c.evalx(`(${W}.work?.id || null)`)

/* ---------- 0) fixture：两个作品（A 用于目标功能，B 用于隔离） ---------- */
const fixture = await c.evalx(`(async () => {
  const { db } = window.__ns
  const now = Date.now()
  await db.chapters.bulkDelete(['wg-ch-a1', 'wg-ch-a2', 'wg-ch-b1']).catch(() => {})
  await db.works.bulkDelete(['wg-work-a', 'wg-work-b']).catch(() => {})
  await db.appconfig.delete('wordgoal:wg-work-a')
  await db.appconfig.delete('wordgoal:wg-work-b')
  await db.works.bulkPut([
    { id: 'wg-work-a', title: '字数目标验证A', genre: '', intro: '', status: '构思', kind: 'novel', createdAt: now, updatedAt: now, deletedAt: null },
    { id: 'wg-work-b', title: '字数目标验证B', genre: '', intro: '', status: '构思', kind: 'novel', createdAt: now, updatedAt: now, deletedAt: null }
  ])
  const ch = (id, workId, title, n, sortOrder) => ({ id, workId, volumeId: null, title, content: '<p>' + '字'.repeat(n) + '</p>', fmt: 'html', wordCount: n, status: 'draft', sortOrder, createdAt: now, updatedAt: now, deletedAt: null })
  await db.chapters.bulkPut([ch('wg-ch-a1', 'wg-work-a', '第1章', 1234, 0), ch('wg-ch-a2', 'wg-work-a', '第2章', 0, 1), ch('wg-ch-b1', 'wg-work-b', '第1章', 0, 0)])
  return { ok: true }
})()`)
check('fixture 写入（作品 A/B，第1章 1,234 字）', fixture?.ok === true)

await c.evalx(`(async () => { await ${W}.open('wg-work-a'); return 1 })()`)
await c.sleep(700)

/* ---------- 1) 底栏渲染 + 未设目标态 ---------- */
const foot0 = await c.evalx(`(() => {
  const foot = document.querySelector('.editor-foot')
  return {
    hasFoot: !!foot,
    setText: document.querySelector('.editor-foot .wg-set')?.textContent.trim() || '',
    fillW: parseFloat(document.querySelector('.editor-foot .wg-fill')?.style.width) || 0,
    numText: document.querySelector('.editor-foot .wg-num')?.textContent.trim() || '',
    goal: ${W}.wordGoal,
    readHidden: false
  }
})()`)
check('底栏渲染（未设目标态：提示「设定每章目标」、进度条空、本章字数千分位）',
  foot0.hasFoot === true && foot0.goal === 0 && foot0.setText === '设定每章目标' && foot0.fillW === 0 && foot0.numText.includes('1,234'), JSON.stringify(foot0))

/* ---------- 2) popover 设定目标 3000（DOM 交互，即时保存） ---------- */
const setFlow = await c.evalx(`(async () => {
  const fire = (el) => { for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })) }
  const btn = document.querySelector('.editor-foot .wg-set')
  if (!btn) return { err: 'no wg-set' }
  fire(btn)
  let inp = null
  for (let i = 0; i < 20 && !inp; i++) { await new Promise((r) => setTimeout(r, 200)); inp = document.querySelector('.wg-goal-pop input') }
  if (!inp) return { err: 'no popover input' }
  const setVal = (el, v) => { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
  setVal(inp, '3000')
  await new Promise((r) => setTimeout(r, 250))
  const save = [...document.querySelectorAll('.wg-goal-pop button')].find((b) => b.textContent.includes('保存'))
  if (!save) return { err: 'no save btn' }
  fire(save)
  await new Promise((r) => setTimeout(r, 450))
  return { wordGoal: ${W}.wordGoal }
})()`)
check('popover 设定每章目标 3000（DOM 交互 + 即时保存）', setFlow.wordGoal === 3000, JSON.stringify(setFlow))

/* ---------- 3) 进度条 / 百分比 / 目标对照 + 落库 ---------- */
const prog0 = await c.evalx(`(async () => {
  const { db } = window.__ns
  const row = await db.appconfig.get('wordgoal:' + ${W}.work.id)
  return {
    dbGoal: row?.value,
    fillW: parseFloat(document.querySelector('.editor-foot .wg-fill')?.style.width),
    expectW: Math.min(100, (1234 / 3000) * 100),
    pct: document.querySelector('.editor-foot .wg-pct')?.textContent.trim() || '',
    goalTxt: document.querySelector('.editor-foot .wg-goal')?.textContent.trim() || ''
  }
})()`)
check('目标落库 + 进度条宽度 / 41% / 「目标 3,000 字」对照',
  prog0.dbGoal === 3000 && Math.abs(prog0.fillW - prog0.expectW) < 0.5 && prog0.pct === '41%' && prog0.goalTxt === '目标 3,000 字', JSON.stringify(prog0))

/* ---------- 4) 正文增字 → 进度实时更新 ---------- */
const live = await c.evalx(`(async () => {
  const w = ${W}
  await w.setChapterContent('wg-ch-a1', '<p>' + '文'.repeat(2000) + '</p>', 'html')
  await new Promise((r) => setTimeout(r, 300))
  return {
    wc: w.activeChapter.wordCount,
    fillW: parseFloat(document.querySelector('.editor-foot .wg-fill')?.style.width),
    num: document.querySelector('.editor-foot .wg-num')?.textContent.trim() || '',
    pct: document.querySelector('.editor-foot .wg-pct')?.textContent.trim() || ''
  }
})()`)
check('正文增字后进度实时更新（2000/3000 = 66%）',
  live.wc === 2000 && Math.abs(live.fillW - 66.66) < 0.5 && live.num.includes('2,000') && live.pct === '66%', JSON.stringify(live))

/* ---------- 5) 达标态（目标低于当前字数） ---------- */
const done = await c.evalx(`(async () => {
  const w = ${W}
  await w.setWordGoal(1500)
  await new Promise((r) => setTimeout(r, 300))
  const track = document.querySelector('.editor-foot .wg-track')
  return {
    doneCls: track ? track.classList.contains('done') : false,
    pct: document.querySelector('.editor-foot .wg-pct')?.textContent.trim() || '',
    fillW: parseFloat(document.querySelector('.editor-foot .wg-fill')?.style.width),
    storeDone: w.goalProgress.done
  }
})()`)
check('达标态：进度条满 + 成功色类 + 「已达标」',
  done.doneCls === true && done.pct === '已达标' && done.fillW === 100 && done.storeDone === true, JSON.stringify(done))

/* ---------- 6) 换章 → 进度按新章重算 ---------- */
const swap = await c.evalx(`(async () => {
  const w = ${W}
  w.selChapterId = 'wg-ch-a2'
  await new Promise((r) => setTimeout(r, 500))
  const track = document.querySelector('.editor-foot .wg-track')
  return {
    wc: w.activeChapter.wordCount,
    pct: document.querySelector('.editor-foot .wg-pct')?.textContent.trim() || '',
    num: document.querySelector('.editor-foot .wg-num')?.textContent.trim() || '',
    doneCls: track ? track.classList.contains('done') : false
  }
})()`)
check('换章：进度按新章字数重算（0/1500 = 0%，未达标）',
  swap.wc === 0 && swap.pct === '0%' && swap.doneCls === false && swap.num.includes('本章 0 字'), JSON.stringify(swap))

/* ---------- 7) 跨作品隔离（作品 B 无目标） ---------- */
const iso = await c.evalx(`(async () => {
  const w = ${W}
  await w.open('wg-work-b')
  await new Promise((r) => setTimeout(r, 650))
  return {
    goal: w.wordGoal,
    setText: document.querySelector('.editor-foot .wg-set')?.textContent.trim() || '',
    hasFoot: !!document.querySelector('.editor-foot')
  }
})()`)
check('跨作品隔离：作品 B 无目标（显示「设定每章目标」）',
  iso.goal === 0 && iso.setText === '设定每章目标' && iso.hasFoot === true, JSON.stringify(iso))

/* ---------- 8) 持久化：设值 → reload → 重新打开仍在 ---------- */
await c.evalx(`(async () => { const w = ${W}; await w.open('wg-work-a'); await w.setWordGoal(2500); return 1 })()`)
await c.sleep(400)
await c.evalx('location.reload()')
await c.sleep(3200)
const persist = await c.evalx(`(async () => {
  const w = ${W}
  await w.open('wg-work-a')
  await new Promise((r) => setTimeout(r, 600))
  return { goal: w.wordGoal, goalTxt: document.querySelector('.editor-foot .wg-goal')?.textContent.trim() || '' }
})()`)
check('持久化：reload 后目标仍在（2,500 字）',
  persist.goal === 2500 && persist.goalTxt === '目标 2,500 字', JSON.stringify(persist))

/* ---------- 9) 清除目标 ---------- */
const cleared = await c.evalx(`(async () => {
  const w = ${W}
  await w.setWordGoal(0)
  await new Promise((r) => setTimeout(r, 300))
  const { db } = window.__ns
  const row = await db.appconfig.get('wordgoal:' + w.work.id)
  return {
    goal: w.wordGoal,
    setText: document.querySelector('.editor-foot .wg-set')?.textContent.trim() || '',
    fillW: parseFloat(document.querySelector('.editor-foot .wg-fill')?.style.width) || 0,
    dbGoal: row?.value
  }
})()`)
check('清除目标：回到未设态且键值为 0',
  cleared.goal === 0 && cleared.setText === '设定每章目标' && cleared.fillW === 0 && cleared.dbGoal === 0, JSON.stringify(cleared))

/* ---------- 10) 清理 fixture 并恢复原作品 ---------- */
await c.evalx(`(async () => {
  const { db } = window.__ns
  await db.chapters.bulkDelete(['wg-ch-a1', 'wg-ch-a2', 'wg-ch-b1'])
  await db.works.bulkDelete(['wg-work-a', 'wg-work-b'])
  await db.appconfig.delete('wordgoal:wg-work-a')
  await db.appconfig.delete('wordgoal:wg-work-b')
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
