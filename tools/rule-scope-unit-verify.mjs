import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('src/components/ai/RuleScopeSettings.vue','utf8'),start=source.indexOf('async function save(row)'),end=source.indexOf('\n</script>',start)
const make=new Function('work','form','messages','chapters','outlines','targets','saving','autosave','emit','isPopped',`return (${source.slice(start,end).trim()})`)
for(const locked of [true,false]){
  const row={id:'l',text:'规则正文不得被替换'},work={work:{id:'w'},mubu:[row]},messages={},calls=[]
  const save=make(work,()=>({scope:'global',confirmed:true,keywords:'',targetIds:[]}),messages,{value:[]},{value:[]},{value:[]},{value:null},{mark:(table,value)=>calls.push({table,text:value.text}),flushAll:async()=>{},hasPending:()=>false},()=>{},()=>locked)
  await save(row)
  assert.equal(row.text,'规则正文不得被替换')
  assert.equal(calls.length,locked?0:1,'other-window lore lock blocks the actual UI save function')
  assert.equal(!!row.rulePolicy,!locked)
}
console.log('PASS rule classification honors other-window lore lock before changing author rows')
