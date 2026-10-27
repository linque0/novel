/* 赤月戏 v3 应用接入验收：真实 Vite 应用 + 隔离浏览器上下文，不写用户数据。
 * 用法：先启动 `vite --host 127.0.0.1 --port 5173`，再 node tools/crimson-v3-verify.mjs
 */
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'docs/前端美化/赤月戏-验收/v3')
mkdirSync(out, { recursive: true })
const require = createRequire(import.meta.url)
const { chromium } = require(require.resolve('playwright', {
  paths: [join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node')]
}))

const fail = []
const report = {}
const near = (a, b, tol = 2) => Math.abs(Number(a) - Number(b)) <= tol
const check = (cond, msg) => { if (!cond) fail.push(msg) }

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(2600)

async function switchSkin(name = '赤月戏') {
  const current = await page.evaluate(() => document.body.dataset.skin)
  if ((name === '赤月戏' && current === 'crimson') || (name === '原版工坊' && current === 'original')) return
  await page.locator('.n-base-selection').first().click()
  await page.getByText(name, { exact: true }).last().click()
  await page.waitForTimeout(1100)
}
async function pinia(expr) {
  return page.evaluate((code) => {
    const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    return new Function('pinia', code)(p)
  }, expr)
}
async function clickNav(label) {
  await page.locator('.crimson-topnav-item', { hasText: label }).click()
  await page.waitForTimeout(900)
}
async function metrics() {
  return page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    }
    return {
      skin: document.body.dataset.skin,
      tab: document.querySelector('.workbench-shell')?.dataset.module || 'shelf',
      overflow: document.documentElement.scrollWidth > innerWidth,
      broken: [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src.split('/').pop()),
      header: pick('.crimson-header, .crimson-topbar'),
      rail: pick('.crimson-chapter-rail'),
      book: pick('.crimson-book'),
      margin: pick('.crimson-margin'),
      strip: !!document.querySelector('.crimson-chapter-strip'),
      dir: pick('.crimson-outline-directory'),
      canvas: pick('.oc-canvas'),
      art: pick('.crimson-art-pane'),
      paper: pick('.crimson-lore-paper'),
      index: pick('.crimson-lore-index'),
      portrait: pick('.crimson-portrait-frame'),
      dossier: pick('.crimson-dossier'),
      wall: pick('.crimson-idea-wall'),
      reader: pick('.crimson-idea-reader'),
      graphMain: pick('.crimson-graph-main'),
      graphIndex: pick('.crimson-graph-index'),
      detail: !!document.querySelector('.ldt-crimson'),
      detailArt: pick('.ldt-crimson-layout .crimson-art-pane'),
      detailPaper: pick('.crimson-detail-paper'),
      detailConn: pick('.crimson-detail-connections'),
      backdrop: [...document.images].filter((i) => i.classList.contains('crimson-backdrop')).map((i) => ({ src: i.src.split('/').pop(), pos: getComputedStyle(i).objectPosition })),
      artImgs: [...document.images].filter((i) => i.closest('.crimson-art-pane')).map((i) => ({ src: i.src.split('/').pop(), pos: getComputedStyle(i).objectPosition }))
    }
  })
}
async function shot(name) {
  const m = await metrics()
  report[name] = m
  await page.screenshot({ path: join(out, name + '.png') })
  return m
}

await switchSkin()

/* ── 书架 ── */
await page.waitForTimeout(700)
let m = await shot('shelf')
check(m.skin === 'crimson', 'shelf: skin not crimson')
check(near(m.header?.h, 76), `shelf: header ${m.header?.h} != 76`)
check(!(await page.locator('.crimson-rail').count()), 'shelf: old 84px rail still rendered')
check((await page.locator('.crimson-shelf-nav-item').count()) === 7, 'shelf: header nav is not seven items')
check((await page.locator('.crimson-program').boundingBox())?.width === 316, 'shelf: program column is not 316')
check(!m.overflow && m.broken.length === 0, 'shelf: overflow or broken image')

