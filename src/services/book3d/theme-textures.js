import { CanvasTexture, SRGBColorSpace } from 'three'
import { textureCanvas, textureFont } from './drawing'
import { wrapBookLines as lines } from './theme-layout'
import { clothOf, isVerticalTitle, sealChar } from './glaze-cloth'

export const SPACE_COLORS = { novel:'#15324c', note:'#d1c9b7', cedar:'#21443f', violet:'#413c62', claret:'#572c3b', ink:'#141e29' }
const kinds = Object.keys(SPACE_COLORS)
const canvas = textureCanvas
function rng(seed) { return () => { seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296 } }
function texture(image,color=false) { const t=new CanvasTexture(image);if(color)t.colorSpace=SRGBColorSpace;t.anisotropy=4;return t }
function titleLayout(title,ctx,font) {
  let size=[...title].length<9?140:100,rows=[]
  for(;size>=50;size-=4){ctx.font=`500 ${size}px ${font}`;rows=lines(title,ctx,790);if(rows.length<=3)break}
  if(rows.length>3){rows=rows.slice(0,3);rows[2]=rows[2].slice(0,-1)+'…'}
  return{size:Math.max(size,50),rows}
}
function weave(w=512,h=720,space=false) {
  const c=canvas(w,h),ctx=c.getContext('2d'),p=ctx.createImageData(w,h),rand=rng(813)
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const value=space?127+(rand()-.5)*54:132+Math.cos(x*1.45)*18+Math.cos(y*1.58)*13+(rand()-.5)*7
    p.data.set([value,value,value,255],(y*w+x)*4)
  }
  ctx.putImageData(p,0,0);return c
}
function spaceArt(ctx,kind,back=false) {
  const index=Math.max(0,kinds.indexOf(kind)),rand=rng(72+index*127),color=SPACE_COLORS[kind]||SPACE_COLORS.novel
  ctx.fillStyle=color;ctx.fillRect(0,0,1024,1440)
  const haze=ctx.createRadialGradient(750,1020,20,750,1020,800)
  haze.addColorStop(0,kind==='note'?'#ffffff60':'#a8cbe22c');haze.addColorStop(1,'#00000000');ctx.fillStyle=haze;ctx.fillRect(0,400,1024,1040)
  for(let i=0;i<160;i++){const x=rand()*1024,y=480+rand()*960;ctx.fillStyle=kind==='note'?'#203b4a50':`rgba(201,221,230,${.1+rand()*.4})`;ctx.fillRect(x,y,rand()> .97?3:1.2,1.2)}
  const cx=[900,810,840,650,280,720][index],cy=[1180,1170,1240,1320,1300,1100][index],r=[640,630,640,680,610,480][index]
  ctx.save();if(back)ctx.globalAlpha=.35
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip()
  const surface=ctx.createRadialGradient(cx-r*.47,cy-r*.66,0,cx+r*.2,cy+r*.2,r*1.5)
  const colors=kind==='note'?['#eee7d4','#9c9b91','#3b4548']:kind==='cedar'?['#659287','#315b53','#0c1c22']:kind==='violet'?['#9a99b4','#575171','#161d30']:kind==='claret'?['#b27c79','#623d48','#1a1d2a']:kind==='ink'?['#617b8d','#142330','#080f18']:['#839eaf','#365b75','#101e30']
  surface.addColorStop(0,colors[0]);surface.addColorStop(.44,colors[1]);surface.addColorStop(1,colors[2]);ctx.fillStyle=surface;ctx.fillRect(0,400,1024,1040)
  for(let i=0;i<4300;i++){const x=cx-r+rand()*r*2,y=cy-r+rand()*r*2;ctx.fillStyle=rand()>.5?'#d4e2e90d':'#0b182018';ctx.beginPath();ctx.ellipse(x,y,2+rand()*22,1+rand()*4,-.32,0,Math.PI*2);ctx.fill()}
  const terminator=ctx.createLinearGradient(cx-r,cy-r,cx+r*.75,cy+r*.3);terminator.addColorStop(0,'#09121d00');terminator.addColorStop(.47,'#09121d08');terminator.addColorStop(.73,'#09121db3');terminator.addColorStop(1,'#070d16f5');ctx.fillStyle=terminator;ctx.fillRect(0,400,1024,1040)
  ctx.restore()
  ctx.strokeStyle=kind==='note'?'#435562b3':'#9fb6c6a0';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(650,1005,700,181,-.38,0,Math.PI*2);ctx.stroke()
  ctx.strokeStyle='#c6986db0';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(640,1020,640,310,.3,0,Math.PI*2);ctx.stroke()
}
function foilLines(ctx,kind) {
  ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(107,1330);ctx.lineTo(190,1330);ctx.stroke()
  ctx.fillStyle='#fff';ctx.fillRect(106,1321,8,18)
  ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(650,1005,700,181,-.38,.15,Math.PI*.85);ctx.stroke()
}

