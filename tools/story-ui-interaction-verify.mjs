import assert from 'node:assert/strict'
import {writeFileSync} from 'node:fs'
import {connect} from './_cdp-lib.mjs'
import {assertAiTestProfile} from './_ai-test-profile.mjs'
process.env.AI_TEST_PROFILE='booksource-verify'
const c=await connect('http://',process.env.CDP_PORT||9333),results=[]
async function evaluate(code){const v=await c.evalx(code);if(v?.PAGE_ERR)throw Error(v.PAGE_ERR);return v}
async function wait(code){const end=Date.now()+15000;while(Date.now()<end){if(await evaluate(code))return;await c.sleep(80)}throw Error('Timed out: '+code)}
async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);const box=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...box});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...box})}
async function test(name,fn){await fn();results.push({name,ok:true});console.log('PASS '+name)}
try{
 assertAiTestProfile(await evaluate('window.native.getDataLocation()'))
 await evaluate(`(async()=>{const ui=(await import('/src/stores/ui.js')).useUiStore();ui.workbenchMode='agent';window.__interactionStory=(await import('/src/stores/story.js')).useStoryStore();return true})()`)
 await wait('document.querySelector(".story-scene")?.getClientRects().length>0')
 await test('1440 and 1080 desktop layouts keep the primary action in view without horizontal overflow',async()=>{
   for(const width of [1440,1080]){await c.send('Emulation.setDeviceMetricsOverride',{width,height:width===1440?900:760,deviceScaleFactor:1,mobile:false});await c.sleep(80);const box=await evaluate('(()=>{const b=document.querySelector(".story-input-shell .story-primary").getBoundingClientRect();return {ok:b.width>0&&b.right<=innerWidth+1&&b.bottom<=innerHeight+1&&b.top>=0,overflow:document.documentElement.scrollWidth>innerWidth}})()');assert.equal(box.ok,true);assert.equal(box.overflow,false)}
 })
 await test('Chinese composition Ctrl+Enter does not submit; completed Ctrl+Enter submits once',async()=>{
   await evaluate(`(()=>{const s=window.__interactionStory;window.__interactionAdvance=s.advance;window.__interactionCalls=0;s.advance=async()=>{window.__interactionCalls++};document.querySelector('.story-input-shell textarea').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,isComposing:true,bubbles:true}));return true})()`)
   assert.equal(await evaluate('window.__interactionCalls'),0)
   await evaluate(`document.querySelector('.story-input-shell textarea').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,isComposing:false,bubbles:true}))`)
   await wait('window.__interactionCalls===1');await c.sleep(50)
   await evaluate('window.__interactionStory.advance=window.__interactionAdvance;true')
 })
 await test('inspector opening interpolates in rendered frames and reduced motion disables transitions',async()=>{
   await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]})
   await c.send('Runtime.evaluate',{expression:`window.__storyMotion=new Promise(resolve=>{const samples=[];let frames=0;function sample(){const el=document.querySelector('.story-inspector');if(el){const s=getComputedStyle(el);samples.push({opacity:Number(s.opacity),transform:s.transform})}if(++frames<35)requestAnimationFrame(sample);else resolve(samples)}requestAnimationFrame(sample)});true`,returnByValue:true})
   await click('.story-config-toggle');const samples=await evaluate('window.__storyMotion')
   assert(samples.some(s=>s.opacity>0&&s.opacity<1),'opening must interpolate rather than jump between screenshots')
   await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
   assert.equal(await evaluate('getComputedStyle(document.querySelector(".story-inspector")).transitionDuration'),'0s')
   await click('.story-inspector>header>button')
 })
 const model=await evaluate(`(async()=>{const ai=(await import('/src/stores/ai.js')).useAiStore();return {selectedModel:ai.model,requiredModel:'deepseek/deepseek-v4.1-flash',eligible:ai.model==='deepseek/deepseek-v4.1-flash',status:'not-run',reason:'This read-only configuration probe performs no model-quality request.'}})()`)
 writeFileSync('docs/恍然梦AI工作台/story-ui-20261028/real-model-status.json',JSON.stringify(model,null,2))
}catch(e){results.push({ok:false,error:e.message});console.error(e.stack)}finally{
 await evaluate('if(window.__interactionAdvance&&window.__interactionStory)window.__interactionStory.advance=window.__interactionAdvance;true').catch(()=>{})
 writeFileSync('docs/恍然梦AI工作台/story-ui-20261028/interaction-verification.json',JSON.stringify({kind:'rendered-ui-and-input',results},null,2));process.exit(results.every(r=>r.ok)?0:1)
}
