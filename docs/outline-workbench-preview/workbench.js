// 大纲工作台 · 交互与渲染（独立设计稿：只操作内存示例数据，刷新重置，不读写正式作品）
import {EVENT_SHAPES,eventSurface,KINDS,STATUS,EDGE_KINDS,CONTAINER_COLORS,seedStory,parentOf,pathTo,pathLabel,descendants,stats,nodeStats,projectEdges,blockConnections,createContainer,addModule,deleteNode} from './story.js';

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ico=name=>`<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const dirVec={top:{x:0,y:-1},right:{x:1,y:0},bottom:{x:0,y:1},left:{x:-1,y:0}};
const PORT_SIDES=['top','right','bottom','left'];
const capture=(el,id)=>{try{el.setPointerCapture(id)}catch{/* 合成事件没有真实指针，忽略即可 */}};

let story=seedStory();
const view={scope:'book',expanded:new Set(),treeOpen:new Set(['act2','ter']),selected:null,selectedEdge:null,multi:false,picked:new Set(),mode:'curve',textures:true,zoom:1,tx:0,ty:0,counter:0,drawerSnapshot:false};
const history=[];const cameras=new Map();
let toastTimer,edgeFrame,resizeFrame,drawerDeleteArmed=false,animations=new Set(),navEpoch=0;

/* ---------------- 基础工具 ---------------- */
const nodeEl=id=>$('world').querySelector(`[data-node="${id}"]`);
function offsetRect(el){let x=0,y=0,n=el;while(n&&n!==$('world')){x+=n.offsetLeft;y+=n.offsetTop;n=n.offsetParent}return {x,y,w:el.offsetWidth,h:el.offsetHeight}}
function measuredRect(id){const el=nodeEl(id);return el?offsetRect(el):null}
function allRects(){const map=new Map();for(const el of $('world').querySelectorAll('[data-node]'))map.set(el.dataset.node,offsetRect(el));return map}
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2200)}
function pushSnapshot(snap){history.push(snap);if(history.length>40)history.shift();$('undo').disabled=false}
function snapshot(){return {story:structuredClone(story),scope:view.scope,expanded:[...view.expanded],selected:view.selected}}
function remember(){pushSnapshot(snapshot())}
function statusDot(status){return `<i class="state-dot ${status||'planned'}"></i>`}
function progressOf(id){const s=nodeStats(story,id);return {s,percent:s.total?Math.round(s.done/s.total*100):0,label:s.total?`${s.done} / ${s.total} 事件`:'还没有事件'}}

/* ---------------- 渲染：节点 ---------------- */
function portsHTML(){return PORT_SIDES.map(s=>`<span class="port ${s}" data-side="${s}" role="button" tabindex="-1" aria-label="从${s==='top'?'上':s==='right'?'右':s==='bottom'?'下':'左'}侧建立连线"></span>`).join('')}
function pickHTML(id){return view.multi?`<button class="pick ${view.picked.has(id)?'on':''}" data-action="pick" data-id="${id}" aria-label="${view.picked.has(id)?'取消选择':'选择'}${esc(story.nodes[id].title)}" aria-pressed="${view.picked.has(id)}">${view.picked.has(id)?ico('check'):''}</button>`:''}

function leafHTML(n){
  const meta=KINDS[n.kind];
  const shape=EVENT_SHAPES[n.shape]||EVENT_SHAPES.process;
  const surface=n.kind==='event'?eventSurface(n.id,n.shape):'';
  const kicker=`<div class="node-kicker">${ico(n.kind)}<span>${n.kind==='volume'?'VOLUME':meta.label}</span><span class="node-index">${esc(n.index||'')}</span></div>`;
  const body=n.body?`<p class="node-body">${esc(n.body).replace(/\n/g,'<br>')}</p>`:'';
  const footer=n.kind==='textbox'||n.kind==='volume'?'':`<div class="node-footer">${n.kind==='event'?statusDot(n.status):'<span class="tiny-dot"></span>'}${esc(n.footer||(n.kind==='event'?(STATUS[n.status]||'待展开'):meta.label))}</div>`;
  return `<div class="node-inner">${kicker}<h3 class="node-title">${esc(n.title).replace(/\n/g,'<br>')}</h3>${body}${footer}</div>`;
}

function containerHTML(n){
  const open=view.expanded.has(n.id),{s,percent,label}=progressOf(n.id);
  const kids=open?`<div class="cnode-kids">${n.children.map(kidHTML).join('')}</div>`:'';
  const progress=open?'':`<div class="cnode-progress">${statusDot(s.complete?'done':s.done?'writing':'planned')}<span>${s.complete?'已完成':s.done?'进行中':'待展开'}</span><span class="bar"><i style="width:${percent}%"></i></span><span class="progress-text">${label}</span></div>`;
  const connections=blockConnections(story,n.id).length;
  return `<div class="cnode-head has-fold">
      <div class="cnode-kicker"><span class="cnode-kind">容器</span><span class="cnode-chapter">${esc(n.chapter||'故事片段')}</span><span class="cnode-count">${s.blocks?`${s.blocks} 个嵌套`:''}</span></div>
      <button class="cnode-fold" data-action="toggle" data-id="${n.id}" aria-expanded="${open}" title="${open?'收起内部细节，保留摘要与外联':'在当前画布内显示子项，不切换层级'}">${open?'收起内容 −':'就地展开 ＋'}</button>
      <h2 class="cnode-title">${esc(n.title)}</h2>
      <p class="cnode-summary">${esc(n.summary||'尚未填写摘要，进入容器查看内部情节。')}</p>
      ${pickHTML(n.id)}
    </div>${progress}${kids}
    <div class="cnode-foot">
      <button class="enter" data-action="scope" data-id="${n.id}" title="切换到这个情节的内部，用面包屑返回上层">${ico('enter')}进入容器</button>
      <button class="inspect" data-action="inspect" data-id="${n.id}" title="容器名称、颜色、摘要与外部联系">设置 · ${connections} 条外联</button>
    </div>`;
}

function kidHTML(id){
  const n=story.nodes[id];
  if(n.kind==='container'){
    const open=view.expanded.has(id),{s,percent,label}=progressOf(id);
    return `<article class="kid kid-container${open?' is-open':''}${view.selected===id?' selected':''}" data-node="${id}" data-kid="1" style="--block:${n.color}" tabindex="0" aria-label="容器：${esc(n.title)}">
      <div class="kid-top"><span class="kid-kind">容器</span><span>${esc(n.chapter||'')}</span><span class="kid-status">${statusDot(s.complete?'done':s.done?'writing':'planned')}${label}</span>${pickHTML(id)}<button class="kid-fold" data-action="toggle" data-id="${id}" aria-label="${open?'收起内容':'就地展开'}" title="${open?'收起内部细节，保留摘要与外联':'在当前画布内显示子项，不切换层级'}">${open?'−':'＋'}</button></div>
      <h3>${esc(n.title)}</h3><p>${esc(n.summary||'')}</p>
      <div class="kid-actions"><button class="enter" data-action="scope" data-id="${id}">进入容器 ↗</button><button data-action="inspect" data-id="${id}">设置</button></div>
      ${open?`<div class="cnode-kids">${n.children.map(kidHTML).join('')}</div>`:''}
    </article>`;
  }
  const shape=EVENT_SHAPES[n.shape]||EVENT_SHAPES.process;
  const hasSurface=n.kind==='event';
  const inner=`<div class="kid-body">
      <div class="kid-top"><span class="kid-kind">${KINDS[n.kind].label}</span>${n.kind==='event'?`<span class="kid-status">${statusDot(n.status)}${STATUS[n.status]||'待展开'}</span>`:''}${pickHTML(id)}</div>
      <h3>${esc(n.title)}</h3><p>${esc(n.body||'')}</p>
    </div>`;
  const surface=hasSurface?eventSurface('kid-'+id,n.shape):'';
  const shapeClass=n.kind==='event'?' shape-'+(n.shape||'process'):'';
  return `<article class="kid kid-${n.kind}${hasSurface?' has-surface':''}${shapeClass}${view.selected===id?' selected':''}" data-node="${id}" data-kid="1" tabindex="0" aria-label="${KINDS[n.kind].label}：${esc(n.title)}">${surface}${inner}</article>`;
}

function renderCanvas(){
  const scopeChildren=story.nodes[view.scope]?.children||[];
  const frames=[],nodesEl=[];
  for(const id of scopeChildren){
    const n=story.nodes[id];
    if(n.kind==='container'){
      frames.push(`<article class="cnode${view.expanded.has(id)?' open':''}${view.selected===id?' selected':''}" data-node="${id}" data-container="1" style="left:${n.x}px;top:${n.y}px;width:${n.w||520}px;--block:${n.color||KINDS.container.color}" tabindex="0" aria-label="容器：${esc(n.title)}">${containerHTML(n)}${portsHTML()}${pickHTML(id)}</article>`);
    }else{
      const shape=EVENT_SHAPES[n.shape]||EVENT_SHAPES.process;
      nodesEl.push(`<article class="node kind-${n.kind}${n.kind==='event'?' shape-'+(n.shape||'process'):''}${view.selected===id?' selected':''}" data-node="${id}" style="left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;--paper-tone:${shape.tone};--paper-edge:${shape.edge}" tabindex="0" aria-label="${KINDS[n.kind].label}：${esc(n.title)}">${n.kind==='event'?eventSurface(n.id,n.shape):''}${leafHTML(n)}${portsHTML()}${pickHTML(id)}</article>`);
    }
  }
  $('frames').innerHTML=frames.join('');
  $('nodes').innerHTML=nodesEl.join('');
  $('scope-empty').hidden=scopeChildren.length>0;
  scheduleEdges();
}

/* ---------------- 渲染：连线 ---------------- */
function roundedPath(points,r=12){
  let d=`M ${points[0].x} ${points[0].y}`;
  for(let i=1;i<points.length-1;i++){
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
function pickPorts(a,b){
  const dx=(b.x+b.w/2)-(a.x+a.w/2),dy=(b.y+b.h/2)-(a.y+a.h/2);
  const hGap=Math.max(b.x-(a.x+a.w),a.x-(b.x+b.w)),vGap=Math.max(b.y-(a.y+a.h),a.y-(b.y+b.h));
  if(hGap>0)return dx>0?['right','left']:['left','right'];
  if(vGap>0)return dy>0?['bottom','top']:['top','bottom'];
  return Math.abs(dx)>=Math.abs(dy)?(dx>0?['right','left']:['left','right']):(dy>0?['bottom','top']:['top','bottom']);
}
function portPoint(r,side,offset=0){
  if(side==='right')return {x:r.x+r.w,y:r.y+r.h/2+offset};
  if(side==='left')return {x:r.x,y:r.y+r.h/2+offset};
  if(side==='top')return {x:r.x+r.w/2+offset,y:r.y};
  return {x:r.x+r.w/2+offset,y:r.y+r.h};
}
function directGeometry(a,b,sa,sb,offset=0){
  const pa=portPoint(a,sa,offset),pb=portPoint(b,sb,offset),da=dirVec[sa],db=dirVec[sb];
  const horizontal=sa==='left'||sa==='right';
  if(view.mode==='curve'){
    const span=horizontal?Math.abs(pb.x-pa.x):Math.abs(pb.y-pa.y),reach=Math.max(25,span*.5);
    const c={x:pa.x+da.x*reach,y:pa.y+da.y*reach},d={x:pb.x+db.x*reach,y:pb.y+db.y*reach};
    return {d:`M ${pa.x} ${pa.y} C ${c.x} ${c.y} ${d.x} ${d.y} ${pb.x} ${pb.y}`,mid:{x:(pa.x+3*c.x+3*d.x+pb.x)/8,y:(pa.y+3*c.y+3*d.y+pb.y)/8}};
  }
  const mid={x:(pa.x+pb.x)/2,y:(pa.y+pb.y)/2};
  const pts=horizontal?[pa,{x:mid.x,y:pa.y},{x:mid.x,y:pb.y},pb]:[pa,{x:pa.x,y:mid.y},{x:pb.x,y:mid.y},pb];
  return {d:roundedPath(pts,12),mid:{x:horizontal?mid.x:(pa.x+pb.x)/2,y:horizontal?(pa.y+pb.y)/2:mid.y}};
}
function envelopeOf(id){
  let p=parentOf(story,id),found=null;
  while(p&&p!==view.scope){if(view.expanded.has(p))found=p;p=parentOf(story,p)}
  return found;
}
function insideRect(r,outer,pad=2){return r.x>=outer.x-pad&&r.x+r.w<=outer.x+outer.w+pad&&r.y>=outer.y-pad&&r.y+r.h<=outer.y+outer.h+pad}
function envelopePlan(from,to,rects){
  const ra=rects.get(from),rb=rects.get(to);
  const envA=envelopeOf(from),envB=envelopeOf(to);
  for(const [envId,otherRect] of [[envA,rb],[envB,ra]]){
    if(!envId||!otherRect)continue;
    const r=rects.get(envId);if(!r)continue;
    if(!insideRect(otherRect,r))return {envelope:r,insideIsFrom:envId===envA};
  }
  return null;
}
function envelopeGeometry(a,b,plan,offset=0){
  const env=plan.envelope,insideIsA=plan.insideIsFrom;
  const insideRect=insideIsA?a:b,outsideRect=insideIsA?b:a;
  const laneSide=(outsideRect.x+outsideRect.w/2)>=(env.x+env.w/2)?'right':'left';
  const pInside=portPoint(insideRect,laneSide,offset),pOutside=portPoint(outsideRect,laneSide==='right'?'left':'right',offset);
  const lane=(laneSide==='right'?env.x+env.w+22:env.x-22)+offset*1.6;
  // 路径必须从 from 端走向 to 端，箭头才会落在真实目标上。
  const pts=insideIsA?[pInside,{x:lane,y:pInside.y},{x:lane,y:pOutside.y},pOutside]:[pOutside,{x:lane,y:pOutside.y},{x:lane,y:pInside.y},pInside];
  return {d:roundedPath(pts,12),mid:{x:lane,y:(pInside.y+pOutside.y)/2}};
}
// 展开展开的容器是一块“实体障碍”：直连会横穿里面的卡片与标题，改从容器上/下或左/右绕行。
function crossingExpandedContainer(a,b,rects){
  const ac={x:a.x+a.w/2,y:a.y+a.h/2},bc={x:b.x+b.w/2,y:b.y+b.h/2};
  for(const [id,r] of rects){
    const n=story.nodes[id];
    if(n?.kind!=='container'||!view.expanded.has(id))continue;
    if(insideRect(a,r)||insideRect(b,r))continue;
    for(let t=.15;t<=.85;t+=.1){
      const x=ac.x+(bc.x-ac.x)*t,y=ac.y+(bc.y-ac.y)*t;
      if(x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h)return r;
    }
  }
  return null;
}
function avoidGeometry(a,b,r,offset=0){
  const ac={x:a.x+a.w/2,y:a.y+a.h/2},bc={x:b.x+b.w/2,y:b.y+b.h/2};
  const horizontal=(ac.x<r.x&&bc.x>r.x+r.w)||(bc.x<r.x&&ac.x>r.x+r.w);
  if(horizontal){
    const gapTop=Math.min(Math.abs(ac.y-r.y),Math.abs(bc.y-r.y));
    const gapBottom=Math.min(Math.abs(ac.y-(r.y+r.h)),Math.abs(bc.y-(r.y+r.h)));
    const side=gapTop<=gapBottom?'top':'bottom';
    const laneY=(side==='top'?r.y-26:r.y+r.h+26)+offset;
    const pa=portPoint(a,side,offset),pb=portPoint(b,side,offset);
    return {d:roundedPath([pa,{x:pa.x,y:laneY},{x:pb.x,y:laneY},pb],12),mid:{x:(pa.x+pb.x)/2,y:laneY}};
  }
  const gapLeft=Math.min(Math.abs(ac.x-r.x),Math.abs(bc.x-r.x));
  const gapRight=Math.min(Math.abs(ac.x-(r.x+r.w)),Math.abs(bc.x-(r.x+r.w)));
  const side=gapLeft<=gapRight?'left':'right';
  const laneX=(side==='left'?r.x-26:r.x+r.w+26)+offset;
  const pa=portPoint(a,side,offset),pb=portPoint(b,side,offset);
  return {d:roundedPath([pa,{x:laneX,y:pa.y},{x:laneX,y:pb.y},pb],12),mid:{x:laneX,y:(pa.y+pb.y)/2}};
}
function drawEdges(){
  const rects=allRects();
  const g=projectEdges(story,view.scope,view.expanded);
  // 同一对模块之间的多条关系互相错开，避免叠在一条线上。
  const pairCounts=new Map(),pairUsed=new Map();
  for(const group of g.edges){const k=`${group.from}>${group.to}`;pairCounts.set(k,(pairCounts.get(k)||0)+1)}
  const offsetOf=group=>{const k=`${group.from}>${group.to}`,i=pairUsed.get(k)||0;pairUsed.set(k,i+1);return (i-(pairCounts.get(k)-1)/2)*24};
  const defs=Object.entries(EDGE_KINDS).map(([kind,color],i)=>`<marker id="head-${i}" viewBox="0 -4 9 8" refX="8.5" refY="0" markerWidth="8" markerHeight="7" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0 -3.5 8.5 0 0 3.5 2.3 0Z" fill="${color}" stroke="none"/></marker>`).join('');
  const paths=[],labelItems=[];
  g.edges.forEach((group,index)=>{
    const a=rects.get(group.from),b=rects.get(group.to);
    if(!a||!b)return;
    const offset=offsetOf(group);
    const color=EDGE_KINDS[group.kind]||EDGE_KINDS['关联'],markerIndex=Object.keys(EDGE_KINDS).indexOf(group.kind);
    const plan=envelopePlan(group.from,group.to,rects);
    let geometry,startPoint,endPoint;
    if(plan){
      geometry=envelopeGeometry(a,b,plan,offset);
    }else{
      const obstacle=crossingExpandedContainer(a,b,rects);
      if(obstacle){
        geometry=avoidGeometry(a,b,obstacle,offset);
      }else{
        const [sa,sb]=pickPorts(a,b);
        geometry=directGeometry(a,b,sa,sb,offset);
        startPoint=portPoint(a,sa,offset);endPoint=portPoint(b,sb,offset);
      }
    }
    const selected=view.selectedEdge===group.key;
    const dash=group.kind==='伏笔'?'stroke-dasharray="5 5"':'';
    const markers=`${group.arrow!=='none'?`marker-end="url(#head-${markerIndex})"`:''} ${group.arrow==='both'?`marker-start="url(#head-${markerIndex})"`:''}`;
    const projectedDot=group.projected&&endPoint?`<circle cx="${endPoint.x}" cy="${endPoint.y}" r="2.6" fill="#fffef9" stroke="${color}" stroke-width="1.2"/>`:'';
    const startDot=startPoint?`<circle cx="${startPoint.x}" cy="${startPoint.y}" r="2.2" fill="${color}" opacity=".75"/>`:'';
    paths.push(`<g class="edge-group${selected?' selected':''}${group.projected?' projected':''}" data-edge="${index}" aria-label="${group.kind}关系">${projectedDot}${startDot}<path class="edge-halo" d="${geometry.d}"/><path class="edge-visible" d="${geometry.d}" stroke="${color}" ${dash} ${markers}/><path class="edge-hit" d="${geometry.d}"/><title>${esc(group.relations.map(r=>`${story.nodes[r.from]?.title||r.from} → ${story.nodes[r.to]?.title||r.to}`).join('；'))}</title></g>`);
    const text=group.relations.length>1?`${group.kind} · ${group.relations.length}`:group.label;
    // 绕容器外侧的标签再向右让开，避免压住容器右边框。
    const labelX=geometry.mid.x+(plan?32:0);
    if(text)labelItems.push({index,text,color,selected,x:labelX,y:geometry.mid.y-14});
  });
  // 标签排在线的上方，彼此太近时向下让位，避免叠字和压住容器框线。
  labelItems.sort((p,q)=>p.y-q.y);
  for(let i=0;i<labelItems.length;i++){
    for(let j=0;j<i;j++){
      const prev=labelItems[j],cur=labelItems[i];
      if(Math.abs(prev.x-cur.x)<86&&Math.abs(prev.y-cur.y)<17)cur.y=prev.y+19;
    }
  }
  const labels=labelItems.map(item=>`<button class="edge-label${item.selected?' selected':''}" data-edge="${item.index}" style="left:${item.x}px;top:${item.y}px;--label-color:${item.color}" aria-label="查看关系详情">${esc(item.text)}</button>`);
  $('edge-defs').innerHTML=defs;
  $('edges-static').innerHTML=paths.join('');
  $('labels').innerHTML=labels.join('');
}
function scheduleEdges(){cancelAnimationFrame(edgeFrame);edgeFrame=requestAnimationFrame(drawEdges)}

