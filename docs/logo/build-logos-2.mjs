// 小说工坊 logo 第二轮：按美术主义重做六稿
// 运行：node docs/logo/build-logos-2.mjs [输出HTML片段路径]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = HERE;

const SERIF_CN = '"Source Han Serif SC","Noto Serif SC","Songti SC",SimSun,Georgia,serif';
const SANS_CN = '"Source Han Sans SC","Noto Sans SC","PingFang SC","Microsoft YaHei",system-ui,sans-serif';
const DECO_EN = '"Playfair Display",Georgia,"Times New Roman",serif';

const spark = (cx, cy, r, fill, op = 1) => {
  const k = r * 0.14;
  return `<path d="M${cx},${cy - r} C${cx + k},${cy - k} ${cx + k},${cy - k} ${cx + r},${cy} C${cx + k},${cy + k} ${cx + k},${cy + k} ${cx},${cy + r} C${cx - k},${cy + k} ${cx - k},${cy + k} ${cx - r},${cy} C${cx - k},${cy - k} ${cx - k},${cy - k} ${cx},${cy - r} Z" fill="${fill}" opacity="${op}"/>`;
};

const f1 = (n) => Number(n.toFixed(1));

// 由三次贝塞尔中心线生成「渐细笔画」：拆成多段圆头短线，宽度线性插值，接缝不可见
const taper = (p0, c1, c2, p3, w0, w1, color, steps = 24, op = 1) => {
  const at = (t) => {
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1],
    ];
  };
  let out = '', prev = at(0);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const cur = at(t);
    const w = w0 + (w1 - w0) * ((i - 0.5) / steps);
    out += `<line x1="${f1(prev[0])}" y1="${f1(prev[1])}" x2="${f1(cur[0])}" y2="${f1(cur[1])}" stroke="${color}" stroke-width="${f1(w)}" stroke-linecap="round" opacity="${op}"/>`;
    prev = cur;
  }
  return out;
};

/* ============================================================ 05 装饰艺术 Art Deco */
const mk5 = (p) => {
  // 放射日冕：长／短交替
  let rays = '';
  for (let i = 0; i < 33; i++) {
    const a = (185 + i * (170 / 32)) * Math.PI / 180;
    const ro = i % 2 === 0 ? 238 : 176;
    rays += `<line x1="${f1(450 + 98 * Math.cos(a))}" y1="${f1(452 + 98 * Math.sin(a))}" x2="${f1(450 + ro * Math.cos(a))}" y2="${f1(452 + ro * Math.sin(a))}" stroke="#D8B85E" stroke-width="${i % 2 === 0 ? 2.6 : 1.4}" opacity="${i % 2 === 0 ? 0.5 : 0.32}"/>`;
  }
  // 底部人字纹带
  let zig = 'M300,658';
  for (let i = 1; i <= 16; i++) zig += ` L${300 + i * 19},${i % 2 ? 640 : 658}`;

  return `
  <defs>
    <linearGradient id="${p}-au" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#F4E4AE"/>
      <stop offset="0.42" stop-color="#D9B95F"/>
      <stop offset="1" stop-color="#9C7A29"/>
    </linearGradient>
    <radialGradient id="${p}-fd" cx="50%" cy="52%" r="60%">
      <stop offset="0" stop-color="#1D4638"/>
      <stop offset="1" stop-color="#0C1B17"/>
    </radialGradient>
    <clipPath id="${p}-clip"><circle cx="450" cy="430" r="240"/></clipPath>
  </defs>

  <circle cx="450" cy="430" r="240" fill="url(#${p}-fd)"/>
  <g clip-path="url(#${p}-clip)">${rays}</g>

  <circle cx="450" cy="430" r="252" fill="none" stroke="url(#${p}-au)" stroke-width="5"/>
  <circle cx="450" cy="430" r="243" fill="none" stroke="url(#${p}-au)" stroke-width="1.6" opacity="0.75"/>
  <circle cx="450" cy="430" r="259" fill="none" stroke="url(#${p}-au)" stroke-width="1.2" opacity="0.5"/>

  <rect x="189" y="421" width="18" height="18" transform="rotate(45 198 430)" fill="url(#${p}-au)"/>
  <rect x="693" y="421" width="18" height="18" transform="rotate(45 702 430)" fill="url(#${p}-au)"/>

  <path d="M450,292 C448,336 436,404 388,468 L400,556 L500,556 L512,468 C464,404 452,336 450,292 Z" fill="url(#${p}-au)"/>
  <path d="M450,296 L450,418" stroke="#0C1B17" stroke-width="7" stroke-linecap="round"/>
  <circle cx="450" cy="428" r="11" fill="#0C1B17"/>
  <path d="M406,498 L450,452 L494,498 M413,534 L450,500 L487,534" stroke="#0C1B17" stroke-width="4"
        opacity="0.72" fill="none" stroke-linecap="round" stroke-linejoin="round"/>

  <path d="M386,556 L514,556 L514,582 L546,582 L546,608 L578,608 L578,634 L322,634 L322,608 L354,608 L354,582 L386,582 Z"
        fill="url(#${p}-au)"/>
  <path d="M348,596 L552,596 M330,622 L570,622" stroke="#0C1B17" stroke-width="2" opacity="0.35"/>

  <g clip-path="url(#${p}-clip)"><path d="${zig}" stroke="url(#${p}-au)" stroke-width="3.4" fill="none" stroke-linejoin="miter" opacity="0.95"/></g>
`;
};

