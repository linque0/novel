import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdirSync,writeFileSync,copyFileSync} from 'node:fs'
import {connect} from './_cdp-lib.mjs'
import {connectInspector,captureWindow,evalMain} from './_capture-main.mjs'
import {assertAiTestProfile} from './_ai-test-profile.mjs'
import {buildSeedExpr} from './verify-seeds.mjs'
const rows=[
  {id:'a',title:'拒绝交易，暗中追踪',development:'林昭收起铜镜，拒绝来客的交换条件。他借巡逻经过的动静离开钟楼，随后沿着泥地上的脚印追向渡口。'},
  {id:'b',title:'以假线索换取信任',development:'林昭交出一份真假掺半的星图，试探来客是否认得缺失的符号。对方一句脱口而出的话，让他发现真正的目标另有其人。'},
  {id:'c',title:'巡逻打断，暂时联手',development:'钟声忽然响起，两人都成了巡逻队的目标。林昭必须与来客暂时合作，在天亮之前逃出封锁的城区。'},
  {id:'d',title:'退回旧案，寻找破绽',development:'林昭没有立即追问，而是回到档案室重查那场火灾。他在一份被划掉的名单中看见了来客的姓氏。'},
  {id:'e',title:'让铜镜先给出答案',development:'林昭决定冒险转动铜镜背面的机关。映出的并非星图，而是今晚尚未发生的一场告别。'},
]
const prose='林昭没有伸手。\n\n他把铜镜往袖中收了半寸，直到冰凉的镜沿抵住腕骨。来客的目光跟着那点铜光移动，又很快停在他的脸上。\n\n“你还没告诉我，为什么一定要在天亮以前。”\n\n楼下传来巡逻队整齐的脚步声。来客侧过头，就是这短短一瞬，林昭看清了他领口那道熟悉的烧痕。'
const server=createServer(async(req,res)=>{res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}let raw='';for await(const ch of req)raw+=ch;const body=JSON.parse(raw),direction=body.tools.some(t=>t.function.name==='submit_plot_directions'),args=direction?{data:{directions:rows}}:{text:prose,title:'钟楼下的试探',summary:'保持当前视角，延续林昭与来客之间的试探。',evidence:[],warnings:[],review:'候选创作文本，采纳前可继续调整。'},json=JSON.stringify(args);res.writeHead(200,{'Content-Type':'text/event-stream'});let n=0;const timer=setInterval(()=>{if(res.destroyed){clearInterval(timer);return}if(n<json.length){const delta={tool_calls:[{index:0,...(n===0?{id:'local-art-review',type:'function'}:{}),function:{...(n===0?{name:direction?'submit_plot_directions':'submit_chapter'}:{}),arguments:json.slice(n,n+32)}}]};res.write('data: '+JSON.stringify({choices:[{delta,finish_reason:null}]})+'\n\n');n+=32}else{res.end('data: '+JSON.stringify({choices:[{delta:{},finish_reason:'tool_calls'}]})+'\n\ndata: [DONE]\n\n');clearInterval(timer)}},25)})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
process.env.AI_TEST_PROFILE='booksource-verify'
const c=await connect('app://',9333),ins=await connectInspector(),dir='docs/agent-chat-ui-20261024'
assertAiTestProfile(await c.evalx('window.native.getDataLocation()'))
mkdirSync(dir,{recursive:true})
for(const skin of ['original','gravity','glaze','crimson'])copyFileSync(`docs/writing-workflow-20261024/${skin}-directions.png`,`${dir}/${skin}-before.png`)
const seed=await c.evalx(buildSeedExpr('AI 验证书',{reset:true}));assert(seed?.ok)
await c.evalx(`window.__artSetup=(async()=>{const {useAiStore}=await import('/src/stores/ai.js'),{useWritingStore}=await import('/src/stores/writing.js'),{useUiStore}=await import('/src/stores/ui.js'),{useAssistantTaskStore}=await import('/src/stores/assistant-task.js');const a=useAiStore(),w=window.__ns.getWork(),ui=useUiStore(),writing=useWritingStore(),task=useAssistantTaskStore();await ui.setSkin('original');await w.open(${JSON.stringify(seed.books[0].workId)});await a.loadSettings();await a.loadPresets();window.__art={a,w,ui,writing,task,restore:{providers:a.providers,activeProviderId:a.activeProviderId,credentials:a.credentials}};a.providers=[{id:'art-fixture',name:'本地验证',enabled:true,baseURL:'http://127.0.0.1:${server.address().port}/v1',apiFormat:'openai',activeModel:'创作模型',models:[{name:'创作模型',enabled:true}],params:{maxContext:64000,temperature:.7,privacy:false,kb:{auto:false}},modelCfg:{}}];a.activeProviderId='art-fixture';a.credentials={'art-fixture':await window.native.credentialEncrypt('local-art-only')};a.loaded=true;window.__ns.editor.commands.setTextSelection(window.__ns.editor.state.doc.content.size-1);await task.open('chapters');await writing.open({fresh:true,mode:'append'});writing.active.requirement='让林昭保持警惕，通过行动和对话推进冲突，先给出几种不同走向。';task.openParameters=false;await writing.startDirections();const s=writing.active;writing.selectDirection(s.directions[0].id);writing.editDirection(s.selectedId,{development:s.directions[0].draft.development+' 保留两人之间尚未揭开的旧怨。'});await writing.flush();return s.phase==='choose'||{error:s.error}})();window.__artSetup`)
assert.equal(await c.evalx("window.__art.writing.active.phase==='choose'"),true)
await c.send('Emulation.clearDeviceMetricsOverride',{})
await evalMain(ins,"(()=>{const {BrowserWindow}=require('electron');const w=BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('panel='));w.setContentSize(1440,900);return true})()")
await captureWindow(ins,'127.0.0.1:5173/',`${dir}/first-full.png`,{exclude:'panel='})
const metrics=[]
async function shot(name){await c.evalx('document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))');await c.sleep(500);const rect=await c.evalx("document.querySelector('.ai-dock').getBoundingClientRect().toJSON()");const clip=Object.fromEntries(['x','y','width','height'].map(k=>[k,Math.round(rect[k])]));const r=await evalMain(ins,`(async()=>{const {BrowserWindow}=require('electron');const w=BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('panel='));w.webContents.invalidate();await new Promise(r=>setTimeout(r,100));return (await w.webContents.capturePage(${JSON.stringify(clip)})).toPNG().toString('base64')})()`);assert(r,name);writeFileSync(`${dir}/${name}.png`,Buffer.from(r,'base64'))}
for(const skin of ['original','gravity','glaze','crimson']){
  await c.evalx(`window.__art.ui.setSkin('${skin}')`);await c.sleep(180)
  for(const width of [300,400,640]){
    await c.evalx(`window.__art.task.openParameters=false;window.__art.ui.setPref('aiDrawerWidth',${width})`);await c.sleep(400)
    const stable=await c.evalx(`window.__artLayout=(async()=>{const e=window.__ns.editor,selection={from:e.state.selection.from,to:e.state.selection.to},measure=()=>{const r=e.view.dom.getBoundingClientRect(),toolbar=document.querySelector('.ed-toolbar'),scroll=document.querySelector('.ed-scroll');return [r.width,toolbar?.getBoundingClientRect().height||0,scroll?.scrollTop||0]};const before=measure();window.__art.ui.aiDrawerOpen=false;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const closed=measure();window.__art.ui.aiDrawerOpen=true;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const after=measure();return e===window.__ns.editor&&e.view.dom.isConnected&&e.state.selection.from===selection.from&&e.state.selection.to===selection.to&&before.every((v,i)=>Math.abs(v-closed[i])<=1&&Math.abs(v-after[i])<=1)})();window.__artLayout`)
    assert.equal(stable,true,skin+' '+width+' editor layout, selection and instance must survive hiding AI')
    const r=await c.evalx(`(()=>{const p=document.querySelector('.agent-panel'),composer=document.querySelector('.agent-composer'),dock=document.querySelector('.ai-dock'),host=document.querySelector('.agent-conversation'),e=window.__ns.editor;host.scrollTop=0;host.dispatchEvent(new Event('scroll'));return {width:dock.getBoundingClientRect().width,over:composer.scrollWidth-composer.clientWidth,within:composer.getBoundingClientRect().right<=dock.getBoundingClientRect().right,connected:e.view.dom.isConnected,font:getComputedStyle(document.querySelector('.agent-prompt textarea')).fontSize,ink:getComputedStyle(p).color,bg:getComputedStyle(p).backgroundColor}})()`)
    assert(Math.abs(r.width-width)<=1&&r.within&&r.over<=1&&r.connected&&r.font==='14px',JSON.stringify({skin,width,r}));metrics.push({skin,width,...r});await shot(`${skin}-chat-${width}`)
    if(width===400){await c.evalx('window.__art.task.openParameters=true');await c.sleep(150);await shot(`${skin}-functions`);await c.evalx('window.__art.task.openParameters=false')}
    console.log(`PASS ${skin} ${width}px`)
  }
}
await c.evalx("window.__art.ui.setPref('aiDrawerWidth',400)")
await c.evalx('window.__art.pending=window.__art.writing.startDraft();true')
for(let i=0;i<50&&!await c.evalx('window.__art.a.busy');i++)await c.sleep(20)
await shot('generating')
await c.evalx('window.__art.pending.then(()=>true)')
assert.equal(await c.evalx('window.__art.writing.active.candidates.length'),1)
for(const skin of ['original','gravity','glaze','crimson']){
  await c.evalx(`window.__art.ui.setSkin('${skin}')`);await c.sleep(150)
  await c.evalx("document.querySelector('.writing-candidates')?.scrollIntoView({block:'start'})");await shot(`${skin}-draft`)
  await c.evalx("[...document.querySelectorAll('.writing-candidates button')].find(b=>b.textContent.includes('接入预览'))?.click()");await c.sleep(80);await shot(`${skin}-preview`)
  await c.evalx("[...document.querySelectorAll('.writing-candidates button')].find(b=>b.textContent.includes('关闭预览'))?.click()")
}
await c.evalx('(async()=>{await window.__art.writing.flush();Object.assign(window.__art.a,window.__art.restore);return true})()')
await c.send('Emulation.clearDeviceMetricsOverride',{});ins.ws.close();await new Promise(r=>server.close(r));writeFileSync(`${dir}/layout-results.json`,JSON.stringify(metrics,null,2));console.log('12/12 layout cases and four-skin conversation/menu/draft/preview captured');process.exit(0)