/* ---------------- 渲染：侧栏 / 标题 / 接续卡 ---------------- */
function treeRow(id,depth=0){
  const n=story.nodes[id],isBlock=n.kind==='container',s=nodeStats(story,id),open=view.treeOpen.has(id);
  const active=view.scope===id,current=view.selected===id;
  const row=`<div class="tree-row ${isBlock?'':'event'}${active?' active':''}${current?' current':''}" style="--depth:${depth}">${isBlock?`<button class="tree-toggle" data-action="tree-toggle" data-id="${id}" aria-label="${open?'收起':'展开'}${esc(n.title)}结构" aria-expanded="${open}">${open?'⌄':'›'}</button>`:'<span class="tree-dot"></span>'}<button class="tree-name" data-action="${isBlock?'scope':'reveal'}" data-id="${id}" title="${esc(n.title)}">${esc(n.title)}</button>${isBlock?`<span class="tree-count">${s.total}</span>`:statusDot(n.status)}</div>`;
  return row+(isBlock&&open?n.children.map(c=>treeRow(c,depth+1)).join(''):'');
}
function renderTree(){
  $('tree').innerHTML=story.nodes.book.children.map(id=>treeRow(id)).join('');
  const all=stats(story,'book');
  $('book-progress').textContent=`${all.done} / ${all.total} 事件`;
}
function renderCrumbs(){
  const path=pathTo(story,view.scope);
  $('crumbs').innerHTML=path.map((id,i)=>`${i?'<span>›</span>':''}<button data-action="scope" data-id="${id}"${id===view.scope?' aria-current="page"':''}>${id==='book'?'全书':esc(story.nodes[id].title)}</button>`).join('');
}
function renderHead(){
  const n=story.nodes[view.scope],s=stats(story,view.scope);
  const isBook=view.scope==='book';
  $('scope-title').textContent=isBook?'全书情节':n.title;
  $('scope-tag').textContent=isBook?'全书画布':'容器内部';
  $('scope-tag').classList.toggle('inside',!isBook);
  $('scope-eyebrow').textContent=isBook?'OUTLINE · 全书画布':`OUTLINE / ${story.nodes[view.scope].chapter||'故事片段'}`;
  const counts=`${s.total} 个事件${s.blocks?` · ${s.blocks} 个容器`:''}`;
  $('scope-meta').textContent=`${isBook?'第一卷 · 潮声':(n.chapter||'当前情节')} · ${counts} · 已完成 ${s.done}/${s.total}`;
}
function renderLayers(){
  const children=story.nodes[view.scope]?.children||[];
  $('layer-count').textContent=children.length;
  $('layers').innerHTML=children.map(id=>{
    const n=story.nodes[id],s=nodeStats(story,id);
    const sub=n.kind==='container'?(s.total?`${s.done}/${s.total}`:''):(n.kind==='event'?(STATUS[n.status]||'待展开'):'');
    return `<button class="layer${view.selected===id?' active':''}" data-layer="${id}" title="${esc(n.title)}">${ico(n.kind)}<span>${esc(n.title)}</span><i class="layer-sub">${esc(sub)}</i></button>`;
  }).join('');
}
function renderExternal(){
  const g=projectEdges(story,view.scope,view.expanded);
  const card=(direction,ids)=>{
    const list=[...ids];if(!list.length)return '';
    const title=list.length===1?story.nodes[list[0]].title:`${list.length} 处外部情节`;
    return `<div class="external-card"><span class="lane-icon">${direction==='in'?'↳':'↗'}</span><div><small>${direction==='in'?'前接':'后续'}</small><button data-action="${list.length===1?'reveal':'show-connections'}" data-id="${list.length===1?list[0]:''}">${esc(title)} →</button></div></div>`;
  };
  $('external-in').innerHTML=card('in',g.external.in);
  $('external-out').innerHTML=card('out',g.external.out);
}
function renderHint(){
  const s=stats(story,view.scope),children=story.nodes[view.scope]?.children||[];
  const g=projectEdges(story,view.scope,view.expanded);
  const shownLeaves=[...g.visible].filter(k=>story.nodes[k].kind==='event').length,hidden=s.total-shownLeaves;
  $('current-hint').textContent=`当前层 ${children.length} 个模块${hidden>0?` · ${hidden} 个事件收在容器中`:''}`;
  const sel=view.selected?story.nodes[view.selected]:null;
  $('selection-hint').textContent=sel?`已选中 ${KINDS[sel.kind].label}「${sel.title}」 · 双击编辑`:(view.selectedEdge?'已选中连线 · 可改关系类型和箭头':'拖动端口可建立连线');
  $('multi-toggle').setAttribute('aria-pressed',view.multi);
  $('selection-bar').hidden=!view.multi;
  $('selection-count').textContent=view.picked.size?`已选择 ${view.picked.size} 个模块`:'选择同层至少 2 个模块，再用容器封装';
  $('wrap-open').disabled=view.picked.size<2;
  $('undo').disabled=!history.length;
}
function renderAll(){
  renderTree();renderCrumbs();renderHead();renderLayers();renderCanvas();renderExternal();renderHint();
}