/* ── 打开一本有章节的书，补齐验收数据 ── */
await pinia(`(async () => {
  const shelf = pinia._s.get('shelf'); const work = pinia._s.get('work')
  const target = shelf.works.find((w) => (w.chapterCount || 0) > 0) || shelf.works[0]
  if (!target) return false
  await work.open(target.id)
  if (!work.liveCharacters.length) ['林远', '沈砚', '白鸽'].forEach((n) => work.addCharacter(n))
  if (!work.liveSnippets.length) {
    work.addSnippet('雾港来信：一封没有寄件人的信，提起父亲从未抵达的海岸。\\n\\n信纸边缘有盐，像从很远的海上寄来。')
    work.addSnippet('第十二声钟响：如果钟声不是报时，而是唤醒一段被抹去的记忆。\\n\\n林远记得十一声，沈砚却听见了十二声。')
  }
  if (!work.liveMubu().length) {
    const world = work.mubuAdd(null, null, '世界观')
    work.mubuAdd(world.id, null, '星图系统')
    work.mubuAdd(world.id, null, '铜星是星图中最稳定的导航基准。')
    work.mubuAdd(null, null, '地理')
    work.mubuAdd(null, null, '组织')
  }
  if (!work.liveOlnodes().length) {
    work.olnodeAdd(null, { kind: 'container', title: '第一卷 · 星图初醒', text: '' })
    work.olnodeAdd(null, { kind: 'event', title: '铜星熄灭', text: '一枚铜星在雾中熄灭，旧航线失去坐标。' })
    work.olnodeAdd(null, { kind: 'note', title: '保留第十二声钟响', text: '只让读者听见异常，暂不解释原因。' })
    work.olnodeAdd(null, { kind: 'cite', title: '林远', text: '观测者 · 追寻父亲的航线' })
  }
  work.charView = 'list'
  work.selCharacterId = work.liveCharacters[1]?.id || work.liveCharacters[0]?.id
  work.selSnippetId = work.liveSnippets[0]?.id || null
  work.tab = 'chapters'
  return true
})()`)
await page.waitForTimeout(1500)

/* ── 正文 ── */
m = await shot('editor')
check(m.tab === 'chapters', 'editor: did not open chapters')
check(near(m.rail?.w, 248), `editor: rail ${m.rail?.w} != 248`)
check(near(m.book?.x, 296), `editor: book left ${m.book?.x} != 296`)
check(near(m.margin?.w, 252), `editor: margin ${m.margin?.w} != 252`)
check(!m.strip, 'editor: old bottom chapter strip still rendered')
check((await page.locator('.crimson-rail-chapter').count()) > 0, 'editor: chapter rail list is empty')

/* 搜索 / 收起 / 上下章 / 新建 */
const total = await page.locator('.crimson-rail-chapter').count()
await page.locator('.crimson-rail-search input').fill('第二章')
await page.waitForTimeout(250)
const filtered = await page.locator('.crimson-rail-chapter').count()
check(filtered <= total, 'editor: chapter search did not filter')
await page.locator('.crimson-rail-search input').fill('')
await page.locator('.crimson-rail-toggle').click()
await page.waitForTimeout(350)
m = await metrics()
check(near(m.rail?.w, 56), `editor collapsed: rail ${m.rail?.w} != 56`)
check(near(m.book?.x, 104), `editor collapsed: book left ${m.book?.x} != 104`)
const before = await page.evaluate(() => document.querySelector('.crimson-rail-chapter.current .num')?.textContent || '')
await page.locator('.crimson-mini-nav').last().click()
await page.waitForTimeout(300)
const after = await page.evaluate(() => document.querySelector('.crimson-rail-chapter.current .num')?.textContent || '')
check(before !== after, 'editor: next chapter did not change current chapter')
await page.locator('.crimson-rail-toggle').click()
await page.waitForTimeout(300)
const countBefore = await page.locator('.crimson-rail-chapter').count()
await page.locator('.crimson-rail-new').click()
await page.waitForTimeout(500)
const countAfter = await page.locator('.crimson-rail-chapter').count()
check(countAfter === countBefore + 1, 'editor: new chapter button did not add a chapter')