/* ============================================================ 06 构成主义 Constructivism */
const mk6 = (p) => `
  <defs>
    <clipPath id="${p}-c"><circle cx="486" cy="398" r="186"/></clipPath>
  </defs>

  <circle cx="486" cy="398" r="186" fill="#141414"/>
  <g clip-path="url(#${p}-c)">
    <circle cx="486" cy="398" r="124" fill="none" stroke="#E8E0CE" stroke-width="3" opacity="0.55"/>
    <circle cx="486" cy="398" r="62" fill="none" stroke="#E8E0CE" stroke-width="2" opacity="0.35"/>
  </g>

  <path d="M570,334 L256,568 L292,628 Z" fill="#C62828"/>
  <path d="M570,334 L400,452" stroke="#E8E0CE" stroke-width="3" opacity="0.5"/>
  <path d="M146,668 L742,292" stroke="#141414" stroke-width="3" opacity="0.4"/>
  <path d="M652,206 L700,178 L712,206 Z" fill="#C62828"/>

  <rect x="404" y="612" width="330" height="22" transform="rotate(-18 569 623)" fill="#141414"/>
  <rect x="152" y="470" width="86" height="16" transform="rotate(-18 195 478)" fill="#C62828"/>
  <rect x="596" y="452" width="60" height="16" transform="rotate(-18 626 460)" fill="#141414"/>
  <rect x="240" y="286" width="42" height="13" transform="rotate(-18 261 292)" fill="#C62828"/>
  <circle cx="712" cy="286" r="24" fill="#C62828"/>
  <rect x="176" y="226" width="30" height="30" fill="#141414"/>

  <rect x="158" y="186" width="486" height="34" transform="rotate(-18 401 203)" fill="#141414"/>
  <text x="401" y="215" font-family='${SANS_CN}' font-size="29" font-weight="800" letter-spacing="9"
        fill="#E8E0CE" text-anchor="middle" transform="rotate(-18 401 203)">NOVEL STUDIO</text>
`;

