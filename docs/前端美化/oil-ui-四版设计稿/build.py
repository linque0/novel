from pathlib import Path
import json, re, shutil
from fontTools import subset

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
CSS = (ROOT / 'design.css').read_text(encoding='utf-8')
CSS += (ROOT / 'polish.css').read_text(encoding='utf-8')
JS = (ROOT / 'design.js').read_text(encoding='utf-8')
ASSETS = ROOT / 'assets'
ASSETS.mkdir(exist_ok=True)
chars = ''.join(sorted(set(CSS + JS + '小说工坊蓝序出版朱砂笺谱赤线档案松影夜读外观模型设置数据关于')))
for src, dest in [('kinghwa-oldsong-400.woff2','oldsong.woff2'),('lxgw-wenkai-sc-400.woff2','wenkai.woff2')]:
    if (ASSETS / dest).exists():
        continue
    font = subset.load_font(str(REPO / 'src/assets/fonts/files' / src), subset.Options())
    opts = subset.Options(); opts.flavor = 'woff2'
    worker = subset.Subsetter(options=opts); worker.populate(text=chars); worker.subset(font)
    subset.save_font(font, str(ASSETS / dest), opts)

styles = [
 dict(id='a',name='蓝序出版',concept='把书籍装帧的力量留在书架，把安静留给正文。', typography='京華老宋體：书封与标题；微软雅黑：工具；正文18px / 1.95',palette=['#F7F7F2','#173CC0','#222A35'], traits=['六本横向陈列','双色巨字书封','窄轨导航与宽正文']),
 dict(id='b',name='朱砂笺谱',concept='像翻开一册当代笺谱，疏朗而有一处鲜明落款。',typography='霞鹜文楷：题名与正文；微软雅黑：工具；正文18px / 1.95',palette=['#F5F1F6','#842D43','#363040'],traits=['横向模块导航','竖排书封与选中作品展开','平面纸片与放射大纲']),
 dict(id='c',name='赤线档案',concept='将一本长篇的复杂信息整理成清楚可查的创作档案。',typography='微软雅黑：界面与题名；京華老宋體：正文；等宽数字',palette=['#F1F2EE','#B33223','#242922'],traits=['编目表格与书脊','完整文字目录','分幕式大纲与紧凑表单']),
 dict(id='d',name='松影夜读',concept='像夜里的精装藏书室，作品有分量，写作有呼吸。',typography='京華老宋體：标题与正文；微软雅黑：工具；正文18px / 1.95',palette=['#132D2B','#D5DECC','#A1C6BA'],traits=['精选作品与三列藏书','深松绿与麦白','线刻封面与横向故事路径'])
]
for s in styles:
    html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>小说工坊 · '+s['name']+'</title><style>'+CSS+'</style></head><body class="'+s['id']+'"><div id="root"></div><script>const STYLE='+json.dumps(s,ensure_ascii=False)+';'+JS+'</script></body></html>'
    (ROOT / (s['id']+'.html')).write_text(html, encoding='utf-8')
manifest = dict(schemaVersion=1,project='小说工坊 · 四种创作美学',brief='四套完整设计稿，每套含书架、设置、正文、大纲、设定、人物、灵感。共用同一批中文内容，用构图而非仅配色拉开差异。',round='oil-ui-01',lang='zh',nativeViewport='1440x900',candidates=[dict(**s,source=s['id']+'.html',interactive=True) for s in styles])
(ROOT / 'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
(ASSETS / 'SOURCES.md').write_text('字体复用小说工坊已打包的京華老宋體与霞鹜文楷，按本设计稿文字再次子集化。原授权与原包见 docs/前端美化/字体 和 src/assets/fonts/fonts-user.css（SIL OFL）。所有封面图形为本次代码生成的抽象装帧几何，不使用摄影或生成式人物图片。全部书名、字段、正文为 HTML 文本。',encoding='utf-8')
print(json.dumps(dict(pages=28,designs=4,directory=str(ROOT)),ensure_ascii=False))
