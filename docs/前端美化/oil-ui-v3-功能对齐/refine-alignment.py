from pathlib import Path
p=Path(__file__).resolve().parent/'aligned.js';s=p.read_text(encoding='utf-8')
s=s.replace('M160 250V340H750V390','M160 250V300H750V340').replace('x="444" y="327"','x="444" y="287"')
# Detail changes its reading content with the selected node rather than reusing an unrelated entry.
s=s.replace("kids=loreNodes.filter(x=>x.parent===n.id),crumb=[]", "kids=loreNodes.filter(x=>x.parent===n.id),isSystem=['world','system','star'].includes(n.id),entryTitle=isSystem?'铜星':n.text,entryText=isSystem?'铜星是星图中最稳定的导航基准。它们的位置由观测局记录，所有航船据此校正航线。':(n.note||n.text),entryMore=isSystem?'一枚铜星的熄灭，意味着一条航线从记录中消失。失去坐标的人，会先忘记归途。':'此条目在幕布中维护；关联关系和子条目随当前选择切换。',crumb=[]")
s=s.replace('<h2>铜星</h2><span class="tag">导航基准</span>','<h2>${esc(entryTitle)}</h2><span class="tag">${esc(n.tags[0]||\'设定条目\')}</span>')
s=s.replace("'<p>铜星是", "'<p>铜星是")
s=s.replace('<p>铜星是星图中最稳定的导航基准。它们的位置由观测局记录，所有航船据此校正航线。</p><p>一枚铜星的熄灭，意味着一条航线从记录中消失。失去坐标的人，会先忘记归途。</p>','<p>${esc(entryText)}</p><p>${esc(entryMore)}</p>')
s=s.replace("<small>世界观 / 设定详情</small>","<small>${esc(crumb.map(c=>c.id==='star'?'铜星':c.text.slice(0,8)).join(' / '))}</small>")
p.write_text(s,encoding='utf-8')