/* ============================================================ 07 新艺术运动 Art Nouveau */
const mk7 = (p) => {
  const PL = '#43284A', OL = '#6E7A45', AU = '#B08D4F', CR = '#EDE8DA';
  let dots = '', thru = '';
  for (let i = 0; i < 24; i++) {
    const a = i * 15 * Math.PI / 180;
    dots += `<circle cx="${f1(450 + 252 * Math.cos(a))}" cy="${f1(420 + 252 * Math.sin(a))}" r="2.6" fill="${AU}" opacity="0.8"/>`;
  }
  for (const d of [135, 315]) {
    thru += `<g transform="rotate(${d} 450 420)">${taper([450, 202], [450, 170], [462, 142], [488, 120], 24, 2, OL, 18, 0.92)}${taper([450, 212], [428, 182], [434, 154], [456, 134], 16, 2, AU, 18, 0.85)}</g>`;
  }
  return `
  <defs>
    <linearGradient id="${p}-pl" x1="0" y1="1" x2="0.4" y2="0">
      <stop offset="0" stop-color="#2A1730"/>
      <stop offset="1" stop-color="#5C3763"/>
    </linearGradient>
  </defs>

  <circle cx="450" cy="420" r="252" fill="none" stroke="${PL}" stroke-width="3"/>
  <circle cx="450" cy="420" r="263" fill="none" stroke="${AU}" stroke-width="1.4" opacity="0.8"/>
  <circle cx="450" cy="420" r="242" fill="none" stroke="${OL}" stroke-width="1" opacity="0.65"
          stroke-dasharray="1 9" stroke-linecap="round"/>
  ${dots}
  ${thru}

  ${taper([442.0, 500.2], [486, 494], [524, 510], [548, 540], 18, 2, AU, 20, 0.85)}
  ${taper([500.8, 240.9], [542, 232], [572, 246], [596, 276], 14, 2, OL, 20, 0.85)}
  ${taper([436.7, 464.3], [398, 444], [358, 460], [326, 494], 20, 2, OL, 22, 0.92)}
  ${taper([436.3, 393.8], [396, 372], [352, 364], [320, 384], 17, 2, AU, 22, 0.88)}
  ${taper([449.7, 325.8], [414, 302], [382, 278], [352, 278], 14, 2, OL, 20, 0.85)}

  ${taper([450, 532], [424, 446], [430, 338], [478, 266], 34, 22, `url(#${p}-pl)`, 30)}
  ${taper([478, 266], [524, 198], [608, 212], [600, 284], 22, 10, `url(#${p}-pl)`, 26)}
  ${taper([600, 284], [594, 322], [570, 338], [550, 326], 10, 3, PL, 16)}
  <circle cx="548" cy="324" r="7" fill="${AU}"/>

  <path d="M414,514 L486,514 C486,548 478,594 450,662 C422,594 414,548 414,514 Z" fill="${PL}"/>
  <rect x="410" y="504" width="80" height="15" rx="7.5" fill="${PL}"/>
  <path d="M450,654 L450,558" stroke="${CR}" stroke-width="4" stroke-linecap="round"/>
  <circle cx="450" cy="550" r="8" fill="${CR}"/>
`;
};

/* ============================================================ 08 浮世绘 Ukiyo-e */
const mk8 = (p) => {
  const IN = '#1F4A6E', DP = '#16324A', CR = '#F2EAD9', VE = '#C0392B', LT = '#4A6E8A';
  let scales = '';
  for (let r = 0; r < 6; r++) {
    const y = 540 + r * 34;
    const off = r % 2 ? 54 : 0;
    for (let x = -54 + off; x <= 960; x += 108) {
      scales += `<path d="M${x - 54},${y} A54,54 0 0 1 ${x + 54},${y}" fill="${IN}"/>`;
      for (const [rr, w] of [[54, 3], [40, 2.4], [26, 2], [12, 1.6]])
        scales += `<path d="M${x - rr},${y} A${rr},${rr} 0 0 1 ${x + rr},${y}" fill="none" stroke="${CR}" stroke-width="${w}"/>`;
    }
  }
  return `
  <defs>
    <clipPath id="${p}-w"><path d="M0,706 L0,592 C90,552 190,532 288,548 C386,564 434,614 530,624 C626,634 706,600 786,574 C846,554 884,548 900,552 L900,706 Z"/></clipPath>
  </defs>

  <circle cx="560" cy="300" r="145" fill="${VE}"/>
  <circle cx="560" cy="300" r="145" fill="none" stroke="#1A1A1A" stroke-width="3"/>

  <path d="M436,650 L530,380 L624,650 Z" fill="#3E6B8C" stroke="#1A1A1A" stroke-width="5" stroke-linejoin="round"/>
  <path d="M494,486 L530,380 L566,486 C557,478 550,492 541,484 C533,494 525,482 517,490 C510,483 502,488 494,486 Z" fill="${CR}"/>

  <g clip-path="url(#${p}-w)">${scales}</g>
  <path d="M0,592 C90,552 190,532 288,548 C386,564 434,614 530,624 C626,634 706,600 786,574 C846,554 884,548 900,552"
        fill="none" stroke="#1A1A1A" stroke-width="5"/>
  <path d="M0,640 C96,604 196,588 292,604 C388,620 438,664 534,672 C630,680 712,646 792,622 C850,604 886,600 900,604"
        fill="none" stroke="#1A1A1A" stroke-width="2.4" opacity="0.4"/>

  <path d="M262,350 C259,394 248,440 206,490 L218,600 L306,600 L318,490 C276,440 265,394 262,350 Z" fill="${IN}"/>
  <path d="M262,350 C259,394 248,440 206,490 L218,600 L306,600 L318,490 C276,440 265,394 262,350 Z"
        fill="none" stroke="#1A1A1A" stroke-width="5" stroke-linejoin="round"/>
  <path d="M262,358 L262,540" stroke="${CR}" stroke-width="6" stroke-linecap="round"/>
  <circle cx="262" cy="548" r="9" fill="${CR}"/>

  <circle cx="356" cy="452" r="8" fill="${CR}"/>
  <circle cx="398" cy="420" r="5" fill="${CR}"/>
  <circle cx="640" cy="470" r="6" fill="${CR}"/>
  <circle cx="176" cy="500" r="5" fill="${CR}"/>

  <rect x="596" y="574" width="94" height="94" rx="8" fill="${VE}"/>
  <text x="643" y="621" font-family='${SERIF_CN}' font-size="52" fill="${CR}"
        text-anchor="middle" dominant-baseline="central">坊</text>
`;
};

/* ============================================================ 09 泥金装饰手抄本 Illuminated */
const mk9 = (p) => {
  const L = 260, R = 640, T = 250, B = 590;
  const segs = [
    { h: true, y: T, from: L, to: R, ang: 0 },
    { h: false, x: R, from: T, to: B, ang: 90 },
    { h: true, y: B, from: R, to: L, ang: 180 },
    { h: false, x: L, from: B, to: T, ang: 270 },
  ];
  const total = (R - L) * 2 + (B - T) * 2;
  let vine = '', pin = '';
  const N = 24, step = total / N;
  for (let i = 0; i < N; i++) {
    let d = i * step + step / 2, pt = null;
    for (const s of segs) {
      const len = Math.abs(s.to - s.from);
      if (d <= len) {
        const dir = s.to > s.from ? 1 : -1;
        const t = s.from + dir * d;
        pt = s.h ? { x: t, y: s.y, a: s.ang } : { x: s.x, y: t, a: s.ang };
        break;
      }
      d -= len;
    }
    if (!pt) continue;
    const flip = i % 2 ? -1 : 1;
    // 不对称莨苕叶：基部收窄、叶尖外卷，避免读成眼睛
    const leaf = `M0,0 C-11,-13 -16,-30 -9,-44 C-3,-38 2,-40 5,-48 C13,-34 11,-14 0,0 Z`;
    vine += `<g transform="translate(${f1(pt.x)},${f1(pt.y)}) rotate(${pt.a}) scale(${flip},1)"><path d="${leaf}" fill="${i % 3 === 0 ? '#4A6B3A' : '#C9A227'}" opacity="0.92"/><path d="M-1,-6 C-6,-17 -6,-31 -2,-40" stroke="#EFE4CE" stroke-width="1.5" fill="none" opacity="0.6"/></g>`;
    pin += `<circle cx="${f1(pt.x)}" cy="${f1(pt.y)}" r="2.8" fill="#B23A2E" opacity="0.85"/>`;
  }
  let ringDots = '';
  for (let i = 0; i < 40; i++) {
    const a = i * 9 * Math.PI / 180;
    ringDots += `<circle cx="${f1(450 + 162 * Math.cos(a))}" cy="${f1(420 + 162 * Math.sin(a))}" r="${i % 4 === 0 ? 3.2 : 1.9}" fill="#C9A227" opacity="0.8"/>`;
  }
  const boss = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="30" fill="url(#${p}-au)"/>
  <circle cx="${cx}" cy="${cy}" r="21" fill="#1B3A93"/>
  <path d="M${cx},${cy - 15} C${cx + 6},${cy - 6} ${cx + 6},${cy - 6} ${cx + 15},${cy} C${cx + 6},${cy + 6} ${cx + 6},${cy + 6} ${cx},${cy + 15} C${cx - 6},${cy + 6} ${cx - 6},${cy + 6} ${cx - 15},${cy} C${cx - 6},${cy - 6} ${cx - 6},${cy - 6} ${cx},${cy - 15} Z" fill="#C9A227"/>`;
  const leafPath = `M0,0 C-11,-13 -16,-30 -9,-44 C-3,-38 2,-40 5,-48 C13,-34 11,-14 0,0 Z`;
  // 圆窗内自书心向外的金线光（illumination 本义）
  let rays = '';
  for (let i = 0; i < 32; i++) {
    const a = i * 11.25 * Math.PI / 180;
    rays += `<line x1="${f1(450 + 100 * Math.cos(a))}" y1="${f1(420 + 100 * Math.sin(a))}" x2="${f1(450 + 152 * Math.cos(a))}" y2="${f1(420 + 152 * Math.sin(a))}" stroke="#C9A227" stroke-width="1.6" opacity="0.26"/>`;
  }
  let mid = '';
  for (let i = 0; i < N; i++) {
    let d = i * step, pt = null;
    for (const s of segs) {
      const len = Math.abs(s.to - s.from);
      if (d <= len) {
        const dir = s.to > s.from ? 1 : -1;
        const t = s.from + dir * d;
        pt = s.h ? { x: t, y: s.y, a: s.ang } : { x: s.x, y: t, a: s.ang };
        break;
      }
      d -= len;
    }
    if (!pt) continue;
    mid += `<g transform="translate(${f1(pt.x)},${f1(pt.y)}) rotate(${pt.a}) scale(${i % 2 ? -1 : 1},1)"><path d="M0,4 C9,10 11,22 4,30 C-3,24 -4,12 0,4 Z" fill="#4A6B3A" opacity="0.75"/></g>`;
  }
  const diag = (deg) => {
    const a = (deg - 90) * Math.PI / 180;
    const x = 450 + 118 * Math.cos(a), y = 420 + 118 * Math.sin(a);
    return `<g transform="translate(${f1(x)},${f1(y)}) rotate(${deg}) scale(0.82)"><path d="${leafPath}" fill="#C9A227" opacity="0.9"/><path d="M-1,-6 C-6,-17 -6,-31 -2,-40" stroke="#1B3A93" stroke-width="1.6" fill="none" opacity="0.55"/></g>`;
  };
  return `
  <defs>
    <linearGradient id="${p}-au" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#F2E2AE"/>
      <stop offset="0.45" stop-color="#D4B157"/>
      <stop offset="1" stop-color="#A07F2C"/>
    </linearGradient>
  </defs>

  <rect x="190" y="180" width="520" height="480" fill="#F7EEDA" stroke="#C9A227" stroke-width="7"/>
  <rect x="204" y="194" width="492" height="452" fill="none" stroke="#C9A227" stroke-width="1.8"/>
  <rect x="${L}" y="${T}" width="${R - L}" height="${B - T}" fill="none" stroke="#4A6B3A" stroke-width="3" rx="4"/>
  ${vine}
  ${mid}
  ${pin}
  ${boss(206, 196)}${boss(694, 196)}${boss(206, 644)}${boss(694, 644)}

  <circle cx="450" cy="420" r="178" fill="url(#${p}-au)"/>
  <circle cx="450" cy="420" r="168" fill="#1B3A93"/>
  <circle cx="450" cy="420" r="146" fill="none" stroke="#C9A227" stroke-width="1.2" opacity="0.4"/>
  ${rays}
  ${ringDots}

  <path d="M450,300 C448,346 438,410 400,470 L412,540 L488,540 L500,470 C462,410 452,346 450,300 Z" fill="url(#${p}-au)"/>
  <path d="M450,304 L450,428" stroke="#1B3A93" stroke-width="6" stroke-linecap="round"/>
  <circle cx="450" cy="436" r="9" fill="#1B3A93"/>
  <path d="M414,486 L450,450 L486,486 M420,520 L450,492 L480,520" stroke="#1B3A93" stroke-width="3.4"
        opacity="0.75" fill="none" stroke-linecap="round" stroke-linejoin="round"/>

  ${diag(45)}${diag(135)}${diag(225)}${diag(315)}
`;
};

/* ============================================================ 10 孟菲斯 Memphis */
const mk10 = (p) => {
  let zig = 'M244,614';
  for (let i = 1; i <= 10; i++) zig += ` L${244 + i * 40},${i % 2 ? 588 : 614}`;
  const dots = [
    [262, 232, 7, '#FFFFFF'], [330, 296, 5, '#FF4D8D'], [636, 232, 8, '#FFFFFF'],
    [604, 288, 5, '#00B3B0'], [248, 386, 6, '#FF4D8D'], [652, 396, 5, '#FFC93C'],
    [286, 452, 5, '#FFFFFF'], [530, 214, 4, '#FFFFFF'], [422, 206, 5, '#00B3B0'],
    [662, 330, 4, '#FFFFFF'], [238, 316, 4, '#FFFFFF'], [500, 620, 5, '#FFC93C'],
  ];
  return `
  <rect x="220" y="190" width="460" height="460" rx="80" fill="#141414"/>

  <path d="M244,238 C284,198 324,198 364,238 C404,278 444,278 484,238 C524,198 564,198 604,238 C624,256 642,260 654,256"
        stroke="#FF4D8D" stroke-width="16" fill="none" stroke-linecap="round"/>

  <circle cx="352" cy="330" r="90" fill="#FFC93C"/>
  <path d="M470,300 C440,356 384,384 384,428 A86,86 0 0 0 556,428 C556,384 500,356 470,300 Z" fill="#00B3B0"/>
  <circle cx="470" cy="428" r="20" fill="#FF4D8D"/>

  <circle cx="598" cy="524" r="52" fill="#2D5BFF"/>
  <circle cx="300" cy="512" r="22" fill="#FF4D8D"/>

  <path d="${zig}" stroke="#FFFFFF" stroke-width="9" fill="none" stroke-linejoin="miter"/>

  ${dots.map(([cx, cy, r, c]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"/>`).join('')}
