// Static editor colour studies. The approved layout and Chinese content stay identical.
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const root=dirname(fileURLToPath(import.meta.url)), parent=dirname(root);
const require=createRequire(import.meta.url);
const {chromium}=require(require.resolve('playwright',{paths:[join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node')]}));
const browser=await chromium.launch({channel:'msedge',headless:true});
let body, text;
try {
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  await page.goto(pathToFileURL(join(parent,'nouveau.html')).href+'?state=editor');
  await page.evaluate(()=>document.fonts.ready);
  ({body,text}=await page.evaluate(()=>{
    const copy=document.body.cloneNode(true);
    copy.querySelectorAll('script,#overlay,#toast').forEach(x=>x.remove());
    copy.querySelectorAll('[contenteditable]').forEach(x=>x.removeAttribute('contenteditable'));
    copy.querySelectorAll('textarea,input').forEach(x=>x.setAttribute('readonly',''));
    copy.querySelector('.design-footer').innerHTML='<span>赤月戏</span><span>星尘旅人 · 第一卷</span><span>第一章 · 初雪</span>';
    return {body:copy.innerHTML,text:copy.textContent};
  }));
} finally { await browser.close(); }
mkdirSync(join(root,'assets'),{recursive:true});
writeFileSync(join(root,'font-text.txt'),text+'0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ壹第章卷初雪中文标点霞鹜文楷京华老宋体微软雅黑');
// Keep original geometry; remove artwork declarations for unused screens from these editor-only drafts.
let base=['nouveau-approved.css','studio.css'].map(f=>readFileSync(join(parent,f),'utf8')).join('\n');
base=base.replace(/url\('assets\/(?:opera|nouveau)\.webp'\)/g,'none');
const palettes=[
 {id:'moon-violet',name:'月白 · 墨紫 · 香槟金',concept:'月白稿纸承接墨紫舞台，香槟金只点亮花饰与页边。',palette:['#F9F7FC','#3D284F','#9B7D49'],
  vars:{bg:'#eae5ef',surface:'#f5f1f8',soft:'#725c8f0c',ink:'#3d284f',muted:'#625170',stroke:'#9279aa4d',accent:'#63417f',onaccent:'#faf4ff',hover:'#52306c',hoverbg:'#7d60991c',focus:'#88609e',paper:'#f9f7fc',paperink:'#3d3249',papermuted:'#796980',tagbg:'#8c6ea91a',tagink:'#67477d',header:'#f1ecf6',nav:'#e2daec',note:'#e0d5eb',noteink:'#533b66',noteshadow:'#7c62941c',tool:'#e8dfee',select:'#f7f3fa',edge:'#d6cadf',stage:'#dfd4e9',selected:'#d9cbe5',selectedink:'#49305e',metal:'#9b7d49',decor:'#ab91bc',dream:'#4d345f',dreamink:'#faf3ff',avatar:'#624579',running:'#776382',shadow:'#2d153314'}},
 {id:'mist-silver',name:'冰白 · 雾蓝 · 银铂',concept:'雾蓝结构包裹冰白稿纸，银铂边线呈现通透的月光舞台。',palette:['#F8FBFF','#385D83','#91A5BA'],
  vars:{bg:'#e4ebf3',surface:'#f1f6fb',soft:'#496b910a',ink:'#294865',muted:'#455f77',stroke:'#7891ad50',accent:'#385d83',onaccent:'#f5faff',hover:'#244766',hoverbg:'#5d82a41c',focus:'#557eaa',paper:'#f8fbff',paperink:'#30455c',papermuted:'#61768b',tagbg:'#7191b61a',tagink:'#446789',header:'#eff4fa',nav:'#dbe5ef',note:'#d7e3ee',noteink:'#355573',noteshadow:'#577b9e1c',tool:'#dee8f2',select:'#f5f9fd',edge:'#c5d4e3',stage:'#d6e2ee',selected:'#ccddeb',selectedink:'#254b70',metal:'#667f9b',decor:'#90a8c1',dream:'#355574',dreamink:'#f1f8ff',avatar:'#466989',running:'#57718a',shadow:'#1f375414'}},
 {id:'iris-noir',name:'曜黑 · 鸢尾紫 · 月银',concept:'曜黑舞台围合鸢尾紫稿纸，以月银线条勾勒夜间幻戏。',palette:['#171321','#8E68B3','#CBC5DD'],
  vars:{bg:'#171321',surface:'#241c33',soft:'#c9b9e80b',ink:'#e1d7ef',muted:'#b3a5c7',stroke:'#b7a0cd3d',accent:'#b89bd8',onaccent:'#24162e',hover:'#cdb6e7',hoverbg:'#c4a8e01a',focus:'#cfb1f1',paper:'#292134',paperink:'#e5ddef',papermuted:'#b4a5c5',tagbg:'#af87d52b',tagink:'#d0b6e8',header:'#1c1628',nav:'#120f1b',note:'#372b46',noteink:'#d5c6e7',noteshadow:'#00000033',tool:'#21192e',select:'#372a47',edge:'#171020',stage:'#332640',selected:'#49335f',selectedink:'#ecddfc',metal:'#cbc5dd',decor:'#85659f',dream:'#503969',dreamink:'#f5ebff',avatar:'#63457d',running:'#bdadce',shadow:'#00000045'}}
];
const css=`
/* Colour-only comparison: all three use the same 1440 × 900 approved editor. */
.nouveau{background:var(--bg);color:var(--ink);color-scheme:light}
.nouveau.iris-noir{color-scheme:dark}
.nouveau *, .nouveau *:before,.nouveau *:after{animation:none!important;transition:none!important;caret-color:transparent}
.nouveau button{cursor:default;pointer-events:none}
.nouveau input,.nouveau textarea,.nouveau select{pointer-events:none}
.nouveau .global-header{background:var(--header);border-color:var(--stroke)}
.nouveau .header-poem,.nouveau .studio-brand{color:var(--ink)}
.nouveau .brand-emblem{border-color:var(--metal);color:var(--metal)}
.nouveau .user-avatar{background:var(--avatar);border-color:var(--avatar);color:var(--dreamink)}
.nouveau .current-project span,.nouveau .global-item{color:var(--muted)}
.nouveau .global-nav{background:var(--nav);border-color:var(--stroke)}
.nouveau .global-item.active{background:var(--dream);color:var(--dreamink)}
.nouveau .global-item.active:after{background:var(--metal)}
.nouveau .studio-main{background:radial-gradient(ellipse at 82% 0,var(--soft),transparent 66%)}
.nouveau .page-heading h1{color:var(--ink)}
.nouveau .heading-tools .tool{color:var(--ink);border-color:var(--stroke);background:transparent}
.nouveau .editor-notes:before{border-color:var(--stroke)}
.nouveau .note-sheet{background:var(--note);box-shadow:3px 4px 0 var(--noteshadow)}
.nouveau .note-sheet>small{color:var(--muted)}
.nouveau .note-sheet textarea{color:var(--noteink)}
.nouveau .note-flower{color:var(--metal);opacity:.65}
.nouveau .reference-link{color:var(--ink);border-color:var(--stroke)}
.nouveau .reference-link>span{background:var(--selected);color:var(--selectedink)}
.nouveau .reference-link small{color:var(--muted)}
.nouveau .dream-btn{background:var(--dream);color:var(--dreamink)}
.nouveau .writing-stage{background:var(--stage);border-top-color:var(--metal);box-shadow:4px 6px 0 var(--shadow)}
.nouveau .format-bar{background:var(--tool);border-color:var(--stroke);color:var(--ink)}
.nouveau .format-bar select{background:var(--select);color:var(--ink)}
.nouveau .toolbar-divider{background:var(--stroke)}
.nouveau .format-bar .tool{color:var(--ink);background:transparent}
.nouveau .manuscript{background:linear-gradient(90deg,var(--paper),var(--paper) 97%,var(--edge));color:var(--paperink)}
.nouveau .manuscript:after{border-color:var(--stroke)}
.nouveau .manuscript-running{color:var(--running);border-color:var(--stroke)}
.nouveau .chapter-ornament{color:var(--metal)}
.nouveau .manuscript h2,.nouveau .editable-prose{color:var(--paperink)}
.nouveau .chapter-subtitle,.nouveau .page-folio{color:var(--papermuted)}
.nouveau .editor-status{background:var(--stage);color:var(--muted)}
.nouveau .chapters{border-color:var(--stroke)}
.nouveau .chapters:after{color:var(--decor);opacity:.25}
.nouveau .chapter-row{color:var(--ink);border-color:var(--stroke)}
.nouveau .chapter-row.selected{background:var(--selected);color:var(--selectedink)}
.nouveau .chapter-number{color:var(--muted)}
.nouveau .chapter-row.selected .chapter-number{color:var(--selectedink)}
.nouveau .chapter-row small,.nouveau .volume-label,.nouveau .add-line{color:var(--muted)}
.nouveau .search-box{color:var(--muted);border-color:var(--stroke)}
.nouveau .design-footer{background:var(--header);color:var(--muted);border-color:var(--stroke)}
`;
for(const p of palettes){
  const vars=Object.entries(p.vars).map(([k,v])=>'--'+k.replace('hoverbg','hover-bg')+':'+v).join(';');
  const sheet=base+'\n.nouveau.'+p.id+'{'+vars+'}\n'+css;
  writeFileSync(join(root,p.id+'.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>赤月戏 · '+p.name+'</title><style>'+sheet+'</style></head><body class="nouveau static '+p.id+'" data-theme="nouveau" data-state="editor">'+body+'</body></html>');
}
writeFileSync(join(root,'manifest.json'),JSON.stringify({schemaVersion:1,lang:'zh',project:'赤月戏 · 三种配色',brief:'同一写作界面、同一内容与排布，比较三套阅读纸张、舞台框架与控件配色。',round:'配色 01',nativeViewport:'1440x900',candidates:palettes.map(p=>({id:p.id,name:p.name,concept:p.concept,typography:'霞鹜文楷界面标题 + 京华老宋体正文 / 保留原稿字号',palette:p.palette,traits:['相同写作界面与章节内容','保留非对称折页和拱形选中态','静态色彩对比'],source:p.id+'.html'}))},null,2));
console.log('Created three static editor drafts. Subset fonts before building the explorer.');