/* ---------------- 相机 ---------------- */
function applyTransform(){
  $('world').style.transform=`translate(${view.tx}px,${view.ty}px) scale(${view.zoom})`;
  $('world').style.setProperty('--canvas-zoom',view.zoom);
  $('zoom-value').textContent=`${Math.round(view.zoom*100)}%`;
  $('stage').style.backgroundSize=`${20*view.zoom}px ${20*view.zoom}px`;
  $('stage').style.backgroundPosition=`${view.tx}px ${view.ty}px`;
}
function zoomAt(value,x,y){
  const next=Math.max(.3,Math.min(2.2,value)),ratio=next/view.zoom;
  view.tx=x-(x-view.tx)*ratio;view.ty=y-(y-view.ty)*ratio;view.zoom=next;applyTransform();
}
function zoomCenter(factor){const box=$('stage').getBoundingClientRect();zoomAt(view.zoom*factor,box.width/2,box.height/2)}
function fitView(readable=false){
  const box=$('stage').getBoundingClientRect();
  const rects=[...allRects().values()];
  if(!rects.length){view.tx=60;view.ty=60;view.zoom=1;applyTransform();return}
  const minX=Math.min(...rects.map(r=>r.x))-40,maxX=Math.max(...rects.map(r=>r.x+r.w))+40;
  const minY=Math.min(...rects.map(r=>r.y))-34,maxY=Math.max(...rects.map(r=>r.y+r.h))+46;
  const cap=readable&&box.width<760?1.0:1.06;
  const fit=Math.min(cap,(box.width-24)/(maxX-minX),(box.height-24)/(maxY-minY));
  // 首屏保留可读字号：整图过宽时先给到下限并靠左展示故事开头，其余可平移查看。
  view.zoom=Math.max(.3,Math.min(cap,Math.max(fit,readable?.74:.3)));
  const contentW=(maxX-minX)*view.zoom,contentH=(maxY-minY)*view.zoom;
  view.tx=contentW<=box.width-24?(box.width-contentW)/2-minX*view.zoom:24-minX*view.zoom;
  view.ty=contentH<=box.height-24?(box.height-contentH)/2-minY*view.zoom:24-minY*view.zoom;
  applyTransform();scheduleEdges();
}
function centerOn(id,smooth=false){
  const r=measuredRect(id);if(!r)return;
  const box=$('stage').getBoundingClientRect();
  view.tx=box.width/2-(r.x+r.w/2)*view.zoom;
  view.ty=box.height/2-(r.y+r.h/2)*view.zoom;
  applyTransform();scheduleEdges();
}

