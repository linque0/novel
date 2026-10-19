import assert from 'node:assert/strict'
import fs from 'node:fs'
import {EVENT_SHAPES,eventSurface,eventPort} from './event-shapes.js'
let count=0
for(const [shape,s] of Object.entries(EVENT_SHAPES)) {
  assert.ok(fs.existsSync(new URL(s.image,import.meta.url)),shape+' image exists')
  const svg=eventSurface('preview-'+shape,shape)
  assert.ok(svg.includes('clip-path="url(#event-clip-preview-'+shape+')"'))
  assert.ok(svg.includes(s.path));count++
  const n={kind:'event',shape,x:-100,y:40,w:200,h:120}
  for(const side of ['top','bottom','left','right']) {
    const p=eventPort(n,side),u=(p.x-n.x)/n.w,v=(p.y-n.y)/n.h
    if(side==='left'||side==='right') {assert.equal(v,.5);assert.ok(Math.abs(u-(side==='left'?(shape==='para'?.065:.01):(shape==='para'?.935:.99)))<1e-9)}
    else {assert.equal(u,.5);assert.ok(Math.abs(v-(side==='top'?.01:.99))<1e-9)}
    count++
  }
}
console.log(`${count}/${count} event material and boundary checks passed`)
