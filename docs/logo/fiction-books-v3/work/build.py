from pathlib import Path
import sys, os, zipfile, json, html
sys.path.insert(0, str(Path(os.environ['TEMP']) / 'novel-logo-fonttools'))
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parents[1]
ROOT.mkdir(parents=True, exist_ok=True)
FONTDIR = ROOT / 'work' / 'fonts'
FONTDIR.mkdir(parents=True, exist_ok=True)
archive = next((ROOT.parents[1] / '前端美化' / '字体').glob('京華*.zip'))
with zipfile.ZipFile(archive) as z:
    entry = next(n for n in z.namelist() if n.endswith('v3.0.ttf'))
    (FONTDIR / 'old-song.ttf').write_bytes(z.read(entry))
FONTS = {
    'song': TTFont(str(FONTDIR / 'old-song.ttf')),
    'serif': TTFont('C:/Windows/Fonts/simsun.ttc', fontNumber=0),
    'sans': TTFont('C:/Windows/Fonts/msyhbd.ttc', fontNumber=0),
    'ui': TTFont('C:/Windows/Fonts/msyh.ttc', fontNumber=0),
    'roman': TTFont('C:/Windows/Fonts/times.ttf'),
    'narrow': TTFont('C:/Windows/Fonts/ARIALNB.TTF'),
    'latin': TTFont('C:/Windows/Fonts/arial.ttf'),
}

def path(d, c):
    return f'<path fill="{c}" fill-rule="evenodd" d="{d}"/>'

def rect(x,y,w,h,c,rx=0):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{c}"/>'

def text(s,x,y,size,color,font='ui',spacing=0,center=False):
    f=FONTS[font]; gs=f.getGlyphSet(); cm=f.getBestCmap(); upm=f['head'].unitsPerEm
    scale=size/upm; xpos=0; chunks=[]
    for ch in s:
        name=cm.get(ord(ch))
        if name is None: raise ValueError(f'Missing glyph: {font} {ch}')
        pen=SVGPathPen(gs); gs[name].draw(pen)
        if pen.getCommands(): chunks.append(f'<path transform="translate({xpos:.3f},0)" d="{pen.getCommands()}"/>')
        xpos += f['hmtx'][name][0]+spacing/scale
    width=(xpos-spacing/scale)*scale if s else 0
    if center: x-=width/2
    return f'<g aria-label="{html.escape(s)}" fill="{color}" transform="translate({x:.3f},{y:.3f}) scale({scale:.7f}, {-scale:.7f})">'+''.join(chunks)+'</g>'

def move(body,x,y,s=1):
    return f'<g transform="translate({x},{y}) scale({s})">{body}</g>'

def svg(body,w,h,title):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img"><title>{html.escape(title)}</title>{body}</svg>'

def oriental(c,a=None,simple=False):
    a=a or c
    body=path('M28 73 C59 68 91 83 115 105 L115 185 C88 164 60 153 28 158 Z',c)
    body+=path('M141 105 C168 89 194 61 220 37 L220 145 C198 165 167 175 141 185 Z',c)
    if not simple:
        body+=path('M28 169 C62 166 91 179 115 198 L115 211 C90 193 61 180 28 183 Z',c)
        body+=path('M141 198 C168 188 195 181 220 161 L220 176 C199 195 169 201 141 212 Z',c)
        body+=path('M28 194 C62 191 90 204 115 222 L115 233 C89 216 60 204 28 207 Z',c)
        body+=path('M141 222 C169 213 197 206 220 188 L220 202 C194 219 166 225 141 235 Z',c)
    else:
        body+=path('M28 178 C64 176 90 192 115 211 L115 233 C89 216 60 204 28 207 Z',c)
        body+=path('M141 211 C169 202 197 192 220 174 L220 202 C194 219 166 225 141 235 Z',c)
    body+=path('M124 111 L133 105 L133 226 L124 233 Z',a)
    return body