`;
};

/* ============================================================ 变体表 */
const VARIANTS = [
  {
    slug: '05-art-deco', num: '05', cn: '装饰艺术', en: 'Art Deco',
    paper: '#0E1F1B', ink: '#E8D48A', caption: '#7E9A8E',
    wordFont: SERIF_CN, wordSize: 74, wordSpacing: 16, wordWeight: 600,
    baseline: 768, capY: 842, markViewBox: '176 156 548 548',
    note: '对称 · 放射日冕 · 阶梯与人字纹，钢笔尖化用摩天楼轮廓',
    mark: mk5,
  },
  {
    slug: '06-constructivism', num: '06', cn: '构成主义', en: 'Constructivism',
    paper: '#E8E0CE', ink: '#141414', caption: '#7A6F5C',
    wordFont: SANS_CN, wordSize: 76, wordSpacing: 4, wordWeight: 900,
    baseline: 772, capY: 844, markViewBox: '140 160 620 520',
    note: '红黑斜切 · 楔形刺入墨点，字体作为图形参与构图',
    mark: mk6,
  },
  {
    slug: '07-art-nouveau', num: '07', cn: '新艺术运动', en: 'Art Nouveau',
    paper: '#EDE8DA', ink: '#43284A', caption: '#8A7F6B',
    wordFont: SERIF_CN, wordSize: 74, wordSpacing: 10, wordWeight: 600,
    baseline: 768, capY: 842, markViewBox: '178 148 544 544',
    note: '鞭形曲线 · 渐细笔触，笔杆化作鸢尾花茎',
    mark: mk7,
  },
  {
    slug: '08-ukiyo-e', num: '08', cn: '浮世绘', en: 'Ukiyo-e',
    paper: '#F2EAD9', ink: '#1F4A6E', caption: '#8A7F6B',
    wordFont: SERIF_CN, wordSize: 74, wordSpacing: 10, wordWeight: 600,
    baseline: 786, capY: 854, markViewBox: '160 180 560 480',
    note: '平涂设色 · 铁线轮廓，青海波与朱印，富士作远景',
    mark: mk8,
  },
  {
    slug: '09-illuminated', num: '09', cn: '泥金手抄本', en: 'Illuminated',
    paper: '#EFE4CE', ink: '#1B3A93', caption: '#8A7A5E',
    wordFont: SERIF_CN, wordSize: 74, wordSpacing: 8, wordWeight: 600,
    baseline: 772, capY: 846, markViewBox: '178 168 544 504',
    note: '金箔 · 群青 · 藤蔓全框与四角金徽，泥金装饰文法',
    mark: mk9,
  },
  {
    slug: '10-memphis', num: '10', cn: '孟菲斯', en: 'Memphis',
    paper: '#F4F1EA', ink: '#141414', caption: '#8A8A8A',
    wordFont: SANS_CN, wordSize: 76, wordSpacing: 4, wordWeight: 900,
    baseline: 752, capY: 826, markViewBox: '208 178 484 484',
    note: '撞色 · 水磨石 · 波浪与锯齿，后现代的反叛几何',
    mark: mk10,
  },
];

/* ============================================================ 渲染 */
const sheet = (v, p) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 900 900" width="900" height="900" role="img" aria-label="小说工坊 logo 设计稿 ${v.num} ${v.cn}">
  <rect width="900" height="900" fill="${v.paper}"/>
  ${v.mark(p)}
  <text x="450" y="${v.baseline}" font-family='${v.wordFont}' font-size="${v.wordSize}" font-weight="${v.wordWeight}"
        letter-spacing="${v.wordSpacing}" fill="${v.ink}" text-anchor="middle">小说工坊</text>
  <text x="450" y="${v.capY}" font-family='${SANS_CN}' font-size="19" letter-spacing="4"
        fill="${v.caption}" text-anchor="middle">${v.num} · ${v.cn} · ${v.en}</text>
</svg>
`;