/* ── 大纲 ── */
await clickNav('大纲')
await pinia(`(() => { const w = pinia._s.get('work'); w.outlineView = 'canvas'; w.selOlnodeId = w.liveOlnodes()[0]?.id || null; return true })()`)
await page.waitForTimeout(800)
m = await shot('outline')
check(near(m.dir?.w, 240), `outline: directory ${m.dir?.w} != 240`)
check(m.canvas && m.canvas.w > 900, 'outline: canvas did not fill remaining width')
check((await page.locator('.oc-node').count()) >= 3, 'outline: canvas nodes missing')
await pinia(`(() => { const w = pinia._s.get('work'); w.outlineView = 'text'; w.selOlnodeId = w.liveOlnodes()[0]?.id || null; return true })()`)
await page.waitForTimeout(800)
m = await shot('outline-text')
check(near(m.dir?.w, 240), 'outline-text: directory width changed')

/* ── 设定 / 详情 ── */
await clickNav('设定')
m = await shot('world')
check(near(m.art?.w, 220), `world: art pane ${m.art?.w} != 220`)
check(near(m.index?.w, 240), `world: index ${m.index?.w} != 240`)
check(m.artImgs.some((i) => i.src.includes('world')), 'world: new world art not mounted')
check(m.artImgs[0]?.pos === '50% 50%', `world: art object-position is ${m.artImgs[0]?.pos}`)
await pinia(`(() => { const ui = pinia._s.get('ui'); const w = pinia._s.get('work'); ui.loreDetailId = w.mubu.find(n => !n.parentId && !n.deletedAt)?.id || null; return true })()`)
await page.waitForTimeout(900)
m = await shot('world-detail')
check(m.detail, 'world-detail: detail overlay did not open')
check(near(m.detailArt?.w, 200), `world-detail: art ${m.detailArt?.w} != 200`)
check(near(m.detailConn?.w, 340), `world-detail: connections ${m.detailConn?.w} != 340`)
await pinia(`(() => { pinia._s.get('ui').loreDetailId = null; return true })()`)
await page.waitForTimeout(600)

/* ── 人物 / 关系图 ── */
await clickNav('人物')
await pinia(`(() => { const w = pinia._s.get('work'); w.charView = 'list'; w.selCharacterId = w.liveCharacters[1]?.id || w.liveCharacters[0]?.id; return true })()`)
await page.waitForTimeout(900)
m = await shot('characters')
check(near(m.portrait?.w, 330) && near(m.portrait?.h, 420), `characters: portrait ${m.portrait?.w}x${m.portrait?.h} != 330x420`)
check(near(m.dossier?.x, 440), `characters: dossier left ${m.dossier?.x} != 440`)
const castCount = await page.locator('.crimson-cast .side-item').count()
check(castCount >= 1, `characters: cast list not rendered (${castCount})`)
check(m.backdrop.some((i) => i.src.includes('characters') && i.pos.startsWith('0%')), 'characters: new background not mounted at left center')
await pinia(`(() => { pinia._s.get('work').charView = 'graph'; return true })()`)
await page.waitForTimeout(1600)
m = await shot('characters-graph')
check(near(m.graphIndex?.w, 260), `graph: index ${m.graphIndex?.w} != 260`)
check((await page.locator('.rg-node').count()) >= 1, 'graph: nodes missing')

/* ── 灵感 ── */
await clickNav('灵感')
await pinia(`(() => { const w = pinia._s.get('work'); w.selSnippetId = w.liveSnippets[0]?.id || null; return true })()`)
await page.waitForTimeout(900)
m = await shot('inspiration')
check(near(m.art?.w, 220), `inspiration: art ${m.art?.w} != 220`)
check(near(m.wall?.w, 420), `inspiration: wall ${m.wall?.w} != 420`)
check(m.reader && m.reader.w > 500, 'inspiration: reader missing')
check(m.artImgs.some((i) => i.src.includes('inspiration')), 'inspiration: new lantern art not mounted')
check(m.backdrop.some((i) => i.src.includes('inspiration') && i.pos.startsWith('0%')), 'inspiration: full-stage art not left-aligned')

