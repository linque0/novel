// Real Vue/Pinia/Dexie rendering in an isolated Electron profile, no model calls.
import { createServer } from 'vite'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const require = createRequire(import.meta.url)
const directory = mkdtempSync(join(tmpdir(), 'hm-skill-ui-'))
const html = `<div id="app"></div><script type="module">
import {createApp} from 'vue';import {createPinia} from 'pinia';
import StageSettings from '/src/components/ai/StageSettings.vue';
import {useAiStore} from '/src/stores/ai.js';import {db} from '/src/db/database.js';
const pinia=createPinia(),ai=useAiStore(pinia);ai.loaded=true;ai.providers=[];ai.presets=[];
await db.appconfig.put({key:'ai.stageConfig',value:{version:1,stages:{drafting:{skillId:'own',model:'kept-model'}},skills:[{id:'own',name:'作者规则',text:'保持作者自己的叙述方式。'}]}});
const app=createApp(StageSettings);app.use(pinia);app.mount('#app');window.__skillsFixture={db,app};
</script>`
let server
try {
  server = await createServer({configFile:fileURLToPath(new URL('../vite.config.mjs',import.meta.url)),server:{host:'127.0.0.1',port:5187,strictPort:true},plugins:[{
    name:'builtin-skill-verification-page',configureServer(vite) {vite.middlewares.use(async(req,res,next)=>{
      if(req.url !== '/__builtin-skills-verify')return next()
      try {res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml(req.url,html))} catch(e) {next(e)}
    })},
  }]})
  await server.listen()
  const runner = join(directory,'runner.cjs')
  const checksScript = `(async()=>{
const checks=[],ok=(name,value)=>{if(!value)throw Error(name);checks.push(name)};
ok('five stage rows',document.querySelectorAll('.stage-row').length===5);
[...document.querySelectorAll('button')].find(b=>b.textContent.includes('为未绑定阶段')).click();
for(let n=0;n<100&&!document.body.textContent.includes('已为未绑定阶段');n++)await new Promise(r=>setTimeout(r,50));
ok('recommendation saved',document.body.textContent.includes('已为未绑定阶段'));
const stored=(await window.__skillsFixture.db.appconfig.get('ai.stageConfig')).value;
ok('author binding and model preserved',stored.stages.drafting.skillId==='own'&&stored.stages.drafting.model==='kept-model');
ok('four unbound stages filled',Object.entries(stored.stages).filter(([s,v])=>s!=='drafting'&&v.skillId?.startsWith('builtin:')).length===4);
ok('all selected texts previewable',document.querySelectorAll('.skill-details').length===5);
ok('source links pinned',Array.from(document.querySelectorAll('.skill-sources a')).every(a=>/^[a-f0-9]{40}$/.test(a.href.split('/blob/')[1]?.split('/')[0]||''))&&document.querySelectorAll('.skill-sources a').length>0);
ok('licenses included',document.body.textContent.includes('Copyright (c) 2025 Context Engineering Agent Skills Contributors'));
const table=window.__skillsFixture.db.appconfig,put=table.put;
table.put=async()=>{throw Error('intentional skill save failure')};
[...document.querySelectorAll('button')].find(b=>b.textContent.includes('保存阶段设置')).click();
for(let n=0;n<100&&!document.body.textContent.includes('intentional skill save failure');n++)await new Promise(r=>setTimeout(r,50));
table.put=put;
ok('save failure visible',document.body.textContent.includes('intentional skill save failure'));
ok('persisted bindings survive failed save',(await table.get('ai.stageConfig')).value.stages.drafting.skillId==='own');
return checks;
})()`
  writeFileSync(runner, `const {app,BrowserWindow}=require('electron');
app.setPath('userData',process.argv[2]);app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async()=>{const w=new BrowserWindow({show:false,width:1080,height:900,webPreferences:{contextIsolation:true,nodeIntegration:false}});
const evaluate=expression=>w.webContents.executeJavaScript(expression);
const wait=async expression=>{const end=Date.now()+45000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('UI readiness timed out: '+expression);};
try {await w.loadURL('http://127.0.0.1:5187/__builtin-skills-verify');
await wait("Boolean(window.__skillsFixture)&&[...document.querySelectorAll('button')].some(b=>b.textContent.includes('为未绑定阶段')&&!b.disabled)");
const result=await evaluate(${JSON.stringify(checksScript)});console.log(JSON.stringify({passed:result.length,checks:result}));app.exit(0);
}catch(e){console.error(e.stack||e);app.exit(1)}}).catch(e=>{console.error(e);app.exit(1)});`)
  const exit = await new Promise((resolve,reject)=>{
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE
    const child=spawn(require('electron'),[runner,join(directory,'profile')],{env,windowsHide:true,stdio:['ignore','pipe','pipe']})
    child.stdout.on('data',chunk=>process.stdout.write(chunk))
    child.stderr.on('data',chunk=>process.stderr.write(chunk))
    child.on('error',reject);child.on('close',resolve)
  })
  if(exit!==0)process.exitCode=1
} finally {await server?.close()}