def classical(c,a=None,simple=False):
    # The turning leaves form an arch; their lower edges form an open book.
    left='M119 27 C65 33 28 75 28 127 L28 194 C62 192 91 203 119 223 L119 194 C101 176 81 164 56 163 L56 127 C56 89 81 62 119 55 Z'
    right='M137 27 C191 33 228 75 228 127 L228 194 C194 192 165 203 137 223 L137 194 C155 176 175 164 200 163 L200 127 C200 89 175 62 137 55 Z'
    body=path(left,c)+path(right,c)
    if not simple:
        body+=path('M28 205 C60 203 91 215 119 234 L119 243 C88 224 59 214 28 217 Z',c)
        body+=path('M137 234 C165 215 196 203 228 205 L228 217 C197 214 168 224 137 243 Z',c)
    body+=path('M124 199 L128 203 L132 199 L132 236 L128 240 L124 236 Z',a or c)
    return body

def future(c,a=None,simple=False):
    a=a or c
    body=path('M38 71 L94 31 L94 120 L38 164 Z',c)
    body+=path('M38 179 L94 135 L94 184 L38 226 Z',c)
    body+=path('M108 31 L229 47 L193 84 L108 72 Z',c)
    body+=path('M108 92 L201 105 L166 140 L108 131 Z',c)
    body+=path('M99 135 L110 126 L110 181 L99 192 Z',a)
    if not simple:
        body+=path('M114 80 L188 90 L181 96 L114 87 Z',c)
    return body

def paradox(c,a=None,simple=False,mono=False):
    # An open, hollowed spread crossed by a page that reverses its overlap.
    # Both fore-edges remain visible: the silhouette reads as a book, not a cube.
    mid=c if mono else '#ABB4C2'
    left='M28 47 L120 82 L120 204 L28 169 Z M52 89 L52 145 L96 162 L96 106 Z'
    right='M136 82 L228 47 L228 169 L136 204 Z M160 106 L160 162 L204 145 L204 89 Z'
    body=path(left,c)+path(right,mid)
    # The left side passes in front; the right side appears behind the frame.
    body+=path('M52 111 L128 140 L180 120 L180 143 L128 163 L52 134 Z',c)
    if not mono:
        body+=path('M128 140 L180 120 L180 143 L128 163 Z','#68768B')
    else:
        # A small seam preserves the over-under junction in one color.
        body=path(left,c)+path(right,c)+path('M52 111 L124 138 L124 160 L52 134 Z',c)+path('M132 138 L180 120 L180 143 L132 161 Z',c)
    body+=path('M28 181 L120 216 L120 229 L28 194 Z',c)
    body+=path('M136 216 L228 181 L228 194 L136 229 Z',mid)
    return body

STYLES=[
dict(id='01-tianshu',name='天书裂卷',en='THE UNWRITTEN SCROLL',kind='中式古风',dark='#202725',paper='#EFE7D5',accent='#B63D32',font='song',latin='roman',mark=oriental,caption='古籍折页 · 朱砂门隙 · 纸上造境'),
dict(id='02-codex',name='秘典之门',en='THE CODEX GATE',kind='西方古典',dark='#142438',paper='#F2EBDD',accent='#B79A60',font='serif',latin='roman',mark=classical,caption='古典拱页 · 珍本秩序 · 未知入口'),
dict(id='03-rift',name='裂界书 F',en='FICTION / REALITY RIFT',kind='未来主义',dark='#090D10',paper='#EDF2F1',accent='#BAFF42',font='sans',latin='narrow',mark=future,caption='书形连字 · 精确错位 · 虚构切面'),
dict(id='04-paradox',name='悖论之书',en='THE IMPOSSIBLE VOLUME',kind='超现实几何',dark='#111318',paper='#F2F5F8',accent='#ABB4C2',font='sans',latin='latin',mark=paradox,caption='连续折面 · 空间错接 · 不可能篇章'),
]

