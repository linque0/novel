from pathlib import Path
import json
from fontTools import subset
R=Path(__file__).resolve().parent
REPO=R.parents[2]
styles=[
 dict(id='e',name='铬蓝索引',concept='把长篇创作变成一套精密而清晰的出版索引：每部作品都有自己的位置。',palette=['#E9E9E6','#1E40D1','#202526'],typography='无衬线工具标题；老宋体作品名与正文；等宽编号',traits=['出版索引式书架','银灰台面与钴蓝选中页','硬边表单与网格画布']),
 dict(id='f',name='紫幕折页',concept='让故事像一叠被展开的手稿，纸页有层次，编辑有秩序。',palette=['#211B2A','#D8B1F2','#EADFF1'],typography='老宋体大题名与正文；文楷姓名标记；无衬线工具',traits=['层叠折页与作品目录','李紫底色与淡紫纸面','侧边导航与安静正文'])]
app=(R/'app.js').read_text(encoding='utf-8')
insert='\n'.join((R/n).read_text(encoding='utf-8') for n in ['aligned.js','extra-states.js','directions.js'])
js=(R/'data.js').read_text(encoding='utf-8')+'\n'+app.replace('render(true);',insert+'\nrender(true);')
css='\n'.join((R/n).read_text(encoding='utf-8') for n in ['style.css','aligned.css','directions.css'])
chars=''.join(sorted(set(js+css+json.dumps(styles,ensure_ascii=False))))
for src,dest in [('kinghwa-oldsong-400.woff2','oldsong.woff2'),('lxgw-wenkai-sc-400.woff2','wenkai.woff2')]:
 opts=subset.Options();opts.flavor='woff2'
 font=subset.load_font(str(REPO/'src/assets/fonts/files'/src),opts)
 worker=subset.Subsetter(options=opts);worker.populate(text=chars);worker.subset(font)
 subset.save_font(font,str(R/'assets'/dest),opts)
for s in styles:
 html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>小说工坊 · '+s['name']+'</title><style>'+css+'</style></head><body class="'+s['id']+'"><div id="root"></div><script>const STYLE='+json.dumps(s,ensure_ascii=False)+';'+js+'</script></body></html>'
 (R/(s['id']+'.html')).write_text(html,encoding='utf-8')
manifest=dict(schemaVersion=1,project='小说工坊 · 两种新美术方向',brief='沿用原版功能结构：两种美术语言，七个主界面及三个补充视图；不生成或使用书封与人物图片。',round='oil-ui-04',lang='zh',nativeViewport='1440x900',serve=dict(command='python -m http.server 8881 --bind 127.0.0.1',cwd=str(R),url='http://127.0.0.1:8881'),candidates=[dict(**s,kind='url',url='http://127.0.0.1:8881/'+s['id']+'.html') for s in styles])
(R/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('Generated E / F, 10 states each; fonts only, no raster media.')
