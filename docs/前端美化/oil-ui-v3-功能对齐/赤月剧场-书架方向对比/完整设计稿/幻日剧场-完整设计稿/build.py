"""Generate this standalone art revision from the approved opera prototype."""
from pathlib import Path
import json, shutil, re

ROOT = Path(__file__).resolve().parent
BASE = ROOT.parent
(ROOT / 'assets' / 'source').mkdir(parents=True, exist_ok=True)
for name in ['oldsong.woff2', 'wenkai.woff2', 'cover-a.webp', 'cover-b.webp', 'cover-c.webp', 'cover-d.webp', 'person0.webp', 'person1.webp', 'person2.webp']:
    shutil.copy2(BASE / 'assets' / name, ROOT / 'assets' / name)
for name in ['opera-approved.css', 'studio.css', 'data.js']:
    value = (BASE / name).read_text(encoding='utf-8')
    value = value.replace('assets/opera.webp', 'assets/shelf.webp')
    (ROOT / name).write_text(value, encoding='utf-8')
shelf = json.loads((BASE / 'opera-shelf.json').read_text(encoding='utf-8'))
shelf = shelf.replace('赤月歌剧院', '幻日剧场').replace('赤月剧场', '幻日剧场').replace('assets/opera.webp', 'assets/shelf.webp')
shelf = shelf.replace('本季主剧目', '正在续写').replace('赤月', '幻日')
(ROOT / 'shelf-data.js').write_text('const approvedShelves = '+json.dumps({'opera': shelf}, ensure_ascii=False)+';', encoding='utf-8')
js = (BASE / 'studio.js').read_text(encoding='utf-8')
js = js.replace('赤月歌剧院', '幻日剧场').replace('赤月剧场', '幻日剧场')
js = js.replace('<span class="brand-emblem">月</span><b>妙笔 · 幻日剧场</b>', '<span class="brand-emblem">☼</span><b>幻日剧场</b><small class="brand-app">妙笔</small>')
js = js.replace('两套完整设计稿 ↗', '完整设计稿 ↗').replace('幻日剧场 · 幕后创作间', '幻日剧场')
js = js.replace('设定索引 / INDEX', '设定索引').replace('CAST / 0', '演员档案 / 0')
js = js.replace('随心调整阅读的呼吸', '调整正文显示大小').replace('段落间留出思考的空隙', '设置段落内行距')
js = js.replace("${theme==='opera'?'nouveau':'opera'}.html?state=settings", '../金屏夜梅-完整设计稿/index.html?state=settings')
js = js.replace('切换方向 ↗', '赤月戏 ↗')
js = js.replace('<div class="dream-moon" aria-hidden="true">☾</div>', '<div class="dream-moon" aria-hidden="true">☼</div>')
js = js.replace('<p>${body[0]}</p><p>${body[1]}</p><p>${body[4]}</p>', '<p>${body[0]}</p><p>窗外的雪落得很轻。</p>')
# The quiet canvas has six editable nodes; scenery is responsible for atmosphere.
js = js.replace("}else Object.assign(model.modules.find(m=>m.id==='txt'),{x:60,y:510});", "}else { model.modules=model.modules.filter(m=>m.id!=='txt'); const pos=[[34,112],[288,112],[542,112],[45,345],[305,365],[555,345]]; model.modules.forEach((m,i)=>[m.x,m.y]=pos[i]); }")
js = js.replace('M280 195C315 195 330 195 365 195M575 195C610 195 625 195 660 195M465 280C465 320 480 330 480 385M775 280C775 320 775 320 775 345', 'M244 195C263 195 270 195 288 195M498 195C515 195 525 195 542 195M393 270C393 310 410 335 410 365M647 270C647 310 660 320 660 345')
js = js.replace('拖动模块 · 双击编辑 · 右键菜单', '拖动模块 · 双击编辑')
js = js.replace("${state.replace('-',' ')}\" data-page=\"${state}\">${content}", "${state.replace('-',' ')}\" data-page=\"${state}\"><div class=\"scene-art\" aria-hidden=\"true\"><img src=\"assets/${currentGroup()}.webp\" alt=\"\"></div>${content}")
js = js.replace(" if(model.motion&&!shelfFrozen)replay();", " parent.postMessage({type:'theatre-state',state},location.origin);\n if(model.motion&&!shelfFrozen)replay();")
# Same data and route contract as the earlier preview. Only this child prototype changes.
(ROOT / 'studio.js').write_text(js, encoding='utf-8')
html = '''<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>幻日剧场 · 完整设计稿</title><link rel="stylesheet" href="opera-approved.css"><link rel="stylesheet" href="studio.css"><link rel="stylesheet" href="parhelion.css"></head><body class="opera" data-theme="opera"><div id="app"></div><div id="overlay"></div><div id="toast" role="status" aria-live="polite"></div><script src="data.js"></script><script src="shelf-data.js"></script><script src="studio.js"></script></body></html>'''
(ROOT / 'theatre.html').write_text(html, encoding='utf-8')
states=['shelf','editor','outline','outline-text','world','world-detail','characters','characters-graph','inspiration','settings']
(ROOT / 'manifest.json').write_text(json.dumps({'title':'幻日剧场','viewport':{'width':1440,'height':900},'entry':'index.html','page':'theatre.html','states':states,'materials':['shelf','editor','outline','world','characters','inspiration','settings'],'scope':'Standalone design prototype; no database or AI integration.'}, ensure_ascii=False, indent=2), encoding='utf-8')
print('Generated 幻日剧场: 7 modules, 10 states. Parent approved files not regenerated.')