/* ---------------- 选中与抽屉 ---------------- */
function clearSelection(){
  view.selected=null;view.selectedEdge=null;view.drawerSnapshot=false;$('drawer').hidden=true;$('edge-inspector').hidden=true;
  renderCanvas();renderLayers();renderHint();
}
function selectNode(id,{openDrawer=false,center=false}={}){
  if(!story.nodes[id])return;
  view.selected=id;view.selectedEdge=null;view.drawerSnapshot=false;
  if(center)centerOn(id);
  renderCanvas();renderLayers();renderHint();
  if(openDrawer)renderDrawer(id);
}
function selectEdge(key){
  view.selectedEdge=key;view.selected=null;$('drawer').hidden=true;
  const group=projectEdges(story,view.scope,view.expanded).edges.find(e=>e.key===key);
  if(group){
    $('edit-relation').value=group.kind;$('edit-arrow').value=group.arrow;$('edit-label').value=group.label||'';
    $('edge-inspector').hidden=false;
  }
  renderCanvas();renderLayers();renderHint();
}
function renderDrawer(id){
  const n=story.nodes[id];if(!n){$('drawer').hidden=true;return}
  const s=nodeStats(story,id),connections=blockConnections(story,id);
  const kindLabel=n.kind==='container'?'容器设置':`${KINDS[n.kind].label} · 内容`;
  const isContainer=n.kind==='container';
  $('drawer').innerHTML=`<div class="drawer-head"><div><span class="eyebrow">${kindLabel}</span><h2>${esc(n.title)}</h2>${pathTo(story,id).length>2?`<div class="detail-path">${esc(pathLabel(story,id))}</div>`:''}</div><button class="icon-button" data-action="drawer-close" aria-label="关闭设置">${ico('close')}</button></div>
    <label>标题<input id="drawer-title" value="${esc(n.title)}" maxlength="45"></label>
    ${isContainer?`<label>容器颜色</label><div class="color-options">${CONTAINER_COLORS.map(([color,name])=>`<button class="color-swatch" style="--swatch:${color}" data-action="color" data-color="${color}" aria-pressed="${color===n.color}" aria-label="${name}" title="${name}"></button>`).join('')}</div>`:''}
    ${n.kind==='event'?`<div class="field-row"><label>事件形状<select id="drawer-shape">${Object.entries(EVENT_SHAPES).map(([key,shape])=>`<option value="${key}"${(n.shape||'process')===key?' selected':''}>${shape.label}</option>`).join('')}</select></label><label>状态<select id="drawer-status">${Object.entries(STATUS).map(([key,label])=>`<option value="${key}"${n.status===key?' selected':''}>${label}</option>`).join('')}</select></label></div>`:''}
    <label>${isContainer?'收起时的摘要':n.kind==='event'?'事件内容':'内容'}<textarea id="drawer-body" rows="${isContainer?4:3}" maxlength="200">${esc(isContainer?(n.summary||''):(n.body||''))}</textarea></label>
    <div class="drawer-actions">
      ${isContainer?`<button class="quiet" data-action="scope" data-id="${id}">${ico('enter')}进入容器</button><button class="quiet" data-action="toggle" data-id="${id}">${view.expanded.has(id)?'收起内容':'就地展开'}</button>`:''}
      <button class="quiet danger" data-action="delete" data-id="${id}" data-container="${isContainer?'1':'0'}">${ico('trash')}删除${isContainer?'容器及内部':'模块'}</button>
    </div>
    ${isContainer?`<div class="detail-stat"><span>内部事件</span><span>${s.total} 个</span></div><div class="detail-stat"><span>已完成</span><span>${s.done} / ${s.total}</span></div>${s.blocks?`<div class="detail-stat"><span>嵌套容器</span><span>${s.blocks} 个</span></div>`:''}`:''}
    <h3>外部联系 · ${connections.length}</h3>
    <div class="connection-list">${connections.map(e=>{const other=e.direction==='in'?e.from:e.to;return `<div class="connection-item"><span class="kind">${e.kind} · ${e.direction==='in'?'前接':'后续'}${e.label?` · ${esc(e.label)}`:''}</span><button data-action="reveal" data-id="${other}">${esc(story.nodes[other]?.title||other)} ↗</button><small>${esc(pathLabel(story,other))}</small></div>`}).join('')||`<p class="detail-path">暂无跨出这个${isContainer?'容器':'模块'}的连线。</p>`}</div>`;
  $('drawer').hidden=false;
  if(!view.drawerSnapshot){remember();view.drawerSnapshot=true}
}
$('drawer').addEventListener('input',e=>{
  const n=view.selected?story.nodes[view.selected]:null;if(!n)return;
  if(e.target.id==='drawer-title'){
    n.title=e.target.value;
    const heading=$('drawer').querySelector('h2');if(heading)heading.textContent=e.target.value;
    renderCanvas();renderTree();renderLayers();renderCrumbs();
  }
  else if(e.target.id==='drawer-body'){if(n.kind==='container')n.summary=e.target.value;else n.body=e.target.value;renderCanvas()}
});
$('drawer').addEventListener('change',e=>{
  const n=view.selected?story.nodes[view.selected]:null;if(!n)return;
  if(e.target.id==='drawer-shape'){n.shape=e.target.value;const shape=EVENT_SHAPES[n.shape];n.w=shape.w;n.h=shape.h;renderCanvas();renderHint()}
  else if(e.target.id==='drawer-status'){n.status=e.target.value;renderCanvas();renderTree();renderHead();renderLayers();renderExternal()}
});

