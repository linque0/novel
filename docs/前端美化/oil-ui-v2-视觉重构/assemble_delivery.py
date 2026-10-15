from pathlib import Path
import json,shutil
R=Path(__file__).resolve().parent
p=R/'build.py';s=p.read_text(encoding='utf-8').replace(',interactive=True) for s in styles]',') for s in styles]');p.write_text(s,encoding='utf-8')
p=R/'manifest.json';m=json.loads(p.read_text(encoding='utf-8'))
for c in m['candidates']:c.pop('interactive',None)
p.write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
for ident in 'abcd':
    dest=R/'gallery'/ident;dest.mkdir(parents=True,exist_ok=True)
    for state in ('shelf','editor','outline','world','characters','inspiration','settings'):
        p=R/'final-check'/ident/(state+'.png')
        if not p.exists():p=R/'evidence'/ident/(state+'.png')
        shutil.copy2(p,dest/p.name)
print('28 screenshots assembled.')
