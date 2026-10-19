/* 赤月戏 · 证据页：把 10 个设计稿状态与真机截图并排落到 docs/前端美化/赤月戏-验收/ */
import { mkdir, writeFile, access } from 'node:fs/promises'

const states = [
  ['书架', 'shelf', 'shelf', '真机为 87px 纸色页头；书名与作品数据来自 IndexedDB'],
  ['正文', 'editor', 'chapters', '左栏竖排书名/朱印、居中章题、43px 格式条、札记与底部章条按稿'],
  ['大纲 · 画布', 'outline', 'outline', '目录 214、画布右留 170 景深、控制条移到底右'],
  ['大纲 · 文本', 'outline-text', 'outline-text', '连续稿本 266–1270；标题/元信息/正文沿用真实条目'],
  ['设定 · 幕布', 'world', 'lore', '248 / 1fr / 220；索引列改为真实目录/标签/关联'],
  ['设定 · 详情', 'world-detail', 'lore-detail', '顶栏下 210 / 1fr / 355；关系图谱保留真实交互'],
  ['人物 · 档案', 'characters', 'characters', '298×414 肖像 + 横向演员表 + 508–1408 卷宗纸'],
  ['人物 · 关系图', 'characters-graph', 'graph', '左侧 310 露景；图谱 310–1147；名册 1169–1408'],
  ['灵感', 'inspiration', 'snippets', '245 / 462 / 623；43px 手记墙条与阅读纸'],
  ['设置', 'settings', 'settings', '独立窗口 1000×700 适配为 181 / 纸 / 250 预览']
]
const base = new URL('../docs/前端美化/赤月戏-验收/', import.meta.url)
await mkdir(base, { recursive: true })
const designBase = '../oil-ui-v3-功能对齐/赤月剧场-书架方向对比/完整设计稿/金屏夜梅-完整设计稿/screenshots'
const realBase = './对照'
const cards = []
for (const [label, design, real, note] of states) {
  const designPath = new URL(`${designBase}/${design}/page.png`, base)
  const realPath = new URL(`${realBase}/${real}.png`, base)
  let hasDesign = true, hasReal = true
  try { await access(designPath) } catch { hasDesign = false }
  try { await access(realPath) } catch { hasReal = false }
  cards.push(`<section class="pair">
    <header><h2>${label}</h2><span>${note}</span></header>
    <div class="shots">
      <figure><figcaption>设计稿</figcaption>${hasDesign ? `<img src="${designBase}/${design}/page.png" alt="${label}设计稿">` : '<p class="missing">设计稿截图缺失</p>'}</figure>
      <figure><figcaption>真机（赤月戏）</figcaption>${hasReal ? `<img src="${realBase}/${real}.png" alt="${label}真机">` : '<p class="missing">真机截图缺失</p>'}</figure>
    </div>
  </section>`)
}
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>赤月戏 · 设计稿 ↔ 真机对照</title>
<style>
  :root{--bg:#171c1b;--panel:#1f2724;--paper:#f1e8d5;--ink:#403b30;--gold:#cfb06b;--muted:#bfb59c;--line:#baa36845}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--paper);font:14px/1.7 "Microsoft YaHei",sans-serif}
  main{max-width:1500px;margin:0 auto;padding:46px 34px 70px}
  h1{font:400 38px/1.3 "KingHwa OldSong",serif;letter-spacing:8px;margin:0 0 8px;color:#f0e7d5}
  .lede{color:var(--muted);margin:0 0 34px}
  .pair{background:var(--panel);border:1px solid var(--line);margin:0 0 26px;padding:18px}
  .pair>header{display:flex;align-items:baseline;gap:18px;border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:16px}
  .pair h2{font:400 24px "KingHwa OldSong",serif;letter-spacing:4px;margin:0;color:var(--gold)}
  .pair>header span{font-size:12px;color:var(--muted)}
  .shots{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  figure{margin:0;background:#0f1412;border:1px solid #ffffff12}
  figcaption{font-size:11px;letter-spacing:2px;color:var(--muted);padding:8px 10px;border-bottom:1px solid #ffffff10}
  img{display:block;width:100%;height:auto}
  .missing{padding:60px 10px;text-align:center;color:#8b7d60}
  .notes{margin-top:34px;padding:22px 24px;border:1px solid var(--line);background:#1c2926}
  .notes h2{font:400 22px "KingHwa OldSong",serif;letter-spacing:3px;margin:0 0 10px;color:var(--gold)}
  .notes li{color:var(--muted);margin:5px 0}
  @media(max-width:1000px){.shots{grid-template-columns:1fr}}
</style></head><body><main>
  <h1>赤月戏 · 设计稿 ↔ 真机对照</h1>
  <p class="lede">基线：金屏夜梅-完整设计稿（1440×900，设计稿 10 态）。真机截图由隔离实例 赤月戏 皮肤、1440×900 视口（设置窗口按其 1000×700 原生尺寸）截取。设计稿定排布，真实作品数据定内容。</p>
  ${cards.join('\n')}
  <section class="notes"><h2>有意偏差</h2><ul>
    <li>品牌字保留「小说工坊 / 赤月戏」；设计稿的「妙笔 / 林间」是原型演示。</li>
    <li>书封为生成式（纸色 + 款式 + 月轮/山影/题签），不复用设计稿参考封面。</li>
    <li>长书名：≤4 字竖排，5–8 字两行，更长两行截断；设计稿只给了四字示例。</li>
    <li>设计稿的灵感分类（伏笔/场景/人物）没有数据模型，改为真实条数 + 排序 + 快速记录；不伪造分类。</li>
    <li>设置是应用的真实独立窗口（1000×700），三栏按同比例适配为 181 / 纸 / 250 预览。</li>
    <li>人物/灵感/设定的示例数据在真机中换成了实际作品与条目；空数据时显示空态。</li>
  </ul></section>
</main></body></html>`
await writeFile(new URL('对照.html', base), html)
console.log('evidence written:', new URL('对照.html', base).pathname)