/* ---------------- 就地展开 / 收起 ---------------- */
function topLevelAncestor(id){
  let k=id;
  while(parentOf(story,k)&&parentOf(story,k)!==view.scope)k=parentOf(story,k);
  return k;
}
function toggleInline(id){
  const n=story.nodes[id];if(n?.kind!=='container')return;
  const anchorId=topLevelAncestor(id);
  const before=measuredRect(anchorId);
  if(view.expanded.has(id))view.expanded.delete(id);else view.expanded.add(id);
  renderCanvas();renderLayers();renderExternal();
  requestAnimationFrame(()=>{
    const after=measuredRect(anchorId);
    if(!before||!after)return;
    const delta=after.h-before.h;
    let moved=[];
    if(delta>0&&parentOf(story,anchorId)===view.scope){
      const siblings=(story.nodes[view.scope]?.children||[]).filter(k=>k!==anchorId);
      moved=collisionShift(siblings,before,after,delta);
      if(moved.length)renderCanvas();
    }
    renderExternal();scheduleEdges();
    // 被推开的模块从原位滑到新位，避免整块瞬移。
    if(moved.length){
      requestAnimationFrame(()=>{
        for(const sid of moved){
          nodeEl(sid)?.animate([{transform:`translateY(${-delta}px)`},{transform:'none'}],{duration:220,easing:'cubic-bezier(.2,.7,.2,1)'});
        }
      });
    }
  });
}
// 就地展开变高后，把原先位于下方、横向同列的模块推开，避免压住别人的故事内容。
function collisionShift(siblings,before,after,delta){
  const moved=[];
  for(const sib of siblings){
    const r=measuredRect(sib);if(!r)continue;
    const left=Math.min(before.x,after.x),right=Math.max(before.x+before.w,after.x+after.w);
    const overlapsX=r.x<right+10&&left<r.x+r.w+10;
    if(!overlapsX)continue;
    if(r.y<before.y+before.h-8)continue;
    story.nodes[sib].y+=delta;moved.push(sib);
  }
  return moved;
}

/* ---------------- 进入 / 返回 ---------------- */
function stopNavigation(){
  navEpoch++;for(const a of animations)a.cancel();animations.clear();
  document.querySelectorAll('.scope-portal').forEach(e=>e.remove());
  $('stage').dataset.navigation='idle';$('stage').removeAttribute('aria-busy');
}
function animateScope(fromRect,direction,color){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const stage=$('stage'),bounds=stage.getBoundingClientRect(),world=$('world'),epoch=navEpoch;
  const fallback={x:bounds.x+bounds.width*.32,y:bounds.y+bounds.height*.28,width:bounds.width*.36,height:bounds.height*.4};
  const r=fromRect||fallback,target={x:bounds.x+6,y:bounds.y+6,width:bounds.width-12,height:bounds.height-12};
  const portal=document.createElement('div');portal.className='scope-portal';portal.setAttribute('aria-hidden','true');
  portal.style.cssText=`left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px;--portal-color:${color||'#6e8c79'}`;
  document.body.append(portal);
  const transform=`translate(${target.x-r.x}px,${target.y-r.y}px) scale(${target.width/Math.max(r.width,1)},${target.height/Math.max(r.height,1)})`;
  const frames=direction==='return'?[{transform,opacity:.65},{transform:'none',opacity:0}]:[{transform:'none',opacity:.9},{transform,opacity:.62,offset:.68},{transform,opacity:0}];
  const duration=direction==='return'?300:440;
  stage.dataset.navigation=direction;stage.setAttribute('aria-busy','true');
  const scaler=$('world-scale');
  scaler.style.transformOrigin=direction==='return'?'50% 45%':`${r.x+r.width/2-bounds.x}px ${r.y+r.height/2-bounds.y}px`;
  const a=portal.animate(frames,{duration,easing:'cubic-bezier(.2,.75,.2,1)',fill:'both'});
  const b=scaler.animate(direction==='return'?[{transform:'scale(1.04)',opacity:.4},{transform:'scale(1)',opacity:1}]:[{transform:'scale(.93)',opacity:.6},{transform:'scale(.96)',opacity:.8,offset:.24},{transform:'scale(1)',opacity:1}],{duration,easing:'cubic-bezier(.25,.1,.25,1)'});
  animations.add(a);animations.add(b);
  Promise.allSettled([a.finished,b.finished]).then(()=>{
    portal.remove();animations.delete(a);animations.delete(b);
    if(epoch===navEpoch){stage.dataset.navigation='idle';stage.removeAttribute('aria-busy');scheduleEdges()}
  });
}
function focusScope(id,{animate=true}={}){
  const target=story.nodes[id];
  if(!target)return;
  if(target.kind!=='container')return reveal(id);
  if(id===view.scope)return;
  const stage=$('stage'),bounds=stage.getBoundingClientRect();
  const source=nodeEl(id),measured=source?.getBoundingClientRect();
  const sourceRect=measured&&measured.bottom>bounds.top&&measured.top<bounds.bottom?{x:measured.x,y:Math.max(bounds.top,measured.y),width:measured.width,height:Math.min(measured.bottom,bounds.bottom)-Math.max(bounds.top,measured.y)}:null;
  stopNavigation();
  cameras.set(view.scope,{zoom:view.zoom,tx:view.tx,ty:view.ty});
  const returning=pathTo(story,view.scope).includes(id);
  const oldScope=view.scope;
  view.scope=id;view.selected=null;view.selectedEdge=null;view.picked.clear();view.multi=false;$('drawer').hidden=true;$('edge-inspector').hidden=true;
  pathTo(story,id).forEach(k=>view.treeOpen.add(k));
  $('sidebar').classList.remove('open');$('side-scrim').hidden=true;
  renderAll();
  const camera=cameras.get(id);
  requestAnimationFrame(()=>{
    if(camera&&returning){view.zoom=camera.zoom;view.tx=camera.tx;view.ty=camera.ty;applyTransform();scheduleEdges()}
    else fitView(true);
    let destination=null;
    if(returning){
      const step=pathTo(story,oldScope)[pathTo(story,id).length];
      const el=$('world').querySelector(`[data-node="${step}"]`),r=el?.getBoundingClientRect();
      if(r&&r.bottom>bounds.top&&r.top<bounds.bottom)destination={x:r.x,y:Math.max(bounds.top,r.y),width:r.width,height:Math.min(r.bottom,bounds.bottom)-Math.max(bounds.top,r.y)};
    }
    if(animate)animateScope(returning?destination:sourceRect,returning?'return':'enter',story.nodes[returning?oldScope:id]?.color);
  });
}
function reveal(id){
  const n=story.nodes[id];if(!n)return;
  stopNavigation();
  $('search').value='';$('search-results').hidden=true;$('relations-dialog').open&&$('relations-dialog').close();
  const parent=parentOf(story,id);if(!parent)return focusScope('book',{animate:false});
  view.scope=parent;view.selected=id;view.selectedEdge=null;view.multi=false;view.picked.clear();$('drawer').hidden=true;
  pathTo(story,id).forEach(k=>view.treeOpen.add(k));
  $('sidebar').classList.remove('open');$('side-scrim').hidden=true;
  renderAll();
  requestAnimationFrame(()=>{
    centerOn(id);
    const el=nodeEl(id);el?.classList.add('flash');
    setTimeout(()=>nodeEl(id)?.classList.remove('flash'),1600);
  });
}

