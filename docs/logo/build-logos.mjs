// 小说工坊 logo 四稿生成器
// 生成 4 个 SVG 设计稿（每稿一张 900x900 版面）与一个对比用 HTML 片段。
// 运行：node docs/logo/build-logos.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = HERE;

const SERIF_CN = '"Source Han Serif SC","Noto Serif SC","Songti SC",SimSun,Georgia,serif';
const SANS_CN = '"Source Han Sans SC","Noto Sans SC","PingFang SC","Microsoft YaHei",system-ui,sans-serif';
const KAI_CN = 'KaiTi,"Kaiti SC",STKaiti,"LXGW WenKai","Source Han Serif SC",SimSun,serif';
const SERIF_EN = 'Georgia,"Times New Roman",serif';

// 四角星（灵感/奇幻闪光）
const spark = (cx, cy, r, fill, op = 1) => {
  const k = r * 0.14;
  return `<path d="M${cx},${cy - r} C${cx + k},${cy - k} ${cx + k},${cy - k} ${cx + r},${cy} C${cx + k},${cy + k} ${cx + k},${cy + k} ${cx},${cy + r} C${cx - k},${cy + k} ${cx - k},${cy + k} ${cx - r},${cy} C${cx - k},${cy - k} ${cx - k},${cy - k} ${cx},${cy - r} Z" fill="${fill}" opacity="${op}"/>`;
};

/* ------------------------------------------------------------------ 01 古典徽章 */
const mk1 = (p) => `
  <defs>
    <radialGradient id="${p}-field" cx="50%" cy="40%" r="66%">
      <stop offset="0" stop-color="#2C416F"/>
      <stop offset="0.62" stop-color="#1B2A4A"/>
      <stop offset="1" stop-color="#0F1A31"/>
    </radialGradient>
    <linearGradient id="${p}-gold" x1="0" y1="1" x2="0.45" y2="0">
      <stop offset="0" stop-color="#A8842A"/>
      <stop offset="0.45" stop-color="#EBD68C"/>
      <stop offset="1" stop-color="#C9A227"/>
    </linearGradient>
    <path id="${p}-arc" d="M 262,400 A 188,188 0 0 1 638,400"/>
  </defs>

  <circle cx="450" cy="400" r="212" fill="none" stroke="url(#${p}-gold)" stroke-width="7"/>
  <circle cx="450" cy="400" r="168" fill="url(#${p}-field)"/>
  <circle cx="450" cy="400" r="172" fill="none" stroke="#C9A227" stroke-width="2.5"/>

  <text font-family='${SERIF_EN}' font-size="25" font-weight="600" fill="#DCBC63" letter-spacing="7">
    <textPath href="#${p}-arc" xlink:href="#${p}-arc" startOffset="50%" text-anchor="middle">NOVEL STUDIO</textPath>
  </text>
  <rect x="252" y="392" width="16" height="16" transform="rotate(45 260 400)" fill="#C9A227"/>
  <rect x="632" y="392" width="16" height="16" transform="rotate(45 640 400)" fill="#C9A227"/>

  ${spark(352, 306, 20, '#F3EAD3', 0.95)}
  ${spark(552, 316, 13, '#EBD68C', 0.9)}

  <path d="M536,268 C550,300 524,344 468,382 C452,360 492,298 536,268 Z" fill="url(#${p}-gold)"/>

  <path d="M450,372 C 416,354 374,348 344,352 L344,458 C 374,454 416,464 450,486 Z" fill="#F5EDD8"/>
  <path d="M450,372 C 484,354 526,348 556,352 L556,458 C 526,454 484,464 450,486 Z" fill="#E7DBBE"/>
  <path d="M450,372 L450,486" stroke="#C9A227" stroke-width="3" fill="none"/>
`;

/* ------------------------------------------------------------------ 02 现代扁平 */
const mk2 = (p) => `
  <defs>
    <clipPath id="${p}-tile"><rect x="260" y="250" width="380" height="380" rx="88"/></clipPath>
  </defs>

  <rect x="260" y="250" width="380" height="380" rx="88" fill="#4C56D6"/>

  <g clip-path="url(#${p}-tile)">
    <path d="M446,400 L330,366 L330,452 L446,486 Z" fill="#FFFFFF"/>
    <path d="M454,400 L570,366 L570,452 L454,486 Z" fill="#F2F4FF"/>
    <path d="M336,404 L440,434" stroke="#4C56D6" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M336,425 L440,455" stroke="#4C56D6" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M460,434 L564,404" stroke="#4C56D6" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M460,455 L564,425" stroke="#4C56D6" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M439,486 L461,486 L461,552 L450,538 L439,552 Z" fill="#F2B33D"/>
    ${spark(588, 318, 28, '#F2B33D')}
  </g>
`;

