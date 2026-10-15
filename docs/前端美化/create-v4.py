from pathlib import Path
import shutil,re,json,hashlib
BASE=Path(__file__).resolve().parent
SRC=BASE/'oil-ui-v3-功能对齐'
R=BASE/'oil-ui-v4-双风格探索'
R.mkdir(exist_ok=True);(R/'assets').mkdir(exist_ok=True)
for name in ['data.js','style.css','aligned.js','aligned.css','extra-states.js']:
    shutil.copy2(SRC/name,R/name)
for name in ['oldsong.woff2','wenkai.woff2']:
    shutil.copy2(SRC/'assets'/name,R/'assets'/name)
app=(SRC/'app.js').read_text(encoding='utf-8')
app=re.sub(r'const portrait=.*?;\n', '''const portrait=(i=0,large=false)=>`<div class="portrait monogram ${large?'large':''} p${i}" aria-label="${people[i].name}的姓名标记"><span>${people[i].name[0]}</span><small>0${i+1}</small></div>`;\n''',app,count=1)
app=app.replace('function settings(){','function baseSettings(){',1)
(R/'app.js').write_text(app,encoding='utf-8')
files=['src/components/OutlineCenter.vue','src/components/OutlineSidebar.vue','src/components/OutlineCanvas.vue','src/components/MubuView.vue','src/components/MubuTree.vue','src/components/LoreDetail.vue','src/components/CharacterCenter.vue','src/components/CharacterList.vue','src/components/CharacterGraph.vue']
root=BASE.parents[1]
baseline=[dict(path=p,sha256=hashlib.sha256((root/p).read_bytes()).hexdigest()) for p in files if (root/p).is_file()]
(R/'software-readonly-baseline.json').write_text(json.dumps(baseline,ensure_ascii=False,indent=2),encoding='utf-8')
print(str(R))
