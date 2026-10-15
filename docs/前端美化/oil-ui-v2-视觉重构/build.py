from pathlib import Path
import json, re, hashlib, base64
from fontTools import subset
R=Path(__file__).resolve().parent
REPO=R.parents[2]
data=(R/'data.js').read_text(encoding='utf-8')
app=(R/'app.js').read_text(encoding='utf-8')
# URL-based Oil UI frames share local media without duplicating every image four times.
js=data+'\n'+app
css=(R/'style.css').read_text(encoding='utf-8')
styles=[
dict(id='a',name='引力书舱',concept='让故事成为一件悬浮在轨道上的作品；进入正文后，视觉退回安静。',palette=['#0B131D','#F29C62','#BDE6EA'],typography='宋体大题名；无衬线工具；18px正文',traits=['悬浮底部导航','透视书封与轨道舞台','星图式人物与事件画布']),
dict(id='b',name='电光剪辑室',concept='像剪辑一部电影一样推进长篇；荧光只标记正在发生的事。',palette=['#171A18','#D4F75B','#E7EBDF'],typography='粗黑体标题；等宽编号；宋体正文',traits=['侧边工具轨','斜切海报与场景切片','人物档案与分幕时间轴']),
dict(id='c',name='琉光画境',concept='让作品、资料和灵感像玻璃纸一样在同一片光里叠合。',palette=['#E7EFF1','#146878','#F39572'],typography='文楷题名；无衬线工具；宋体正文',traits=['顶栏模块导航','玻璃叠册与折射美术','人物关系图与灵感拼贴']),
dict(id='d',name='赤月剧场',concept='用一张主海报给故事开场，用严格排版承接所有创作细节。',palette=['#F0EFEA','#C73522','#161713'],typography='超大宋体展示字；黑体工具；18px正文',traits=['黑色窄轨与红色焦点','半幅海报与巨字','人物专访与叙事分镜'])]
chars=''.join(sorted(set(js+css+json.dumps(styles,ensure_ascii=False))))
for src,dest in [('kinghwa-oldsong-400.woff2','oldsong.woff2'),('lxgw-wenkai-sc-400.woff2','wenkai.woff2')]:
    opts=subset.Options();opts.flavor='woff2'
    font=subset.load_font(str(REPO/'src/assets/fonts/files'/src),opts)
    worker=subset.Subsetter(options=opts);worker.populate(text=chars);worker.subset(font)
    subset.save_font(font,str(R/'assets'/dest),opts)
for s in styles:
    html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>小说工坊 · '+s['name']+'</title><style>'+css+'</style></head><body class="'+s['id']+'"><div id="root"></div><script>const STYLE='+json.dumps(s,ensure_ascii=False)+';'+js+'</script></body></html>'
    (R/(s['id']+'.html')).write_text(html,encoding='utf-8')
manifest=dict(schemaVersion=1,project='小说工坊 · 视觉重构第二轮',brief='四种炫酷、具有空间与美术辨识度的创作界面；每版七个完整功能视图，保持正文可读和导航清晰。',round='oil-ui-02',lang='zh',nativeViewport='1440x900',serve=dict(command='python -m http.server 8879 --bind 127.0.0.1',cwd=str(R),url='http://127.0.0.1:8879'),candidates=[dict(**s,kind='url',url='http://127.0.0.1:8879/'+s['id']+'.html') for s in styles])
(R/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('4 个方向 × 7 个功能视图；已生成 HTML 与 manifest。')
