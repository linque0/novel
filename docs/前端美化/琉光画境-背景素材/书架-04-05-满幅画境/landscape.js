// 满幅画境：山水与花园使用不同的局部动态遮罩，UI 始终固定。
export async function mountLandscape(doc, source, {active=true, variant='jade', host=null, onState=()=>{}}={}) {
  const win=doc.defaultView, media=win.matchMedia('(prefers-reduced-motion: reduce)');
  const layer=doc.createElement('div');
  layer.className='qinglan-environment';
  Object.assign(layer.style,{position:host?'absolute':'fixed',inset:'0',zIndex:'0',pointerEvents:'none',overflow:'hidden',background:'#173831'});
  const poster=doc.createElement('img');
  poster.src=source;poster.alt='';poster.draggable=false;
  Object.assign(poster.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'cover'});
  const canvas=doc.createElement('canvas');canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',opacity:'0'});
  layer.append(poster,canvas);(host||doc.body).prepend(layer);
  let disposed=false, gl=null,program=null,texture=null,buffer=null,uniforms,request=0,last=0,drawn=0,time=8,width=1,height=1;
  let paused=media.matches, image=null;
  function emit(){layer.dataset.renderer=gl?'webgl':'static';layer.dataset.motion=paused?'paused':'playing';onState({paused,renderer:gl?'webgl':'static',reduced:media.matches})}
  function compile(type,source){
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);throw Error('Background shader unavailable')}
    return shader;
  }
  function release(){
    if(!gl)return;
    if(texture)gl.deleteTexture(texture);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);
    texture=null;buffer=null;program=null;
  }
  function initialize(){
    gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});
    if(!gl)return;
    const vertex=compile(gl.VERTEX_SHADER,`
      attribute vec2 a_position;varying vec2 v_uv;
      void main(){v_uv=vec2(a_position.x*.5+.5,.5-a_position.y*.5);gl_Position=vec4(a_position,0.,1.);}
    `);
    const fragment=compile(gl.FRAGMENT_SHADER,`
      precision mediump float;
      varying vec2 v_uv;uniform sampler2D u_image;uniform vec2 u_view;uniform vec2 u_imageSize;uniform float u_time;uniform float u_garden;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
      }
      float mist(vec2 p){return noise(p)*.6+noise(p*2.13+8.)*.27+noise(p*4.07-3.)*.13;}
      void main(){
        vec2 uv=v_uv;
        float aspect=u_view.x/u_view.y,imgAspect=u_imageSize.x/u_imageSize.y;
        vec2 crop=vec2(min(1.,aspect/imgAspect),min(1.,imgAspect/aspect));
        vec2 photo=(uv-.5)*crop+.5;
        float depth=clamp((photo.y-.45)*2.,0.,1.);
        // 山水沿河道，花园沿池面；不让山崖或近处睡莲被水波扭曲。
        float riverCenter=mix(.38,.89,smoothstep(.45,1.,photo.y));
        float riverWidth=.045+depth*.25;
        float river=exp(-pow(abs(photo.x-riverCenter)/riverWidth,4.))*smoothstep(.46,.62,photo.y);
        float pond=smoothstep(.43,.53,photo.y)*(1.-smoothstep(.53,.72,photo.y)*(1.-smoothstep(.35,.65,photo.x))*.95);
        float water=mix(river,pond,u_garden);
        float wave=sin(photo.y*285.-u_time*.63+sin(photo.x*21.+u_time*.11)*1.6);
        float crossWave=sin(photo.y*139.+photo.x*28.+u_time*.38);
        vec2 bend=vec2(wave*.0017+crossWave*.00065,sin(photo.x*53.-u_time*.42)*.00045)*water;
        // 花园树梢与紫藤轻拂，树干、桥与花朵主体保持稳定。
        float willow=(1.-smoothstep(.30,.48,photo.x))*(1.-smoothstep(.31,.45,photo.y));
        float wisteria=smoothstep(.75,.90,photo.x)*(1.-smoothstep(.25,.45,photo.y));
        float breeze=sin(u_time*.43+photo.y*17.)*.00065+sin(u_time*.21+photo.y*31.)*.00035;
        bend.x+=breeze*(willow+wisteria)*u_garden;
        vec3 color=texture2D(u_image,clamp(photo+bend,0.,1.)).rgb;
        // 水面明暗来自同一波场，不叠加闪烁粒子。
        float glint=pow(max(0.,wave),12.)*.028*water*(.5+.5*depth);
        color+=mix(vec3(.97,.94,.72),vec3(1.,.81,.72),u_garden)*glint;
        color-=vec3(.018,.028,.022)*water*crossWave*.22;
        // 长卷云气沿群峰流动；花园只保留池面极淡水汽。
        float fogBand=exp(-pow((photo.y-mix(.39,.47,u_garden))/mix(.12,.05,u_garden),2.));
        float fog=mist(vec2(photo.x*5.2-u_time*.017,photo.y*20.+u_time*.006));
        color=mix(color,mix(vec3(.79,.89,.82),vec3(.74,.73,.83),u_garden),fogBand*smoothstep(.39,.88,fog)*mix(.10,.035,u_garden));
        float warmReflection=water*exp(-pow((photo.x-mix(riverCenter,.64,u_garden))/.12,2.));
        color+=vec3(.014,.011,.005)*warmReflection*(.5+.5*sin(u_time*.19+photo.y*15.));
        // 满幅绘画保留到所有边缘，不加入洗白渐隐。
        gl_FragColor=vec4(color,1.);
      }
    `);
    program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Background program unavailable');
    gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const location=gl.getAttribLocation(program,'a_position');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
    uniforms=Object.fromEntries(['u_image','u_view','u_imageSize','u_time','u_garden'].map(key=>[key,gl.getUniformLocation(program,key)]));
    texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    gl.uniform1i(uniforms.u_image,0);gl.uniform1f(uniforms.u_garden,variant==='garden'?1:0);gl.uniform2f(uniforms.u_imageSize,image.naturalWidth,image.naturalHeight);
    canvas.style.opacity='1';resize();
  }
  function draw(){
    if(!gl||!program)return;
    gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);
    gl.uniform2f(uniforms.u_view,width,height);gl.uniform1f(uniforms.u_time,time);
    gl.drawArrays(gl.TRIANGLES,0,6);
  }
  function resize(){
    width=layer.clientWidth||win.innerWidth;height=layer.clientHeight||win.innerHeight;
    const dpr=Math.min(win.devicePixelRatio||1,1.4);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);draw();
  }
  function tick(stamp){
    request=0;if(disposed||paused||!active||doc.hidden||!gl)return;
    if(last)time+=Math.min((stamp-last)/1000,.08);last=stamp;
    if(stamp-drawn>=1000/30){draw();drawn=stamp}
    request=win.requestAnimationFrame(tick);
  }
  function stop(){if(request)win.cancelAnimationFrame(request);request=0;last=0}
  function start(){last=0;if(!request&&!disposed&&!paused&&active&&!doc.hidden&&gl)request=win.requestAnimationFrame(tick)}
  function visibility(){doc.hidden?stop():start()}
  function preference(){paused=media.matches;paused?stop():start();emit()}
  function lost(event){event.preventDefault();stop();canvas.style.opacity='0';gl=null;emit()}
  function restored(){try{initialize();start()}catch{gl=null;canvas.style.opacity='0'}emit()}
  win.addEventListener('resize',resize);doc.addEventListener('visibilitychange',visibility);media.addEventListener('change',preference);
  canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);
  const observer=new win.ResizeObserver(resize);observer.observe(layer);
  try{
    image=await new Promise((resolve,reject)=>{const img=new win.Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=source});
    if(!disposed){try{initialize()}catch{release();gl=null;canvas.style.opacity='0'}start()}
  }catch{gl=null}
  emit();
  return {layer,get paused(){return paused},get renderer(){return gl?'webgl':'static'},
    setPaused(value){paused=value;paused?stop():start();emit()},
    setActive(value){active=value;active?start():stop()},
    destroy(){disposed=true;stop();observer.disconnect();release();win.removeEventListener('resize',resize);doc.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',preference);layer.remove()}
  };
}
