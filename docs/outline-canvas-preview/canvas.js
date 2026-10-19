'use strict';
import { EVENT_SHAPES, eventSurface, eventPort } from './event-shapes.js';
// An isolated visual prototype; no application data is read or written.
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = kind => `<svg aria-hidden="true"><use href="#i-${kind}"/></svg>`;
const kinds = {
  event: { label:'事件', color:'#5c7c88', material:'冷白棉纸 · 压印细边', sample:'一封迟到的信', body:'故事在这里发生转折。' },
  note: { label:'便签', color:'#9d8552', material:'浅麦纸纹 · 轻盈折角', sample:'突然想到', body:'记下一个值得保留的念头。' },
  cite: { label:'引用卡', color:'#8b7e98', material:'叠页书纸 · 压印引号', sample:'“每一次归来，都始于一次远行。”', body:'摘录 · 写作手记' },
  textbox: { label:'文本框', color:'#7c8977', sample:'写作备忘', body:'给这段故事留一点呼吸的空间。' },
  container: { label:'容器', color:'#7b9475', sample:'新的故事片段', body:'将有关的事件放在一起。' },
  anchor: { label:'章节锚点', color:'#a47962', material:'象牙帘纹 · 布面书签', sample:'下一章 · 回声', body:'连接到故事的下一页。' },
  volume: { label:'卷', color:'#5c7c68', material:'深松布纹 · 黄铜细线', sample:'第二卷 · 回声', body:'新的旅程，从这里展开' }
};
const initialNodes = [
  {id:'volume',kind:'volume',x:26,y:58,w:210,h:124,title:'第一卷 · 潮声',body:'离开与归来',index:'01'},
  {id:'act',kind:'container',x:270,y:58,w:844,h:280,title:'第一幕 · 一封迟到的信',body:'起 · 故事的引子',children:['letter','home','truth']},
  {id:'letter',kind:'event',x:299,y:123,w:224,h:154,title:'收到旧日来信',body:'失联多年的父亲，寄来一张没有署名的船票。',index:'01',footer:'开端 · 林知夏'},
  {id:'home',kind:'event',shape:'para',x:562,y:123,w:254,h:170,title:'重返雾港',body:'她循着信中的地址，回到十年前离开的海边小镇。',index:'02',footer:'推进 · 雾港'},
  {id:'truth',kind:'event',shape:'diamond',x:850,y:106,w:250,h:210,title:'灯塔里的秘密',body:'那封信，真的来自父亲吗？',index:'03',footer:'转折 · 守塔人'},
  {id:'memory',kind:'event',shape:'ellipse',x:26,y:215,w:210,h:118,title:'雾港旧事',body:'十年前 · 一次离别',index:'00'},
  {id:'note',kind:'note',x:73,y:370,w:248,h:178,title:'那枚黄铜钥匙',body:'让钥匙在开篇出现，\n到灯塔时才揭开用途。',footer:'灵感 · 待展开'},
  {id:'quote',kind:'cite',x:397,y:382,w:264,h:177,title:'“海会带走一些人，\n也会送回一些答案。”',body:'',footer:'摘自 · 序章《潮汐》'},
  {id:'chapter',kind:'anchor',x:843,y:380,w:240,h:153,title:'第三章 · 灯塔',body:'在风暴到来前，找到答案。',index:'CH.03',footer:'修订中 · 2,480 字'},
  {id:'memo',kind:'textbox',x:693,y:570,w:391,h:83,title:'写作备忘',body:'这一幕的情绪：从犹疑，到无法回头。'}
];
const initialEdges = [
  {id:'r1',from:'volume',to:'letter',s:'right',t:'left',kind:'关联',arrow:'none',hideLabel:true},
  {id:'r2',from:'letter',to:'home',s:'right',t:'left',kind:'因果',arrow:'forward',labelDy:-19},
  {id:'r3',from:'home',to:'truth',s:'right',t:'left',kind:'因果',arrow:'forward',labelDy:-19},
  {id:'r4',from:'note',to:'letter',s:'top',t:'bottom',kind:'伏笔',arrow:'forward'},
  {id:'r5',from:'quote',to:'home',s:'top',t:'bottom',kind:'关联',arrow:'both'},
  {id:'r6',from:'truth',to:'chapter',s:'bottom',t:'top',kind:'关联',arrow:'forward'},
  {id:'r7',from:'quote',to:'chapter',s:'right',t:'left',kind:'冲突',arrow:'forward',labelDy:-16}
];
const colors = {'关联':'#59877e','因果':'#ae715f','伏笔':'#8971a2','冲突':'#b28443'};
const state = {nodes:structuredClone(initialNodes),edges:structuredClone(initialEdges),zoom:1,tx:0,ty:0,mode:'curve',selected:null,edge:null,textures:true};
let gesture = null, toastTimer, nextId=1;

