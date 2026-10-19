import {createApp,h,watch,ref,nextTick,onMounted} from 'vue'
import {createPinia} from 'pinia'
import {NConfigProvider,NMessageProvider,NDialogProvider,darkTheme} from 'naive-ui'
import Workbench from '/src/components/Workbench.vue'
import {useWorkStore} from '/src/stores/work.js'
import {useUiStore} from '/src/stores/ui.js'
import {useAiStore} from '/src/stores/ai.js'
import {autosave} from '/src/services/autosave.js'
import {seedStory} from '../outline-workbench-preview/story.js'
import '/src/styles/themes.css'
import '/src/styles/skins/gravity.css'
import '/src/styles/skins/gravity-workbench.css'
import '/src/styles/skins/glaze.css'
import '/src/styles/skins/crimson.css'
import '/src/styles/skins/crimson-workbench.css'
import '/src/styles/skins/crimson-v3.css'
import '/src/styles/outline-paper.css'
import '/src/styles/outline-workbench.css'
import '/src/assets/fonts/fonts.css'
import '/src/assets/fonts/fonts-user.css'
import './crimson-outline.css'
import {arrangeDraftLabels} from './label-layout.js'
// Design-only wrapper. Production components run with in-memory story data. No saved work is opened or edited.
const app=createApp({setup(){
 const work=useWorkStore(),ui=useUiStore(),ai=useAiStore(),s=seedStory(),parents={},sideOpen=ref(false)
 for(const n of Object.values(s.nodes))for(const child of n.children||[])parents[child]=n.id==='book'?null:n.id
 autosave.mark=()=>{};work.saveCanvasPrefs=async()=>{};ui.setPref=async(k,v)=>{ui[k]=v};ui.setSkin=v=>{ui.skin=v};ai.loaded=true
 work.work={id:'outline-crimson-design-draft',title:s.nodes.book.title};work.tab='outline';work.outlineView='canvas';ui.view='work';ui.sideWidth=240;ui.aiDrawerOpen=false;ui.focusMode=false;ui.readMode=false
 work.olnodes=Object.values(s.nodes).filter(n=>n.id!=='book').map((n,i)=>({...n,workId:work.work.id,parentId:parents[n.id]||null,sortOrder:i*1000,text:n.body||n.summary||'',canvasX:n.x,canvasY:n.y,fold:n.kind==='container',rels:s.edges.filter(e=>e.from===n.id).map(e=>({...e,toId:e.to,arrows:e.arrow==='both'?'<->':e.arrow==='none'?'--':'->'})),deletedAt:null}))
 const pigments={'#6e8c79':'#697d6b','#a08455':'#ad8949','#a97868':'#a36550','#758b9b':'#76877e','#8d8196':'#8a7567'};for(const n of work.olnodes)if(n.kind==='container')n.color=pigments[n.color]||n.color
 work.chapters=work.olnodes.filter(n=>n.kind==='anchor').map(n=>({id:n.id,title:n.title,text:n.text,wordCount:2480,status:'draft'}))
 work.volumes=[{id:'volume',title:'第一卷 · 潮声',sortOrder:0}]
 work.snippets=work.olnodes.filter(n=>n.kind==='cite').map(n=>({id:n.id,title:n.title,text:n.text,content:n.title}))
 for(const n of work.olnodes){if(n.kind==='anchor'||n.kind==='volume')n.refId=n.id;if(n.kind==='cite')n.refId='snippet:'+n.id}
 work.selVolumeId='volume';work.canvasPrefs={snap:false,density:'detail',edgeStyle:'bezier',edgeWidth:1.8,arrowSize:1,textures:true,scopeId:null,expanded:[],cameras:{}}
 ui.skin='crimson';ui.theme='xuan';watch(()=>ui.skin,v=>document.body.dataset.skin=v,{immediate:true})
 const scheduleLabels=()=>nextTick(()=>requestAnimationFrame(arrangeDraftLabels));watch(()=>[work.canvasPrefs.scopeId,JSON.stringify(work.canvasPrefs.expanded),JSON.stringify(work.olnodes)],scheduleLabels,{flush:'post'});onMounted(scheduleLabels)
 return ()=>h(NConfigProvider,{theme:['gravity','crimson'].includes(ui.skin)?darkTheme:null},{default:()=>h(NMessageProvider,null,{default:()=>h(NDialogProvider,null,{default:()=>h('div',{class:['app-root theme-xuan crimson-outline-draft',{'draft-side-open':sideOpen.value}],'data-skin':ui.skin},[h(Workbench),h('button',{class:'draft-side-toggle',type:'button','aria-label':sideOpen.value?'关闭故事结构':'打开故事结构','aria-expanded':sideOpen.value,onClick:()=>sideOpen.value=!sideOpen.value},sideOpen.value?'关闭结构 ×':'故事结构 ☰'),sideOpen.value?h('button',{class:'draft-side-scrim',type:'button','aria-label':'关闭故事结构遮罩',onClick:()=>sideOpen.value=false}):null])})})})
}})
app.use(createPinia());app.mount('#app')
