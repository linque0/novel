(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const data=window.DESIGN_DATA, state=document.body.dataset.state;
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let reduced=matchMedia('(prefers-reduced-motion: reduce)').matches, selectedPerson=0, selectedIdea=0;
  function replay(){document.body.classList.remove('static-view','playing');void document.body.offsetWidth;if(!reduced)document.body.classList.add('playing');}
  function still(){document.body.classList.remove('playing');document.body.classList.add('static-view');}
  window.addEventListener('message',e=>{if(e.source!==parent)return;if(e.data?.type==='replay')replay();if(e.data?.type==='static')still();});
  if(new URLSearchParams(location.search).has('static'))still();else replay();
  $$('[data-replay]').forEach(el=>el.addEventListener('click',replay));$$('[data-static]').forEach(el=>el.addEventListener('click',still));
  let toastTimer;
  function toast(message){$('#toast').textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').textContent='',2400);}
  function modal(title,fields,apply,action='完成'){
    const previous=document.activeElement;
    $('#overlay').innerHTML=`<section class="dialog" role="dialog" aria-modal="true" aria-label="${escape(title)}"><header><h2>${escape(title)}</h2><button data-close aria-label="关闭">×</button></header><form>${fields}<div class="dialog-actions"><button type="button" data-close>取消</button><button class="primary" type="submit">${escape(action)}</button></div></form></section>`;
    const close=()=>{$('#overlay').innerHTML='';previous?.focus();};
    $$('[data-close]',$('#overlay')).forEach(b=>b.onclick=close);
    $('#overlay').onclick=e=>{if(e.target.id==='overlay')close();};
    $('form',$('#overlay')).onsubmit=e=>{e.preventDefault();const values=new FormData(e.target);if(apply)apply(values);close();};
    const focusable=$$('button,input,textarea,select,a[href]',$('#overlay'));
    $('#overlay').onkeydown=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
    $('input,textarea,select',$('#overlay'))?.focus();
  }
  const input=(name,label,value='')=>`<label>${label}<input name="${name}" value="${escape(value)}" required></label>`;
  const area=(name,label,value='')=>`<label>${label}<textarea name="${name}">${escape(value)}</textarea></label>`;
  function action(title){
    if(title==='独立窗口'){window.open(location.href,'_blank','noopener');return;}
    if(/放大|缩小|适应/.test(title)){
      const label=$('[data-zoom-label]');if(!label)return;
      const zoom=title.includes('适应')?100:Math.max(70,Math.min(140,parseInt(label.textContent)+(title.includes('放大')?10:-10)));
      label.textContent=zoom+'%';
      const canvas=$('.plot-canvas,.character-graph');canvas?.style.setProperty('--zoom',zoom/100);
      $$('.plot-node,.portrait-node',canvas||document).forEach(n=>n.style.scale=zoom/100);return;
    }
    if(title==='切换吸附'){const b=$('[data-dialog="切换吸附"]');b.textContent=b.textContent.includes('开')?'吸附 · 关':'吸附 · 开';return;}
    if(title==='恢复默认设置'){location.reload();return;}
    if(title==='编辑星图系统'){$('.lore-prose')?.focus();toast('已进入条目编辑');return;}
    if(title==='定位到幕布'){location.href='world.html';return;}
    if(title==='网格布局'||title==='圆形布局'){
      const graph=$('.character-graph');graph?.classList.toggle('grid-graph',title==='网格布局');
      const nodes=$$('.portrait-node');nodes.forEach((n,i)=>{n.style.left=title==='网格布局'?(22+i*29)+'%':'';n.style.top=title==='网格布局'?'48%':'';});
      $$('.graph-toolbar button').forEach(n=>n.classList.toggle('selected',n.dataset.dialog===title));return;
    }
    if(title==='查找与替换'){modal(title,input('find','查找')+input('replace','替换为'),v=>{const p=$('[data-draft]');if(p){p.innerHTML=p.innerHTML.split(escape(v.get('find'))).join(escape(v.get('replace')));toast('已更新章节中的匹配文字');}},'替换');return;}
    if(title==='阅读章节'){modal('第一章 · 初雪',`<div class="dialog-reading">${$('[data-draft]')?.innerHTML||''}</div>`,null,'返回写作');return;}
    if(title==='更换人物肖像'){modal(title,'<label>肖像文件<input type="file" name="portrait" accept="image/*"></label>',v=>{const f=v.get('portrait');if(f?.size)$('[data-main-portrait]').src=URL.createObjectURL(f);},'应用');return;}
    if(title==='新增人物'){
      modal(title,input('name','姓名')+input('role','身份'),v=>{const n=document.createElement('button');n.innerHTML=`<span>${escape(v.get('name'))}<small>${escape(v.get('role'))}</small></span>`;n.onclick=()=>{$$('[data-person-name]').forEach(t=>t.textContent=v.get('name'));$('[data-person-role]')?.replaceChildren(document.createTextNode(v.get('role')));};$('.cast-tabs')?.append(n);n.click();},'创建人物');return;
    }
    if(title==='记录灵感'){
      modal(title,input('title','标题')+area('content','写下此刻的念头'),v=>{data.ideas.push([v.get('title'),v.get('content'),'随记','刚刚']);const n=document.createElement('button');n.className='idea-paper';n.innerHTML=`<small>随记</small><h2>${escape(v.get('title'))}</h2><p>${escape(v.get('content'))}</p><div>刚刚</div>`;n.onclick=()=>selectIdea(data.ideas.length-1);$('.idea-papers')?.prepend(n);n.click();},'收进手记');return;
    }
    if(title==='新建模块'){
      modal(title,'<label>模块类型<select name="kind"><option>事件</option><option>容器</option><option>便签</option><option>引用卡</option><option>文本框</option><option>章节锚点</option></select></label>'+input('title','模块名称'),v=>{const node=document.createElement('button');node.className='plot-node plot-note';node.style.cssText='left:300px;top:315px';node.dataset.nodeKind=v.get('kind');node.innerHTML=`<small>${escape(v.get('kind'))}</small><h3>${escape(v.get('title'))}</h3><p contenteditable="true">在这里继续构思……</p>`;$('.plot-canvas')?.append(node);},'放入画布');return;
    }
    if(/新增同级节点|新增子级节点/.test(title)){
      modal(title,input('name','节点内容')+input('tag','标签','设定'),v=>{const row=document.createElement('div');row.className='tree-node';row.innerHTML=`<span contenteditable="true">${escape(v.get('name'))}</span><span class="tag">${escape(v.get('tag'))}</span>`;(title.includes('子级')?$('.tree-branch'):$('.world-tree'))?.append(row);row.scrollIntoView({block:'nearest'});},'添加节点');return;
    }
    if(title==='新增自定义字段'){
      modal(title,input('label','字段名')+input('value','内容'),v=>{const label=document.createElement('label');label.innerHTML=`<span>${escape(v.get('label'))}</span><input value="${escape(v.get('value'))}">`;$('.dossier-fields')?.append(label);},'添加字段');return;
    }
    if(title==='添加人物标签'){
      modal(title,input('tag','标签'),v=>{const n=document.createElement('span');n.className='tag';n.textContent=v.get('tag');$('.dossier-tags')?.prepend(n);},'添加');return;
    }
    if(title==='归档灵感'){const card=$(`[data-idea="${selectedIdea}"]`);card?.remove();toast('已移入归档');return;}
    if(title==='插入正文'){sessionStorage.setItem('rinpa-insert',$('[data-idea-text]')?.value||'');location.href='editor.html';return;}
    if(title==='恍然梦'){modal('恍然梦','<p>沿着已有的故事，找一个新的切口。</p>'+area('prompt','你想探索什么？','第十二声钟响，可能意味着什么？')+'<label>关联内容<select><option>当前章节与星图系统</option><option>仅当前内容</option></select></label>',()=>toast('已收起这次构思'), '收起构思');return;}
    if(title==='新建作品'){modal(title,input('title','作品名')+area('description','故事简介'),v=>{sessionStorage.setItem('rinpa-title',v.get('title'));location.href='editor.html';},'打开稿本');return;}
    if(/关系|关联/.test(title)){modal(title,'<label>选择对象<select name="target"><option>林远 · 人物</option><option>沈砚 · 人物</option><option>星图系统 · 设定</option><option>铜星熄灭 · 大纲</option></select></label>'+input('relation','关系说明','故事线索'),()=>toast('已更新当前关系'), '关联');return;}
    if(data.scenes.includes(title)){const i=data.scenes.indexOf(title);modal(title,input('title','事件名称',title)+area('summary','事件内容',data.summaries[i]),v=>{const n=$(`#event-${i}`);if(n){$('h3',n).textContent=v.get('title');$('p',n).textContent=v.get('summary');}},'更新事件');return;}
    modal(title,input('name','名称或内容',title.includes('便签')?'保留第十二声钟响':'')+area('notes','备注'),()=>toast('已更新当前内容'));
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-dialog]');if(b)action(b.dataset.dialog);
    const collapse=e.target.closest('[data-collapse]');if(collapse){const target=collapse.nextElementSibling;if(target){target.hidden=!target.hidden;collapse.setAttribute('aria-expanded',String(!target.hidden));}}
  });
  $$('[data-kind]').forEach(b=>b.onclick=()=>{$$('[data-kind]').forEach(n=>n.classList.toggle('current',n===b));$$('[data-node-kind]').forEach(n=>n.hidden=b.dataset.kind!=='全部'&&n.dataset.nodeKind!==b.dataset.kind);$('.plot-container')?.style.setProperty('opacity',b.dataset.kind==='全部'||b.dataset.kind==='容器'?1:.15);});
  let dragging=null, dragged=false;
  const canvas=$('.plot-canvas');
  canvas?.addEventListener('pointerdown',e=>{const n=e.target.closest('.plot-node');if(!n||e.button!==0||e.target.isContentEditable)return;dragging={n,x:e.clientX,y:e.clientY,left:n.offsetLeft,top:n.offsetTop};dragged=false;});
  window.addEventListener('pointermove',e=>{if(!dragging)return;const d=dragging,dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)<5&&!dragged)return;dragged=true;d.n.classList.add('dragging');d.n.style.setProperty('left',Math.max(0,d.left+dx)+'px','important');d.n.style.setProperty('top',Math.max(65,d.top+dy)+'px','important');const nodes=$$('.event',canvas);if(nodes.length===3){const c=n=>({t:n.offsetTop,l:n.offsetLeft,r:n.offsetLeft+n.offsetWidth,y:n.offsetTop+n.offsetHeight/2,b:n.offsetTop+n.offsetHeight,x:n.offsetLeft+n.offsetWidth/2});const[a,b,c3]=nodes.map(c),note=c($('.plot-note',canvas)),cite=c($('.plot-cite',canvas)),anchor=c($('.plot-anchor',canvas));$('.plot-lines path',canvas).setAttribute('d',`M${a.r} ${a.y}C${a.r+45} ${a.y} ${b.l-45} ${b.y} ${b.l} ${b.y}M${b.r} ${b.y}C${b.r+30} ${b.y} ${c3.l-30} ${c3.y} ${c3.l} ${c3.y}M${a.x} ${a.b}L${note.x} ${note.t}M${b.x} ${b.b}L${cite.x} ${cite.t}M${c3.x} ${c3.b}L${anchor.x} ${anchor.t}`);}});
  window.addEventListener('pointerup',()=>{dragging?.n.classList.remove('dragging');dragging=null;});
  canvas?.addEventListener('click',e=>{if(dragged){e.preventDefault();e.stopImmediatePropagation();dragged=false;}},true);
  $$('[data-jump]').forEach(b=>b.onclick=()=>{const t=$('#'+b.dataset.jump);if(t){t.scrollIntoView({block:'nearest',inline:'nearest',behavior:reduced?'instant':'smooth'});if(!reduced)t.animate([{outline:'2px solid #aa6849'},{outline:'2px solid transparent'}],{duration:900});}else{const i=Number(b.dataset.jump.split('-').at(-1));action(data.scenes[i]);}$$('[data-jump]').forEach(n=>n.classList.toggle('current',n===b));});
  $$('[data-search]').forEach(field=>field.oninput=()=>{const query=field.value.trim().toLowerCase();let targets=[];if(state.startsWith('characters'))targets=$$('[data-person]');else if(state==='world')targets=$$('.tree-node');else if(state==='inspiration')targets=$$('.idea-paper');else targets=$$('.directory-entry');targets.forEach(el=>el.hidden=!el.textContent.toLowerCase().includes(query));});
  $$('[data-select-index]').forEach(b=>b.onclick=()=>{$$('[data-select-index]').forEach(n=>n.classList.toggle('current',n===b));const group=$$('.tree-group').find(n=>n.textContent.includes(b.dataset.selectIndex));group?.scrollIntoView({block:'nearest'});});
  function selectPerson(i){selectedPerson=i;const p=data.people[i];if(!p)return;$$('[data-person]').forEach(b=>b.classList.toggle('current',+b.dataset.person===i));$$('[data-person-name]').forEach(n=>n.textContent=p.name);const portrait=$('[data-main-portrait]');if(portrait){portrait.src=`assets/person${i}.webp`;portrait.alt=p.name+'的肖像';}if($('[data-person-role]'))$('[data-person-role]').textContent=p.identity;const values={姓名:p.name,角色:p.role,别名:i?'—':'小远',年龄:p.age,身份:p.identity.split(' · ')[0],所属:p.group};$$('[data-person-field]').forEach(n=>n.value=values[n.dataset.personField]||'');if($('[data-bio]'))$('[data-bio]').value=p.bio;if($('[data-motive]'))$('[data-motive]').value=p.motive;}
  $$('[data-person]').forEach(b=>b.onclick=()=>{if(state==='characters-graph')location.href='characters.html?person='+b.dataset.person;else selectPerson(+b.dataset.person);});
  if(state==='characters')selectPerson(Number(new URLSearchParams(location.search).get('person')||0));
  function selectIdea(i){selectedIdea=i;const idea=data.ideas[i];if(!idea)return;$$('[data-idea]').forEach(n=>n.classList.toggle('current',+n.dataset.idea===i));$('[data-idea-title]').value=idea[0];$('[data-idea-text]').value=idea[1]+(i===0?'\n\n林远记得十一声，沈砚却听见了十二声。\n\n两个人的分歧，会成为找到旧航线的第一条线索。':'');$('[data-idea-tag]').textContent=idea[2];$('[data-idea-date]').textContent=idea[3];}
  $$('[data-idea]').forEach(b=>b.onclick=()=>selectIdea(+b.dataset.idea));
  $$('[data-idea-filter]').forEach(b=>b.onclick=()=>{$$('[data-idea-filter]').forEach(n=>n.classList.toggle('current',n===b));$$('[data-idea]').forEach(n=>n.hidden=b.dataset.ideaFilter!=='全部'&&!data.ideas[+n.dataset.idea][2].includes(b.dataset.ideaFilter));});
  function preview(){const p=$('[data-type-preview]');if(!p)return;p.style.fontFamily=$('[data-font]').value;p.style.fontSize=$('[data-size]').value+'px';p.style.lineHeight=$('[data-lineheight]').value;$('.range-control output').textContent=$('[data-size]').value+' px';}
  $$('[data-font],[data-size],[data-lineheight]').forEach(n=>n.oninput=preview);
  $('[data-motion]')?.addEventListener('change',e=>{reduced=!e.target.checked||matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduced)still();else replay();});
  const originalSettings=$('[data-settings-panel]')?.innerHTML;
  $$('[data-settings-tab]').forEach(b=>b.onclick=()=>{const title=b.dataset.settingsTab;if(title==='外观与排版'){location.reload();return;}$$('[data-settings-tab]').forEach(n=>n.classList.toggle('current',n===b));const content=title==='编辑器'?'<label class="setting-row"><span><b>段落首行缩进</b><small>段落自动留出两个字符</small></span><input type="checkbox" role="switch" checked></label><label class="setting-row"><span><b>拼写与标点提示</b><small>写作时显示轻量提示</small></span><input type="checkbox" role="switch" checked></label>':title==='AI 与模型'?'<label class="setting-row"><span><b>服务配置</b><small>恍然梦的模型连接</small></span><button class="tool" data-dialog="模型服务">管理连接 ↗</button></label><label class="setting-row"><span><b>上下文范围</b><small>当前章节与关联对象</small></span><select><option>当前故事</option><option>仅当前章节</option></select></label>':title==='快捷键'?'<div class="setting-row"><span><b>查找文字</b></span><kbd>Ctrl + F</kbd></div><div class="setting-row"><span><b>添加节点</b></span><kbd>Enter</kbd></div><div class="setting-row"><span><b>缩进节点</b></span><kbd>Tab</kbd></div>':'<p style="font:22px/2 OldSong;margin-top:30px">妙笔 · 赤月幻戏<br>一纸一幕，万千故事。</p>';$('[data-settings-panel]').innerHTML=`<div class="section-rule"><h2>${escape(title)}</h2><span>妙笔</span></div>${content}`;});
  const chapters=['初雪','领航员','失落的星图','白鸽来信','回声海岸','第十二声钟'];
  $$('[data-chapter]').forEach(b=>b.onclick=()=>{$$('[data-chapter]').forEach(n=>n.classList.toggle('current',n===b));$('.chapter-title h1').textContent=$('b',b).textContent;if($('[data-draft]'))$('[data-draft]').innerHTML=data.body.map(p=>`<p>${escape(p)}</p>`).join('');});
  $('[data-immersion]')?.addEventListener('click',e=>{document.body.classList.toggle('immersed');e.target.textContent=document.body.classList.contains('immersed')?'退出沉浸 ↗':'沉浸写作 ↗';});
  if(sessionStorage.getItem('rinpa-insert')&&$('[data-draft]')){const p=document.createElement('p');p.textContent=sessionStorage.getItem('rinpa-insert');$('[data-draft]').append(p);sessionStorage.removeItem('rinpa-insert');}
  const title=sessionStorage.getItem('rinpa-title');if(title&&state==='editor')$('.c-title-column h2').textContent=title;
  const modules={'书架':'shelf','正文':'editor','大纲':'outline','设定':'world','人物':'characters','灵感':'inspiration','设置':'settings','章节':'editor'};
  $$('[data-module]').forEach(b=>b.onclick=()=>location.href=(modules[b.dataset.module]||'shelf')+'.html');
  $$('[data-intent]').forEach(b=>b.onclick=()=>{if(modules[b.dataset.intent])location.href=modules[b.dataset.intent]+'.html';else action(b.dataset.intent);});
  $$('[data-book]').forEach(b=>b.onclick=()=>{sessionStorage.setItem('rinpa-title',data.books[+b.dataset.book]?.title||'星尘旅人');location.href='editor.html';});
  if(state==='shelf'){$('.search input')?.addEventListener('input',e=>{$$('[data-book]').forEach(b=>b.hidden=!b.textContent.includes(e.target.value));});}
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('immersed'))$('[data-immersion]')?.click();});
})();