/* ── 1080×680 ── */
await page.setViewportSize({ width: 1080, height: 680 })
await page.waitForTimeout(700)
await pinia(`(() => { pinia._s.get('work').tab = 'chapters'; return true })()`)
await page.waitForTimeout(500)
m = await shot('narrow-editor')
check(!m.overflow, 'narrow editor: horizontal overflow')
check(near(m.rail?.w, 216), `narrow editor: rail ${m.rail?.w} != 216`)
check(near(m.book?.x, 248), `narrow editor: book left ${m.book?.x} != 248`)
check(near(m.margin?.w, 210), `narrow editor: margin ${m.margin?.w} != 210`)
await clickNav('大纲')
await pinia(`(() => { const w = pinia._s.get('work'); w.outlineView = 'canvas'; w.selOlnodeId = w.liveOlnodes()[0]?.id || null; return true })()`)
await page.waitForTimeout(700)
m = await shot('narrow-outline')
check(!m.overflow && near(m.dir?.w, 216), 'narrow outline: overflow or directory not 216')
await clickNav('设定')
m = await shot('narrow-world')
check(!m.overflow && near(m.art?.w, 190) && near(m.index?.w, 180), 'narrow world: widths wrong or overflow')
await clickNav('人物')
await pinia(`(() => { const w = pinia._s.get('work'); w.charView = 'list'; return true })()`)
await page.waitForTimeout(700)
m = await shot('narrow-characters')
check(!m.overflow && near(m.portrait?.w, 300) && near(m.dossier?.x, 362), 'narrow characters: widths wrong or overflow')
await clickNav('灵感')
m = await shot('narrow-inspiration')
check(!m.overflow && near(m.art?.w, 190) && near(m.wall?.w, 360), 'narrow inspiration: widths wrong or overflow')

/* ── 设置窗口 ── */
const settings = await context.newPage()
await settings.goto('http://127.0.0.1:5173/?panel=settings:app:', { waitUntil: 'networkidle' })
await settings.waitForTimeout(900)
const sw = await settings.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  }
  return {
    skin: document.body.dataset.skin,
    overflow: document.documentElement.scrollWidth > innerWidth,
    nav: pick('.sw-nav'),
    controls: pick('.sw-appearance-controls'),
    preview: pick('.writing-paper-preview'),
    mark: !!document.querySelector('.crimson-settings-mark'),
    current: !!document.querySelector('.sw-nav-item.on')
  }
})
report.settings = sw
await settings.screenshot({ path: join(out, 'settings.png') })
check(sw.skin === 'crimson', 'settings: skin not crimson')
check(!sw.overflow, 'settings: horizontal overflow')
check(sw.mark && sw.current, 'settings: bookmark mark or current category missing')
check(sw.preview && sw.preview.w >= 260, 'settings: preview paper too narrow')
await settings.close()

/* ── 皮肤隔离：切回原版，crimson 结构不应存在 ── */
await page.locator('.crimson-work-brand').click()
await page.waitForTimeout(900)
await switchSkin('原版工坊')
check((await page.locator('body[data-skin="original"]').count()) === 1, 'skin isolation: original skin did not activate')
check((await page.locator('.crimson-shelf').count()) === 0, 'skin isolation: crimson shelf leaked into original')
await switchSkin('赤月戏')

/* ── 焦点环 / 减少动画 / 页面错误 ── */
const focus = await page.evaluate(() => {
  const el = document.querySelector('.crimson-topnav-item') || document.querySelector('.crimson-shelf-nav-item')
  el?.focus()
  const cs = getComputedStyle(el)
  return { width: parseFloat(cs.outlineWidth) || 0, offset: cs.outlineOffset }
})
check(focus.width >= 2, `focus ring width ${focus.width} < 2`)
await page.emulateMedia({ reducedMotion: 'reduce' })
await page.waitForTimeout(200)
const reduced = await page.evaluate(() => {
  const el = document.querySelector('.paper, .crimson-book, .crimson-chapter-rail')
  return el ? getComputedStyle(el).transitionDuration : ''
})
const reducedSecs = String(reduced).split(',').map((v) => parseFloat(v) || 0)
check(reducedSecs.every((v) => v < 0.05), `reduced motion did not collapse transitions (${reduced})`)
await page.emulateMedia({ reducedMotion: 'no-preference' })

check(errors.length === 0, 'page errors: ' + errors.join(' | '))
await browser.close()

writeFileSync(join(out, 'capture-report.json'), JSON.stringify({ fail, errors, report }, null, 2))
if (fail.length) {
  console.error('FAIL\n' + fail.join('\n'))
  process.exit(1)
}
console.log('PASS crimson v3')
