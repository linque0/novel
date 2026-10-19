import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';
const root=dirname(fileURLToPath(import.meta.url)),require=createRequire(import.meta.url);
const {chromium}=require(require.resolve('playwright',{paths:[join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node')]}));
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}}),records=[];
const dest=join(root,'evidence','playback');mkdirSync(dest,{recursive:true});
for(const theme of ['opera','nouveau']){
 await page.goto(pathToFileURL(join(root,'evidence',theme,'record-tour.mp4')).href);
 await page.waitForSelector('video');
 await page.evaluate(async()=>{const v=document.querySelector('video');v.style.cssText='position:fixed;inset:0;width:100%;height:100%;object-fit:contain';v.muted=true;v.playbackRate=1;await v.play();});
 await page.waitForFunction(()=>document.querySelector('video').currentTime>=1.7,null,{polling:100});
 await page.screenshot({path:join(dest,theme+'-early.png')});
 await page.waitForFunction(()=>document.querySelector('video').currentTime>=4.5,null,{polling:100});
 await page.screenshot({path:join(dest,theme+'-middle.png')});
 await page.waitForFunction(()=>document.querySelector('video').ended,null,{polling:100});
 records.push(await page.evaluate(theme=>{const v=document.querySelector('video');return {theme,rate:v.playbackRate,duration:v.duration,ended:v.ended,width:v.videoWidth,height:v.videoHeight};},theme));
}
await browser.close();writeFileSync(join(dest,'results.json'),JSON.stringify(records,null,2));console.log(JSON.stringify(records,null,2));
