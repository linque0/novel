from pathlib import Path
import xml.etree.ElementTree as ET
import json, zipfile
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'manifest.json').read_text(encoding='utf8'))
report=[]
for rel in manifest['svg_assets']:
    file=root/rel
    doc=ET.parse(file)
    nodes=list(doc.iter())
    assert not any(n.tag.rsplit('}',1)[-1] in ['image','foreignObject','script'] for n in nodes), rel
    paths=sum(n.tag.rsplit('}',1)[-1]=='path' for n in nodes)
    texts=sum(n.tag.rsplit('}',1)[-1]=='text' for n in nodes)
    assert paths>0, rel
    assert texts==0 or file.name=='logo-editable-text.svg', rel
    report.append(dict(file=rel,paths=paths,editable_text=texts))
(root/'vector-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
package=root/'novel-workshop-four-book-identities.zip'
with zipfile.ZipFile(package,'w',zipfile.ZIP_DEFLATED) as z:
    for item in root.iterdir():
        if item.name=='work' or item==package:continue
        if item.is_dir():
            for file in item.rglob('*'):
                if file.is_file():z.write(file,file.relative_to(root))
        elif item.is_file():z.write(item,item.name)
print(json.dumps(dict(svg_assets=len(report),outlined_svg=sum(i['editable_text']==0 for i in report),editable_text_svg=sum(i['editable_text']>0 for i in report),embedded_images=0,zip=str(package),bytes=package.stat().st_size),ensure_ascii=False))
