/* Start the isolated Electron profiles described in the acceptance notes first.
 * Runs only existing scoped checks; never builds/packages the app. */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const root=fileURLToPath(new URL('../',import.meta.url))
const logs=fileURLToPath(new URL('../docs/前端美化/琉光画境-验收/logs/',import.meta.url))
mkdirSync(logs,{recursive:true})
const checks=[['skin-unit','tools/skin-unit-verify.mjs'],['component-compile','tools/gravity-compile-verify.mjs'],['canvas-model','tools/canvas-model-test.mjs'],['gravity-outline','tools/gravity-outline-verify.mjs'],['gravity-workbench','tools/gravity-workbench-verify.mjs']]
for(let round=1;round<=3;round++){
  checks.push([`glaze-workbench-${round}`,'tools/glaze-workbench-verify.mjs'],[`glaze-shelf-${round}`,'tools/glaze-shelf-verify.mjs'])
}
const results=[]
for(const [name,script] of checks){
  const started=Date.now()
  const r=spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8',timeout:180000,windowsHide:true})
  const output=(r.stdout||'')+(r.stderr||'')
  writeFileSync(logs+name+'.txt',output,'utf8')
  const ok=r.status===0&&!r.error
  results.push({name,ok,status:r.status,checks:(r.stdout?.match(/^PASS /gm)||[]).length,elapsedMs:Date.now()-started})
  writeFileSync(logs+'results.json',JSON.stringify({generatedAt:new Date().toISOString(),results},null,2))
  console.log(`${ok?'PASS':'FAIL'} ${name}: ${results.at(-1).checks} checks (${Math.round((Date.now()-started)/1000)}s)`)
  if(!ok){console.error(output,r.error||'');process.exit(1)}
}
console.log('PASS all scoped checks and three consecutive glaze integration rounds')