def mark(s,color=None,accent=None,simple=False,mono=False):
    c=color or s['paper']; a=accent or s['accent']
    if s['id']=='04-paradox': return s['mark'](c,a,simple,mono)
    return s['mark'](c,c if mono else a,simple)

def wordmark(s,color,x=0,y=0,size=64):
    return text('小说工坊',x,y,size,color,s['font'],size*.075)

def logo(s,inverse=False,concept=False,editable=False):
    color=s['paper'] if inverse else s['dark']
    bg=s['dark'] if inverse else None
    body=rect(0,0,920,240,bg) if bg else ''
    icon=mark(s,color=color,accent=s['accent'],mono=s['id']=='04-paradox' and not inverse)
    body+=move(icon,30,15,.82)
    if concept:
        body+=text('FICTION',284,128,86,color,s['latin'],3 if s['id']!='03-rift' else 0)
        body+=wordmark(s,color,288,185,29)
    elif editable:
        family='SimSun' if s['font'] in ['song','serif'] else 'Microsoft YaHei'
        body+=f'<text x="284" y="132" font-family="{family}" font-size="70" letter-spacing="5" fill="{color}">小说工坊</text>'
        body+=f'<text x="288" y="179" font-family="Times New Roman" font-size="18" letter-spacing="6" fill="{color}">FICTION</text>'
    else:
        body+=wordmark(s,color,284,132,70)
        body+=text('FICTION',288,179,18,color,s['latin'],6)
    return svg(body,920,240,s['name']+' · 小说工坊 Logo')

files=[]
for s in STYLES:
    folder=ROOT/s['id']; folder.mkdir(exist_ok=True)
    variants={
      'mark.svg':svg(mark(s),256,256,s['name']+' · 彩色符号'),
      'mark-on-light.svg':svg(mark(s,s['dark'],mono=s['id']=='04-paradox'),256,256,s['name']+' · 浅底符号'),
      'mark-black.svg':svg(mark(s,'#111111',mono=True),256,256,s['name']+' · 黑色符号'),
      'mark-white.svg':svg(mark(s,'#FFFFFF',mono=True),256,256,s['name']+' · 白色符号'),
      'logo.svg':logo(s),
      'logo-inverse.svg':logo(s,True),
      'fiction-lockup.svg':logo(s,True,True),
      'logo-editable-text.svg':logo(s,False,False,True),
      'app-icon.svg':svg(rect(0,0,1024,1024,s['dark'])+move(mark(s),154,143,2.8),1024,1024,s['name']+' · 应用图标'),
      'app-icon-rounded.svg':svg(rect(0,0,1024,1024,s['dark'],224)+move(mark(s),154,143,2.8),1024,1024,s['name']+' · 圆角应用图标'),
      'mark-16px.svg':svg(mark(s,'#111111',simple=True,mono=True),256,256,s['name']+' · 小尺寸简化符号').replace('width="256" height="256"','width="16" height="16"'),
      'mark-24px.svg':svg(mark(s,'#111111',simple=True,mono=True),256,256,s['name']+' · 小尺寸简化符号').replace('width="256" height="256"','width="24" height="24"'),
    }
    for name,content in variants.items():
        target=folder/name; target.write_text(content,encoding='utf-8'); files.append(str(target.relative_to(ROOT)))

