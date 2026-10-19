import { createApp, h, ref, nextTick, watch } from 'vue'
import { createPinia } from 'pinia'
import { useWorkStore } from '/src/stores/work.js'
import { useUiStore } from '/src/stores/ui.js'
import { useAiStore } from '/src/stores/ai.js'
import { autosave } from '/src/services/autosave.js'
import { fixture, performanceFixture } from './fixture.js'
const params=new URLSearchParams(location.search)
const before=params.has('before')
await (before?import('/.superpowers/sdd/outline-routing/baseline/themes.css'):import('/src/styles/themes.css'))
await import('/src/styles/skins/gravity.css')
await import('/src/styles/skins/gravity-workbench.css')
await import('/src/styles/skins/glaze.css')
await import('/src/styles/skins/crimson.css')
await import('/src/styles/skins/crimson-workbench.css')
await import('/src/styles/skins/crimson-v3.css')
await import('/src/assets/fonts/fonts.css')
const Canvas=(await (before?import('/.superpowers/sdd/outline-routing/before-component.vue'):import('/src/components/OutlineCanvas.vue'))).default
const app=createApp({setup(){
  const work=useWorkStore(),ui=useUiStore(),ai=useAiStore()
  // This isolated acceptance harness uses the production component and store in memory.
  // It never opens a user work and deliberately disables persistence in this page only.
  autosave.mark=()=>{};work.saveCanvasPrefs=async()=>{};ai.loaded=true
  work.work={id:'routing-ui-sandbox',title:'连线路由验收'};work.olnodes=fixture();work.canvasPrefs={snap:false,density:'detail',edgeStyle:params.get('style')||'ortho',edgeWidth:1.8,arrowSize:1}
  ui.skin=params.get('skin')||'original';ui.theme='xuan'
  watch(()=>ui.skin,skin=>{document.body.dataset.skin=skin},{immediate:true})
  const result=ref(''),running=ref(false)
  const reset=()=>{work.olnodes=fixture();work.olUndo=[];work.olRedo=[];result.value=''}
  const benchmark=async()=>{
    if(running.value) return
    running.value=true;result.value='测试中…'
    work.olnodes=performanceFixture();work.olUndo=[];work.olRedo=[]
    await nextTick()
    const el=document.querySelector('[data-node-id="perf-44"]'),r=el.getBoundingClientRect()
    const x=r.x+r.width/2,y=r.y+r.height/2,frames=[],workTimes=[],positions=new Set()
    el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0,clientX:x,clientY:y}))
    let previous=await new Promise(requestAnimationFrame)
    for(let i=0;i<140;i++) {
      const time=await new Promise(requestAnimationFrame)
      if(i>10) frames.push(time-previous)
      previous=time
      const start=performance.now()
      window.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,buttons:1,clientX:x+Math.sin(i/18)*30,clientY:y+Math.cos(i/22)*20}))
      await nextTick();workTimes.push(performance.now()-start);positions.add(el.style.left+','+el.style.top)
    }
    window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0,clientX:x,clientY:y}))
    frames.sort((a,b)=>a-b);workTimes.sort((a,b)=>a-b)
    result.value=JSON.stringify({nodes:100,edges:150,style:work.canvasPrefs.edgeStyle,frames:frames.length,distinctPositions:positions.size,frameP95Ms:+frames[Math.floor(frames.length*.95)].toFixed(2),eventP95Ms:+workTimes[Math.floor(workTimes.length*.95)].toFixed(2)})
    running.value=false
  }
  return ()=>h('div',{class:'app-root theme-'+ui.theme,'data-skin':ui.skin,style:'height:100vh;display:flex;flex-direction:column'},[
    h('header',{style:'display:flex;align-items:center;gap:12px;padding:16px 24px;border-bottom:1px solid var(--border);font:13px sans-serif'},[
      h('strong',{style:'font-size:15px;flex:1'},before?'优化前 · 原始连线':'大纲画布 · 流程图连线'),
      h('span',{style:'opacity:.6'},'正式组件 · 临时数据 · 可直接拖动'),
      h('select',{'aria-label':'皮肤',value:ui.skin,onChange:e=>ui.skin=e.target.value},['original','gravity','glaze','crimson'].map((v,i)=>h('option',{value:v},['原版工坊','引力书舱','琉光画境','赤月戏'][i]))),
      h('button',{onClick:benchmark,disabled:running.value},'100 节点帧测试'),
      h('button',{onClick:reset},'重置场景')]),
    result.value?h('output',{style:'font:11px monospace;padding:4px 24px'},result.value):null,
    h('main',{'data-module':'outline',style:'flex:1;min-height:0;padding:20px;display:flex'},[h(Canvas)])
  ])
}})
app.use(createPinia());app.mount('#app')