function goldFill(ctx, cloth, kind, inset) {
  const highlight = kind === 'note' ? '#c9a86a' : '#f0d9a4'
  const fill = ctx.createLinearGradient(inset, inset, 1024 - inset, 1440 - inset)
  fill.addColorStop(0, cloth.rule)
  fill.addColorStop(.28, highlight)
  fill.addColorStop(.55, cloth.rule)
  fill.addColorStop(.78, highlight)
  fill.addColorStop(1, cloth.rule)
  return fill
}
function foilRect(ctx, rough, x, y, w, h, fill) {
  ctx.fillStyle = fill
  ctx.fillRect(x, y, w, h)
  rough.fillStyle = '#4a4a4a'
  rough.fillRect(x, y, w, h)
}
function foilText(ctx, rough, text, x, y, font, fill, maxWidth, align = 'center', baseline = 'top') {
  for (const target of [ctx, rough]) {
    target.font = font
    target.textAlign = align
    target.textBaseline = baseline
    target.fillStyle = target === ctx ? fill : '#4a4a4a'
    if (maxWidth) target.fillText(text, x, y, maxWidth)
    else target.fillText(text, x, y)
  }
}
function paintSeal(ctx, cloth, author, title, font, y = 1256) {
  const ch = sealChar({ author, title })
  const x = 485
  ctx.fillStyle = cloth.seal
  ctx.fillRect(x, y, 54, 54)
  ctx.strokeStyle = '#fff8e866'
  ctx.lineWidth = 2
  ctx.strokeRect(x + 4, y + 4, 46, 46)
  ctx.fillStyle = '#fff8ec'
  ctx.font = `700 34px ${font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(ch, 512, y + 29)
}
function clothFace(book, back = false, font = textureFont('glaze')) {
  const base = canvas(), rough = canvas(), height = canvas()
  const c = base.getContext('2d'), r = rough.getContext('2d'), b = height.getContext('2d')
  const kind = book.kind || 'novel', title = String(book.title || '未命名作品'), author = String(book.author || '').trim(), cloth = clothOf(kind)
  b.drawImage(weave(512, 720, false), 0, 0, 1024, 1440)
  c.fillStyle = cloth.board
  c.fillRect(0, 0, 1024, 1440)
  const sheen = c.createLinearGradient(0, 0, 1024, 1440)
  sheen.addColorStop(0, 'rgba(255,255,255,.075)')
  sheen.addColorStop(.52, 'rgba(255,255,255,0)')
  sheen.addColorStop(1, 'rgba(0,0,0,.09)')
  c.fillStyle = sheen
  c.fillRect(0, 0, 1024, 1440)
  r.fillStyle = '#e2e2e2'
  r.fillRect(0, 0, 1024, 1440)
  c.textBaseline = 'top'
  c.textAlign = 'center'
  const foil = goldFill(c, cloth, kind, 72)
  const titleFill = kind === 'note' ? cloth.title : foil
  const inset = 72, inner = inset + 16
  foilRect(c, r, inset, inset, 880, 3, foil)
  foilRect(c, r, inset, 1440 - inset - 3, 880, 3, foil)
  foilRect(c, r, inset, inset, 3, 882, foil)
  foilRect(c, r, 1024 - inset - 3, inset, 3, 882, foil)
  foilRect(c, r, inner, inner, 1024 - inner * 2, 1, foil)
  foilRect(c, r, inner, 1440 - inner - 1, 1024 - inner * 2, 1, foil)
  foilRect(c, r, inner, inner, 1, 1440 - inner * 2, foil)
  foilRect(c, r, 1024 - inner - 1, inner, 1, 1440 - inner * 2, foil)

  if (!back) {
    if (isVerticalTitle(title)) {
      const chars = [...title], available = 880
      const size = Math.min(132, available / Math.max(chars.length, 1) / 1.08)
      const step = size * 1.08, total = chars.length * step
      const start = 180 + (available - total) / 2
      chars.forEach((ch, i) => foilText(c, r, ch, 512, start + i * step, `500 ${size}px ${font}`, titleFill))
    } else {
      const { size, rows } = titleLayout(title, c, font)
      const start = 180 + (880 - rows.length * size * 1.23) / 2
      rows.forEach((row, i) => foilText(c, r, row, 512, start + i * size * 1.23, `500 ${size}px ${font}`, titleFill))
    }
    if (author) foilText(c, r, author + ' 著', 512, 1188, `500 40px ${font}`, cloth.author)
    paintSeal(c, cloth, author, title, font)
  } else {
    const titleSize = 50
    const backRows = lines(title, c, 800).slice(0, 2)
    if (backRows.length > 1) backRows[1] = backRows[1].slice(0, -1) + '…'
    backRows.forEach((row, i) => foilText(c, r, row, 512, 112 + i * titleSize * 1.25, `500 ${titleSize}px ${font}`, titleFill, 800))
    const intro = String(book.intro || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    c.font = `400 36px ${font}`
    c.fillStyle = cloth.author
    c.textAlign = 'left'
    c.textBaseline = 'top'
    const introRows = intro ? lines(intro, c, 780).slice(0, 8) : []
    introRows.forEach((row, i) => c.fillText(row, 122, 260 + i * 52))
    if (author) foilText(c, r, author + ' 著', 512, 1184, `500 38px ${font}`, cloth.author)
    paintSeal(c, cloth, author, title, font, 1248)
  }
  return { map: texture(base, true), bumpMap: texture(height), roughnessMap: texture(rough) }
}

function face(book, theme, back = false, font = textureFont(theme)) {
  if (theme !== 'gravity') return clothFace(book, back, font)
  const base=canvas(),foil=canvas(),rough=canvas(),height=canvas(),c=base.getContext('2d'),f=foil.getContext('2d'),r=rough.getContext('2d'),b=height.getContext('2d')
  const kind=book.kind||'novel',title=String(book.title||'未命名作品'),author=String(book.author||'').trim()
  b.drawImage(weave(512,720,true),0,0,1024,1440)
  f.fillStyle='#000';f.fillRect(0,0,1024,1440);f.fillStyle='#fff';f.textBaseline='top'
  c.textBaseline='top';c.fillStyle=SPACE_COLORS[kind]||SPACE_COLORS.novel;c.fillRect(0,0,1024,1440)
  spaceArt(c,kind,back)
  if(!back){
    const {size,rows}=titleLayout(title,f,font)
    f.fillStyle='#fff';f.font=`500 ${size}px ${font}`
    rows.forEach((row,i)=>f.fillText(row,111,116+i*size*1.28))
    if(author){f.font=`39px ${font}`;f.fillText(author+' 著',113,1245,785)}
    foilLines(f,kind)
  } else {
    f.fillStyle='#fff';f.font=`51px ${font}`;f.fillText(title,113,118,790)
    const intro=String(book.intro||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()
    f.font=`39px ${font}`;lines(intro,f,780).slice(0,8).forEach((row,i)=>f.fillText(row,113,257+i*66))
    if(author){f.font=`36px ${font}`;f.fillText(author,113,800,780)}
    foilLines(f,kind)
  }
  const mask=f.getImageData(0,0,1024,1440),pixels=c.getImageData(0,0,1024,1440),roughness=r.createImageData(1024,1440),relief=b.getImageData(0,0,1024,1440)
  const gold=kind==='note'?[66,78,85]:[210,190,154]
  for(let i=0;i<pixels.data.length;i+=4){const a=mask.data[i]/255;for(let k=0;k<3;k++)pixels.data[i+k]=pixels.data[i+k]*(1-a)+gold[k]*a;const v=201-132*a;roughness.data.set([v,v,v,255],i);if(a>.2)relief.data[i]=relief.data[i+1]=relief.data[i+2]=115}
  c.putImageData(pixels,0,0);r.putImageData(roughness,0,0);b.putImageData(relief,0,0)
  return {map:texture(base,true),bumpMap:texture(height),roughnessMap:texture(rough),metalnessMap:texture(foil)}
}
export function themeTextures(book,theme,font=textureFont(theme)) {
  const space=theme==='gravity',kind=book.kind||'novel',cloth=weave(256,512,false),spine=canvas(192,1440),s=spine.getContext('2d')
  const palette=clothOf(kind)
  s.fillStyle=space?'#14212d':palette.board;s.fillRect(0,0,192,1440)
  s.fillStyle=space?'#c5b396':palette.title;s.textBaseline='top';s.textAlign='center'
  const chars=[...String(book.title||'未命名作品')],size=Math.min(66,1020/Math.max(chars.length,1)/1.25)
  s.font=`${size}px ${space?'"Microsoft YaHei",sans-serif':font}`;chars.forEach((ch,i)=>s.fillText(ch,96,190+i*size*1.25,150))
  if(space){s.fillRect(32,101,128,4);s.fillRect(32,1304,128,4)}
  else {s.fillStyle=palette.rule;s.fillRect(32,101,128,4);s.fillRect(32,1304,128,4)}
  const paper=canvas(256,256),p=paper.getContext('2d');p.fillStyle=space?'#e4e0d3':'#f1e9d6';p.fillRect(0,0,256,256)
  const rand=rng(57);for(let x=0;x<256;x+=3){p.fillStyle='#8e806625';p.fillRect(x,0,1+rand(),256)}
  for(let x=5;x<256;x+=19+Math.floor(rand()*5)){p.fillStyle='#8c7e6560';p.fillRect(x,0,3,256)}
  const seam=p.createLinearGradient(0,0,256,0);seam.addColorStop(0,'#534a3d66');seam.addColorStop(.1,'#534a3d00');seam.addColorStop(.9,'#534a3d00');seam.addColorStop(1,'#534a3d66');p.fillStyle=seam;p.fillRect(0,0,256,256)
  return {front:face(book,theme,false,font),back:face(book,theme,true,font),spine:{map:texture(spine,true),bumpMap:texture(weave(48,720,false))},cloth:texture(cloth),paper:texture(paper,true)}
}
