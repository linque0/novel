from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
R=Path(__file__).resolve().parent
out=R.parent/'小说工坊-视觉重构V2-四版28屏.zip'
files=[R/x for x in ('index.html','style-explorer.html','a.html','b.html','c.html','d.html','app.js','data.js','style.css','build.py','manifest.json','README.md','REVIEW.md')]
files += [p for d in ('assets','gallery','overview') for p in (R/d).rglob('*') if p.is_file()]
with ZipFile(out,'w',ZIP_DEFLATED,compresslevel=6) as z:
    for p in files:z.write(p,'小说工坊-视觉重构V2/'+str(p.relative_to(R)).replace('\\','/'))
print(str(out),out.stat().st_size)