/* ---------------- 连线编辑 ---------------- */
function setEdgeGroupField(field,value){
  const group=projectEdges(story,view.scope,view.expanded).edges.find(e=>e.key===view.selectedEdge);
  if(!group)return;
  remember();
  for(const rel of group.relations){if(field==='label')rel.label=value;else rel[field]=value}
  if(field==='label'&&!value)delete group.relations[0].label;
  scheduleEdges();renderHint();
}
/* ---------------- 建立连线（端口拖拽） ---------------- */
let linkDrag=null;
function draftPath(from,side,to){
  const r=measuredRect(from);if(!r)return '';
  const p=portPoint(r,side);
  const mid={x:(p.x+to.x)/2,y:(p.y+to.y)/2};
  return {d:roundedPath([p,{x:mid.x,y:p.y},{x:mid.x,y:to.y},to],12),start:p};
}
function stagePoint(e){
  const box=$('stage').getBoundingClientRect();
  return {x:(e.clientX-box.left-view.tx)/view.zoom,y:(e.clientY-box.top-view.ty)/view.zoom};
}
function updateDraft(e){
  if(!linkDrag)return;
  const to=stagePoint(e),draw=draftPath(linkDrag.from,linkDrag.side,to);
  $('edges-draft').innerHTML=draw?`<path class="edge-draft" d="${draw.d}"/><circle cx="${draw.start.x}" cy="${draw.start.y}" r="2.4" fill="#7d9a8b"/>`:'';
  const hover=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('[data-node]');
  $('world').querySelectorAll('.target').forEach(el=>el.classList.remove('target'));
  if(hover&&hover.dataset.node!==linkDrag.from)hover.classList.add('target');
}
function finishDraft(e){
  $('edges-draft').innerHTML='';
  $('world').querySelectorAll('.target').forEach(el=>el.classList.remove('target'));
  const drag=linkDrag;linkDrag=null;$('stage').classList.remove('drawing');
  const el=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-node]');
  const target=el?.dataset.node;
  if(!drag||!target||target===drag.from)return;
  const visible=projectEdges(story,view.scope,view.expanded).visible;
  if(!visible.has(drag.from)||!visible.has(target)){toast('请把连线画到当前画布可见的模块上');return}
  remember();
  const id='edge-'+(++view.counter);
  story.edges.push({id,from:drag.from,to:target,kind:'关联',arrow:'forward'});
  renderAll();
  scheduleEdges();
  const group=projectEdges(story,view.scope,view.expanded).edges.find(g=>g.relations.some(r=>r.id===id));
  if(group)selectEdge(group.key);
  toast('已建立连线：可在上方改为因果、伏笔或冲突');
}

/* ---------------- 对话：封装 / 添加 / 关系 ---------------- */
let wrapIds=[],moduleKind='event';
function openWrapDialog(ids){
  wrapIds=ids;
  $('wrap-heading').textContent=ids.length?'用容器封装':'新建容器';
  $('wrap-submit-label').textContent=ids.length?'封装并收起':'创建容器';
  $('wrap-description').textContent=ids.length?`把选中的 ${ids.length} 个模块归入同一个容器，内容与全部连线保留；容器收起为一段故事摘要。`:'容器用来归类模块、自由换色，也可以收起为一段故事。创建后进入内部继续添加内容。';
  $('wrap-title').value='';$('wrap-summary').value='';$('wrap-error').textContent='';
  $('wrap-dialog').showModal();
  requestAnimationFrame(()=>$('wrap-title').focus());
}
$('wrap-form').addEventListener('submit',e=>{
  e.preventDefault();
  const id='wrap-'+(++view.counter);
  const result=createContainer(story,view.scope,wrapIds,$('wrap-title').value,$('wrap-summary').value,id);
  if(!result.ok){$('wrap-error').textContent=result.error;return}
  remember();story=result.story;view.multi=false;view.picked.clear();view.selected=id;view.expanded.delete(id);
  $('wrap-dialog').close();$('drawer').hidden=true;
  renderAll();
  requestAnimationFrame(()=>{centerOn(id);const el=nodeEl(id);el?.classList.add('flash');setTimeout(()=>nodeEl(id)?.classList.remove('flash'),1600)});
  toast(wrapIds.length?'已用容器封装，全部连线保留':'已创建空容器，进入后添加内容');
  wrapIds=[];
});
function openModuleDialog(kind){
  moduleKind=kind;
  const labels={event:'事件',note:'便签',cite:'引用卡',textbox:'文本框',anchor:'章节锚点',volume:'卷'};
  $('module-heading').textContent=`添加${labels[kind]||'模块'}`;
  $('module-description').textContent=kind==='event'?'事件是进度统计的最小单位，添加后可直接拖到想放的位置。':'新模块会添加到当前层，添加后可拖动摆放。';
  $('module-title').value='';$('module-text').value='';
  $('module-dialog').showModal();
  requestAnimationFrame(()=>$('module-title').focus());
}
$('module-form').addEventListener('submit',e=>{
  e.preventDefault();
  const box=$('stage').getBoundingClientRect();
  const x=(box.width/2-view.tx)/view.zoom-120,y=(box.height/2-view.ty)/view.zoom-70;
  const id='module-'+(++view.counter);
  const result=addModule(story,view.scope,moduleKind,$('module-title').value,$('module-text').value,id,x,y);
  if(!result.ok)return;
  remember();story=result.story;view.selected=id;$('module-dialog').close();renderAll();
  requestAnimationFrame(()=>{centerOn(id);const el=nodeEl(id);el?.classList.add('flash');setTimeout(()=>nodeEl(id)?.classList.remove('flash'),1600)});
  toast('已添加到当前层');
});
function showRelations(relations,title='关系详情'){
  $('relations-heading').textContent=title;
  $('relations-list').innerHTML=relations.map(e=>`<div class="relation-row"><button data-action="reveal" data-id="${e.from}">${esc(story.nodes[e.from]?.title||e.from)}<small>${esc(pathLabel(story,e.from))}</small></button><span>${esc(e.kind)}${e.arrow==='both'?' ⇄':e.arrow==='none'?' —':' →'}</span><button data-action="reveal" data-id="${e.to}">${esc(story.nodes[e.to]?.title||e.to)}<small>${esc(pathLabel(story,e.to))}</small></button></div>`).join('')||'<p>当前没有关系。</p>';
  $('relations-dialog').showModal();
}

