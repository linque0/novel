from pathlib import Path
import json,zipfile,xml.etree.ElementTree as ET,hashlib,shutil,struct
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'manifest.json').read_text(encoding='utf8'))
report=[]
for rel in manifest['assets']:
 doc=ET.parse(root/rel);nodes=list(doc.iter())
 forbidden=[n for n in nodes if n.tag.rsplit('}',1)[-1] in ['image','text','foreignObject','script']]
 if forbidden:raise ValueError(f'Nonvector or unoutlined content: {rel}')
 paths=sum(n.tag.rsplit('}',1)[-1]=='path' for n in nodes)
 if not paths:raise ValueError(f'Empty graphic: {rel}')
 report.append(dict(file=rel,paths=paths))
for s in manifest['styles']:
 d=root/s['id']
 for n in [16,24,32,48,64,128,256]:
  f=d/f'app-icon-{n}.png';raw=f.read_bytes()
  if raw[:8]!=b'\x89PNG\r\n\x1a\n' or struct.unpack('>II',raw[16:24])!=(n,n):raise ValueError(str(f))
 ico=(d/'app-icon.ico').read_bytes()
 if struct.unpack('<HHH',ico[:6])!=(0,1,7):raise ValueError(f'Invalid ICO: {s["id"]}')
(root/'vector-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
out=root/'novel-workshop-six-faction-crests-v5-20261105.zip'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for p in root.iterdir():
  if p.name=='work' or p.suffix=='.zip':continue
  if p.is_dir():
   for f in p.rglob('*'):
    if f.is_file():z.write(f,f.relative_to(root))
  elif p.is_file():z.write(p,p.name)
 for name in ['build.py','export.cjs','package.py']:
  z.write(root/'work'/name,Path('source')/name)
with zipfile.ZipFile(out) as z:
 if z.testzip() is not None:raise ValueError('Archive integrity check failed')
backup=Path('C:/Users/linque/.codex/visualizations/2026/10/15/01a13f94-e805-7912-835f-91fa68da993f/restored-logo-assets-20261105')
backup.mkdir(parents=True,exist_ok=True)
shutil.copy2(out,backup/out.name)
shutil.copytree(root/'work',backup/'source',dirs_exist_ok=True)
for name in ['six-faction-crests-color.png','six-faction-crests-mono.png','six-app-icons.png','设计说明.md']:
 shutil.copy2(root/name,backup/name)
digest=hashlib.sha256(out.read_bytes()).hexdigest()
if digest!=hashlib.sha256((backup/out.name).read_bytes()).hexdigest():raise ValueError('Backup mismatch')
(backup/'SHA256.txt').write_text(digest+'  '+out.name+'\n',encoding='utf8')
print(json.dumps({'styles':len(manifest['styles']),'svg_assets':len(report),'png_files':len(list(root.rglob('*.png'))),'ico_files':len(list(root.rglob('*.ico'))),'embedded_images':0,'package':str(out),'bytes':out.stat().st_size,'backup':str(backup/out.name),'sha256':digest},ensure_ascii=False))
