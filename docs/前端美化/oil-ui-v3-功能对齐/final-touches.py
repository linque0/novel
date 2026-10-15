from pathlib import Path
p=Path(__file__).resolve().parent/'aligned.js';s=p.read_text(encoding='utf-8')
s=s.replace("selectedLore=row.dataset.loreRow;relationPanel('lore')","selectedLore=row.dataset.loreRow;loreMenu(selectedLore)")
s=s.replace("function charGraph(){return", "function charGraph(){return")
# Close transient menus before replacing a module page.
s=s.replace("else if(t.dataset.loreDetail){loreDetail=t.dataset.loreDetail;repaint()}","else if(t.dataset.loreDetail){loreDetail=t.dataset.loreDetail;repaint()}")
p.write_text(s,encoding='utf-8')
p=Path(__file__).resolve().parent/'build.py';s=p.read_text(encoding='utf-8')
s=s.replace("(R/'aligned.js').read_text(encoding='utf-8')+'\\nrender(true);'","(R/'aligned.js').read_text(encoding='utf-8')+'\\n'+(R/'extra-states.js').read_text(encoding='utf-8')+'\\nrender(true);'")
s=s.replace('人物档案与分幕时间轴','可编辑人物档案与自由画布').replace('人物专访与叙事分镜','编辑档案与分组模块画布')
p.write_text(s,encoding='utf-8')
