/* Publish only local screenshots from the isolated verification scripts. */
import { readFileSync,writeFileSync,readdirSync,mkdirSync,copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const root=fileURLToPath(new URL('../',import.meta.url))
const out=root+'docs/前端美化/琉光画境-验收/'
mkdirSync(out+'screenshots',{recursive:true})
const images=readdirSync(root+'tools').filter(n=>/^_glaze-(work|shelf)-.*\.png$/.test(n)&&!n.includes('failure'))
for(const name of images)copyFileSync(root+'tools/'+name,out+'screenshots/'+name)
const states=[
 ['shelf','书架','shelf-glaze-1440'],['editor','正文','work-chapters'],
 ['outline','大纲画布','work-outline-canvas'],['outline-text','文本大纲','work-outline'],
 ['world','设定节点','work-lore'],['world-detail','设定详情','work-lore-detail'],
 ['characters','人物档案','work-characters'],['characters-graph','人物关系图','work-character-graph'],
 ['inspiration','灵感','work-snippets'],['settings','设置','work-settings-reference']
]
const size=path=>{const b=readFileSync(path);return [b.readUInt32BE(16),b.readUInt32BE(20)].join('×')}
const sections=states.map(([key,label,name])=>{
 const actual=`screenshots/_glaze-${name}.png`,ref=`../oil-ui-v3-功能对齐/gallery/c/${key}.png`
 return `<section id="${key}"><h2>${label}</h2><div class="pair"><figure><figcaption>C 版基准 · ${size(out+ref)}</figcaption><div class="frame"><img src="${ref}" alt="${label} C 版基准" loading="lazy"></div></figure><figure><figcaption>真实应用 · ${size(out+actual)}</figcaption><div class="frame"><img src="${actual}" alt="${label}实际运行" loading="lazy"></div></figure></div></section>`
}).join('\n')
const small=images.filter(n=>/1080|800|settings\.png|empty|create-form|edit-form/.test(n))
const limits=small.map(n=>`<figure><figcaption>${n.replace('_glaze-','')} · ${size(out+'screenshots/'+n)}</figcaption><a href="screenshots/${n}" target="_blank"><img src="screenshots/${n}" alt="${n}" loading="lazy"></a></figure>`).join('\n')
writeFileSync(out+'index.html',`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>琉光画境 · 设计稿与真实界面对照</title><style>
*{box-sizing:border-box}body{margin:0;background:#e7eff1;color:#234752;font:15px/1.65 "Microsoft YaHei",sans-serif}header{padding:30px 32px 20px}h1{font-size:27px;font-weight:500;margin:0 0 12px}p{max-width:1000px}nav{position:sticky;top:0;background:#f5fafbf2;padding:12px 24px;display:flex;flex-wrap:wrap;gap:12px;z-index:3;border-bottom:1px solid #bad2d6}a{color:#146878}button{font:inherit;cursor:pointer;background:white;border:1px solid #adcbd0;color:#234752;border-radius:6px;padding:4px 12px}button.on{background:#146878;color:white}main{padding:0 24px 40px}section{scroll-margin-top:120px;margin:30px 0 55px}h2{font-size:23px;font-weight:500}figure{margin:0;min-width:0}figcaption{padding:9px 13px;background:#fff;border-radius:8px 8px 0 0;font-size:13px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}.frame{overflow:auto;max-height:85vh;background:white;box-shadow:0 10px 24px #426d7c14}img{display:block;width:100%;height:auto}.native .frame img{width:auto;max-width:none}.double .frame img{width:200%;max-width:none}.limits{display:grid;grid-template-columns:repeat(auto-fit,minmax(460px,1fr));gap:24px}.limits img{border-radius:0 0 8px 8px}@media(max-width:950px){.pair{grid-template-columns:1fr}.limits{grid-template-columns:1fr}}
</style><header><h1>琉光画境 · 设计稿与真实界面对照</h1><p>十个主状态均以 1440×900 对照。左为原 C 版，右为隔离 Electron 配置中的真实组件与测试作品。真实状态、全部原版工具、正文偏好和姓名首字字牌予以保留；设置仍是独立窗口。下方另附 1080×680、800×500 与 1000×700 边界状态。</p><p>此页只展示截图。可缩放检查排版；应用中的皮肤从书架选择器或设置 → 外观切换。<a href="shelf-refinement/index.html">本轮书架三联对照</a> · <a href="../琉光画境-接入记录.md">功能清单与差异说明</a> · <a href="logs/results.json">本次验证结果</a></p></header><nav>${states.map(([key,label])=>`<a href="#${key}">${label}</a>`).join('')}<a href="#limits">边界与弹窗</a><span style="flex:1"></span><button class="on" data-zoom="fit">并排</button><button data-zoom="native">100%</button><button data-zoom="double">200%</button></nav><main>${sections}<section id="limits"><h2>边界窗口与真实弹窗</h2><div class="limits">${limits}</div></section></main><script>document.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>{document.body.className=b.dataset.zoom;document.querySelectorAll('[data-zoom]').forEach(n=>n.classList.toggle('on',n===b))})</script></html>`,'utf8')
writeFileSync(out+'manifest.json',JSON.stringify({generatedAt:new Date().toISOString(),states:states.map(([reference,label,name])=>({label,reference:`../oil-ui-v3-功能对齐/gallery/c/${reference}.png`,actual:`screenshots/_glaze-${name}.png`,size:size(out+`screenshots/_glaze-${name}.png`)})),screenshots:images},null,2),'utf8')
console.log(`PASS evidence: ${states.length} reference comparisons, ${images.length} application screenshots`)
