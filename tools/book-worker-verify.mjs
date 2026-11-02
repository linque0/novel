// Disposable browser only: virtual shelf fixtures never enter the user's database.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require(require.resolve('playwright', { paths: [join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node')] }))
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage(), errors = [], results = []
page.on('pageerror', e => errors.push(e.message))
async function init(count = 6) {
  await page.goto(process.env.BOOK_TEST_URL || 'http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__ns && document.querySelector('#app').__vue_app__?.config.globalProperties.$pinia._s.has('shelf'))
  await page.evaluate(async count => {
    const stores = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s
    const source = await (await fetch('/src/components/ThemeBook.vue')).text()
    const path = source.match(/import\(["']([^"']*book3d\/renderer[^"']*)/)[1]
    window.__perf = { ui: stores.get('ui'), shelf: stores.get('shelf'), apiPath:path, api:null }
    __perf.shelf.works = Array.from({ length: count }, (_, i) => ({ id: 'temporary-perf-' + i, title: ['星尘旅人','白昼','山海拾遗录','雾都来信','中文与 English 混排小说','无名之书'][i % 6] + (i >= 6 ? i : ''), author: '林间', intro: '独立临时性能数据', kind: ['novel','note','cedar','violet','claret','ink'][i % 6], totalWords: 1000, chapterCount: 1, genre: '奇幻', status: '连载' }))
    __perf.shelf.loading = false
    await document.fonts.ready
  }, count)
}
async function switchTo(skin, sample = 2200) {
  const result = await page.evaluate(async ({skin,sample}) => {
    const tasks = [], observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(e => Math.round(e.duration))))
    observer.observe({ type: 'longtask' })
    const next = () => new Promise(r => requestAnimationFrame(r))
    await next(); const start = performance.now(); let last = start, maxGap = 0, stop = false
    function tick(now) { maxGap = Math.max(maxGap, now - last); last = now; if (!stop) requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
    await __perf.ui.setSkin(skin); await next(); await next()
    const firstFrames = performance.now() - start
    await new Promise(r => setTimeout(r, sample)); await next(); await next(); stop = true; observer.disconnect()
    if(!__perf.api)__perf.api=await import(__perf.apiPath)
    return { skin, workCount:__perf.shelf.works.length, firstFrames: Math.round(firstFrames), maxGap: Math.round(maxGap), longTasks: tasks, diag: __perf.api.getBook3DDiagnostics() }
  }, {skin,sample})
  results.push(result); console.log(JSON.stringify(result))
  return result
}
async function ready() {
  await page.waitForFunction(() => [...document.querySelectorAll('.theme-book,.crimson-book-thumbnail')].filter(e => { const r = e.getBoundingClientRect(); return !e.closest('[inert]') && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0 }).every(e => e.dataset.poster === 'ready') && (!document.querySelector('.crimson-book-display') || document.querySelector('.crimson-book-display').dataset.state === 'ready'), null, { timeout: 60000 })
}
try {
  await init()
  const cold = await switchTo('gravity')
  assert.ok(cold.diag.workers >= 1, '3D artwork runs in a worker')
  await ready()
  assert.ok(await page.evaluate(() => __perf.api.getBook3DDiagnostics().cachedPosters > 0), 'completed posters enter the live cache')
  for (const skin of ['glaze', 'crimson', 'original', 'gravity']) { await switchTo(skin); await ready() }
  // Every directed transition, including saving the setting through IndexedDB.
  for (const from of ['original','gravity','glaze','crimson']) {
    await page.evaluate(skin => __perf.ui.setSkin(skin), from); await ready()
    for (const to of ['original','gravity','glaze','crimson'].filter(s => s !== from)) {
      await switchTo(to, 250); await ready()
      await page.evaluate(skin => __perf.ui.setSkin(skin), from); await ready()
    }
  }
  assert.ok(results.filter(r => r.skin !== 'original').every(r => r.firstFrames <= 200), 'six-book shelf is usable within 200ms')
  assert.ok(results.every(r => r.longTasks.every(ms => ms <= 100)), 'book rendering produces no main-thread long tasks over 100ms')
  await switchTo('original')
  const before = await page.evaluate(() => __perf.api.getBook3DDiagnostics().frames)
  await switchTo('gravity'); await ready()
  assert.equal(await page.evaluate(() => __perf.api.getBook3DDiagnostics().frames), before, 'returning to a cached skin needs no new renders')
  await page.evaluate(async () => { for (const skin of ['glaze','crimson','gravity','original','glaze']) await __perf.ui.setSkin(skin) })
  await ready(); assert.equal(await page.locator('.theme-book').first().getAttribute('data-book-theme'), 'glaze')
  await page.locator('.gg-viewport').focus()
  const galleryFrames=await page.evaluate(()=>{
    window.__galleryLongTasks=[];window.__galleryObserver=new PerformanceObserver(list=>__galleryLongTasks.push(...list.getEntries().map(entry=>Math.round(entry.duration))));__galleryObserver.observe({type:'longtask'});return __perf.api.getBook3DDiagnostics().frames
  })
  for(let i=0;i<20;i++)await page.keyboard.press('ArrowRight')
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const cycle=await page.evaluate(before=>{__galleryObserver.disconnect();const d=__perf.api.getBook3DDiagnostics();return {newFrames:d.frames-before,nodes:document.querySelectorAll('.gg-slot').length,longTasks:__galleryLongTasks,cacheBytes:d.cacheBytes}},galleryFrames)
  assert.equal(cycle.newFrames,0,'warm gallery movement does not rebuild 3D models')
  assert.ok(cycle.nodes<=7&&cycle.longTasks.every(ms=>ms<=100),'rapid gallery cycles stay bounded and responsive')
  console.log('GALLERY_CYCLE '+JSON.stringify(cycle));writeFileSync(new URL('_glaze-gallery-cycle.json',import.meta.url),JSON.stringify(cycle,null,2))
  await switchTo('crimson'); await ready()
  const viewer = page.locator('.crimson-book-display'), rotation = await viewer.getAttribute('data-rotation')
  await viewer.focus(); await page.keyboard.press('ArrowRight')
  await page.waitForFunction(before => document.querySelector('.crimson-book-display').dataset.rotation !== before, rotation)
  await page.keyboard.press('Home')
  await page.waitForFunction(before => document.querySelector('.crimson-book-display').dataset.rotation === before, rotation)
  await page.evaluate(async () => { await __perf.ui.setSkin('original'); __perf.shelf.works = [] })
  for (const skin of ['gravity','glaze','crimson','original']) await switchTo(skin)
  assert.equal(await page.evaluate(() => __perf.api.getBook3DDiagnostics().workers), 0, 'empty shelves retain no workers')
  await init(100); await switchTo('gravity'); await ready()
  assert.ok(await page.evaluate(() => __perf.api.getBook3DDiagnostics().cachedPosters <= 48), '100-book cache remains bounded')
  await page.evaluate(() => __perf.ui.setSkin('original'))
  await page.waitForFunction(() => { const d = __perf.api.getBook3DDiagnostics(); return !d.models && !d.workers && !d.pendingPosters && !d.posterRenderers && !d.viewers })
  assert.ok(await page.evaluate(() => __perf.api.getBook3DDiagnostics().cacheBytes <= 16 * 1024 * 1024))
  assert.deepEqual(errors, [])
  writeFileSync(new URL('_book-worker-performance.json', import.meta.url), JSON.stringify(results, null, 2))
  console.log('PASS background rendering, cold/warm/rapid switching, interactive keyboard, empty/100-book shelves and resource bounds')
} finally { await context.close(); await browser.close() }
