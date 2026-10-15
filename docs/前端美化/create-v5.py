from pathlib import Path
import shutil,re,json,hashlib
B=Path(__file__).resolve().parent;R=B/'oil-ui-v5-古风与雾屿';R.mkdir(exist_ok=True);(R/'assets').mkdir(exist_ok=True)
for n in ['data.js','app.js','style.css','aligned.js','aligned.css','extra-states.js']:
 shutil.copy2(B/'oil-ui-v4-双风格探索'/n,R/n)
src=(B/'oil-ui-v4-双风格探索/build.py').read_text(encoding='utf-8')
start=src.index('styles=[');end=src.index('\napp=',start)
styles="""styles=[
 dict(id='g',name='溪山书院',concept='以线装册页、山水留白与朱印题签，让创作像展开一部自己的藏书。',palette=['#EDE8DA','#354C43','#9C4436'],typography='宋体作品题名与正文；文楷导航；直排册签',traits=['右侧直排导航','线装书册与山水留白','双页式编辑工作区']),
 dict(id='h',name='雾屿',concept='把故事放在雾化的空间中，正在创作的那一部成为唯一清晰的焦点。',palette=['#283C38','#8FBFBA','#F3F4EF'],typography='无衬线界面；宋体正文；大尺度作品标题',traits=['雾化绸面背景','纵深悬浮作品选择','胶囊导航与半透明工作面'])]
"""
src=src[:start]+styles+src[end:]
src=src.replace('8881','8882').replace('小说工坊 · 两种新美术方向','小说工坊 · 古风与雾屿').replace('oil-ui-04','oil-ui-05').replace('Generated E / F','Generated G / H')
(R/'build.py').write_text(src,encoding='utf-8')
root=B.parents[1]
baseline=json.loads((B/'oil-ui-v4-双风格探索/software-readonly-baseline.json').read_text(encoding='utf-8'))
for row in baseline:row['sha256']=hashlib.sha256((root/row['path']).read_bytes()).hexdigest()
(R/'software-readonly-baseline.json').write_text(json.dumps(baseline,ensure_ascii=False,indent=2),encoding='utf-8')
print(str(R))