/* ------------------------------------------------------------------ 03 幻想魔法 */
const mk3 = (p) => `
  <defs>
    <radialGradient id="${p}-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#9A6BFF" stop-opacity="0.80"/>
      <stop offset="0.55" stop-color="#6A3FD0" stop-opacity="0.26"/>
      <stop offset="1" stop-color="#6A3FD0" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${p}-beam" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#6FE3FF" stop-opacity="0.70"/>
      <stop offset="0.55" stop-color="#A98BFF" stop-opacity="0.30"/>
      <stop offset="1" stop-color="#F5CE6B" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${p}-cover" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4A2E8A"/>
      <stop offset="1" stop-color="#2A1850"/>
    </linearGradient>
  </defs>

  <g transform="translate(0,-20)">
    <circle cx="450" cy="430" r="200" fill="url(#${p}-glow)"/>
    <circle cx="450" cy="430" r="200" fill="none" stroke="#B79BFF" stroke-width="1.5" opacity="0.20"/>
    <circle cx="450" cy="430" r="232" fill="none" stroke="#B79BFF" stroke-width="1" stroke-dasharray="2 16" opacity="0.10"/>

    <path d="M450,330 C426,266 430,196 450,140 C470,196 474,266 450,330 Z" fill="url(#${p}-beam)"/>

    <circle cx="450" cy="150" r="58" fill="#F5CE6B" opacity="0.16"/>
    ${spark(450, 150, 38, '#FBE7A8')}

    <g transform="rotate(-20 351 284)">
      <rect x="322" y="272" width="58" height="24" rx="4" fill="#EDE4FF" opacity="0.92"/>
      <path d="M331,284 L371,284" stroke="#9E82E8" stroke-width="3.5" stroke-linecap="round" opacity="0.55"/>
    </g>
    <g transform="rotate(12 554 247)">
      <rect x="528" y="236" width="52" height="22" rx="4" fill="#DCCBFF" opacity="0.85"/>
      <path d="M536,247 L572,247" stroke="#9E82E8" stroke-width="3.5" stroke-linecap="round" opacity="0.55"/>
    </g>
    <g transform="rotate(-30 394 200)">
      <rect x="372" y="190" width="44" height="19" rx="3.5" fill="#EDE4FF" opacity="0.70"/>
    </g>

    <path d="M450,422 C 408,398 360,388 322,392 L322,528 C 360,524 408,534 450,556 Z" fill="url(#${p}-cover)"/>
    <path d="M450,422 C 492,398 540,388 578,392 L578,528 C 540,524 492,534 450,556 Z" fill="url(#${p}-cover)"/>
    <path d="M450,422 C 408,398 360,388 322,392 M450,422 C 492,398 540,388 578,392"
          stroke="#E3C56B" stroke-width="2.5" opacity="0.85" fill="none"/>
    <path d="M322,392 L322,528 M578,392 L578,528" stroke="#E3C56B" stroke-width="2" opacity="0.55" fill="none"/>

    <path d="M450,422 C 414,404 372,396 340,400 L340,516 C 372,512 414,522 450,544 Z" fill="#F3ECFF"/>
    <path d="M450,422 C 486,404 528,396 560,400 L560,516 C 528,512 486,522 450,544 Z" fill="#E7DDFF"/>

    <path d="M348,447 L442,471 M348,480 L442,505" stroke="#9E82E8" stroke-width="5" stroke-linecap="round" opacity="0.5" fill="none"/>
    <path d="M452,471 L552,447 M452,505 L552,480" stroke="#9E82E8" stroke-width="5" stroke-linecap="round" opacity="0.5" fill="none"/>

    ${spark(620, 330, 24, '#F5CE6B')}
    ${spark(286, 370, 20, '#6FE3FF', 0.9)}
    ${spark(520, 292, 11, '#FFFFFF', 0.85)}
    ${spark(392, 330, 8, '#6FE3FF', 0.8)}
  </g>
`;

