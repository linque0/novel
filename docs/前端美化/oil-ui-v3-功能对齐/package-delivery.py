from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib, json
R=Path(__file__).resolve().parent
keep=['a.html','b.html','c.html','d.html','index.html','style-explorer.html','manifest.json','README.md','功能对齐说明.md','REVIEW.md','交付校验.json','software-readonly-baseline.json','software-readonly-verification.json','app.js','aligned.js','extra-states.js','data.js','style.css','aligned.css','build.py']
files=[R/name for name in keep]
for dirname in ['assets','gallery','final-evidence','overview-final']:
    files.extend(p for p in (R/dirname).rglob('*') if p.is_file())
for p in files: assert p.is_file(),p
output=R.parent/'小说工坊-四版功能对齐设计稿-v3.zip'
with ZipFile(output,'w',ZIP_DEFLATED,compresslevel=6) as z:
    for p in files:z.write(p,Path(R.name)/p.relative_to(R))
with ZipFile(output) as z:
    assert z.testzip() is None
    assert sum('/gallery/' in p and p.endswith('.png') for p in z.namelist())==40
print(json.dumps(dict(path=str(output),files=len(files),bytes=output.stat().st_size,sha256=hashlib.sha256(output.read_bytes()).hexdigest(),integrity='passed'),ensure_ascii=False))
