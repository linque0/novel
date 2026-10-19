// 自绘矿彩背景。没有位图依赖，也不访问作品或偏好存储。
export function mountPainting(doc) {
  const win = doc.defaultView;
  const canvas = doc.createElement('canvas');
  canvas.id = 'flow-painting';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position:'fixed', inset:'0', width:'100%', height:'100%', pointerEvents:'none', zIndex:'0' });
  doc.body.prepend(canvas);
  const ctx = canvas.getContext('2d', {alpha:false});
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  let width=0, height=0, dpr=1, time=6.5, last=0, drawn=0, raf=0, paused=reduced.matches, disposed=false;
  let paper, bands=[];
  let seed=47;
  const random=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646};
  const smooth=x=>x*x*(3-2*x);
  const lerp=(a,b,t)=>a+(b-a)*t;
  const curves=[
    { points:[[1.09,.12],[.77,.08],[.67,.24],[.84,.37],[1.04,.52],[1.01,.71],[.72,.73],[.53,.74],[.49,.62],[.64,.57]], size:94, rgb:[34,124,130], alpha:.44, phase:0 },
    { points:[[1.12,.16],[.84,.12],[.75,.28],[.91,.43],[1.07,.59],[.88,.76],[.64,.70],[.48,.65],[.58,.57],[.70,.62]], size:68, rgb:[111,174,155], alpha:.38, phase:1.8 },
    { points:[[1.08,.09],[.96,.12],[.85,.22],[.94,.33],[1.09,.47],[.93,.62],[.76,.64],[.66,.65],[.59,.62],[.56,.58]], size:44, rgb:[204,148,119], alpha:.36, phase:3.9 },
    { points:[[1.1,.24],[.84,.18],[.78,.30],[.93,.44],[1.1,.59],[.93,.79],[.71,.76],[.56,.76],[.48,.70],[.54,.63]], size:33, rgb:[237,246,224], alpha:.76, phase:2.7 }
  ];
  function sample(points){
    const out=[];
    for(let segment=0;segment<3;segment++){
      const p=points.slice(segment*3,segment*3+4);
      for(let k=0;k<100;k++){
        const t=k/99,u=1-t;
        const x=u*u*u*p[0][0]+3*u*u*t*p[1][0]+3*u*t*t*p[2][0]+t*t*t*p[3][0];
        const y=u*u*u*p[0][1]+3*u*u*t*p[1][1]+3*u*t*t*p[2][1]+t*t*t*p[3][1];
        out.push({x:x*width,y:y*height});
      }
    }
    return out.map((p,i)=>{
      const before=out[Math.max(0,i-1)],after=out[Math.min(out.length-1,i+1)];
      const length=Math.hypot(after.x-before.x,after.y-before.y)||1;
      return {...p,nx:-(after.y-before.y)/length,ny:(after.x-before.x)/length};
    });
  }
  function line(points, offset=0, start=0, end=points.length, wiggle=0){
    ctx.beginPath();
    for(let i=start;i<end;i++){
      const p=points[i],delta=offset+Math.sin(i*.21)*wiggle+Math.sin(i*.067)*wiggle*.6;
      const x=p.x+p.nx*delta,y=p.y+p.ny*delta;
      if(i===start)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
  }
  function thickness(i,n){
    const t=i/(n-1);
    return Math.pow(Math.sin(Math.PI*t),.65)*(.73+.19*Math.sin(t*9)+.08*Math.sin(t*24));
  }
  function silhouette(band){
    ctx.beginPath();
    for(const side of [1,-1]){
      for(let j=0;j<band.points.length;j++){
        const i=side===1?j:band.points.length-1-j,p=band.points[i];
        const edge=band.size*thickness(i,band.points.length)+Math.sin(i*1.72)*1.1+Math.sin(i*.43)*1.8;
        const x=p.x+p.nx*edge*side,y=p.y+p.ny*edge*side;
        if(j===0&&side===1)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
    }
    ctx.closePath();
  }
  function makePaper(){
    paper=doc.createElement('canvas');paper.width=360;paper.height=360;
    const p=paper.getContext('2d'), data=p.createImageData(360,360);
    seed=47;
    for(let i=0;i<data.data.length;i+=4){
      const n=Math.round(random()*24);
      data.data[i]=97+n;data.data[i+1]=127+n;data.data[i+2]=128+n;data.data[i+3]=Math.round(random()*11);
    }
    p.putImageData(data,0,0);
  }
  function resize(){
    width=win.innerWidth;height=win.innerHeight;dpr=Math.min(win.devicePixelRatio||1,1.5);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    bands=curves.map(c=>({...c,points:sample(c.points),size:c.size*Math.min(width/1440,height/900)}));
    makePaper();render();
  }
  function render(){
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const bg=ctx.createLinearGradient(0,0,width,height);
    bg.addColorStop(0,'#f6f5ed');bg.addColorStop(.45,'#e8f1ef');bg.addColorStop(1,'#dceceb');
    ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
    // 大面积画纸上的极淡水色，左侧信息区保持低细节。
    const wash=ctx.createRadialGradient(width*.87,height*.46,0,width*.87,height*.46,width*.42);
    wash.addColorStop(0,'rgba(144,197,190,.21)');wash.addColorStop(1,'rgba(144,197,190,0)');
    ctx.fillStyle=wash;ctx.fillRect(0,0,width,height);
    ctx.lineCap='round';ctx.lineJoin='round';
    for(const band of bands){
      const pts=band.points,phase=time*.13+band.phase;
      const moving=ctx.createLinearGradient(width*.55+Math.sin(phase)*width*.05,0,width*1.07,height*.83);
      const [r,g,b]=band.rgb;
      moving.addColorStop(0,`rgba(${r},${g},${b},.04)`);
      moving.addColorStop(.28,`rgba(${r},${g},${b},${band.alpha*.8})`);
      moving.addColorStop(.57,`rgba(${r},${g},${b},${band.alpha})`);
      moving.addColorStop(1,`rgba(${r},${g},${b},.02)`);
      ctx.save();silhouette(band);ctx.clip();
      ctx.fillStyle=moving;ctx.fillRect(0,0,width,height);
      // 非等距细线表现矿彩的聚散与干刷，收笔自然变细。
      for(let j=0;j<33;j++){
        const offset=Math.sin(j*12.9898)*band.size*.94;
        ctx.strokeStyle=j%3===0?'#f7f8e5':`rgb(${r*.65},${g*.72},${b*.72})`;
        ctx.lineWidth=.5+(Math.sin(j*5.31)+1)*2.4;
        ctx.globalAlpha=.025+.035*(Math.sin(j*2.37)+1);
        line(pts,offset,0,pts.length,2.8);ctx.stroke();
      }
      ctx.globalAlpha=1;
      // 染色沿既有笔触推进，保持纸上构图和全部点击位置稳定。
      const progress=((time+band.phase*4)%27)/27;
      const head=Math.floor(lerp(20,pts.length-1,smooth(progress)));
      const start=Math.max(0,head-57);
      const fade=Math.min(1,progress*9,(1-progress)*9);
      for(let j=-5;j<=5;j++){
        ctx.globalAlpha=fade*.31*(1-Math.abs(j)/7);
        ctx.strokeStyle=`rgb(${r},${g},${b})`;ctx.lineWidth=band.size/7;
        line(pts,j*band.size/6,start,head,1);ctx.stroke();
      }
      ctx.globalAlpha=.35;
      const edge=ctx.createLinearGradient(width*.6,height*.7,width,height*.2);
      edge.addColorStop(0,'#a6c9c0');edge.addColorStop(.48,'#fbfcf3');edge.addColorStop(.7,'#bbd5cc');edge.addColorStop(1,'#fffbed');
      ctx.strokeStyle=edge;ctx.lineWidth=1.2;
      line(pts,-band.size*.65,0,pts.length,.6);ctx.stroke();
      ctx.globalAlpha=1;
      const tip=pts[Math.max(0,head-14)];
      const glow=ctx.createRadialGradient(tip.x,tip.y,0,tip.x,tip.y,band.size*2.2);
      glow.addColorStop(0,'rgba(255,253,225,.42)');
      glow.addColorStop(.4,'rgba(240,250,232,.14)');glow.addColorStop(1,'rgba(240,250,232,0)');
      ctx.globalAlpha=fade;ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);ctx.globalAlpha=1;
      ctx.restore();
    }
    // 一笔香槟色游丝呼应颜料的流向；不是独立漂浮粒子。
    const pts=bands[0].points;
    ctx.strokeStyle='#bba47c';ctx.lineWidth=.8;ctx.globalAlpha=.48;
    line(pts,25,38,270,1.3);ctx.stroke();
    const spot=(time*.016)%1;
    const start=Math.floor(spot*255),end=Math.min(pts.length,start+32);
    ctx.strokeStyle='#fffdf1';ctx.lineWidth=2;ctx.globalAlpha=.65;
    line(pts,25,start,end,1.3);ctx.stroke();ctx.globalAlpha=1;
    // 卡片集合前的画纸留白；颜色自然收束，不留下硬边。
    const veil=ctx.createLinearGradient(0,height*.72,0,height);
    veil.addColorStop(0,'rgba(232,241,239,0)');veil.addColorStop(1,'rgba(232,241,239,.93)');
    ctx.fillStyle=veil;ctx.fillRect(0,0,width,height);
    ctx.fillStyle=ctx.createPattern(paper,'repeat');ctx.fillRect(0,0,width,height);
  }
  function tick(stamp){
    raf=0;if(disposed||paused||doc.hidden)return;
    if(last)time+=Math.min((stamp-last)/1000,.08);
    last=stamp;
    if(stamp-drawn>1000/30){render();drawn=stamp}
    raf=win.requestAnimationFrame(tick);
  }
  function start(){last=0;if(!raf&&!paused&&!doc.hidden&&!disposed)raf=win.requestAnimationFrame(tick)}
  function stop(){if(raf)win.cancelAnimationFrame(raf);raf=0;last=0}
  function setPaused(value){paused=value;paused?stop():start();return paused}
  function visibility(){doc.hidden?stop():start()}
  function preference(){setPaused(reduced.matches);canvas.dispatchEvent(new win.CustomEvent('motionchange',{detail:{paused,reduced:reduced.matches}}))}
  win.addEventListener('resize',resize);doc.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',preference);
  resize();start();
  return {setPaused,get paused(){return paused},get reduced(){return reduced.matches},canvas,destroy(){
    disposed=true;stop();win.removeEventListener('resize',resize);doc.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',preference);canvas.remove();
  }};
}
