// Explicit real-service evaluation. Never falls back to a local transport fixture.
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { connect } from './_cdp-lib.mjs'
import { assertAiTestProfile } from './_ai-test-profile.mjs'
import { buildSeedExpr } from './verify-seeds.mjs'
import { CREATIVE_QUALITY_CASES } from './creative-quality-fixtures.mjs'
process.env.AI_TEST_PROFILE='booksource-verify'
const report={kind:'real-model-quality',status:'incomplete',modelRequired:'deepseek/deepseek-v4.1-flash',results:[],limitations:['文学质量、误报率与修改量需作者复核；证据定位成功不代表语义正确。','未记录旧版真实输出，不能据此宣称优化幅度。']}
const c=await connect('app://',process.env.CDP_PORT||9333)
const evaluate=async expression=>{const r=await c.evalx(expression);if(r?.PAGE_ERR)throw new Error(r.PAGE_ERR);return r}
let restore
try{
  assertAiTestProfile(await evaluate('window.native.getDataLocation()'))
  const configuration=await evaluate(`(async()=>{const ai=(await import('/src/stores/ai.js')).useAiStore();await ai.loadSettings();return {ready:ai.ready,model:ai.model,remote:!!ai.activeProvider&&!['localhost','127.0.0.1','::1'].includes(new URL(ai.activeProvider.baseURL).hostname)}})()`)
  report.configuration=configuration
  if(!process.argv.includes('--real'))throw new Error('真实评测须显式传入 --real；本工具不会使用固定响应替代')
  if(!configuration.ready)throw new Error('隔离验证 profile 未配置可用模型凭据（ready=false）')
  if(!configuration.remote||!['deepseek/deepseek-v4.1-flash','deepseek-v4.1-flash'].includes(configuration.model))throw new Error('当前配置不是要求的远程 DeepSeek 模型，真实评测未执行')
  const seed=await evaluate(buildSeedExpr('AI 验证书',{reset:true}));assert(seed.ok)
  restore=await evaluate(`(async()=>{const db=window.__ns.db,w=window.__ns.getWork();await w.open(${JSON.stringify(seed.books[0].workId)});const stage=await db.appconfig.get('ai.stageConfig');await db.appconfig.delete('ai.stageConfig');return stage||null})()`)
  for(const fixture of CREATIVE_QUALITY_CASES){
    const started=Date.now()
    const result=await evaluate(`(async()=>{
      const db=window.__ns.db,w=window.__ns.getWork(),f=${JSON.stringify(fixture)},ai=(await import('/src/stores/ai.js')).useAiStore();
      const chapters=[...w.chapters].sort((a,b)=>a.sortOrder-b.sortOrder);chapters[0].content=f.fact;chapters[0].fmt='text';chapters[1].content='';chapters[1].fmt='text';
      const lore=w.mubu[0];lore.text=f.rule;const save=(await import('/src/services/autosave.js')).autosave;save.mark('chapters',chapters[0]);save.mark('chapters',chapters[1]);save.mark('mubu',lore);await save.flushAll();
      let message;const before=JSON.stringify(ai.usage.session),ok=await ai.send('独立核查候选，问题须提供可定位依据；没有客观缺陷时不要虚报。',{taskRequest:{type:'chapter.review',workId:w.work.id,chapterId:chapters[1].id,draftSource:{id:'quality-'+f.id,revision:0,text:f.draft}},onMessage:m=>message=m});
      return {ok,model:message?.stageSnapshot?.model,error:ai.error?.message,review:message?.cards?.find(c=>c.kind==='chapter-review')?.review,materials:message?.context?.materials,usage:ai.usage.session,usageBefore:JSON.parse(before)}
    })()`)
    report.results.push({id:fixture.id,expectation:fixture.expectation,elapsedMs:Date.now()-started,...result})
    console.log((result.ok?'COMPLETED ':'INCOMPLETE ')+fixture.id)
  }
  report.status=report.results.every(r=>r.ok)?'generated-awaiting-author-evaluation':'incomplete'
}catch(e){report.reason=e.message;console.log('真实模型评测未完成：'+e.message)}
finally{
  if(restore!==undefined)await evaluate(`(async()=>{const db=window.__ns.db;const row=${JSON.stringify(restore)};if(row)await db.appconfig.put(row);else await db.appconfig.delete('ai.stageConfig');return true})()`).catch(()=>{})
  writeFileSync('tools/_creative-quality-results.json',JSON.stringify(report,null,2))
  process.exit(report.status==='incomplete'?2:0)
}