/* ------------------------------------------------------------------ 04 东方水墨 */
const mk4 = (p) => `
  <path d="M523.9,603.0
           A216,216 0 0 1 275.1,522.5
           A213.5,213.5 0 0 1 288.4,264.3
           A211,211 0 0 1 538.2,211.1
           A208.5,208.5 0 0 1 654.9,436.2
           L649.0,435.1
           A202,202 0 0 0 535.2,217.4
           A201.5,201.5 0 0 0 297.6,272.0
           A199,199 0 0 0 289.1,512.8
           A196.5,196.5 0 0 0 516.4,582.4 Z"
        fill="#1A1A1A" opacity="0.16"/>

  <path d="M444,336 C 402,314 352,305 312,311 C 307,372 307,428 312,482 C 356,474 404,482 444,506 C 448,450 448,392 444,336 Z" fill="#1F1F1F"/>
  <path d="M456,336 C 498,314 548,305 588,311 C 593,372 593,428 588,482 C 544,474 496,482 456,506 C 452,450 452,392 456,336 Z" fill="#303030"/>

  <g stroke="#F7F3EA" stroke-width="4.5" stroke-linecap="round" fill="none">
    <path d="M336,336 L336,474"/>
    <path d="M358,340 L358,478"/>
    <path d="M380,344 L380,482"/>
    <path d="M402,348 L402,486"/>
    <path d="M422,352 L422,490"/>
    <path d="M478,352 L478,490"/>
    <path d="M498,348 L498,486"/>
    <path d="M520,344 L520,482"/>
    <path d="M542,340 L542,478"/>
    <path d="M564,336 L564,474"/>
  </g>

  <rect x="582" y="510" width="92" height="92" rx="9" fill="#B93A32"/>
  <text x="628" y="556" font-family='${KAI_CN}' font-size="54" fill="#F7F3EA"
        text-anchor="middle" dominant-baseline="central">坊</text>
  <circle cx="300" cy="524" r="7" fill="#1A1A1A" opacity="0.16"/>
  <circle cx="322" cy="554" r="4" fill="#1A1A1A" opacity="0.11"/>
  <circle cx="676" cy="466" r="5" fill="#1A1A1A" opacity="0.12"/>
`;

/* ------------------------------------------------------------------ 四稿定义 */
const VARIANTS = [
  {
    slug: '01-classic-emblem', num: '01', cn: '古典徽章', en: 'Classic Emblem',
    paper: '#F7F1E3', bgSolid: true,
    ink: '#16233F', caption: '#A08A5E',
    wordFont: SERIF_CN, wordSize: 78, wordSpacing: 8, wordWeight: 600,
    baseline: 730, capY: 812,
    markViewBox: '228 178 444 444',
    note: '厚重 · 对称 · 烫金质感，适合书封与正式场合',
    mark: mk1,
  },
  {
    slug: '02-modern-flat', num: '02', cn: '现代扁平', en: 'Modern Flat',
    paper: '#F6F7FE', bgSolid: true,
    ink: '#1E2130', caption: '#7C83A8',
    wordFont: SANS_CN, wordSize: 76, wordSpacing: 6, wordWeight: 700,
    baseline: 730, capY: 812,
    markViewBox: '248 238 404 404',
    note: '几何 · 单色 · 圆角方块，适配 App 图标与深色界面',
    mark: mk2,
  },
  {
    slug: '03-fantasy-grimoire', num: '03', cn: '幻想魔法', en: 'Fantasy Grimoire',
    paper: '#1A1033', bgSolid: false,
    ink: '#F5CE6B', caption: '#9C8FC7',
    wordFont: SERIF_CN, wordSize: 78, wordSpacing: 8, wordWeight: 600,
    baseline: 730, capY: 812,
    markViewBox: '196 84 508 572',
    note: '辉光 · 紫夜 · 魔法书，强调想象力与灵感涌现',
    mark: mk3,
  },
  {
    slug: '04-oriental-ink', num: '04', cn: '东方水墨', en: 'Oriental Ink',
    paper: '#F7F3EA', bgSolid: true,
    ink: '#1A1A1A', caption: '#8A8375',
    wordFont: KAI_CN, wordSize: 78, wordSpacing: 12, wordWeight: 400,
    baseline: 730, capY: 812,
    markViewBox: '236 186 448 428',
    note: '留白 · 笔触 · 朱印，竖排书叶呼应中文古典排版',
    mark: mk4,
  },
];

