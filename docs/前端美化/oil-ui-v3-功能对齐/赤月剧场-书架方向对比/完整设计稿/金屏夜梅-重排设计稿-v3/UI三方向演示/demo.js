(() => {
 const people = structuredClone(window.DEMO_PEOPLE);
 const portraits = window.DEMO_ASSETS?.portraits ?? people.map((_, index) => `assets/person${index}.webp`);
 const reduced = matchMedia('(prefers-reduced-motion: reduce)');
 let active = 0, motionTimer, toastTimer;
 const body = document.body;
 const $all = selector => [...document.querySelectorAll(selector)];
 function animate() {
   if (reduced.matches || body.dataset.static === 'true') return;
   clearTimeout(motionTimer);
   body.classList.remove('scene-change');
   void body.offsetWidth;
   body.classList.add('scene-change');
   motionTimer = setTimeout(() => body.classList.remove('scene-change'), 800);
 }
 function render() {
   const p = people[active];
   body.dataset.activePerson = active;
   $all('[data-value]').forEach(el => { el.textContent = p[el.dataset.value] ?? ''; });
   $all('[data-main-portrait]').forEach(el => {el.src = portraits[active];el.alt = `${p.name}的肖像`;});
   $all('[data-person]').forEach(el => {const index = Number(el.dataset.person);el.setAttribute('aria-pressed', String(index === active));el.classList.toggle('current', index === active);const label=el.querySelector('strong,span:not(.cast-index):not(.cast-role)');if(label)label.textContent=people[index].name;else if(!el.querySelector('img'))el.textContent=people[index].name;});
   $all('.folio-number b').forEach(el => el.textContent=['壹','贰','叁'][active]);
   $all('[data-tags]').forEach(el => {el.replaceChildren(...p.tags.map(tag => {const span=document.createElement('span');span.textContent=tag;return span;}));});
   $all('[data-relations]').forEach(el => {
     el.replaceChildren(...p.relations.map(relation => {
       const target = people[relation.id];
       const button=document.createElement('button');button.className='relation-item';button.dataset.select=relation.id;button.setAttribute('aria-label',`查看${target.name}，${relation.label}`);
       const img=document.createElement('img');img.src=portraits[relation.id];img.alt='';
       const label=document.createElement('span');const name=document.createElement('strong');name.textContent=target.name;const note=document.createElement('small');note.textContent=relation.label;label.append(name,note);
       const arrow=document.createElement('span');arrow.className='arrow';arrow.textContent='↗';button.append(img,label,arrow);return button;
     }));
   });
   $all('[data-satellite]').forEach(el=>{const relation=p.relations[Number(el.dataset.satellite)];el.dataset.select=relation.id;el.setAttribute('aria-label',`查看${people[relation.id].name}，${relation.label}`);el.querySelector('img').src=portraits[relation.id];el.querySelector('img').alt=people[relation.id].name;el.querySelector('strong').textContent=people[relation.id].name;el.querySelector('small').textContent=relation.label;});
 }
 function select(index) {if(index===active)return;active=index;render();animate();}
 function tab(name) {
   $all('[data-tab]').forEach(el=>el.setAttribute('aria-selected',String(el.dataset.tab===name)));
   $all('[data-panel]').forEach(el=>{el.hidden=el.dataset.panel!==name;});
   animate();
 }
 body.insertAdjacentHTML('beforeend', `<dialog id="edit-dialog" aria-labelledby="edit-title"><form class="dialog-shell" id="edit-form"><div class="dialog-head"><h2 id="edit-title">编辑人物</h2><button type="button" class="dialog-close" data-close aria-label="关闭编辑">×</button></div><div class="dialog-grid"><label>姓名<input name="name" required maxlength="12"></label><label>角色<input name="role" required maxlength="20"></label><label>别名<input name="alias" maxlength="24"></label><label>年龄<input name="age" maxlength="12"></label><label>身份<input name="identity" maxlength="40"></label><label>所属<input name="group" maxlength="24"></label><label class="full">人物小传<textarea name="bio" required></textarea></label><label class="full">欲望与动机<textarea name="motive" required></textarea></label></div><div class="dialog-actions"><button type="button" class="text-action" data-close>取消</button><button type="submit" class="edit-action">完成编辑</button></div></form></dialog><dialog id="chapter-dialog" aria-labelledby="chapter-title"><div class="dialog-shell"><div class="dialog-head"><h2 id="chapter-title">第一章 · 初雪</h2><button class="dialog-close" data-close aria-label="关闭章节">×</button></div><p class="chapter-heading">星尘旅人 · 人物初次登场</p><div class="chapter-copy"></div></div></dialog><div class="local-toast" role="status" aria-live="polite"></div>`);
 const edit = document.querySelector('#edit-dialog');
 const chapter = document.querySelector('#chapter-dialog');
 body.insertAdjacentHTML('beforeend','<dialog class="baseline-dialog" id="baseline-dialog" aria-labelledby="baseline-title"><div class="dialog-shell"><div class="dialog-head"><h2 id="baseline-title">金屏夜梅 v3 · 原人物页</h2><button class="dialog-close" data-close aria-label="关闭原稿">×</button></div><img alt="金屏夜梅 v3 原人物页截图"></div></dialog>');
 const baseline = document.querySelector('#baseline-dialog');
 baseline.querySelector('img').src=window.DEMO_ASSETS?.baseline??'screenshots/baseline-v3.png';
 document.querySelector('.chapter-copy').replaceChildren(...window.DEMO_CHAPTER.map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));
 document.addEventListener('click', event => {
   const pick=event.target.closest('[data-person],[data-select]');
   if(pick){select(Number(pick.dataset.select??pick.dataset.person));return;}
   const selectedTab=event.target.closest('[data-tab]');if(selectedTab){tab(selectedTab.dataset.tab);return;}
   if(event.target.closest('[data-edit]')) {const form=document.querySelector('#edit-form');for(const key of ['name','role','alias','age','identity','group','bio','motive'])form.elements[key].value=people[active][key];edit.showModal();return;}
   if(event.target.closest('[data-close]')) {event.target.closest('dialog').close();return;}
   if(event.target.closest('[data-chapter]')){const content=window.DEMO_CHAPTERS[active];document.querySelector('#chapter-title').textContent=people[active].chapter;document.querySelector('.chapter-heading').textContent='星尘旅人 · '+content.kind;document.querySelector('.chapter-copy').replaceChildren(...content.paragraphs.map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));chapter.showModal();return;}
   if(event.target.closest('[data-baseline]')){baseline.showModal();return;}
   if(event.target.closest('[data-replay]')){animate();return;}
   const staticButton=event.target.closest('[data-static]');if(staticButton){const enabled=body.dataset.static!=='true';body.dataset.static=String(enabled);staticButton.setAttribute('aria-pressed',String(enabled));staticButton.textContent=enabled?'开启动效':'静态查看';return;}
 });
 document.querySelector('#edit-form').addEventListener('submit',event=>{event.preventDefault();const form=new FormData(event.target);for(const key of ['name','role','alias','age','identity','group','bio','motive'])people[active][key]=String(form.get(key)).trim();render();edit.close();animate();const toast=document.querySelector('.local-toast');toast.textContent='已更新当前人物档案';toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2200);});
 $all('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}}));
 $all('[role=tablist]').forEach(list=>list.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...list.querySelectorAll('[data-tab]')];let index=tabs.indexOf(document.activeElement);if(event.key==='Home')index=0;else if(event.key==='End')index=tabs.length-1;else index=(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[index].focus();tab(tabs[index].dataset.tab);}));
 render();
 document.fonts.ready.then(()=>{if(!body.dataset.static)animate();});
 window.addEventListener('pagehide',()=>{clearTimeout(motionTimer);clearTimeout(toastTimer);});
})();