/* ---------------- 事件处理 ---------------- */
document.addEventListener('click',e=>{
  const button=e.target.closest('[data-action]');if(!button)return;
  const {action,id}=button.dataset;
  if(action==='scope')focusScope(id);
  else if(action==='toggle')toggleInline(id);
  else if(action==='inspect')selectNode(id,{openDrawer:true,center:true});
  else if(action==='reveal')reveal(id);
  else if(action==='pick'){view.picked.has(id)?view.picked.delete(id):view.picked.add(id);renderCanvas();renderHint()}
  else if(action==='multi'){view.multi=!view.multi;view.picked.clear();$('drawer').hidden=true;renderCanvas();renderHint();if(view.multi)toast('多选：点选同层模块后用容器封装')}
  else if(action==='cancel-multi'){view.multi=false;view.picked.clear();renderCanvas();renderHint()}
  else if(action==='wrap-open'||action==='container-tool')openWrapDialog(action==='wrap-open'?[...view.picked]:view.multi?[...view.picked]:[]);
  else if(action==='wrap-close')$('wrap-dialog').close();
  else if(action==='module-close')$('module-dialog').close();
  else if(action==='add-module')openModuleDialog(button.dataset.kind);
  else if(action==='relations-close')$('relations-dialog').close();
  else if(action==='show-connections')showRelations(blockConnections(story,id||view.scope),'外部联系');
  else if(action==='tree-toggle'){view.treeOpen.has(id)?view.treeOpen.delete(id):view.treeOpen.add(id);renderTree()}
  else if(action==='sidebar'){$('sidebar').classList.toggle('open');$('side-scrim').hidden=!$('sidebar').classList.contains('open')}
  else if(action==='overview'){for(const c of story.nodes[view.scope]?.children||[])view.expanded.delete(c);renderCanvas();renderExternal();requestAnimationFrame(()=>fitView())}
  else if(action==='expand-level'){for(const c of story.nodes[view.scope]?.children||[])if(story.nodes[c].kind==='container')view.expanded.add(c);renderCanvas();renderExternal();requestAnimationFrame(()=>fitView())}
  else if(action==='collapse-done'){let count=0;for(const c of descendants(story,view.scope))if(story.nodes[c].kind==='container'&&stats(story,c).complete&&view.expanded.has(c)){view.expanded.delete(c);count++}renderCanvas();renderExternal();toast(count?`已收起 ${count} 个已完成的情节`:'已完成的情节都已收起')}
  else if(action==='tidy')tidyLayout();
  else if(action==='undo')undo();
  else if(action==='delete')armDelete(id,button);
  else if(action==='color'){const n=story.nodes[view.selected];if(!n)return;n.color=button.dataset.color;$('drawer').querySelectorAll('.color-swatch').forEach(s=>s.setAttribute('aria-pressed',s===button));renderCanvas();renderTree()}
  else if(action==='drawer-close'){view.selected=null;$('drawer').hidden=true;renderCanvas();renderLayers();renderHint()}
});
function armDelete(id,button){
  if(!drawerDeleteArmed){
    drawerDeleteArmed=true;button.classList.add('confirming');button.textContent='再点一次确认删除';
    setTimeout(()=>{drawerDeleteArmed=false;button.classList.remove('confirming');if(document.body.contains(button))button.innerHTML=`${ico('trash')}删除`},3200);
    return;
  }
  drawerDeleteArmed=false;
  const result=deleteNode(story,id);
  if(!result.ok)return;
  remember();story=result.story;
  if(!story.nodes[view.scope])view.scope='book';
  view.selected=null;$('drawer').hidden=true;renderAll();
  requestAnimationFrame(()=>scheduleEdges());
  toast(`已删除 ${result.removed.length} 个模块`);
}
function undo(){
  const old=history.pop();if(!old)return;
  story=old.story;view.scope=old.scope;view.expanded=new Set(old.expanded);view.selected=old.selected;
  view.multi=false;view.picked.clear();$('drawer').hidden=true;$('edge-inspector').hidden=true;
  renderAll();$('undo').disabled=!history.length;
  requestAnimationFrame(()=>scheduleEdges());
  toast('已撤销最近的修改');
}
function tidyLayout(){
  const children=story.nodes[view.scope]?.children||[];
  if(!children.length)return;
  remember();
  const rects=allRects();
  const ordered=[...children].sort((a,b)=>{const ra=rects.get(a),rb=rects.get(b);return ra.y-rb.y||ra.x-rb.x});
  const box=$('stage').getBoundingClientRect(),maxWidth=Math.max(900,(box.width-80)/view.zoom);
  let x=60,y=60,rowHeight=0;
  for(const id of ordered){
    const r=rects.get(id)||{w:240,h:170};
    if(x+r.w>60+maxWidth&&x>60){x=60;y+=rowHeight+110;rowHeight=0}
    story.nodes[id].x=x;story.nodes[id].y=y;
    x+=r.w+70;rowHeight=Math.max(rowHeight,r.h);
  }
  renderCanvas();renderExternal();
  requestAnimationFrame(()=>{fitView();scheduleEdges()});
  toast('已按阅读顺序重新排列，可再手动微调');
}
$('stage').addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  if(e.target.closest('.zoom-controls,.selection-bar,.edge-inspector,.edge-label'))return;
  const port=e.target.closest('.port');
  if(port){
    e.preventDefault();
    const holder=port.closest('[data-node]');
    linkDrag={from:holder.dataset.node,side:port.dataset.side,pointerId:e.pointerId};
    $('stage').classList.add('drawing');
    capture($('stage'),e.pointerId);
    return;
  }
  const edge=e.target.closest('[data-edge]');
  if(edge){selectEdge(projectEdges(story,view.scope,view.expanded).edges[+edge.dataset.edge]?.key);return}
  const el=e.target.closest('[data-node]');
  if(el){
    const id=el.dataset.node,n=story.nodes[id];
    if(view.multi&&parentOf(story,id)===view.scope&&!e.target.closest('.pick')){view.picked.has(id)?view.picked.delete(id):view.picked.add(id);renderCanvas();renderHint();return}
    if(view.selected!==id||view.selectedEdge)selectNode(id);
    // 选中会重绘画布，拖动必须拿到重绘后的元素。
    const dragEl=nodeEl(id)||el;
    const drag={type:'node',id,x:e.clientX,y:e.clientY,ox:n.x,oy:n.y,el:dragEl,moved:false,snap:snapshot()};
    e.preventDefault();
    capture($('stage'),e.pointerId);
    gesture=drag;
    return;
  }
  clearSelection();
  gesture={type:'pan',x:e.clientX,y:e.clientY,tx:view.tx,ty:view.ty};
  $('stage').classList.add('panning');
  capture($('stage'),e.pointerId);
});
let gesture=null;
$('stage').addEventListener('pointermove',e=>{
  if(linkDrag){updateDraft(e);return}
  if(!gesture)return;
  if(gesture.type==='node'){
    const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
    if(Math.abs(dx)+Math.abs(dy)>3&&!gesture.moved){gesture.moved=true;gesture.el.classList.add('dragging')}
    const n=story.nodes[gesture.id];
    n.x=Math.round(gesture.ox+dx/view.zoom);n.y=Math.round(gesture.oy+dy/view.zoom);
    gesture.el.style.left=`${n.x}px`;gesture.el.style.top=`${n.y}px`;
    scheduleEdges();
  }else{
    view.tx=gesture.tx+(e.clientX-gesture.x);view.ty=gesture.ty+(e.clientY-gesture.y);
    applyTransform();
  }
});
function endGesture(e){
  if(linkDrag&&e&&e.type==='pointerup'){finishDraft(e);return}
  if(linkDrag){linkDrag=null;$('edges-draft').innerHTML='';$('stage').classList.remove('drawing')}
  if(gesture?.type==='node'&&gesture.moved){
    gesture.el.classList.remove('dragging');
    if(gesture.snap)pushSnapshot(gesture.snap);
  }
  gesture=null;$('stage').classList.remove('panning');
}
$('stage').addEventListener('pointerup',endGesture);
$('stage').addEventListener('pointercancel',()=>{linkDrag=null;$('edges-draft').innerHTML='';$('stage').classList.remove('drawing');endGesture()});
$('stage').addEventListener('dblclick',e=>{
  const edge=e.target.closest('[data-edge]');
  if(edge){
    const group=projectEdges(story,view.scope,view.expanded).edges[+edge.dataset.edge];
    if(group)showRelations(group.relations,group.relations.length>1?'这条线连接的真实事件':`${group.kind}关系`);
    return;
  }
  const el=e.target.closest('[data-node]');
  if(el)selectNode(el.dataset.node,{openDrawer:true});
});
$('stage').addEventListener('wheel',e=>{
  if(e.target.closest('.edge-inspector,.selection-bar,.drawer'))return;
  e.preventDefault();
  const box=$('stage').getBoundingClientRect();
  if(e.ctrlKey||e.metaKey)zoomAt(view.zoom*Math.exp(-e.deltaY*.002),e.clientX-box.left,e.clientY-box.top);
  else{view.tx-=e.deltaX;view.ty-=e.deltaY;applyTransform()}
},{passive:false});
$('stage').addEventListener('keydown',e=>{
  if(e.target.matches('input,textarea,select'))return;
  if(e.key==='Escape'){clearSelection();return}
  const el=e.target.closest('[data-node]');if(!el)return;
  const n=story.nodes[el.dataset.node];if(!n)return;
  if(e.key==='Enter'){e.preventDefault();selectNode(n.id,{openDrawer:true});return}
  const step=e.shiftKey?24:8;
  const dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;
  if(!dx&&!dy)return;
  e.preventDefault();selectNode(n.id);
  n.x+=dx;n.y+=dy;renderCanvas();
  requestAnimationFrame(()=>{nodeEl(n.id)?.focus({preventScroll:true})});
});
$('curve-mode').addEventListener('click',()=>setMode('curve'));
$('ortho-mode').addEventListener('click',()=>setMode('ortho'));
function setMode(mode){
  view.mode=mode;
  for(const [id,m] of [['curve-mode','curve'],['ortho-mode','ortho']]){$(id).classList.toggle('active',mode===m);$(id).setAttribute('aria-pressed',mode===m)}
  scheduleEdges();
}
$('zoom-in').addEventListener('click',()=>zoomCenter(1.16));
$('zoom-out').addEventListener('click',()=>zoomCenter(1/1.16));
$('zoom-value').addEventListener('click',()=>zoomCenter(1/view.zoom));
$('fit').addEventListener('click',()=>fitView());
$('texture-toggle').addEventListener('click',()=>{
  view.textures=!view.textures;document.body.classList.toggle('no-textures',!view.textures);
  $('texture-toggle').setAttribute('aria-pressed',view.textures);
  $('texture-toggle').querySelector('.switch').classList.toggle('on',view.textures);
});
$('edit-relation').addEventListener('change',()=>setEdgeGroupField('kind',$('edit-relation').value));
$('edit-arrow').addEventListener('change',()=>setEdgeGroupField('arrow',$('edit-arrow').value));
$('edit-label').addEventListener('change',()=>setEdgeGroupField('label',$('edit-label').value.trim()));
$('edge-close').addEventListener('click',()=>{$('edge-inspector').hidden=true;view.selectedEdge=null;renderCanvas();renderHint()});
$('edge-details').addEventListener('click',()=>{
  const group=projectEdges(story,view.scope,view.expanded).edges.find(e=>e.key===view.selectedEdge);
  if(group)showRelations(group.relations,group.relations.length>1?'这条线连接的真实事件':`${group.kind}关系`);
});
$('search').addEventListener('input',()=>{
  const q=$('search').value.trim();
  if(!q){$('search-results').hidden=true;return}
  const found=Object.values(story.nodes).filter(n=>n.id!=='book'&&(n.title+' '+(n.summary||n.body||'')).includes(q)).slice(0,10);
  $('search-results').innerHTML=found.map(n=>`<button class="search-result" data-action="reveal" data-id="${n.id}"><strong>${esc(n.title)}<span class="kind-tag">${KINDS[n.kind].label}</span></strong><small>${esc(pathLabel(story,n.id))}</small></button>`).join('')||'<p class="empty-search">没有找到匹配的情节、事件或线索。</p>';
  $('search-results').hidden=false;
});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.search-wrap'))$('search-results').hidden=true});
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('search').focus();$('search').select();return}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.target.closest('input,textarea')){e.preventDefault();undo();return}
  if(e.key==='Escape'){
    stopNavigation();
    if(!$('wrap-dialog').open&&!$('relations-dialog').open&&!$('module-dialog').open&&!$('materials-dialog').open){
      $('drawer').hidden=true;$('search-results').hidden=true;$('edge-inspector').hidden=true;
      $('sidebar').classList.remove('open');$('side-scrim').hidden=true;
      view.multi=false;view.picked.clear();view.selectedEdge=null;
      renderAll();
    }
  }
});
$('materials-open').addEventListener('click',()=>$('materials-dialog').showModal());
$('materials-close').addEventListener('click',()=>$('materials-dialog').close());
$('materials-dialog').addEventListener('click',e=>{if(e.target===$('materials-dialog'))$('materials-dialog').close()});
$('palette').addEventListener('click',e=>{
  const b=e.target.closest('[data-add]');if(!b)return;
  if(b.dataset.add==='container')openWrapDialog(view.multi?[...view.picked]:[]);
  else openModuleDialog(b.dataset.add);
});
$('layers').addEventListener('click',e=>{
  const b=e.target.closest('[data-layer]');if(!b)return;
  selectNode(b.dataset.layer,{center:true});
});
$('side-scrim').addEventListener('click',()=>{$('sidebar').classList.remove('open');$('side-scrim').hidden=true});

