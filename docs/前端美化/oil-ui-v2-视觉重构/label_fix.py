from pathlib import Path
p=Path(__file__).resolve().parent/'app.js'
s=p.read_text(encoding='utf-8')
s=s.replace("${esc(ideas[selectedIdea][0])}</h1>${assistant()}</section>","${esc(ideas[selectedIdea][0])}</h1>${assistant().replaceAll('instruction','drawer-instruction')}</section>")
p.write_text(s,encoding='utf-8')
