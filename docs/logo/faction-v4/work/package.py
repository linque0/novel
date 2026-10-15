from pathlib import Path
import json,zipfile,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'manifest.json').read_text(encoding='utf8'))
report=[]
for rel in manifest['assets']:
 doc=ET.parse(root/rel);nodes=list(doc.iter())
 forbidden=[n for n in nodes if n.tag.rsplit('}',1)[-1] in ['image','text','foreignObject','script']]
 if forbidden:raise ValueError(f'Nonoutlined or raster element: {rel}')
 paths=sum(n.tag.rsplit('}',1)[-1]=='path' for n in nodes)
 if paths<1:raise ValueError(f'Empty graphic: {rel}')
 report.append(dict(file=rel,paths=paths))
(root/'vector-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
out=root/'novel-workshop-faction-crests-v4.zip'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for p in root.iterdir():
  if p.name=='work' or p==out:continue
  if p.is_dir():
   for f in p.rglob('*'):
    if f.is_file():z.write(f,f.relative_to(root))
  elif p.is_file():z.write(p,p.name)
print(json.dumps(dict(svg_assets=len(report),outlined=True,embedded_images=0,package=str(out),bytes=out.stat().st_size),ensure_ascii=False))