/* ---------------- 静态内容 ---------------- */
$('module-tools').innerHTML=[['event','事件'],['note','便签'],['cite','引用'],['textbox','文本'],['anchor','章节锚点']].map(([kind,label])=>`<button data-action="add-module" data-kind="${kind}" title="添加${label}">${ico(kind)}<span class="mt-label">${label}</span></button>`).join('')+`<button class="container-tool" data-action="container-tool" title="新建容器，或用容器封装选中的模块">${ico('container')}<span class="mt-label">容器</span></button>`;
$('palette').innerHTML=[['event','事件'],['note','便签'],['cite','引用卡'],['textbox','文本框'],['anchor','章节锚点'],['volume','卷']].map(([kind,label])=>`<button class="palette-button" data-add="${kind}" style="--kind-color:${KINDS[kind].color}" title="添加${label}">${ico(kind)}<span>${label}</span></button>`).join('')+`<button class="palette-button" data-add="container" style="--kind-color:${KINDS.container.color}" title="新建容器">${ico('container')}<span>容器</span><span class="plus">＋</span></button>`;
$('event-shape-grid').innerHTML=Object.entries(EVENT_SHAPES).map(([shape,s])=>`<article class="material-card"><div class="shape-swatch shape-${shape}" style="--paper-tone:${s.tone};--paper-edge:${s.edge}">${eventSurface('gallery-'+shape,shape)}<span>${s.label}</span></div><h3>${s.label}事件</h3><p>${s.material}</p><a href="${s.original}" download>下载原图 ↗</a></article>`).join('');
$('material-grid').innerHTML=Object.entries(KINDS).filter(([kind,m])=>m.material&&kind!=='event').map(([kind,m])=>`<article class="material-card material-${kind}"><div class="material-surface" style="background-image:url('../outline-canvas-preview/assets/${kind}.webp')">${m.label}</div><h3>${m.label}</h3><p>${m.material}</p><a href="../outline-canvas-preview/assets/originals/${kind}.png" download>下载原图 ↗</a></article>`).join('');
new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>scheduleEdges())}).observe($('stage'));
$('edges').innerHTML='<defs id="edge-defs"></defs><g id="edges-static"></g><g id="edges-draft"></g>';
$('edges').setAttribute('viewBox','-1500 -900 6400 5200');
renderAll();
requestAnimationFrame(()=>{fitView(true);document.fonts.ready.then(()=>{scheduleEdges();if(view.scope==='book')fitView(true)})});
