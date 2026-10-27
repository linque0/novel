import assert from 'node:assert/strict'
import { wrapBookLines } from '../src/services/book3d/theme-layout.js'
const ctx={measureText:text=>({width:[...text].reduce((sum,c)=>sum+(/[A-Za-z0-9 ]/.test(c)?.5:1),0)})}
const title='一部名字很长的中文与 English 混排小说'
const rows=wrapBookLines(title,ctx,7)
assert.ok(rows.some(row=>row.includes('English')),'ordinary Latin words stay together in mixed-language titles')
assert.equal(rows.join('').replace(/\s/g,''),title.replace(/\s/g,''),'all title characters survive wrapping')
assert.ok(rows.every(row=>ctx.measureText(row).width<=7),'each line fits its measured width')
assert.deepEqual(wrapBookLines('白昼\n星河',ctx,7),['白昼','星河'],'explicit line breaks are respected')
assert.ok(wrapBookLines('ABCDEFGHIJKLMNOPQRST',ctx,3).every(row=>ctx.measureText(row).width<=3),'oversized individual tokens still fit')
console.log('PASS book-theme mixed-language typography contracts')
