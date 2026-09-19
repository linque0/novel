/* 验证书整合验收（v1.0.20）：npm run dev 启动后书架必须包含 tools/verify-seeds.mjs 注册的全部验证书，
 * 且不含任何未注册的遗留测试书。运行前提：npm run dev（开发调试版已自动种入）。
 * 注意：需停留在书架页（应用内打开某作品时请先返回书架）。 */
import { connect } from './_cdp-lib.mjs'
import { VERIFY_BOOKS } from './verify-seeds.mjs'

const c = await connect('app://')
await c.sleep(1500)

// 不在书架页时先返回（顶栏「书架」按钮）
await c.evalx(`[...document.querySelectorAll('.topbar button')].find(b => b.textContent.includes('书架'))?.click()`)
await c.sleep(1200)

const shelf = await c.evalx(`(() => {
  const cards = [...document.querySelectorAll('.book-card')]
  return { count: cards.length, titles: cards.map((x) => x.querySelector('.book-title')?.textContent || x.textContent.trim()) }
})()`)
const registered = VERIFY_BOOKS.map((b) => b.title)
const missing = registered.filter((t) => !shelf.titles.includes(t))
// 未注册的「验证书」命名残留（演示书《星尘旅人》等非验证书不在此列）
const stray = shelf.titles.filter((t) => t.includes('验证书') || t.includes('验收测试') ? !registered.includes(t) : false)

console.log('书架作品数:', shelf.count, '（注册验证书 ' + registered.length + ' 本）')
for (const b of VERIFY_BOOKS) {
  const ok = shelf.titles.includes(b.title)
  console.log((ok ? 'PASS ' : 'FAIL ') + b.title + '  ← ' + b.owner)
}
if (stray.length) console.log('FAIL 未注册的验证书残留：' + stray.join('、') + '（应删除或在注册表登记）')
console.log('书架全部作品:', JSON.stringify(shelf.titles))

const pass = !missing.length && !stray.length
console.log(`\n${registered.length - missing.length}/${registered.length} 本在架` + (pass ? '，验证书整合通过' : '，验证书整合未通过'))
process.exit(pass ? 0 : 1)