function nodeHTML(n) {
  const meta=kinds[n.kind];
  if(n.kind==='container') return `<div class="group-header">${icon('container')}<span class="group-title">${esc(n.title)}</span><span class="group-count">${(n.children||[]).length} 个事件</span></div><div class="group-footer">${esc(n.body)}</div>`;
  if(n.kind==='textbox') return `<div class="node-inner"><p class="node-body">${esc(n.body).replace(/\n/g,'<br>')}</p></div>`;
  return `${n.kind==='event'?eventSurface(n.id,n.shape):''}<div class="node-inner"><div class="node-kicker">${icon(n.kind)}<span>${n.kind==='volume'?'VOLUME':meta.label}</span><span class="node-index">${esc(n.index||'')}</span></div><h3 class="node-title">${esc(n.title).replace(/\n/g,'<br>')}</h3><p class="node-body">${esc(n.body).replace(/\n/g,'<br>')}</p><div class="node-footer"><span class="tiny-dot"></span>${esc(n.footer||'故事片段')}</div></div>${['top','right','bottom','left'].map(s=>`<span class="port ${s}"></span>`).join('')}`;
}
function renderNodes() {
  $('groups').replaceChildren(); $('nodes').replaceChildren();
  for(const n of state.nodes) {
    const el=document.createElement('article');
    el.id=`node-${n.id}`; el.dataset.node=n.id;
    const shape=EVENT_SHAPES[n.shape]||EVENT_SHAPES.process;
    el.className=`canvas-node kind-${n.kind}${n.kind==='event'?' shape-'+(n.shape||'process'):''}${n.id===state.selected?' selected':''}`;
    el.style.cssText=`left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;--group-color:${n.color||kinds.container.color};--paper-tone:${shape.tone};--paper-edge:${shape.edge}`;
    el.tabIndex=0; el.setAttribute('aria-label',`${kinds[n.kind].label}：${n.title}`);
    el.innerHTML=nodeHTML(n);
    (n.kind==='container'?$('groups'):$('nodes')).append(el);
  }
  renderLayers(); renderEdges();
}
function renderLayers() {
  $('layer-count').textContent=state.nodes.length;
  $('layers').innerHTML=state.nodes.map(n=>`<button class="layer ${['letter','home','truth'].includes(n.id)?'child':''} ${n.id===state.selected?'active':''}" data-layer="${n.id}" title="${esc(n.title)}">${icon(n.kind)}<span>${esc(n.kind==='cite'?'序章 · 潮汐摘录':n.title)}</span></button>`).join('');
}
const direction={top:{x:0,y:-1},right:{x:1,y:0},bottom:{x:0,y:1},left:{x:-1,y:0}};
function port(n,side) {
  const d=direction[side],p=eventPort(n,side);
  return {x:p.x+d.x*6,y:p.y+d.y*6};
}
function roundedPath(points,r=12) {
  let d=`M ${points[0].x} ${points[0].y}`;
  for(let i=1;i<points.length-1;i++) {
    const p=points[i-1],c=points[i],q=points[i+1];
    const before=Math.hypot(c.x-p.x,c.y-p.y),after=Math.hypot(q.x-c.x,q.y-c.y);
    if(before<.01||after<.01)continue;
    const rad=Math.min(r,before/2,after/2);
    const a={x:c.x+(p.x-c.x)*rad/before,y:c.y+(p.y-c.y)*rad/before};
    const b={x:c.x+(q.x-c.x)*rad/after,y:c.y+(q.y-c.y)*rad/after};
    d+=` L ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`;
  }
  const end=points.at(-1);return d+` L ${end.x} ${end.y}`;
}
function geometry(e) {
  const source=state.nodes.find(n=>n.id===e.from),target=state.nodes.find(n=>n.id===e.to);
  const a=port(source,e.s),b=port(target,e.t),da=direction[e.s],db=direction[e.t];
  const horizontal=e.s==='left'||e.s==='right';
  const span=horizontal?Math.abs(b.x-a.x):Math.abs(b.y-a.y);
  const reach=Math.max(25,span*.5);
  const c={x:a.x+da.x*reach,y:a.y+da.y*reach},d={x:b.x+db.x*reach,y:b.y+db.y*reach};
  let path,mid;
  if(state.mode==='curve') {
    path=`M ${a.x} ${a.y} C ${c.x} ${c.y} ${d.x} ${d.y} ${b.x} ${b.y}`;
    mid={x:(a.x+3*c.x+3*d.x+b.x)/8,y:(a.y+3*c.y+3*d.y+b.y)/8};
  } else {
    mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    const ps=horizontal?[a,{x:mid.x,y:a.y},{x:mid.x,y:b.y},b]:[a,{x:a.x,y:mid.y},{x:b.x,y:mid.y},b];
    path=roundedPath(ps);
  }
  return {path,mid};
}
function renderEdges() {
  $('edges').innerHTML=`<defs>${Object.entries(colors).map(([k,c],i)=>`<marker id="arrow-${i}" viewBox="0 -4 9 8" refX="8.5" refY="0" markerWidth="8" markerHeight="7" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0 -3.5 8.5 0 0 3.5 2.3 0Z" fill="${c}" stroke="none"/></marker>`).join('')}</defs>`+state.edges.map(e=>{
    const {path}=geometry(e),color=colors[e.kind],i=Object.keys(colors).indexOf(e.kind),selected=state.edge===e.id;
    return `<g class="edge-group ${selected?'selected':''}" data-edge="${e.id}" aria-label="${e.kind}关系"><path class="edge-halo" d="${path}"/><path class="edge-visible" d="${path}" stroke="${color}" ${e.kind==='伏笔'?'stroke-dasharray="5 5"':''} ${e.arrow!=='none'?`marker-end="url(#arrow-${i})"`:''} ${e.arrow==='both'?`marker-start="url(#arrow-${i})"`:''}/><path class="edge-hit" d="${path}"/></g>`;
  }).join('');
  $('edge-labels').innerHTML=state.edges.filter(e=>!e.hideLabel).map(e=>{
    const {mid}=geometry(e);
    return `<button class="edge-label ${state.edge===e.id?'selected':''}" data-edge="${e.id}" style="left:${mid.x}px;top:${mid.y+(e.labelDy||0)}px;color:${colors[e.kind]}" aria-label="编辑${e.kind}关系">${e.kind}</button>`;
  }).join('');
}
function transform() {
  $('world').style.transform=`translate(${state.tx}px,${state.ty}px) scale(${state.zoom})`;
  $('world').style.setProperty('--canvas-zoom',state.zoom);
  $('zoom-value').textContent=`${Math.round(state.zoom*100)}%`;
  $('viewport').style.backgroundSize=`${20*state.zoom}px ${20*state.zoom}px`;
  $('viewport').style.backgroundPosition=`${state.tx}px ${state.ty}px`;
}
function zoomAt(value,x,y) {
  const next=Math.max(.35,Math.min(2.2,value)),ratio=next/state.zoom;
  state.tx=x-(x-state.tx)*ratio;state.ty=y-(y-state.ty)*ratio;state.zoom=next;transform();
}
function zoomCenter(factor) { const box=$('viewport').getBoundingClientRect();zoomAt(state.zoom*factor,box.width/2,box.height/2); }
function fit(readable=false) {
  const box=$('viewport').getBoundingClientRect();
  const minX=Math.min(...state.nodes.map(n=>n.x))-27,maxX=Math.max(...state.nodes.map(n=>n.x+n.w))+27;
  const minY=Math.min(...state.nodes.map(n=>n.y))-20,maxY=Math.max(...state.nodes.map(n=>n.y+n.h))+35;
  // Small screens start at a legible size; the canvas remains horizontally pannable.
  state.zoom=Math.max(readable&&box.width<800?.82:.35,Math.min(1.12,(box.width-40)/(maxX-minX),(box.height-24)/(maxY-minY)));
  state.tx=(box.width-(maxX-minX)*state.zoom)/2-minX*state.zoom;
  state.ty=(box.height-(maxY-minY)*state.zoom)/2-minY*state.zoom;
  if(readable&&box.width<800){state.tx=25-initialNodes[2].x*state.zoom;state.ty=45-initialNodes[2].y*state.zoom;}
  transform();
}
function clearSelection() {
  state.selected=null;state.edge=null;$('inspector').hidden=true;$('edge-inspector').hidden=true;
  document.querySelectorAll('.canvas-node.selected').forEach(el=>el.classList.remove('selected'));
  $('selection-hint').textContent='双击模块编辑文字';renderLayers();renderEdges();
}
function selectNode(id,edit=false) {
  state.selected=id;state.edge=null;$('edge-inspector').hidden=true;
  document.querySelectorAll('.canvas-node').forEach(el=>el.classList.toggle('selected',el.dataset.node===id));
  const n=state.nodes.find(n=>n.id===id);
  $('selection-hint').textContent=`已选中 ${kinds[n.kind].label} · 双击编辑`;
  if(edit){$('inspector-kind').textContent=`${kinds[n.kind].label} · 内容`;$('edit-title').value=n.title;$('edit-body').value=n.body;$('group-color-row').hidden=n.kind!=='container';$('edit-group-color').value=n.color||kinds.container.color;$('event-shape-row').hidden=n.kind!=='event';$('edit-event-shape').value=n.shape||'process';$('inspector').hidden=false;}
  else $('inspector').hidden=true;
  renderLayers();renderEdges();
}
function selectEdge(id) {
  clearSelection();state.edge=id;const e=state.edges.find(e=>e.id===id);
  $('edit-relation').value=e.kind;$('edit-arrow').value=e.arrow;$('edge-inspector').hidden=false;
  $('selection-hint').textContent=`已选中 ${e.kind}关系`;renderEdges();
}
function notify(message) {
  $('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),1900);
}
function setMode(mode) {
  state.mode=mode;for(const [id,m]of [['curve-mode','curve'],['ortho-mode','ortho']]){ $(id).classList.toggle('active',mode===m);$(id).setAttribute('aria-pressed',mode===m); }renderEdges();
}
function addNode(kind) {
  const box=$('viewport').getBoundingClientRect(),meta=kinds[kind];
  const sizes={event:[224,154],note:[248,178],cite:[264,177],textbox:[330,94],container:[510,280],anchor:[240,153],volume:[210,124]};
  const [w,h]=sizes[kind];
  const n={id:`added-${nextId++}`,kind,x:(box.width/2-state.tx)/state.zoom-w/2,y:(box.height/2-state.ty)/state.zoom-h/2,w,h,title:meta.sample,body:meta.body,children:kind==='container'?[]:undefined};
  state.nodes.push(n);renderNodes();selectNode(n.id,true);notify(`已添加${meta.label}`);
}

$('palette').innerHTML=Object.entries(kinds).map(([kind,m])=>`<button class="palette-button" data-add="${kind}" style="--kind-color:${m.color}" title="添加${m.label}">${icon(kind)}<span>${m.label}</span>${kind==='volume'?'<span class="plus">＋</span>':''}</button>`).join('');
$('palette').addEventListener('click',e=>{const b=e.target.closest('[data-add]');if(b)addNode(b.dataset.add);});
$('layers').addEventListener('click',e=>{
  const b=e.target.closest('[data-layer]');if(!b)return;selectNode(b.dataset.layer);
  const n=state.nodes.find(n=>n.id===b.dataset.layer),box=$('viewport').getBoundingClientRect();
  state.tx=box.width/2-(n.x+n.w/2)*state.zoom;state.ty=box.height/2-(n.y+n.h/2)*state.zoom;transform();
});
$('viewport').addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target.closest('.canvas-controls,.inspector,.edge-inspector,.edge-label'))return;
  const edge=e.target.closest('[data-edge]');if(edge){selectEdge(edge.dataset.edge);return;}
  const nodeEl=e.target.closest('[data-node]');
  if(nodeEl){
    const n=state.nodes.find(n=>n.id===nodeEl.dataset.node);selectNode(n.id);
    const moving=[n,...(n.children||[]).map(id=>state.nodes.find(k=>k.id===id)).filter(Boolean)];
    gesture={type:'node',x:e.clientX,y:e.clientY,moving:moving.map(k=>({node:k,x:k.x,y:k.y})),element:nodeEl,moved:false};
  }else{clearSelection();gesture={type:'pan',x:e.clientX,y:e.clientY,tx:state.tx,ty:state.ty};$('viewport').classList.add('panning');}
  (nodeEl||$('viewport')).setPointerCapture(e.pointerId);e.preventDefault();
});
$('viewport').addEventListener('pointermove',e=>{
  if(!gesture)return;
  const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
  if(gesture.type==='node'){
    if(Math.abs(dx)+Math.abs(dy)>3){gesture.moved=true;gesture.element.classList.add('dragging');}
    for(const p of gesture.moving){p.node.x=p.x+dx/state.zoom;p.node.y=p.y+dy/state.zoom;const el=$(`node-${p.node.id}`);el.style.left=`${p.node.x}px`;el.style.top=`${p.node.y}px`;}
    renderEdges();
  }else{state.tx=gesture.tx+dx;state.ty=gesture.ty+dy;transform();}
});
function endGesture(){if(gesture?.element)gesture.element.classList.remove('dragging');gesture=null;$('viewport').classList.remove('panning');}
$('viewport').addEventListener('pointerup',endGesture);$('viewport').addEventListener('pointercancel',endGesture);
$('viewport').addEventListener('dblclick',e=>{const n=e.target.closest('[data-node]');if(n)selectNode(n.dataset.node,true);});
$('viewport').addEventListener('click',e=>{const b=e.target.closest('.edge-label');if(b)selectEdge(b.dataset.edge);});
$('viewport').addEventListener('wheel',e=>{
  if(e.target.closest('.inspector,.edge-inspector'))return;
  e.preventDefault();const r=$('viewport').getBoundingClientRect();
  if(e.ctrlKey||e.metaKey)zoomAt(state.zoom*Math.exp(-e.deltaY*.002),e.clientX-r.left,e.clientY-r.top);
  else{state.tx-=e.deltaX;state.ty-=e.deltaY;transform();}
},{passive:false});
$('viewport').addEventListener('keydown',e=>{
  if(e.target.matches('input,textarea,select'))return;
  if(e.key==='Escape'){clearSelection();return;}
  const n=e.target.closest('[data-node]');
  if(n&&e.key==='Enter'){e.preventDefault();selectNode(n.dataset.node,true);}
  if(n&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
    e.preventDefault();const node=state.nodes.find(k=>k.id===n.dataset.node);selectNode(node.id);
    const dx=e.key==='ArrowLeft'?-8:e.key==='ArrowRight'?8:0,dy=e.key==='ArrowUp'?-8:e.key==='ArrowDown'?8:0;
    for(const k of [node,...(node.children||[]).map(id=>state.nodes.find(p=>p.id===id)).filter(Boolean)]){k.x+=dx;k.y+=dy;}
    renderNodes();$(`node-${node.id}`).focus({preventScroll:true});
  }
});
for(const field of ['title','body'])$(`edit-${field}`).addEventListener('input',()=>{
  const n=state.nodes.find(n=>n.id===state.selected);if(!n)return;
  n[field]=$(`edit-${field}`).value;const el=$(`node-${n.id}`);el.innerHTML=nodeHTML(n);el.setAttribute('aria-label',`${kinds[n.kind].label}：${n.title}`);renderLayers();
});
$('inspector-close').addEventListener('click',()=>$('inspector').hidden=true);
$('edge-close').addEventListener('click',clearSelection);
$('edit-relation').addEventListener('change',()=>{const e=state.edges.find(e=>e.id===state.edge);if(e){e.kind=$('edit-relation').value;renderEdges();}});
$('edit-arrow').addEventListener('change',()=>{const e=state.edges.find(e=>e.id===state.edge);if(e){e.arrow=$('edit-arrow').value;renderEdges();}});
$('curve-mode').addEventListener('click',()=>setMode('curve'));
$('ortho-mode').addEventListener('click',()=>setMode('ortho'));
$('zoom-in').addEventListener('click',()=>zoomCenter(1.16));$('zoom-out').addEventListener('click',()=>zoomCenter(1/1.16));
$('zoom-value').addEventListener('click',()=>zoomCenter(1/state.zoom));$('fit').addEventListener('click',()=>fit());
$('reset').addEventListener('click',()=>{state.nodes=structuredClone(initialNodes);state.edges=structuredClone(initialEdges);clearSelection();renderNodes();fit(true);notify('画布已恢复到初始布局');});
$('texture-toggle').addEventListener('click',()=>{state.textures=!state.textures;document.body.classList.toggle('no-textures',!state.textures);$('texture-toggle').setAttribute('aria-pressed',state.textures);$('texture-toggle').querySelector('.switch').classList.toggle('on',state.textures);});
$('edit-group-color').addEventListener('input',e=>{const n=state.nodes.find(n=>n.id===state.selected);if(n?.kind==='container'){n.color=e.target.value;renderNodes();}});
$('edit-event-shape').addEventListener('change',e=>{const n=state.nodes.find(n=>n.id===state.selected);if(n?.kind!=='event')return;const s=EVENT_SHAPES[e.target.value];n.shape=e.target.value;n.w=s.w;n.h=s.h;renderNodes();});
$('event-shape-grid').innerHTML=Object.entries(EVENT_SHAPES).map(([shape,s])=>`<article class="material-card"><div class="shape-swatch shape-${shape}" style="--paper-tone:${s.tone};--paper-edge:${s.edge}">${eventSurface('gallery-'+shape,shape)}<span>${s.label}</span></div><h3>${s.label}事件</h3><p>${s.material}</p><a href="${s.original}" download>下载原图 ↗</a></article>`).join('');
$('material-grid').innerHTML=Object.entries(kinds).filter(([kind,m])=>m.material&&kind!=='event').map(([kind,m])=>`<article class="material-card material-${kind}"><div class="material-surface" style="background-image:url('assets/${kind}.webp')">${m.label}</div><h3>${m.label}</h3><p>${m.material}</p><a href="assets/originals/${kind}.png" download>下载原图 ↗</a></article>`).join('');
$('materials-open').addEventListener('click',()=>$('materials-dialog').showModal());
$('materials-close').addEventListener('click',()=>$('materials-dialog').close());
$('materials-dialog').addEventListener('click',e=>{if(e.target===$('materials-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
let resizeFrame;new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>fit(true));}).observe($('viewport'));
renderNodes();fit(true);