# A single editorial board: four identities at equal optical scale.
body=rect(0,0,1800,1900,'#E6E5DF')
body+=rect(0,0,1800,176,'#171C1D')
body+=text('小说工坊',60,80,44,'#F0EDE5','song',3)
body+=text('FICTION / FOUR BOOK STUDIES',440,75,22,'#F0EDE5','latin',3)
body+=text('书籍作为虚构的入口',62,125,17,'#BFC5BD','ui',2)
body+=text('LOGO + APP ICON     /     VECTOR EDITION 03',1180,125,13,'#BFC5BD','latin',1)
for i,s in enumerate(STYLES):
    x=60+(i%2)*870; y=218+(i//2)*800
    b=rect(0,0,810,760,s['paper'])
    b+=text(f'0{i+1}   /   '+s['kind'],36,42,13,s['dark'],'ui',1)
    b+=text(s['name'],36,88,31,s['dark'],s['font'],1)
    b+=text(s['en'],36,116,11,s['dark'],'latin',1.4)
    b+=rect(0,143,810,355,s['dark'])
    b+=move(mark(s),264,175,1.1)
    b+=text('FICTION',405,470,14,s['accent'],s['latin'],6,True)
    b+=move(mark(s,s['dark'],mono=s['id']=='04-paradox'),34,522,.38)
    b+=wordmark(s,s['dark'],165,573,41)
    b+=text('FICTION',168,604,12,s['dark'],s['latin'],5)
    b+=rect(36,639,70,70,s['dark'],15)+move(mark(s),46,648,.195)
    b+=rect(122,639,70,70,s['dark'],35)+move(mark(s),132,648,.195)
    b+=move(mark(s,'#171C1D',mono=True),226,646,.22)
    b+=move(mark(s,'#171C1D',simple=True,mono=True),325,675,16/256)
    b+=move(mark(s,'#171C1D',simple=True,mono=True),365,667,24/256)
    b+=move(mark(s,'#171C1D',simple=True,mono=True),416,643,48/256)
    b+=text('16',333,727,10,s['dark'],'latin',center=True)
    b+=text('24',377,727,10,s['dark'],'latin',center=True)
    b+=text('48',440,727,10,s['dark'],'latin',center=True)
    b+=text('ICON / MONO / MICRO',36,735,9,s['dark'],'latin',1)
    for j,c in enumerate([s['dark'],s['accent'],s['paper']]):
        b+=rect(554+j*70,646,58,20,c)
        b+=text(c.upper(),554+j*70,685,8,s['dark'],'latin')
    b+=text(s['caption'],554,716,10,s['dark'],'ui')
    body+=move(b,x,y)
body+=text('FICTION IS A WORLD YOU CAN OPEN.',60,1861,14,'#454D49','latin',2)
body+=text('四组原创符号 / 中文组合 / 应用图标 / 单色与小尺寸',1150,1861,12,'#454D49','ui')
(ROOT/'four-book-identities.svg').write_text(svg(body,1800,1900,'小说工坊 · 四种书籍主题 Logo 与应用图标'),encoding='utf-8')

manifest={'styles':[dict(id=s['id'],name=s['name'],direction=s['kind'],colors=[s['dark'],s['paper'],s['accent']]) for s in STYLES], 'svg_assets':files,'note':'所有正式字标已转路径；editable-text 版本保留可编辑系统字体文字。京華老宋体字体不随资产包分发。'}
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'使用说明.md').write_text('''# 小说工坊 · 四种书籍主题视觉方案

01 天书裂卷：中式古风；02 秘典之门：西方古典；03 裂界书 F：未来主义；04 悖论之书：超现实几何。

每套包含独立符号、深浅色组合 Logo、FICTION 概念组合、满版与圆角应用图标、纯黑白符号，以及 16/24px 简化版。正式 SVG 的文字均转为路径；logo-editable-text.svg 保留系统字体文字，适合修改名称，外观与转曲版本可能略有差异。

app-icon.svg 为平台导出用满版图标，app-icon-rounded.svg 为透明圆角展示版本。mark.svg 为深色背景上的彩色符号，mark-on-light.svg 适合浅色背景。小尺寸请使用 mark-16px.svg 或 mark-24px.svg。

全部 SVG 均为真实矢量，未嵌入位图。将 SVG 拖入 Figma 即可编辑。字体文件不随资产包分发。源脚本保留在 work/，便于调整图形；PNG 为预览与应用导出。
''',encoding='utf-8')
print(json.dumps({'root':str(ROOT),'svg_assets':len(files),'board':str(ROOT/'four-book-identities.svg')},ensure_ascii=False))