const markOnly = (v, p) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${v.markViewBox}" role="img" aria-label="小说工坊 ${v.cn} 标识">
  <rect x="-2000" y="-2000" width="8000" height="8000" fill="${v.paper}"/>
  ${v.mark(p)}
</svg>
`;

mkdirSync(OUT, { recursive: true });
for (const [i, v] of VARIANTS.entries()) {
  writeFileSync(join(OUT, `${v.slug}.svg`), sheet(v, `v${i + 5}`), 'utf8');
  writeFileSync(join(OUT, `${v.slug}-mark.svg`), markOnly(v, `m${i + 5}`), 'utf8');
  console.log('wrote', `${v.slug}.svg`, `${v.slug}-mark.svg`);
}

/* ============================================================ 对比片段 */
const sheets = VARIANTS.map((v, i) => `      <figure class="draft">
        <div class="art">${sheet(v, `v${i + 5}`)}</div>
        <figcaption><b>${v.num} ${v.cn}</b><span>${v.note}</span></figcaption>
      </figure>`).join('\n');

const minis = VARIANTS.map((v, i) => `      <div class="mini" style="background:${v.paper}" title="${v.num} ${v.cn}">${markOnly(v, `n${i + 5}`)}</div>`).join('\n');

const fragment = `<div id="novel-logo-isms" class="nli">
  <style>
    #novel-logo-isms { display: block; width: 100%; }
    #novel-logo-isms .grid { display: grid; gap: 22px; width: 100%; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
    #novel-logo-isms .draft { margin: 0; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
    #novel-logo-isms .art { width: 100%; border-radius: 14px; overflow: hidden; }
    #novel-logo-isms .art svg { display: block; width: 100%; height: auto; }
    #novel-logo-isms figcaption { display: flex; flex-direction: column; gap: 2px; }
    #novel-logo-isms figcaption b { font-weight: 500; color: var(--foreground); }
    #novel-logo-isms figcaption span { color: var(--muted-foreground); font-size: 12px; line-height: 1.5; }
    #novel-logo-isms .scaleline { display: flex; align-items: center; flex-wrap: wrap; gap: 14px; margin-top: 26px; }
    #novel-logo-isms .scaleline > .lbl { color: var(--muted-foreground); font-size: 12px; }
    #novel-logo-isms .mini { width: 62px; height: 62px; border-radius: 10px; overflow: hidden; flex: none; display: grid; place-items: center; }
    #novel-logo-isms .mini svg { width: 44px; height: 44px; display: block; }
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
if (fragPath) { writeFileSync(fragPath, fragment, 'utf8'); console.log('wrote', fragPath); }
