import {seedStory,parentOf,pathTo,descendants,stats,projectEdges,blockConnections,createContainer,addModule} from './model.js';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let story=seedStory(),scope='book',expanded=new Set(),treeOpen=new Set(['lighthouse','testimony']),selected=null,multi=false,picked=new Set(),history=[],counter=0,wireFrame=0,toastTimer,moduleKind='event',wrapIds=[];
const views=new Map(),navAnimations=new Set();let navigationEpoch=0;
const containerColors=[['#6e8c79','苔绿'],['#a08455','麦金'],['#758b9b','雾蓝'],['#8d8196','灰紫'],['#a97868','陶红'],['#748b80','石绿']];
const stateLabel={done:'已完成',writing:'正在写',revise:'待修改',planned:'待展开'};
function toast(text){$('toast').textContent=text;$('toast').classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('on'),2200)}
function snapshot(){return {story:structuredClone(story),scope,expanded:[...expanded],selected}}
function remember(){history.push(snapshot());if(history.length>30)history.shift()}
function pathLabel(id){return pathTo(story,id).map(k=>story.nodes[k].title).join(' / ')}
function nodeStats(id){const n=story.nodes[id];return n.type!=='container'?{total:1,done:n.status==='done'?1:0,complete:n.status==='done',blocks:0,depth:0}:stats(story,id)}
function chapter(id){return story.nodes[id].chapter||'故事片段'}
function countText(s){return `${s.total} 个事件${s.blocks>0?' · '+s.blocks+' 个容器':''}`}
function selectable(id){return multi&&parentOf(story,id)===scope}
function pickButton(id){return selectable(id)?`<button class="pick ${picked.has(id)?'on':''}" data-action="pick" data-id="${id}" aria-label="${picked.has(id)?'取消选择':'选择'}${esc(story.nodes[id].title)}" aria-pressed="${picked.has(id)}">${picked.has(id)?'✓':''}</button>`:''}
function card(id,depth=0){
  const n=story.nodes[id],s=nodeStats(id),open=n.type==='container'&&expanded.has(id),sel=selected===id?' selected':'';
  if(n.type!=='container')return `<article class="leaf-card ${n.type}${sel}" data-node="${id}"><div class="leaf-top"><span>${{event:'事件',note:'便签',textbox:'文本'}[n.type]}</span><span class="leaf-status">${n.type==='event'?`<i class="state-dot ${n.status}"></i>${stateLabel[n.status]||'待展开'}`:''} ${pickButton(id)}</span></div><h3>${esc(n.title)}</h3><p>${esc(n.summary)}</p><button class="inspect-leaf" data-action="inspect" data-id="${id}">查看内容 ↗</button></article>`;
  return `<article class="plot-block ${open?'expanded':'collapsed'}${sel}" data-node="${id}" data-expanded="${open}" style="--block:${n.color}"><div class="block-heading"><div class="block-kicker"><span class="block-symbol"></span><span class="container-kind">容器</span><span>${esc(chapter(id))}</span>${pickButton(id)}</div><button class="inline-collapse quiet" data-action="toggle" data-id="${id}" aria-expanded="${open}" title="${open?'收起内部细节，保留摘要与外联':'在当前画布内显示子项，不切换层级'}">${open?'收起内容 −':'就地展开 ＋'}</button><h2>${esc(n.title)}</h2><p class="block-summary">${esc(n.summary||'尚未填写摘要，展开查看内部情节。')}</p>${!open&&s.blocks?`<div class="block-counts"><span>内含 ${n.children.filter(c=>story.nodes[c].type==='container').length} 个子容器</span></div>`:''}</div>${open?`<div class="block-children">${n.children.map(c=>card(c,depth+1)).join('')}</div>`:`<div class="block-progress"><i class="state-dot ${s.complete?'done':s.done?'writing':'planned'}"></i><span>${s.complete?'已完成':s.done?'进行中':'待展开'}</span><span class="progress-text">${s.total?s.done+' / '+s.total+' 事件':''}</span></div>`}<div class="block-actions"><button data-action="scope" data-id="${id}" title="切换到这个情节的内部，用面包屑返回上层">进入容器 ↗</button><button class="inspect" data-action="inspect" data-id="${id}" title="容器名称、颜色、摘要与外部联系">设置 · ${blockConnections(story,id).length} 条外联</button></div></article>`;
}
function treeRow(id,depth=0){
  const n=story.nodes[id],isBlock=n.type==='container',s=nodeStats(id),open=treeOpen.has(id),active=scope===id,current=selected===id;
  const row=`<div class="tree-row ${isBlock?'':'event'} ${active?'active':''} ${current?'current':''}" style="--depth:${depth}">${isBlock?`<button class="tree-toggle" data-action="tree-toggle" data-id="${id}" aria-label="${open?'收起':'展开'}${esc(n.title)}结构" aria-expanded="${open}">${open?'⌄':'›'}</button>`:'<span class="tree-dot"></span>'}<button class="tree-name" data-action="${isBlock?'scope':'reveal'}" data-id="${id}" title="${esc(n.title)}">${esc(n.title)}</button>${isBlock?`<span class="tree-count">${s.total}</span>`:`<i class="state-dot ${n.status}"></i>`}</div>`;
  return row+(isBlock&&open?n.children.map(c=>treeRow(c,depth+1)).join(''):'');
}
function externalCard(direction,ids){
  const list=[...ids];if(!list.length)return '';
  const title=list.length===1?story.nodes[list[0]].title:`${list.length} 处外部情节`;
  return `<div class="external-card" data-node="outside-${direction}"><span>${direction==='in'?'↳':'↗'}</span><div><small>${direction==='in'?'前接情节':'后续情节'}</small><button class="quiet" data-action="${list.length===1?'reveal':'scope-connections'}" data-id="${list.length===1?list[0]:scope}">${esc(title)} →</button></div></div>`;
}
function render(){
  if(!story.nodes[scope])scope='book';
  const n=story.nodes[scope],s=stats(story,scope),g=projectEdges(story,scope,expanded),all=stats(story,'book');
  $('tree').innerHTML=story.nodes.book.children.map(id=>treeRow(id)).join('');
  $('scope-title').textContent=scope==='book'?'全书情节':n.title;
  $('scope-tag').textContent=scope==='book'?'全书画布':'容器内部';$('scope-tag').classList.toggle('inside',scope!=='book');
  $('scope-meta').textContent=(scope==='book'?'第一卷 · 潮声':'当前情节')+' · '+countText(s);
  $('book-progress').textContent=`${all.done} / ${all.total} 个事件已完成`;
  $('breadcrumbs').innerHTML=pathTo(story,scope).map((id,i)=>`${i?'<span>›</span>':''}<button data-action="scope" data-id="${id}" ${id===scope?'aria-current="page"':''}>${id==='book'?'全书':esc(story.nodes[id].title)}</button>`).join('');
  const shownLeaves=[...g.visible].filter(k=>story.nodes[k].type==='event').length,hidden=s.total-shownLeaves;
  $('current-hint').textContent=`当前层 ${n.children.length} 个模块${hidden>0?' · '+hidden+' 个事件收在容器中':''}`;
  $('flow').innerHTML=n.children.map(id=>card(id)).join('')||'<p class="scope-empty">容器里还没有模块，可从上方添加事件、便签或文本。</p>';
  $('external-in').innerHTML=externalCard('in',g.external.in);
  $('external-out').innerHTML=externalCard('out',g.external.out);
  $('multi-toggle').setAttribute('aria-pressed',multi);
  $('selection-bar').hidden=!multi;$('selection-count').textContent=picked.size?`已选择 ${picked.size} 个模块`:'选择当前层的模块，再用容器封装';$('wrap-open').disabled=picked.size<1;
  $('undo').disabled=!history.length;
  if(!$('detail').hidden&&selected)renderDetail(selected);
  scheduleWires();
}
function scheduleWires(){if($('canvas').hasAttribute('aria-busy'))return;cancelAnimationFrame(wireFrame);wireFrame=requestAnimationFrame(drawWires)}
function rounded(points,r=9){
  let d=`M ${points[0].x} ${points[0].y}`;
  for(let i=1;i<points.length-1;i++){const a=points[i-1],p=points[i],b=points[i+1],u=Math.hypot(p.x-a.x,p.y-a.y),v=Math.hypot(b.x-p.x,b.y-p.y);if(u<.1||v<.1)continue;const q=Math.min(r,u/2,v/2),entry={x:p.x+(a.x-p.x)*q/u,y:p.y+(a.y-p.y)*q/u},exit={x:p.x+(b.x-p.x)*q/v,y:p.y+(b.y-p.y)*q/v};d+=` L ${entry.x} ${entry.y} Q ${p.x} ${p.y} ${exit.x} ${exit.y}`}
  return d+` L ${points.at(-1).x} ${points.at(-1).y}`;
}
function wireGeometry(A,B,branch,envelope){
  if(envelope){const x=envelope+18+(branch?12:0),a={x:A.x+A.w,y:A.y+A.h/2},b={x:B.x+B.w,y:B.y+B.h/2};return {start:a,end:b,d:rounded([a,{x,y:a.y},{x,y:b.y},b]),mid:{x:x+5,y:(a.y+b.y)/2-6}}}
  const right=B.x>A.x+A.w+10,left=A.x>B.x+B.w+10;
  if(right||left){const a={x:right?A.x+A.w:A.x,y:A.y+A.h/2},b={x:right?B.x:B.x+B.w,y:B.y+B.h/2},mx=(a.x+b.x)/2+(branch?12:0);return {start:a,end:b,d:rounded([a,{x:mx,y:a.y},{x:mx,y:b.y},b]),mid:{x:mx,y:(a.y+b.y)/2-8}}}
  if(B.y>A.y+A.h-4){const a={x:A.x+A.w/2,y:A.y+A.h},b={x:B.x+B.w/2,y:B.y},my=(a.y+b.y)/2;return {start:a,end:b,d:rounded([a,{x:a.x,y:my},{x:b.x,y:my},b]),mid:{x:(a.x+b.x)/2+9,y:my+3}}}
  const x=Math.max(A.x+A.w,B.x+B.w)+18+(branch?12:0),a={x:A.x+A.w,y:A.y+A.h/2},b={x:B.x+B.w,y:B.y+B.h/2};return {start:a,end:b,d:rounded([a,{x,y:a.y},{x,y:b.y},b]),mid:{x:x+8,y:(a.y+b.y)/2}};
}
function drawWires(){
  const stage=$('graph-stage'),base=stage.getBoundingClientRect(),svg=$('wires'),g=projectEdges(story,scope,expanded);
  const rects=new Map([...stage.querySelectorAll('[data-node]')].map(el=>{const r=el.getBoundingClientRect();return [el.dataset.node,{x:r.x-base.x,y:r.y-base.y,w:r.width,h:r.height}]}));
  const width=Math.max(stage.clientWidth,$('flow').offsetLeft+$('flow').scrollWidth+28),height=stage.offsetHeight;
  svg.setAttribute('width',width);svg.setAttribute('height',height);svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  svg.innerHTML=`<defs><marker id="head-cause" markerWidth="6" markerHeight="6" refX="5.3" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L6 3L0 6Z" fill="#8ca28b"/></marker><marker id="head-foreshadow" markerWidth="6" markerHeight="6" refX="5.3" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L6 3L0 6Z" fill="#9b8fa7"/></marker></defs>`+g.edges.map((e,i)=>{
    const a=rects.get(e.from),b=rects.get(e.to);if(!a||!b)return '';
    const owner=id=>{let k=id;while(story.nodes[k]&&parentOf(story,k)!==scope)k=parentOf(story,k);return k};
    const fromOwner=owner(e.from),toOwner=owner(e.to),nested=fromOwner!==toOwner&&(fromOwner!==e.from||toOwner!==e.to),vertical=Math.abs(a.x-b.x)<Math.max(a.w,b.w)/2;
    const envelope=vertical&&(nested||e.kind==='foreshadow')?Math.max(a.x+a.w,b.x+b.w,...[fromOwner,toOwner].map(k=>rects.get(k)).filter(Boolean).map(r=>r.x+r.w)):null;
    const geometry=wireGeometry(a,b,e.kind==='foreshadow',envelope),label=e.relations.length>1?`${e.kind==='foreshadow'?'伏笔':'接续'} · ${e.relations.length}`:e.label;
    return `<g data-wire="${i}" data-raw-count="${e.relations.length}"><path class="wire ${e.kind}" d="${geometry.d}" marker-end="url(#head-${e.kind})"/><circle class="wire-port ${e.kind}" cx="${geometry.start.x}" cy="${geometry.start.y}" r="2.5"/><path class="wire-hit" d="${geometry.d}" data-action="wire" data-index="${i}"/><title>${e.relations.map(r=>esc(story.nodes[r.from].title+' → '+story.nodes[r.to].title)).join('；')}</title>${label?`<text class="wire-label ${e.kind}" x="${geometry.mid.x}" y="${geometry.mid.y}" text-anchor="middle" data-action="wire" data-index="${i}">${esc(label)}</text>`:''}</g>`;
  }).join('');
}
function stopNavigation(){
  navigationEpoch++;for(const a of navAnimations)a.cancel();navAnimations.clear();document.querySelectorAll('.scope-portal').forEach(e=>e.remove());$('canvas').dataset.navigation='idle';$('canvas').removeAttribute('aria-busy');
}
function animateScope(fromRect,direction,color){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const canvas=$('canvas'),bounds=canvas.getBoundingClientRect(),stage=$('graph-stage'),epoch=navigationEpoch;
  const fallback={x:bounds.x+bounds.width*.3,y:bounds.y+bounds.height*.3,width:bounds.width*.4,height:bounds.height*.4};
  const r=fromRect||fallback,target={x:bounds.x+8,y:bounds.y+8,width:bounds.width-16,height:bounds.height-16};
  const portal=document.createElement('div');portal.className='scope-portal';portal.setAttribute('aria-hidden','true');portal.style.cssText=`left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px;--portal-color:${color||'#6e8c79'}`;document.body.append(portal);
  const transform=`translate(${target.x-r.x}px,${target.y-r.y}px) scale(${target.width/Math.max(r.width,1)},${target.height/Math.max(r.height,1)})`;
  const frames=direction==='return'?[{transform,opacity:.65},{transform:'none',opacity:0}]:[{transform:'none',opacity:.9},{transform,opacity:.65,offset:.68},{transform,opacity:0}];
  const duration=direction==='return'?300:440;
  canvas.dataset.navigation=direction;canvas.setAttribute('aria-busy','true');
  stage.style.transformOrigin=direction==='return'?'50% 45%':`${r.x+r.width/2-bounds.x}px ${r.y+r.height/2-bounds.y+canvas.scrollTop}px`;
  const a=portal.animate(frames,{duration,easing:'cubic-bezier(.2,.75,.2,1)',fill:'both'});
  const b=stage.animate(direction==='return'?[{transform:'scale(1.045)',opacity:.25},{transform:'scale(1)',opacity:1}]:[{transform:'scale(.91)',opacity:.5},{transform:'scale(.95)',opacity:.72,offset:.22},{transform:'scale(1)',opacity:1}],{duration,easing:'cubic-bezier(.25,.1,.25,1)'});
  navAnimations.add(a);navAnimations.add(b);
  Promise.allSettled([a.finished,b.finished]).then(()=>{portal.remove();navAnimations.delete(a);navAnimations.delete(b);if(epoch===navigationEpoch){canvas.dataset.navigation='idle';canvas.removeAttribute('aria-busy');scheduleWires()}});
}
function focusScope(id){
  if(story.nodes[id]?.type!=='container')return reveal(id);if(id===scope)return;
  stopNavigation();const oldScope=scope,canvas=$('canvas'),bounds=canvas.getBoundingClientRect();views.set(scope,{top:canvas.scrollTop,left:canvas.scrollLeft});
  const returning=pathTo(story,oldScope).includes(id),source=$('graph-stage').querySelector(`[data-node="${id}"]`);
  const measured=source?.getBoundingClientRect(),sourceRect=measured&&measured.bottom>bounds.top&&measured.top<bounds.bottom?{x:measured.x,y:Math.max(bounds.top,measured.y),width:measured.width,height:Math.min(measured.bottom,bounds.bottom)-Math.max(bounds.top,measured.top)}:null;
  $('structure').classList.remove('open');$('structure-scrim').hidden=true;scope=id;selected=null;picked.clear();multi=false;$('detail').hidden=true;pathTo(story,id).forEach(k=>treeOpen.add(k));render();
  const position=views.get(id)||{top:0,left:0};canvas.scrollTo({...position,behavior:'instant'});
  let destination=null;if(returning){const target=pathTo(story,oldScope)[pathTo(story,id).length];const el=$('graph-stage').querySelector(`[data-node="${target}"]`);const r=el?.getBoundingClientRect();if(r&&r.bottom>bounds.top&&r.top<bounds.bottom)destination={x:r.x,y:Math.max(bounds.top,r.y),width:r.width,height:Math.min(r.bottom,bounds.bottom)-Math.max(bounds.top,r.top)}}
  // Capture final geometry before any transform animates the stage.
  cancelAnimationFrame(wireFrame);drawWires();animateScope(returning?destination:sourceRect,returning?'return':'enter',story.nodes[returning?oldScope:id]?.color);
  $('scope-live').textContent=(id==='book'?'已返回全书画布':'已进入容器：'+story.nodes[id].title);
}
function reveal(id){
  stopNavigation();const n=story.nodes[id];if(!n)return;
  $('search').value='';$('search-results').hidden=true;$('relations-dialog').close();
  const parent=parentOf(story,id);if(!parent)return focusScope('book');
  $('structure').classList.remove('open');$('structure-scrim').hidden=true;scope=parent;selected=id;multi=false;picked.clear();pathTo(story,id).forEach(k=>treeOpen.add(k));$('detail').hidden=true;render();
  requestAnimationFrame(()=>{const el=$('graph-stage').querySelector(`[data-node="${id}"]`);el?.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});el?.classList.add('flash')});
}
function renderDetail(id){
  const n=story.nodes[id];if(!n){$('detail').hidden=true;return}
  const s=nodeStats(id),connections=blockConnections(story,id);
  $('detail').innerHTML=`<button class="icon-button close-detail" data-action="detail-close" aria-label="关闭设置">×</button><span class="eyebrow">${n.type==='container'?'容器设置':{event:'事件内容',note:'便签内容',textbox:'文本内容'}[n.type]}</span><h2>${esc(n.title)}</h2><div class="detail-path">${esc(pathLabel(id))}</div>${n.type==='container'?`<label>容器名称<input id="detail-title" value="${esc(n.title)}" maxlength="40"></label><label>容器颜色</label><div class="color-options">${containerColors.map(([color,name])=>`<button class="color-swatch" style="--swatch:${color}" data-action="color" data-color="${color}" aria-label="${name}" aria-pressed="${color===n.color}" title="${name}"></button>`).join('')}</div>`:''}<label>${n.type==='container'?'收起时的摘要':'内容'}<textarea id="detail-summary" rows="4" maxlength="200">${esc(n.summary)}</textarea></label><button class="primary" data-action="save-summary" data-id="${id}">${n.type==='container'?'保存容器设置':'更新内容'}</button>${n.type==='container'?`<div class="detail-stat"><span>内部事件</span><span>${s.total} 个</span></div><div class="detail-stat"><span>已完成</span><span>${s.done} / ${s.total}</span></div>${s.blocks?`<div class="detail-stat"><span>嵌套情节</span><span>${s.blocks} 个</span></div>`:''}`:''}<h3>外部联系 · ${connections.length}</h3><div class="connection-list">${connections.map(e=>{const other=e.direction==='in'?e.from:e.to;return `<div class="connection-item"><span class="kind">${e.kind==='foreshadow'?'伏笔关联':'因果接续'} · ${e.direction==='in'?'前接':'后续'}</span><button class="quiet" data-action="reveal" data-id="${other}">${esc(story.nodes[other].title)} ↗</button></div>`}).join('')||'<p class="detail-path">暂时没有连接到其他情节。</p>'}</div>${n.type==='container'?`<div class="detail-bottom"><button class="quiet" data-action="scope" data-id="${id}">进入容器 ↗</button><button class="quiet" data-action="toggle" data-id="${id}">${expanded.has(id)?'收起内容':'就地展开'}</button></div>`:''}`;
}
function inspect(id){$('detail').dataset.pendingColor=story.nodes[id].color||'';selected=id;$('detail').hidden=false;render();renderDetail(id);$('detail').scrollTop=0}
function showRelations(relations){
  $('relations-list').innerHTML=relations.map(e=>`<div class="relation-row"><button data-action="reveal" data-id="${e.from}">${esc(story.nodes[e.from].title)}<small>${esc(pathLabel(e.from))}</small></button><span>${e.kind==='foreshadow'?'伏笔':'接续'}<br>→</span><button data-action="reveal" data-id="${e.to}">${esc(story.nodes[e.to].title)}<small>${esc(pathLabel(e.to))}</small></button></div>`).join('')||'<p>当前没有外部联系。</p>';
  $('relations-dialog').showModal();
}
function toggle(id){const top=$('graph-stage').querySelector(`[data-node="${id}"]`)?.getBoundingClientRect().top;if(expanded.has(id))expanded.delete(id);else expanded.add(id);render();const now=$('graph-stage').querySelector(`[data-node="${id}"]`)?.getBoundingClientRect().top;if(top!==undefined&&now!==undefined)$('canvas').scrollTop+=now-top}
function undo(){const old=history.pop();if(!old)return;story=old.story;scope=old.scope;expanded=new Set(old.expanded);selected=old.selected;multi=false;picked.clear();$('detail').hidden=true;render();toast('已撤销最近的修改')}
document.addEventListener('click',e=>{
  const button=e.target.closest('[data-action]');if(!button)return;const {action,id}=button.dataset;
  if(action==='scope')focusScope(id);
  else if(action==='toggle')toggle(id);
  else if(action==='inspect')inspect(id);
  else if(action==='reveal')reveal(id);
  else if(action==='detail-close'){$('detail').hidden=true;selected=null;render()}
  else if(action==='tree-toggle'){treeOpen.has(id)?treeOpen.delete(id):treeOpen.add(id);render()}
  else if(action==='sidebar'){$('structure').classList.toggle('open');$('structure-scrim').hidden=!$('structure').classList.contains('open')}
  else if(action==='overview'){for(const c of story.nodes[scope].children)expanded.delete(c);render();$('canvas').scrollTo({top:0,left:0,behavior:'instant'})}
  else if(action==='expand-level'){for(const c of story.nodes[scope].children)if(story.nodes[c].type==='container')expanded.add(c);render()}
  else if(action==='collapse-done'){let count=0;for(const c of descendants(story,scope))if(story.nodes[c].type==='container'&&stats(story,c).complete&&expanded.has(c)){expanded.delete(c);count++}render();toast(count?`已收起 ${count} 个完成的情节`:'已完成的情节都已收起')}
  else if(action==='multi'){multi=!multi;picked.clear();$('detail').hidden=true;render()}
  else if(action==='cancel-multi'){multi=false;picked.clear();render()}
  else if(action==='pick'){picked.has(id)?picked.delete(id):picked.add(id);render()}
  else if(action==='wrap-open'||action==='container-tool'){openContainerDialog(action==='wrap-open'?[...picked]:multi?[...picked]:[])}
  else if(action==='wrap-close')$('wrap-dialog').close();
  else if(action==='save-summary'){remember();const n=story.nodes[id];n.summary=$('detail-summary').value.trim();if(n.type==='container'){n.title=$('detail-title').value.trim()||n.title;n.color=$('detail').dataset.pendingColor||n.color}render();toast(n.type==='container'?'容器设置已更新':'内容已更新')}
  else if(action==='color'){$('detail').dataset.pendingColor=button.dataset.color;for(const chip of $('detail').querySelectorAll('.color-swatch'))chip.setAttribute('aria-pressed',chip===button)}
  else if(action==='add-module'){moduleKind=button.dataset.kind;$('module-heading').textContent='添加'+({event:'事件',note:'便签',textbox:'文本'}[moduleKind]);$('module-title').value='';$('module-body').value='';$('module-dialog').showModal()}
  else if(action==='module-close')$('module-dialog').close();
  else if(action==='undo')undo();
  else if(action==='fit')$('canvas').scrollTo({top:0,left:0,behavior:'smooth'});
  else if(action==='wire'){const g=projectEdges(story,scope,expanded);const edge=g.edges[+button.dataset.index];if(edge)showRelations(edge.relations)}
  else if(action==='scope-connections')showRelations(blockConnections(story,id));
  else if(action==='relations-close')$('relations-dialog').close();
});
$('wrap-form').addEventListener('submit',e=>{
  e.preventDefault();const id='wrapped-'+(++counter),result=createContainer(story,scope,wrapIds,$('wrap-title').value,$('wrap-summary').value,id);
  if(!result.ok){$('wrap-error').textContent=result.error;return}
  remember();story=result.story;multi=false;picked.clear();selected=id;expanded.delete(id);$('wrap-dialog').close();$('detail').hidden=true;render();toast(wrapIds.length?'已用容器封装，外部联系继续保留':'已创建容器，可进入后添加内容');requestAnimationFrame(()=>$('graph-stage').querySelector(`[data-node="${id}"]`)?.classList.add('flash'));
});
$('search').addEventListener('input',()=>{
  const q=$('search').value.trim();if(!q){$('search-results').hidden=true;return}
  const found=Object.values(story.nodes).filter(n=>n.id!=='book'&&(n.title+' '+n.summary).includes(q)).slice(0,12);
  $('search-results').innerHTML=found.map(n=>`<button class="search-result" data-action="reveal" data-id="${n.id}"><strong>${esc(n.title)}</strong><small>${esc(pathLabel(n.id))}</small></button>`).join('')||'<p class="empty-search">没有找到匹配的情节或事件。</p>';$('search-results').hidden=false;
});
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('search').focus();return}
  if(e.key==='Escape'){stopNavigation();if(!$('wrap-dialog').open&&!$('relations-dialog').open&&!$('module-dialog').open){$('detail').hidden=true;$('search-results').hidden=true;$('structure').classList.remove('open');$('structure-scrim').hidden=true;multi=false;picked.clear();render()}return}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.target.closest('input,textarea')){e.preventDefault();undo()}
});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.search-wrap'))$('search-results').hidden=true});
new ResizeObserver(()=>{if($('canvas').dataset.navigation!=='idle'&&$('canvas').hasAttribute('aria-busy'))return;scheduleWires()}).observe($('graph-stage'));
document.fonts.ready.then(()=>{scheduleWires();$('canvas').scrollTo({top:0,left:0,behavior:'instant'})});
render();

function openContainerDialog(ids){
  wrapIds=ids;$('wrap-heading').textContent=ids.length?'用容器封装':'新建容器';$('wrap-submit-label').textContent=ids.length?'封装并收起':'创建容器';
  $('wrap-description').textContent=ids.length?`将选中的 ${ids.length} 个模块归入同一个容器，保留内容和全部连线。`:'容器可归类模块、自由换色，也可以收起为一段故事。进入内部后继续添加内容。';
  $('wrap-title').value='';$('wrap-summary').value='';$('wrap-error').textContent='';$('wrap-dialog').showModal();
}
$('module-form').addEventListener('submit',e=>{e.preventDefault();const result=addModule(story,scope,moduleKind,$('module-title').value,$('module-body').value,'module-'+(++counter));if(!result.ok)return;remember();story=result.story;selected=result.id;$('module-dialog').close();render();requestAnimationFrame(()=>$('graph-stage').querySelector(`[data-node="${result.id}"]`)?.scrollIntoView({behavior:'smooth',block:'center',inline:'center'}));toast('已添加到当前层')});
