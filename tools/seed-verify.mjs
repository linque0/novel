/* 验证书补种 / 重置（对运行中的开发调试版实例）
 *
 * 用法：
 *   node tools/seed-verify.mjs                 # 只补种书架上缺失的验证书
 *   node tools/seed-verify.mjs --reset         # 删除重建全部验证书（含级联清子表）
 *   node tools/seed-verify.mjs --only 批注验证书 --reset
 *
 * 说明：npm run dev 启动时渲染层已自动种入（src/dev/verifyBooks.js），本脚本用于
 *   不重启应用的情况下补种 / 重置，以及核验注册表内容是否与书架一致。
 * 正式版（npm start / 安装包）不含验证书，本脚本对其执行会因找不到书而无副作用。
 */
import { connect } from './_cdp-lib.mjs'
import { VERIFY_BOOKS, buildSeedExpr } from './verify-seeds.mjs'

const args = process.argv.slice(2)
const reset = args.includes('--reset')
const onlyIdx = args.indexOf('--only')
const only = onlyIdx >= 0 ? args.slice(onlyIdx + 1).filter((a) => !a.startsWith('--')) : null

const known = new Map(VERIFY_BOOKS.map((b) => [b.title, b]))
const titles = only && only.length ? only : VERIFY_BOOKS.map((b) => b.title)
for (const t of titles) {
  if (!known.has(t)) {
    console.error('未注册的验证书：' + t + '\n先在 tools/verify-seeds.mjs 的 VERIFY_BOOKS 登记（title / owner / create）。')
    process.exit(1)
  }
}

const c = await connect('app://')
await c.sleep(1200)

const r = await c.evalx(buildSeedExpr(titles, { reset }))
if (!r || r.PAGE_ERR || !r.ok) {
  console.error('种入失败：' + JSON.stringify(r).slice(0, 400))
  process.exit(1)
}

// 书架即时可见（无需手动刷新 / 重载）；不在书架页（如停在 work 视图）时静默跳过
await c.evalx(
  `try { document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('shelf').refresh() } catch (e) {}`
)
await c.sleep(600)

const created = r.books.filter((b) => b.created)
const skipped = r.books.filter((b) => b.skipped)
for (const b of r.books) {
  const meta = known.get(b.title)
  console.log((b.created ? '已种入  ' : '已存在  ') + b.title.padEnd(10) + '  ← ' + meta.owner + (b.created ? '' : '（未重置）'))
}
console.log(`\n共 ${r.books.length} 本：新种入 ${created.length}，已存在 ${skipped.length}${reset ? '（--reset 已删除重建）' : ''}`)
console.log('书架可在开发调试版首页查看；验证书数据仅存在于 --profile=dev 数据库。')
process.exit(0) // CDP WebSocket 不会自动断开，须显式退出
