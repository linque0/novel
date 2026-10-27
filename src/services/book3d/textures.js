import { CanvasTexture, SRGBColorSpace, RepeatWrapping } from 'three'

export const BOOK_COLORS={novel:'#2f4a6b',note:'#e6d9bd',cedar:'#3f5b4c',violet:'#5b4666',claret:'#6f2f2c',ink:'#23282a'}
export function bookKey(book){return JSON.stringify([book.id,book.kind,book.title,book.author,book.intro])}
const family=()=>getComputedStyle(document.body).getPropertyValue('--crimson-serif').trim()||'SimSun, serif'
function canvas(w=1024,h=1440){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
function texture(c,color=false){const t=new CanvasTexture(c);if(color)t.colorSpace=SRGBColorSpace;t.anisotropy=4;return t}
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296}}
let leatherPattern
function leatherRelief(){
  if(leatherPattern)return leatherPattern
  const c=canvas(512,720),ctx=c.getContext('2d'),pixels=ctx.createImageData(c.width,c.height),rng=random(731),pitch=5
  const cols=Math.ceil(c.width/pitch)+2,rows=Math.ceil(c.height/pitch)+2,sites=[]
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)sites.push([(x-1+.15+rng()*.7)*pitch,(y-1+.15+rng()*.7)*pitch])
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
    const gx=Math.floor(x/pitch)+1,gy=Math.floor(y/pitch)+1;let nearest=1e6,second=1e6
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const p=sites[(gy+dy)*cols+gx+dx];if(!p)continue
      const d=Math.hypot(p[0]-x,p[1]-y)
      if(d<nearest){second=nearest;nearest=d}else if(d<second)second=d
    }
    const gap=second-nearest,crease=Math.exp(-gap*3.1),value=151-65*crease+(rng()-.5)*13
    pixels.data.set([value,value,value,255],(y*c.width+x)*4)
  }
  ctx.putImageData(pixels,0,0);leatherPattern=c;return c
}
function wrap(text,ctx,width,max=20){const rows=[];let line='';for(const char of [...text]){if(char==='\n'){rows.push(line);line='';continue}if(ctx.measureText(line+char).width>width&&line){rows.push(line);line=char}else line+=char;if(rows.length===max)break}if(line&&rows.length<max)rows.push(line);return rows}
function cornerFrame(ctx,w,h){
  ctx.lineWidth=3;ctx.strokeStyle='#fff';ctx.beginPath();ctx.roundRect(62,62,w-124,h-124,15);ctx.stroke()
  ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(78,78,w-156,h-156,10);ctx.stroke()
  for(const [x,y,sx,sy] of [[92,92,1,1],[w-92,92,-1,1],[92,h-92,1,-1],[w-92,h-92,-1,-1]]){
    ctx.save();ctx.translate(x,y);ctx.scale(sx,sy);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,48);ctx.bezierCurveTo(0,12,12,0,48,0);ctx.moveTo(0,25);ctx.bezierCurveTo(12,25,25,12,25,0);ctx.stroke();ctx.restore()
  }
}
function moon(ctx,x,y,r){ctx.save();ctx.translate(x,y);ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,r-13,-.25,Math.PI*1.4);ctx.stroke();ctx.beginPath();ctx.arc(13,-5,r*.64,-1.8,1.6);ctx.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(Math.cos(a)*(r+8),Math.sin(a)*(r+8));ctx.lineTo(Math.cos(a)*(r+19),Math.sin(a)*(r+19));ctx.stroke()}ctx.restore()}
function masks(book,back=false){
  const color=BOOK_COLORS[book.kind]||BOOK_COLORS.novel
  const base=canvas(),foil=canvas(),height=canvas(),rough=canvas()
  const ctx=base.getContext('2d'),f=foil.getContext('2d'),b=height.getContext('2d'),r=rough.getContext('2d')
  ctx.fillStyle=color;ctx.fillRect(0,0,1024,1440);f.fillStyle='#000';f.fillRect(0,0,1024,1440)
  const grain=leatherRelief()
  b.drawImage(grain,0,0,1024,1440)
  ctx.save();ctx.globalAlpha=.14;ctx.globalCompositeOperation='soft-light';ctx.drawImage(grain,0,0,1024,1440);ctx.restore()
  f.fillStyle='#fff';f.strokeStyle='#fff';cornerFrame(f,1024,1440)
  const title=String(book.title||'未命名作品'),author=String(book.author||'').trim()
  const font=family();f.textBaseline='top'
  if(!back){
    moon(f,783,286,105)
    const inset=b.createRadialGradient(783,286,0,783,286,105)
    inset.addColorStop(0,'#bdbdbd');inset.addColorStop(.86,'#b5b5b5');inset.addColorStop(.94,'#707070');inset.addColorStop(1,'#ffffff')
    b.save();b.globalCompositeOperation='multiply';b.fillStyle=inset;b.beginPath();b.arc(783,286,105,0,Math.PI*2);b.fill();b.restore()
    const chars=[...title]
    if(chars.length<=4){f.font=`148px ${font}`;chars.forEach((char,i)=>f.fillText(char,135,190+i*184))}
    else {
      const size=chars.length<=8?123:chars.length<=16?94:chars.length<=28?77:64
      f.font=`${size}px ${font}`;const lines=wrap(title,f,740,6)
      lines.forEach((line,i)=>f.fillText(line,138,477+i*size*1.48))
    }
    f.lineWidth=2;f.beginPath();f.moveTo(140,1159);f.lineTo(320,1159);f.stroke()
    if(author){f.font=`48px ${font}`;f.fillText(author+' 著',140,1213,735)}
  } else {
    moon(f,512,300,116)
    f.textAlign='center';f.font=`61px ${font}`;f.fillText(title,512,482,760);f.textAlign='left'
    const intro=String(book.intro||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()
    if(intro){f.font=`42px ${font}`;wrap(intro,f,735,7).forEach((line,i)=>f.fillText(line,145,651+i*73))}
    else{f.lineWidth=2;for(const y of[733,766,799]){f.beginPath();f.moveTo(382,y);f.lineTo(642,y);f.stroke()}}
    if(author){f.textAlign='center';f.font=`44px ${font}`;f.fillText(author,512,1225,720)}
  }
  // The very same artwork mask governs gold color, metalness and roughness.
  const gold=canvas(),g=gold.getContext('2d');g.drawImage(foil,0,0);g.globalCompositeOperation='source-in';g.fillStyle=book.kind==='note'?'#927047':'#dfbf78';g.fillRect(0,0,1024,1440)
  // Black parts of the mask are transparent when compositing printed color.
  const mask=f.getImageData(0,0,1024,1440),goldPixels=g.getImageData(0,0,1024,1440)
  const relief=b.getImageData(0,0,1024,1440)
  for(let i=0;i<mask.data.length;i+=4)goldPixels.data[i+3]=mask.data[i]
  for(let i=0;i<mask.data.length;i+=4){const a=mask.data[i]/255,v=relief.data[i]*(1-a)+111*a;relief.data[i]=relief.data[i+1]=relief.data[i+2]=v}
  b.putImageData(relief,0,0)
  g.putImageData(goldPixels,0,0);ctx.drawImage(gold,0,0)
  r.fillStyle='#b3b3b3';r.fillRect(0,0,1024,1440);r.globalCompositeOperation='source-over'
  const roughPixels=r.getImageData(0,0,1024,1440)
  for(let i=0;i<mask.data.length;i+=4){const v=Math.round(178-mask.data[i]/255*113);roughPixels.data[i]=roughPixels.data[i+1]=roughPixels.data[i+2]=v}
  r.putImageData(roughPixels,0,0)
  return {map:texture(base,true),metalnessMap:texture(foil),roughnessMap:texture(rough),bumpMap:texture(height)}
}
function spine(book){
  const base=canvas(192,1440),foil=canvas(192,1440),rough=canvas(192,1440),height=canvas(192,1440),c=base.getContext('2d'),f=foil.getContext('2d')
  height.getContext('2d').drawImage(leatherRelief(),0,0,192,1440)
  c.fillStyle=BOOK_COLORS[book.kind]||BOOK_COLORS.novel;c.fillRect(0,0,192,1440);f.fillStyle='#000';f.fillRect(0,0,192,1440);f.fillStyle='#fff';f.strokeStyle='#fff';f.textAlign='center';f.textBaseline='top'
  const chars=[...String(book.title||'未命名作品')],size=Math.min(67,950/Math.max(1,chars.length)/1.3);f.font=`${size}px ${family()}`
  chars.forEach((char,i)=>f.fillText(char,96,220+i*size*1.3,148));for(const y of[120,137,1278,1295])f.fillRect(12,y,168,4)
  const pixels=f.getImageData(0,0,192,1440),p=c.getImageData(0,0,192,1440),r=rough.getContext('2d').createImageData(192,1440)
  for(let i=0;i<p.data.length;i+=4){const a=pixels.data[i]/255;for(let k=0;k<3;k++)p.data[i+k]=p.data[i+k]*(1-a)+[223,191,120][k]*a;const v=178-113*a;r.data.set([v,v,v,255],i)}
  c.putImageData(p,0,0);rough.getContext('2d').putImageData(r,0,0)
  return{map:texture(base,true),metalnessMap:texture(foil),roughnessMap:texture(rough),bumpMap:texture(height)}
}
export function bookTextures(book){
  const leather=texture(leatherRelief());leather.wrapS=leather.wrapT=RepeatWrapping;leather.repeat.set(1,1)
  const paperCanvas=canvas(512,512),p=paperCanvas.getContext('2d'),rng=random(921)
  p.fillStyle='#eee5ce';p.fillRect(0,0,512,512)
  for(let x=0;x<512;x+=2+Math.floor(rng()*3)){p.fillStyle=`rgba(126,107,72,${.07+rng()*.13})`;p.fillRect(x,0,1,512)}
  for(let x=0;x<512;x+=29+Math.floor(rng()*7)){p.fillStyle='#9c89695c';p.fillRect(x,0,6,512)}
  const seam=p.createLinearGradient(0,0,512,0);seam.addColorStop(0,'#5e493e55');seam.addColorStop(.09,'#5e493e00');seam.addColorStop(.91,'#5e493e00');seam.addColorStop(1,'#5e493e55');p.fillStyle=seam;p.fillRect(0,0,512,512)
  const paper=texture(paperCanvas,true)
  return{front:masks(book),back:masks(book,true),spine:spine(book),leather,paper}
}