/* ------------------------------------------------------------------ 渲染 */
const sheetBg = (v, p) => v.bgSolid
  ? `<rect width="900" height="900" fill="${v.paper}"/>`
  : `<rect width="900" height="900" fill="url(#${p}-bg)"/>`;

const v3BgDefs = (p) => `
  <defs>
    <radialGradient id="${p}-bg" cx="50%" cy="46%" r="72%">
      <stop offset="0" stop-color="#33205F"/>
      <stop offset="0.55" stop-color="#22143F"/>
      <stop offset="1" stop-color="#150C2B"/>
    </radialGradient>
  </defs>`;

function renderSheet(v, p) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 900 900" width="900" height="900" role="img" aria-label="小说工坊 logo 设计稿 ${v.num} ${v.cn}">
${v.bgSolid ? '' : v3BgDefs(p)}
  ${sheetBg(v, p)}
  ${v.mark(p)}
  <text x="450" y="${v.baseline}" font-family='${v.wordFont}' font-size="${v.wordSize}" font-weight="${v.wordWeight}"
        letter-spacing="${v.wordSpacing}" fill="${v.ink}" text-anchor="middle">小说工坊</text>
  <text x="450" y="${v.capY}" font-family='${SANS_CN}' font-size="19" letter-spacing="4"
        fill="${v.caption}" text-anchor="middle">${v.num} · ${v.cn} · ${v.en}</text>
</svg>
`;
}

function renderMark(v, p) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${v.markViewBox}" role="img" aria-label="小说工坊 ${v.cn} 标识">
${v.bgSolid ? '' : v3BgDefs(p)}
  ${sheetBg(v, p)}
  ${v.mark(p)}
</svg>`;
}

mkdirSync(OUT, { recursive: true });

for (const [i, v] of VARIANTS.entries()) {
  const p = `v${i + 1}`;
  writeFileSync(join(OUT, `${v.slug}.svg`), renderSheet(v, p), 'utf8');
  writeFileSync(join(OUT, `${v.slug}-mark.svg`), renderMark(v, `mk${i + 1}`), 'utf8');
  console.log('wrote', `${v.slug}.svg`, `${v.slug}-mark.svg`);
}

/* ------------------------------------------------------------------ 对比片段 */
const sheets = VARIANTS.map((v, i) => {
  const p = `v${i + 1}`;
  return `      <figure class="draft">
        <div class="art">${renderSheet(v, p)}</div>
        <figcaption><b>${v.num} ${v.cn}</b><span>${v.note}</span></figcaption>
      </figure>`;
}).join('\n');

const minis = VARIANTS.map((v, i) => {
  const p = `m${i + 1}`;
  return `      <div class="mini" title="${v.num} ${v.cn}" style="background:${v.paper}">${renderMark(v, p)}</div>`;
}).join('\n');

const fragment = `<div id="novel-logo-drafts" class="nlg">
  <style>
    #novel-logo-drafts { display: block; width: 100%; }
    #novel-logo-drafts .grid {
      display: grid; gap: 20px; width: 100%;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    }
    #novel-logo-drafts .draft { margin: 0; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
    #novel-logo-drafts .art { width: 100%; border-radius: 14px; overflow: hidden; }
    #novel-logo-drafts .art svg { display: block; width: 100%; height: auto; }
    #novel-logo-drafts figcaption { display: flex; flex-direction: column; gap: 2px; }
    #novel-logo-drafts figcaption b { font-weight: 500; color: var(--foreground); }
    #novel-logo-drafts figcaption span { color: var(--muted-foreground); font-size: 12px; }
    #novel-logo-drafts .scaleline {
      display: flex; align-items: center; flex-wrap: wrap; gap: 14px; margin-top: 22px;
    }
    #novel-logo-drafts .scaleline > .lbl { color: var(--muted-foreground); font-size: 12px; }
    #novel-logo-drafts .mini {
      width: 64px; height: 64px; border-radius: 10px; overflow: hidden; flex: none;
      display: grid; place-items: center;
    }
    #novel-logo-drafts .mini svg { width: 44px; height: 44px; display: block; }
  </style>

  <div class="grid">
${sheets}
  </div>

  <div class="scaleline">
    <span class="lbl">小尺寸识别度</span>
${minis}
  </div>
</div>
`;

const fragPath = process.argv[2];
if (fragPath) {
  writeFileSync(fragPath, fragment, 'utf8');
  console.log('wrote', fragPath);
}
