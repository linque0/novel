from pathlib import Path
import shutil
R=Path(__file__).resolve().parent
p=R/'build.py';s=p.read_text(encoding='utf-8')
s=s.replace("js=data+'\\n'+app","app=app.replace('render(true);', (R/'aligned.js').read_text(encoding='utf-8')+'\\nrender(true);')\njs=data+'\\n'+app")
s=s.replace("css=(R/'style.css').read_text(encoding='utf-8')","css=(R/'style.css').read_text(encoding='utf-8')+'\\n'+(R/'aligned.css').read_text(encoding='utf-8')")
s=s.replace('8879','8880').replace('视觉重构第二轮','视觉与功能对齐第三轮').replace("round='oil-ui-02'","round='oil-ui-03'").replace('四种炫酷、具有空间与美术辨识度的创作界面；每版七个完整功能视图，保持正文可读和导航清晰。','沿用四种美术方向；大纲、设定、人物回归原版功能结构；新增文本大纲、设定详情和人物关系图。')
s=s.replace('4 个方向 × 7 个功能视图；已生成 HTML 与 manifest。','4 个方向 × 10 个评审状态；已生成 HTML 与 manifest。')
p.write_text(s,encoding='utf-8')
p=R/'app.js';s=p.read_text(encoding='utf-8')
s=s.replace("selectedPerson=+t.dataset.person;render()","selectedPerson=+t.dataset.person;if(typeof charMode!=='undefined'&&charMode==='graph'){document.querySelectorAll('[data-person]').forEach(el=>{el.classList.toggle('selected',+el.dataset.person===selectedPerson);el.classList.toggle('active',+el.dataset.person===selectedPerson)})}else render()")
p.write_text(s,encoding='utf-8')
p=R/'index.html';s=p.read_text(encoding='utf-8').replace('28 屏','40 个状态').replace('视觉重构 / 02','功能对齐 / 03').replace('每版七个功能界面','每版七个功能界面与三个补充视图')
s=s.replace("['settings','设置']","['settings','设置'],['outline-text','大纲·文本'],['world-detail','设定·详情'],['characters-graph','人物·关系图']")
s=s.replace('href="${id}.html?state=${s}"','href="${id}.html?state=${s}"')
p.write_text(s,encoding='utf-8')
for ident in 'abcd':
    dest=R/'gallery'/ident;dest.mkdir(parents=True,exist_ok=True)
    for state in ('shelf','editor','inspiration','settings'):
        shutil.copy2(R.parent/'oil-ui-v2-视觉重构/gallery'/ident/(state+'.png'),dest/(state+'.png'))
print('V3 prepared in docs only; four approved views copied without visual changes.')
