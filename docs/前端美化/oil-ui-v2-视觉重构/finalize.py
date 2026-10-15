from pathlib import Path
R=Path(__file__).resolve().parent
p=R/'app.js';s=p.read_text(encoding='utf-8')
s=s.replace('你的<br>创作手感。','你的<br>创作<br>手感。')
s=s.replace("if(k===4){let ry=", "if(STYLE.id==='c'&&k===2){route='M838 140H885V375H20V470H60';tx=180;ty=365}else if(STYLE.id==='c'&&k===4){route='M164 60V20H910V610H674V554';tx=760;ty=600}else if(k===4){let ry=")
s=s.replace('<h2>那些相遇，<br>改变了故事的轨迹。</h2>','<h2>人物关系</h2>')
s=s.replace("${B('＋ 记录灵感','primary'", "${id!=='a'?B('✦ 恍然梦','secondary','data-assistant'):''}${B('＋ 记录灵感','primary'")
s=s.replace("else if(t.hasAttribute('data-close'))", "else if(t.hasAttribute('data-assistant')){$('#overlay').innerHTML=`<div class=\"modal-scrim\"><section class=\"assistant-drawer\" role=\"dialog\" aria-label=\"恍然梦创作提案\">${B('关闭 ×','secondary','data-close')}<small>当前灵感</small><h1>${esc(ideas[selectedIdea][0])}</h1>${assistant()}</section></div>`;$('#overlay textarea').focus()}else if(t.hasAttribute('data-close'))")
s=s.replace("if(!$('#instruction').value.trim()){$('#instruction').focus();return}","let prompt=t.closest('.dream-assistant').querySelector('textarea');if(!prompt.value.trim()){prompt.focus();return}")
p.write_text(s,encoding='utf-8')
css='''
/* Final review: preserve all character metadata and four inspiration cards. */
.a .characters-top{margin-bottom:16px}.a .person-selector{margin-bottom:12px}
.a .character-orbit{grid-template-rows:210px 1fr;height:490px}.a .character-hero>.portrait{width:155px;height:200px}
.a .orbit-bio{padding-top:0}.a .orbit-bio h3{margin:10px 0}.a .orbit-bio .person-motive{font-size:21px;margin:10px 0 14px}.a .orbit-bio .person-bio{font-size:17px;line-height:1.8;margin:10px 0 14px}.a .orbit-bio .person-facts{margin-top:12px;padding-top:14px}
.a .orbital-ideas{grid-template-rows:270px 245px;align-content:start;gap:16px;overflow:visible}.a .orbital-ideas .idea-image{height:78px}.a .orbital-ideas .idea-tile{padding:14px}.a .orbital-ideas .idea-tile h3{font-size:19px}.a .orbital-ideas .idea-tile p{font-size:14.5px;line-height:1.7}.a .orbital-ideas .idea-tile-copy>span{margin-top:12px}.a .orbital-ideas .it1,.a .orbital-ideas .it3{transform:translateY(18px)}.a .orbital-ideas .it2 .idea-image{height:65px}
.d .settings-sidebar>h1{font-size:43px;line-height:1.25;white-space:nowrap;margin-bottom:25px}
.c .relation-canvas{border:0;background:transparent;box-shadow:none}.c .relation-canvas>h2{font:20px WenKai;margin:18px 24px}.c .glass-person-sheet{border:0;border-left:1px solid #bed2d4;border-radius:0;background:#f7fafacc;box-shadow:none}
.assistant-drawer{position:absolute;inset:0 0 0 auto;width:410px;overflow:auto;background:var(--surface);color:var(--ink);padding:28px;border-left:1px solid var(--line);box-shadow:-20px 0 90px #0005;animation:arrive .25s ease-out}.assistant-drawer>button{float:right}.assistant-drawer>small{display:block;margin-top:64px;color:var(--muted)}.assistant-drawer>h1{font:30px/1.5 var(--title);margin:15px 0 30px}.assistant-drawer .dream-assistant{padding:22px;border:1px solid var(--line);background:var(--raised)}.assistant-drawer .dream-assistant textarea{height:160px}.assistant-drawer .dream-assistant .primary{margin-top:18px}
'''
p=R/'style.css';s=p.read_text(encoding='utf-8');p.write_text(s+css,encoding='utf-8')
(R/'data.js').write_text((R.parent/'oil-ui-四版设计稿/design.js').read_text(encoding='utf-8').split('let page=')[0],encoding='utf-8')
p=R/'build.py';s=p.read_text(encoding='utf-8').replace("(R.parent/'oil-ui-四版设计稿'/'design.js').read_text(encoding='utf-8').split('let page=')[0]","(R/'data.js').read_text(encoding='utf-8')").replace("'#E23F2B'","'#C73522'");p.write_text(s,encoding='utf-8')
print('Review fixes applied; V2 now owns its demo data.')
