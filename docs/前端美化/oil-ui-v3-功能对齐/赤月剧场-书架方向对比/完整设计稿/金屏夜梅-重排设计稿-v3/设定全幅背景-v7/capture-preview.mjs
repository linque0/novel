import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const require=createRequire(import.meta.url);
const {chromium}=require(require.resolve('playwright',{paths:[join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node')]}));
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
for(const width of [1440,1080]){
 await page.setViewportSize({width,height:900});
 await page.goto('http://127.0.0.1:8895/%E8%AE%BE%E5%AE%9A%E5%85%A8%E5%B9%85%E8%83%8C%E6%99%AF-v7/world.html',{waitUntil:'networkidle'});
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
 await page.screenshot({path:join(root,'screenshots','world-full-'+width+'.png')});
 console.log(width+'×900 saved');
}
await browser.close();

