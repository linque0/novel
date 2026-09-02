/* 拼接：把 11k/11l 段插入 olcanvas-verify.mjs 的 const fail 之前 */
import { readFileSync, writeFileSync } from 'node:fs'

const p = 'tools/olcanvas-verify.mjs'
let s = readFileSync(p, 'utf8')
const seg = readFileSync('tools/_section3.txt', 'utf8')
const anchor = 'const fail = results.filter((x) => !x).length'
const idx = s.indexOf(anchor)
if (idx < 0) {
  console.log('ANCHOR FAIL')
  process.exit(1)
}
s = s.slice(0, idx) + seg + s.slice(idx)
writeFileSync(p, s)
console.log('inserted ok')
