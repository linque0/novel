from pathlib import Path
import json
from fontTools import subset
R=Path(__file__).resolve().parent
REPO=R.parents[2]
styles=[
 dict(id='g',name='溪山书院',concept='以线装册页、山水留白与朱印题签，让创作像展开一部自己的藏书。',palette=['#EDE8DA','#354C43','#9C4436'],typography='宋体作品题名与正文；文楷导航；直排册签',traits=['右侧直排导航','线装书册与山水留白','双页式编辑工作区']),
 dict(id='h',name='雾屿',concept='把故事放在雾化的空间中，正在创作的那一部成为唯一清晰的焦点。',palette=['#283C38','#8FBFBA','#F3F4EF'],typography='无衬线界面；宋体正文；大尺度作品标题',traits=['雾化绸面背景','纵深悬浮作品选择','胶囊导航与半透明工作面'])]

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
manifest=dict(schemaVersion=1,project='小说工坊 · 古风与雾屿',brief='沿用原版功能结构：两种美术语言，七个主界面及三个补充视图；不生成或使用书封与人物图片。',round='oil-ui-05',lang='zh',nativeViewport='1440x900',serve=dict(command='python -m http.server 8882 --bind 127.0.0.1',cwd=str(R),url='http://127.0.0.1:8882'),candidates=[dict(**s,kind='url',url='http://127.0.0.1:8882/'+s['id']+'.html') for s in styles])
(R/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('Generated G / H, 10 states each; fonts only, no raster media.')
