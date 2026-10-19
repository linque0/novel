import { performance } from 'node:perf_hooks'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { routeEdge, shapePorts } from '../src/components/outline/canvas-model.js'
import { CanvasRouteCache } from '../src/components/outline/canvas-route-cache.js'
const nodes=Array.from({length:100},(_,i)=>({id:`n${i}`,x:(i%10)*280,y:Math.floor(i/10)*160,w:160,h:70}))
const edges=[]
for(let y=0;y<10;y++) for(let x=0;x<9;x++) edges.push({id:`e${edges.length}`,a:y*10+x,b:y*10+x+1,from:'right',to:'left'})
for(let y=0;y<6;y++) for(let x=0;x<10;x++) edges.push({id:`e${edges.length}`,a:y*10+x,b:(y+1)*10+x,from:'bottom',to:'top'})
const report=[]
for(const style of ['ortho','bezier']) {
 const cache=new CanvasRouteCache(),frames=[]
 const render=()=>{
  for(const e of edges) {
   const a=shapePorts(nodes[e.a])[e.from],b=shapePorts(nodes[e.b])[e.to]
   const signature=JSON.stringify([a,b,style])
   cache.get(e.id,signature,nodes,previous=>routeEdge(a,e.from,b,e.to,nodes,style,18,16,{previous}))
  }
 }
 const t=performance.now();render();const cold=performance.now()-t
 for(let frame=0;frame<140;frame++) {
  nodes[44].x=4*280+Math.sin(frame/20)*36;nodes[44].y=4*160+Math.cos(frame/25)*24
  const t=performance.now();render();frames.push(performance.now()-t)
 }
 frames.sort((a,b)=>a-b)
 const p95=frames[Math.floor(frames.length*.95)],result={style,nodes:nodes.length,edges:edges.length,coldMs:+cold.toFixed(2),p50Ms:+frames[70].toFixed(2),p95Ms:+p95.toFixed(2),cacheHits:cache.hits,recomputed:cache.misses}
 assert.equal(edges.length,150);assert.ok(p95<=32,`P95 ${p95} exceeds 32ms`)
 report.push(result);console.log(JSON.stringify(result))
}
fs.mkdirSync('docs/outline-routing-validation',{recursive:true})
fs.writeFileSync('docs/outline-routing-validation/benchmark.json',JSON.stringify({kind:'routing computation; browser frame timings recorded separately',results:report},null,2))
