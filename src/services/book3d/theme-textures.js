import { CanvasTexture, SRGBColorSpace } from 'three'
import { wrapBookLines as lines } from './theme-layout'

export const SPACE_COLORS = { novel:'#15324c', note:'#d1c9b7', cedar:'#21443f', violet:'#413c62', claret:'#572c3b', ink:'#141e29' }
export const LINEN_COLORS = { novel:'#dce5df', note:'#eee8d8', cedar:'#d4ded1', violet:'#ded9e4', claret:'#e8d8d4', ink:'#c7d4d0' }
const kinds = Object.keys(SPACE_COLORS)
function canvas(w=1024,h=1440) { const c=document.createElement('canvas');c.width=w;c.height=h;return c }
function rng(seed) { return () => { seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296 } }
function texture(image,color=false) { const t=new CanvasTexture(image);if(color)t.colorSpace=SRGBColorSpace;t.anisotropy=4;return t }
function titleLayout(title,ctx,font) {
  let size=[...title].length<9?140:100,rows=[]
  for(;size>=50;size-=4){ctx.font=`500 ${size}px ${font}`;rows=lines(title,ctx,790);if(rows.length<=3)break}
  if(rows.length>3){rows=rows.slice(0,3);rows[2]=rows[2].slice(0,-1)+'…'}
  return{size:Math.max(size,50),rows}
}
function paintCrop(ctx,image,x,y,w,h,back=false) {
  // Keep the useful painting interior; generated edge marks are not authorship.
  const inset=.065,iw=image.width*(1-inset*2),ih=image.height*(1-inset*2),ratio=Math.max(w/iw,h/ih)
  const sw=w/ratio,sh=h/ratio,sx=image.width*inset+(iw-sw)*(back?.76:.4),sy=image.height*inset+(ih-sh)*.45
  ctx.drawImage(image,sx,sy,sw,sh,x,y,w,h)
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
function face(book,theme,painting,back=false) {
  const base=canvas(),foil=canvas(),rough=canvas(),height=canvas(),c=base.getContext('2d'),f=foil.getContext('2d'),r=rough.getContext('2d'),b=height.getContext('2d')
  const space=theme==='gravity',kind=book.kind||'novel',title=String(book.title||'未命名作品'),author=String(book.author||'').trim(),font=space?'"Microsoft YaHei", sans-serif':getComputedStyle(document.body).getPropertyValue('--glaze-title').trim()||'KaiTi,serif'
  b.drawImage(weave(512,720,space),0,0,1024,1440)
  f.fillStyle='#000';f.fillRect(0,0,1024,1440);f.fillStyle='#fff';f.textBaseline='top'
  c.textBaseline='top';c.fillStyle=space?(SPACE_COLORS[kind]||SPACE_COLORS.novel):'#f3f0e5';c.fillRect(0,0,1024,1440)
  if(space)spaceArt(c,kind,back)
  if(!back){
    const target=space?f:c,{size,rows}=titleLayout(title,target,font)
    const header=Math.max(350,100+rows.length*size*1.23+(author?83:34))
    if(!space&&painting){paintCrop(c,painting,0,header,1024,1440-header);c.fillStyle=LINEN_COLORS[kind]||LINEN_COLORS.novel;c.fillRect(0,0,58,1440)}
    target.fillStyle=space?'#fff':'#294651';target.font=`500 ${size}px ${font}`
    rows.forEach((row,i)=>target.fillText(row,111,space?116+i*size*1.28:78+i*size*1.23))
    if(author){target.font=`39px ${font}`;target.fillText(author+' 著',113,space?1245:header-69,785)}
    if(space)foilLines(f,kind)
  } else {
    if(!space&&painting){paintCrop(c,painting,0,875,1024,565,true);c.fillStyle=LINEN_COLORS[kind]||LINEN_COLORS.novel;c.fillRect(966,0,58,1440)}
    const target=space?f:c;target.fillStyle=space?'#fff':'#36515a';target.font=`51px ${font}`;target.fillText(title,113,118,790)
    const intro=String(book.intro||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()
    target.font=`39px ${font}`;lines(intro,target,780).slice(0,8).forEach((row,i)=>target.fillText(row,113,257+i*66))
    if(author){target.font=`36px ${font}`;target.fillText(author,113,800,780)}
    if(space)foilLines(f,kind)
  }
  if(space){
    const mask=f.getImageData(0,0,1024,1440),pixels=c.getImageData(0,0,1024,1440),roughness=r.createImageData(1024,1440),relief=b.getImageData(0,0,1024,1440)
    const gold=kind==='note'?[66,78,85]:[210,190,154]
    for(let i=0;i<pixels.data.length;i+=4){const a=mask.data[i]/255;for(let k=0;k<3;k++)pixels.data[i+k]=pixels.data[i+k]*(1-a)+gold[k]*a;const v=201-132*a;roughness.data.set([v,v,v,255],i);if(a>.2)relief.data[i]=relief.data[i+1]=relief.data[i+2]=115}
    c.putImageData(pixels,0,0);r.putImageData(roughness,0,0);b.putImageData(relief,0,0)
  }else{
    const color=c.getImageData(0,0,1024,1440),p=b.getImageData(0,0,1024,1440)
    for(let i=0;i<p.data.length;i+=4){const lum=(color.data[i]+color.data[i+1]+color.data[i+2])/3,v=p.data[i]*.65+lum*.35;p.data[i]=p.data[i+1]=p.data[i+2]=v}
    b.putImageData(p,0,0);r.fillStyle='#c8c8c8';r.fillRect(0,0,1024,1440)
  }
  return {map:texture(base,true),bumpMap:texture(height),roughnessMap:texture(rough),...(space?{metalnessMap:texture(foil)}:{})}
}
export function themeTextures(book,theme,painting) {
  const space=theme==='gravity',kind=book.kind||'novel',cloth=weave(256,512,false),spine=canvas(192,1440),s=spine.getContext('2d')
  s.fillStyle=space?'#14212d':LINEN_COLORS[kind]||LINEN_COLORS.novel;s.fillRect(0,0,192,1440)
  s.fillStyle=space?'#c5b396':'#38525a';s.textBaseline='top';s.textAlign='center'
  const chars=[...String(book.title||'未命名作品')],size=Math.min(66,1020/Math.max(chars.length,1)/1.25)
  s.font=`${size}px ${space?'"Microsoft YaHei",sans-serif':'KaiTi,serif'}`;chars.forEach((ch,i)=>s.fillText(ch,96,190+i*size*1.25,150))
  if(space){s.fillRect(32,101,128,4);s.fillRect(32,1304,128,4)}
  const paper=canvas(256,256),p=paper.getContext('2d');p.fillStyle=space?'#e4e0d3':'#f1e9d6';p.fillRect(0,0,256,256)
  const rand=rng(57);for(let x=0;x<256;x+=3){p.fillStyle='#8e806625';p.fillRect(x,0,1+rand(),256)}
  for(let x=5;x<256;x+=19+Math.floor(rand()*5)){p.fillStyle='#8c7e6560';p.fillRect(x,0,3,256)}
  const seam=p.createLinearGradient(0,0,256,0);seam.addColorStop(0,'#534a3d66');seam.addColorStop(.1,'#534a3d00');seam.addColorStop(.9,'#534a3d00');seam.addColorStop(1,'#534a3d66');p.fillStyle=seam;p.fillRect(0,0,256,256)
  return {front:face(book,theme,painting),back:face(book,theme,painting,true),spine:{map:texture(spine,true),bumpMap:texture(weave(48,720,false))},cloth:texture(cloth),paper:texture(paper,true)}
}
