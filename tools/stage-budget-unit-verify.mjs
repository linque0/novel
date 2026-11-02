import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { freezeProviderConfig } from '../src/services/ai/stage-config.js'

const stubs={
  './provider':'export const chatStream=async()=>{const t=globalThis.__stageBudget;t.calls++;t.ctl.abort();if(t.reject)throw Error("cancelled");return {usage:{total_tokens:42},text:"late",toolCalls:[]}}',
  './tools':'export const TOOL_REGISTRY={};export const executeTool=async()=>({})',
  './presets':'export const estimate=x=>String(x||"").length;export const copy=structuredClone;export const fitBlocks=blocks=>({messages:[],tokens:{used:10},dropped:[]})',
  './contracts':'export const checkAbort=s=>{if(s?.aborted)throw Error("aborted")};export const chapterHash=JSON.stringify;export const entityHash=JSON.stringify;export const resolveEvidence=()=>null;export const namesOf=()=>[]',
  './task-profiles.js':'export const taskProfile=()=>({});export const assertTaskTool=()=>{}',
  './task-proposals.js':'export const TASK_OUTPUT_TOOLS=[];export const taskEvidence=()=>[];export const workflowProposal=()=>({})',
  './writing-directions.js':'export const directionProposal=()=>({})',
  './creative-proposals.js':'export const creativeProposal=()=>({})',
}
const compiled=await build({entryPoints:['src/services/ai/dialogue.js'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'stage-io',setup(b){b.onResolve({filter:/.*/},args=>Object.hasOwn(stubs,args.path)?{path:args.path,namespace:'stage'}:null);b.onLoad({filter:/.*/,namespace:'stage'},args=>({contents:stubs[args.path]}))}}]})
const {runDialogue}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'))
for(const reject of [true,false]){
  const ctl=new AbortController(),usage=[];globalThis.__stageBudget={ctl,reject,calls:0}
  await assert.rejects(runDialogue({compiled:{tools:false,opts:{maxTokens:100},blocks:[]},frozen:{},opts:{signal:ctl.signal,rootRemaining:1000},onUsage:u=>usage.push(u)}),/aborted/)
  assert.equal(globalThis.__stageBudget.calls,1);assert.equal(usage.length,1);assert.equal(usage[0].total_tokens,reject?110:42)
}
const ctl=new AbortController();ctl.abort();globalThis.__stageBudget={ctl,calls:0};let usage=0
await assert.rejects(runDialogue({compiled:{tools:false,opts:{maxTokens:100},blocks:[]},frozen:{},opts:{signal:ctl.signal,rootRemaining:1000},onUsage:()=>usage++}),/aborted/)
assert.equal(globalThis.__stageBudget.calls,0);assert.equal(usage,0)

// Exercise the actual store method without booting Pinia, windows or persistence.
const storeSource=await readFile('src/stores/ai.js','utf8'),start=storeSource.indexOf('async buildOpts(stage = {})'),end=storeSource.indexOf('    generationOpts(',start)
const buildOpts=new Function('window','AiProviderError','AI_ERROR_CODES','freezeProviderConfig','return ({'+storeSource.slice(start,end)+'}).buildOpts')({native:{credentialDecrypt(){}}},Error,{NOT_CONFIGURED:'not-configured'},freezeProviderConfig)
const provider={id:'p',enabled:true,baseURL:'https://endpoint/v1',apiFormat:'openai',activeModel:'m',models:[{name:'m',enabled:true}],params:{},modelCfg:{}}
const stage={providerId:'p',model:'m',...freezeProviderConfig(provider,'m')};let decrypts=0
const store={providers:[provider],activeProvider:provider,generationOpts:()=>({model:'m'}),decryptCredential:async()=>{decrypts++;return 'private'}}
provider.baseURL='https://changed/v1';await assert.rejects(buildOpts.call(store,stage),/配置已变化/);assert.equal(decrypts,0)
provider.baseURL='https://endpoint/v1';const opts=await buildOpts.call(store,stage);assert.equal(opts.baseURL,provider.baseURL);assert.equal(opts.apiKey,'private')
store.decryptCredential=async()=>{provider.apiFormat='anthropic';return 'private'};await assert.rejects(buildOpts.call(store,stage),/配置已变化/)
console.log('PASS dispatched cancellation accounting, preflight cancellation and actual store endpoint/config drift rejection')
