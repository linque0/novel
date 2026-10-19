import assert from 'node:assert/strict'
import { routeEdge, pointAtT, projectOnRoute, flattenRoute, shapePorts, trimEdgeD } from '../src/components/outline/canvas-model.js'
import { CanvasRouteCache } from '../src/components/outline/canvas-route-cache.js'

let count = 0
const test = (name, fn) => { fn(); console.log('PASS', name); count++ }
const near = (p, q, eps = .3) => Math.hypot(p.x-q.x, p.y-q.y) < eps
const A = {x:0,y:0,w:100,h:60}, B = {x:360,y:120,w:100,h:60}
const obstacle = {x:160,y:-20,w:100,h:210}
for (const style of ['ortho','bezier']) {
  for (const from of ['top','right','bottom','left']) for (const to of ['top','right','bottom','left']) {
    test(`${style} ${from}/${to} ports and visible projection`, () => {
      const a=shapePorts(A)[from], b=shapePorts(B)[to]
      const g=routeEdge(a,from,b,to,[A,B,obstacle],style)
      assert.equal(g.status,'ok')
      assert.ok(g.segments.length)
      assert.ok(near(pointAtT(g,0),a) && near(pointAtT(g,1),b))
      for(let t=0;t<=1;t+=.027) {
        const p=pointAtT(g,t), proj=projectOnRoute(p,g)
        assert.ok(proj.dist < .3, `off visible path ${proj.dist}`)
        assert.ok(near(pointAtT(g,proj.t),proj.point))
        for(const o of [A,B,obstacle]) assert.ok(!(p.x>o.x+.3&&p.x<o.x+o.w-.3&&p.y>o.y+.3&&p.y<o.y+o.h-.3),'body crossing')
      }
      assert.ok(g.startDir.x * ({right:1,left:-1}[from]||0) + g.startDir.y * ({bottom:1,top:-1}[from]||0)>0)
      assert.ok(g.endDir.x * ({left:1,right:-1}[to]||0) + g.endDir.y * ({top:1,bottom:-1}[to]||0)>0)
      if(style==='bezier') assert.ok(g.segments.some(s=>s.type==='C'),'smooth avoided curve')
    })
  }
  test(`${style} short gap does not reverse`,()=>{
    const g=routeEdge({x:100,y:30},'right',{x:108,y:30},'left',[A,{x:108,y:0,w:100,h:60}],style)
    assert.equal(g.status,'ok'); assert.ok(g.length<9)
  })
  test(`${style} obstructed manual preference moves to free corridor`,()=>{
    const g=routeEdge({x:100,y:30},'right',{x:360,y:150},'left',[A,B,obstacle],style,18,16,{waypoints:[{x:200,y:80}]})
    assert.equal(g.status,'ok'); assert.ok(g.resolvedWaypoints.length===1)
    const p=g.resolvedWaypoints[0]; assert.ok(!(p.x>160&&p.x<260&&p.y>-20&&p.y<190))
  })
  test(`${style} unreachable endpoint is marked blocked`,()=>{
    const g=routeEdge({x:100,y:30},'right',{x:360,y:150},'left',[A,B,{x:90,y:10,w:40,h:40}],style)
    assert.equal(g.status,'blocked'); assert.ok(g.d)
  })
}
test('diagonal intersection is exact, thin obstacles caught adaptively',()=>{
  const base=routeEdge({x:0,y:0},'right',{x:400,y:150},'left',[],'bezier')
  const p=pointAtT(base,.137), o={x:p.x-1,y:p.y-1,w:2,h:2}
  const g=routeEdge(base.a,'right',base.b,'left',[o],'bezier')
  assert.equal(g.status,'ok'); assert.equal(g.avoided,true)
})
test('rounded corner and trim share exact segments',()=>{
  const g=routeEdge({x:0,y:0},'right',{x:200,y:200},'left',[],'ortho')
  const ps=flattenRoute(g); assert.ok(ps.length>g.pts.length)
  assert.ok(trimEdgeD(g,9,9).includes('Q'))
  for(const p of ps) assert.ok(projectOnRoute(p,g).dist<.3)
})
test('parallelogram ports follow actual slanted border',()=>{
  const p=shapePorts({x:10,y:20,w:200,h:80},'para')
  assert.ok(Math.abs(p.left.x-23.6)<1e-9); assert.ok(Math.abs(p.right.x-196.4)<1e-9)
})
test('previous route preference remains stable',()=>{
  const g=routeEdge({x:100,y:30},'right',{x:360,y:150},'left',[A,B,obstacle],'ortho')
  const h=routeEdge(g.a,'right',{x:361,y:150},'left',[A,{...B,x:361},obstacle],'ortho',18,16,{previous:g})
  assert.equal(h.status,'ok'); assert.equal(Math.sign(Math.min(...g.pts.map(p=>p.y))),Math.sign(Math.min(...h.pts.map(p=>p.y))))
})
for(const shape of ['diamond','para']) for(const side of ['left','right','top','bottom']) test(`${shape} ${side} boundary`,()=>{
 const body={...A,shape},a=shapePorts(A,shape)[side]
 const g=routeEdge(a,side,{x:360,y:150},'left',[body,B],'ortho')
 assert.equal(g.status,'ok')
})
test('negative coordinates, narrow corridor and reversed legacy parameters',()=>{
 const obs=[{x:-260,y:-180,w:120,h:100},{x:-260,y:-60,w:120,h:100}]
 const g=routeEdge({x:-400,y:-70},'right',{x:20,y:-70},'left',obs,'ortho')
 assert.equal(g.status,'ok')
 g.parameterReversed=true
 for(let t=0;t<1;t+=.05) assert.ok(near(projectOnRoute(pointAtT(g,t),g).point,pointAtT(g,t)))
})
test('moving endpoints with a previous route keeps all segments orthogonal',()=>{
 let previous
 for(let i=0;i<20;i++) {
  const g=routeEdge({x:100+i,y:30+i*2},'right',{x:360-i,y:150-i*3},'top',[],'ortho',18,16,{previous})
  assert.equal(g.status,'ok')
  assert.ok(g.pts.slice(1).every((p,i)=>Math.abs(p.x-g.pts[i].x)<.01||Math.abs(p.y-g.pts[i].y)<.01))
  previous=g
 }
})
test('shared port branches use an available parallel lane',()=>{
 const host=routeEdge({x:0,y:0},'right',{x:300,y:0},'left',[],'ortho')
 const branch=routeEdge({x:80,y:0},'right',{x:350,y:160},'top',[],'ortho',18,16,{occupiedSegments:[{a:host.a,b:host.b}]})
 assert.equal(branch.status,'ok')
 const overlapping=branch.pts.slice(1).reduce((n,p,i)=>n+(Math.abs(p.y)<.01&&Math.abs(branch.pts[i].y)<.01?Math.abs(p.x-branch.pts[i].x):0),0)
 assert.ok(overlapping<=24,`shared span ${overlapping}`)
})
test('dragging a segment into its source body shifts the whole segment to a free channel',()=>{
 const obs=[{x:70,y:150,w:180,h:90},{x:480,y:150,w:180,h:90},{x:320,y:120,w:110,h:140}]
 const waypoints=[{x:238,y:195},{x:238,y:276},{x:462,y:276},{x:462,y:195}]
 const g=routeEdge({x:250,y:195},'right',{x:480,y:195},'left',obs,'ortho',18,16,{waypoints})
 assert.equal(g.status,'ok');assert.equal(g.resolvedWaypoints[0].x,g.resolvedWaypoints[1].x)
})
test('cache invalidates only changed endpoint, intersecting obstacle or host geometry',()=>{
 const cache=new CanvasRouteCache(),obs=[{id:'far',x:1000,y:1000,w:30,h:30}]
 let builds=0
 const build=()=>{builds++;return routeEdge({x:0,y:0},'right',{x:300,y:0},'left',[],'ortho')}
 cache.get('edge','ports-v1',obs,build)
 cache.get('edge','ports-v1',[{...obs[0],x:1100}],build);assert.equal(builds,1)
 cache.get('edge','ports-v1',[{...obs[0],x:150,y:-10}],build);assert.equal(builds,2)
 cache.get('edge','host-or-ports-v2',obs,build);assert.equal(builds,3)
 cache.get('edge','host-or-ports-v2',obs,build);assert.equal(builds,3)
})
test('legacy custom preference is read without mutating the saved relation',()=>{
 const custom={x:200,y:-100},saved=JSON.stringify(custom)
 const g=routeEdge({x:100,y:30},'right',{x:360,y:150},'left',[A,B,obstacle],'bezier',18,16,{custom})
 assert.equal(g.status,'ok');assert.equal(JSON.stringify(custom),saved)
 assert.deepEqual(g.resolvedWaypoints,[custom])
})
test('curved branches separate from the visible host corridor after the shared stub',()=>{
 const g=routeEdge({x:80,y:0},'right',{x:350,y:160},'top',[],'bezier',18,16,{occupiedSegments:[{a:{x:0,y:0},b:{x:300,y:0}}]})
 const samples=flattenRoute(g)
 const shared=samples.slice(1).reduce((n,p,i)=>n+(Math.abs(p.y)<6&&Math.abs(samples[i].y)<6&&p.x<300?Math.abs(p.x-samples[i].x):0),0)
 assert.ok(shared<48,`near-overlapping visible span ${shared}`)
})
console.log(`${count}/${count} routing tests passed`)
