from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib,json
R=Path(__file__).resolve().parent
keep=['g.html','h.html','index.html','style-explorer.html','manifest.json','README.md','DESIGN.md','REVIEW.md','交付校验.json','software-readonly-baseline.json','software-readonly-verification.json','app.js','aligned.js','extra-states.js','directions.js','data.js','style.css','aligned.css','directions.css','build.py','assemble-delivery.py','package-delivery.py']
files=[R/n for n in keep]
for dirname in ['assets','gallery','final-evidence','overview']:
    files.extend(p for p in (R/dirname).rglob('*') if p.is_file())
for p in files: assert p.is_file(),p
output=R.parent/'小说工坊-古风与雾屿设计稿-v5.zip'
with ZipFile(output,'w',ZIP_DEFLATED,compresslevel=6) as z:
    for p in files:z.write(p,Path(R.name)/p.relative_to(R))
with ZipFile(output) as z:
    assert z.testzip() is None
    assert sum('/gallery/' in p and p.endswith('.png') for p in z.namelist())==20
print(json.dumps(dict(path=str(output),files=len(files),bytes=output.stat().st_size,sha256=hashlib.sha256(output.read_bytes()).hexdigest(),integrity='passed'),ensure_ascii=False))
