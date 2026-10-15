from pathlib import Path
import os, sys, math, json, html, zipfile
sys.path.insert(0,str(Path(os.environ['TEMP'])/'novel-logo-fonttools'))
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
ROOT=Path(__file__).resolve().parents[1]
ROOT.mkdir(parents=True,exist_ok=True)
FONTS={
 'song':TTFont(str(ROOT.parent/'fiction-books-v3/work/fonts/old-song.ttf')),
 'sans':TTFont('C:/Windows/Fonts/msyhbd.ttc',fontNumber=0),
 'ui':TTFont('C:/Windows/Fonts/msyh.ttc',fontNumber=0),
 'roman':TTFont('C:/Windows/Fonts/times.ttf'),
 'latin':TTFont('C:/Windows/Fonts/arial.ttf'),
}

def P(d,c='#F1F3F2'):
 return f'<path fill="{c}" fill-rule="evenodd" d="{d}"/>'
def L(d,w=2,c='#F1F3F2',opacity=1):
 return f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" opacity="{opacity}" stroke-linejoin="round"/>'
def G(b,x=0,y=0,s=1,rot=0):
 return f'<g transform="translate({x},{y}) scale({s}) rotate({rot})">{b}</g>'
def pair(b):
 return b+f'<g transform="translate(512,0) scale(-1,1)">{b}</g>'
def R(x,y,w,h,c,rx=0):
 return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{c}"/>'
def text(t,x,y,size,c='#F1F3F2',font='ui',space=0,center=False):
 f=FONTS[font];gs=f.getGlyphSet();cmap=f.getBestCmap();scale=size/f['head'].unitsPerEm;pos=0;out=[]
 for ch in t:
  name=cmap.get(ord(ch))
  if name is None:raise ValueError(f'Missing glyph {ch}')
  pen=SVGPathPen(gs);gs[name].draw(pen)
  if pen.getCommands():out.append(f'<path transform="translate({pos:.3f},0)" d="{pen.getCommands()}"/>')
  pos+=f['hmtx'][name][0]+space/scale
 width=pos*scale-space
 if center:x-=width/2
 return f'<g aria-label="{html.escape(t)}" fill="{c}" transform="translate({x:.3f},{y}) scale({scale:.7f},{-scale:.7f})">'+''.join(out)+'</g>'
def SVG(b,w=512,h=512,title='小说工坊 · 虚构徽记'):
 return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><title>{html.escape(title)}</title>{b}</svg>'
def arc(cx,cy,r,a,b):
 a,b=math.radians(a),math.radians(b)
 x,y=cx+r*math.cos(a),cy+r*math.sin(a)
 X,Y=cx+r*math.cos(b),cy+r*math.sin(b)
 return f'M{x:.3f} {y:.3f} A{r} {r} 0 {1 if b-a>math.pi else 0} 1 {X:.3f} {Y:.3f}'
def diamond(x,y,s,c):return P(f'M{x} {y-s} L{x+s*.42} {y} L{x} {y+s} L{x-s*.42} {y} Z',c)

def dream(c='#F1F3F2',detail=True):
 # Swept page horns and an ancient split-leaf body, all original contours.
 wings='M246 278 C226 244 197 235 164 234 C126 234 111 243 75 234 C43 226 25 206 20 179 C40 197 61 199 81 193 C60 178 52 156 57 137 C73 166 99 168 124 182 C111 159 110 131 120 112 C125 149 148 161 172 178 C163 150 169 124 185 107 C177 145 194 168 213 190 C234 216 243 243 246 278 Z'
 if detail:
  wings+=' M67 203 C106 220 147 196 201 237 C155 218 117 238 67 203 Z M111 185 C141 191 170 199 192 217 C158 202 139 205 111 185 Z M152 162 C174 184 186 188 207 217 C195 186 172 171 152 162 Z'
 body=pair(P(wings,c))
 horn='M232 194 C220 150 185 130 166 102 C147 75 144 45 158 23 C149 53 166 73 191 95 C218 118 232 145 232 194 Z'
 body+=pair(P(horn,c))
 body+=P('M256 49 C251 90 225 103 233 132 C237 149 250 162 256 182 C262 162 275 149 279 132 C287 103 261 90 256 49 Z M256 109 C245 125 247 138 256 150 C265 138 267 125 256 109 Z',c)
 # A folded book creates the lower breast of the crest.
 page='M242 291 C211 265 184 261 150 265 L165 306 C194 303 218 315 242 338 Z'
 body+=pair(P(page,c))
 body+=P('M256 198 L266 222 L261 384 L256 464 L251 384 L246 222 Z',c)
 # Tapered, opposing page-scroll tails.
 tail='M239 354 C195 382 135 378 109 345 C91 323 94 299 110 294 C125 291 137 305 130 318 C128 305 121 303 117 307 C103 323 124 349 154 354 C181 361 207 353 239 342 C199 378 148 394 107 371 C72 351 59 322 70 297 C51 319 57 353 82 379 C117 416 198 414 239 354 Z'
 body+=pair(P(tail,c))
 if detail:
  filament='M201 149 C174 127 128 108 116 77 C111 64 111 53 115 43 C111 79 150 102 173 118 C189 128 196 139 201 149 Z'
  body+=pair(P(filament,c))
  body+=pair(L('M225 413 C182 434 123 430 94 408',1.6,c))
  body+=pair(P('M169 412 L156 429 L179 420 Z',c))
  body+=pair(P('M222 307 L179 284 L182 293 L222 316 Z',c))
  body+=diamond(256,489,9,c)
 return body

def codex(c='#F1F3F2',detail=True):
 body=''
 if detail:
  body+=pair(L('M107 353 L107 229 C107 158 175 100 248 62',2,c,.8))
  body+=pair(L('M120 350 L120 229 C120 166 179 114 238 85',1,c,.65))
 # A sharp quill takes the place of a heraldic sword.
 body+=P('M256 23 L271 103 L265 312 L256 466 L247 312 L241 103 Z M256 111 L252 286 L256 341 L260 286 Z',c)
 # Each wing consists of an upper sweep and individually tapered lower feathers.
 wing='M242 236 C207 199 159 192 118 163 C86 140 67 104 59 67 C89 105 120 113 154 125 C188 136 224 177 242 236 Z'
 if detail:wing+=' M92 113 C131 142 173 139 211 192 C166 154 130 157 92 113 Z'
 body+=pair(P(wing,c))
 feathers=[
 'M209 223 C155 211 86 174 48 123 C61 177 130 225 209 239 Z',
 'M187 237 C124 226 64 201 37 166 C48 206 102 242 172 250 Z',
 'M162 255 C113 248 67 230 40 207 C51 242 96 266 151 268 Z',
 'M148 278 C111 275 81 267 57 253 C66 276 96 291 143 292 Z',
 ]
 for d in feathers:body+=pair(P(d,c))
 # The heart of the insignia is a real open codex, with engraved negative lines.
 book='M145 260 C184 252 217 267 240 285 L240 355 C208 337 179 331 145 335 Z'
 if detail:
  book+=' M161 278 C187 276 207 282 224 291 L224 298 C204 289 184 286 161 287 Z M161 297 C187 295 207 301 224 310 L224 317 C204 308 184 305 161 306 Z M161 316 C187 314 207 320 224 329 L224 336 C204 327 184 324 161 325 Z'
 body+=pair(P(book,c))
 body+=pair(P('M136 346 C174 341 207 349 240 369 L240 381 C204 361 173 356 136 359 Z',c))
 if detail:
  flourish='M229 388 C203 421 153 423 140 395 C132 376 145 360 159 367 C172 375 161 391 150 386 C157 401 173 402 184 394 C165 421 127 415 125 388 C122 419 156 443 189 430 C208 423 221 405 229 388 Z'
  body+=pair(P(flourish,c))
  body+=diamond(256,489,8,c)
  body+=pair(P('M153 99 L159 72 L176 55 L166 87 Z',c))
  body+=pair(P('M117 142 L104 119 L104 98 L119 124 Z',c))
  body+=pair(L('M126 434 L197 449 L233 426',1.8,c))
 return body

def archive(c='#F1F3F2',detail=True):
 body=''
 # Three differently weighted broken rings frame a deliberately off-axis monogram.
 for rad,start,end,w in [(174,-128,-20,6),(174,6,101,6),(174,120,211,6),(190,-118,-37,1.7),(190,14,85,1.7),(190,129,206,1.7),(155,-167,-63,2),(155,-36,32,2),(155,58,145,2)]:
  if detail or w==6:body+=L(arc(256,256,rad,start,end),w,c)
 # F is folded from two leaves and a tall, sliced spine.
 body+=P('M179 179 L223 145 L223 272 L179 310 Z M179 325 L223 287 L223 341 L179 378 Z',c)
 body+=P('M236 145 L351 162 L316 199 L236 185 Z M236 211 L321 224 L289 259 L236 250 Z',c)
 body+=P('M229 275 L238 267 L238 339 L229 347 Z',c)
 if detail:body+=P('M242 193 L308 204 L301 211 L242 201 Z',c)
 # A quill-like diagonal pierces the seal and controls the outer silhouette.
 body+=P('M61 428 L112 354 L126 368 L387 100 L451 51 L405 116 L137 379 L151 393 Z M135 367 L398 102 L399 106 L139 371 Z',c)
 if detail:
  body+=L('M39 302 C26 347 66 369 141 354 C258 330 419 224 466 154 C500 102 474 83 419 99',2.5,c)
  body+=P('M40 303 L34 326 L24 335 L32 308 Z',c)
  body+=P('M421 94 L445 98 L418 105 Z',c)
  for angle in [-119,-108,-97,-86,-75,41,52,63,74,85,139,150,161,172,183]:
   a=math.radians(angle);r1=179;r2=185 if angle%2 else 191
   body+=L(f'M{256+math.cos(a)*r1:.2f} {256+math.sin(a)*r1:.2f} L{256+math.cos(a)*r2:.2f} {256+math.sin(a)*r2:.2f}',2,c)
  for x,y,ang in [(101,124,-36),(383,373,42)]:
   body+=G(P('M-8 -18 L8 -18 L8 18 L-8 18 Z M-3 -12 L-3 12 L3 12 L3 -12 Z',c),x,y,1,ang)
  body+=L('M198 447 H256 L275 428 H320',2,c)
  body+=R(205,460,36,5,c)+R(247,460,7,5,c)+R(260,460,7,5,c)
 return body

def observatory(c='#F1F3F2',detail=True):
 body=''
 # An interrupted celestial instrument, not a closed badge border.
 for r,a,b,w in [(163,-154,-24,2.2),(163,12,128,2.2),(163,151,200,2.2),(183,-126,-18,1),(183,37,110,1)]:
  if detail or r==163:body+=L(arc(256,256,r,a,b),w,c)
 if detail:
  body+=f'<ellipse cx="256" cy="256" rx="211" ry="89" transform="rotate(-32 256 256)" fill="none" stroke="{c}" stroke-width="2"/>'
  body+=f'<ellipse cx="256" cy="256" rx="132" ry="174" transform="rotate(28 256 256)" fill="none" stroke="{c}" stroke-width="1"/>'
 # One tapering comet-crescent gives the instrument a strong asymmetric outline.
 body+=P('M135 99 C67 172 63 289 126 365 C180 432 278 450 352 397 C294 459 201 470 132 423 C27 360 27 204 135 99 Z',c)
 # The opened page is an almond-shaped observation aperture, not a stock book.
 eye='M105 244 C157 179 215 182 256 205 C297 182 355 179 407 244 C355 309 297 312 256 285 C215 312 157 309 105 244 Z M148 244 C185 212 218 213 256 230 C294 213 327 212 364 244 C327 276 294 277 256 260 C218 277 185 276 148 244 Z'
 body+=P(eye,c)
 body+=P('M256 216 A29 29 0 1 1 256 274 A29 29 0 1 1 256 216 Z M256 224 A21 21 0 1 1 256 266 A21 21 0 1 1 256 224 Z',c)
 body+=P('M256 226 L264 245 L256 264 L248 245 Z',c)
 # Long registration axis, broad at the center and needle thin at the ends.
 body+=P('M256 26 L261 93 L256 149 L251 93 Z M256 304 L264 341 L256 476 L248 341 Z',c)
 body+=pair(P('M251 322 C217 303 184 302 151 316 L165 335 C195 324 224 333 251 347 Z',c))
 if detail:
  body+=pair(P('M229 361 C194 384 164 380 142 365 C161 392 199 405 229 361 Z',c))
  body+=pair(L('M174 407 C202 422 228 426 246 413',1.6,c))
  for x,y,s in [(392,91,20),(102,161,15),(407,365,12),(114,394,9)]:
   body+=P(f'M{x} {y-s} Q{x+2} {y-2} {x+s*.6} {y} Q{x+2} {y+2} {x} {y+s} Q{x-2} {y+2} {x-s*.6} {y} Q{x-2} {y-2} {x} {y-s} Z',c)
  for angle in [-142,-132,-122,-112,-102,-92,-82,-72,-62,-52,-42,58,68,78,88,98,108,118]:
   a=math.radians(angle);r1=167;r2=173 if angle%4 else 181
   body+=L(f'M{256+math.cos(a)*r1:.2f} {256+math.sin(a)*r1:.2f} L{256+math.cos(a)*r2:.2f} {256+math.sin(a)*r2:.2f}',1.3,c)
  body+=diamond(256,492,5,c)
 return body

STYLES=[
 dict(id='01-dream',name='烬卷司',en='THE DREAM SCRIPTORIUM',tag='东方异兽 · 纸焰书契',fn=dream,font='song'),
 dict(id='02-codex',name='缄默圣典',en='ORDER OF THE VEILED CODEX',tag='哥特羽翼 · 秘典纹章',fn=codex,font='song'),
 dict(id='03-archive',name='零界编纂局',en='THE NULL ARCHIVE',tag='未来断环 · 切页连字',fn=archive,font='sans'),
 dict(id='04-observatory',name='虚构星仪',en='THE FICTION OBSERVATORY',tag='宇宙秘学 · 观测之眼',fn=observatory,font='song'),
]
WHITE='#F1F3F2';BLACK='#080A0C'

assets=[]
for s in STYLES:
 d=ROOT/s['id'];d.mkdir(exist_ok=True)
 sym=s['fn'](WHITE);mono=s['fn']('#101214');simple=s['fn'](WHITE,False)
 logo=G(sym,15,8,.55)+text('小说工坊',344,150,66,WHITE,s['font'],4)+text('FICTION',348,195,19,WHITE,'roman',7)
 lightlogo=G(mono,15,8,.55)+text('小说工坊',344,150,66,'#101214',s['font'],4)+text('FICTION',348,195,19,'#101214','roman',7)
 variants={
  'emblem.svg':SVG(sym,title=s['name']),
  'emblem-black.svg':SVG(mono,title=s['name']+' · 黑色'),
  'emblem-simple.svg':SVG(simple,title=s['name']+' · 简化徽记'),
  'logo.svg':SVG(logo,1000,300,s['name']+' · 小说工坊组合'),
  'logo-on-light.svg':SVG(lightlogo,1000,300,s['name']+' · 浅底组合'),
  'app-icon.svg':SVG(R(0,0,1024,1024,BLACK)+G(sym,82,82,1.68),1024,1024,s['name']+' · 应用图标'),
  'app-icon-rounded.svg':SVG(R(0,0,1024,1024,BLACK,224)+G(sym,82,82,1.68),1024,1024,s['name']+' · 圆角图标'),
  'app-icon-small.svg':SVG(R(0,0,1024,1024,BLACK)+G(simple,82,82,1.68),1024,1024,s['name']+' · 简化图标'),
 }
 for name,content in variants.items():
  p=d/name;p.write_text(content,encoding='utf8');assets.append(str(p.relative_to(ROOT)))

# Keep the comparison sheet focused on the emblems, in the language of faction crests.
b=R(0,0,1920,1870,BLACK)
b+=text('FICTION',72,89,37,WHITE,'roman',7)
b+=text('小说工坊 / 势力徽记实验',74,129,16,'#899498','ui',1)
b+=text('FOUR ORIGINAL FACTION CRESTS   /   VECTOR SERIES 04',1180,100,12,'#899498','latin',1)
b+=R(72,165,1776,1,'#273035')
for i,s in enumerate(STYLES):
 x=72+(i%2)*924;y=204+(i//2)*785
 q=text(f'0{i+1}',0,25,14,'#899498','latin',2)
 q+=text(s['tag'],45,25,13,'#899498','ui')
 q+=G(s['fn'](WHITE),127,36,1.12)
 q+=text(s['name'],414,655,33,WHITE,s['font'],3,True)
 q+=text(s['en'],414,688,10,'#899498','latin',2.3,True)
 q+=R(172,723,484,1,'#273035')
 b+=G(q,x,y)
b+=R(72,1781,1776,1,'#273035')
b+=text('小说工坊',74,1831,24,WHITE,'song',2)
b+=text('BOOK / MYTH / FICTION',1380,1827,13,'#899498','latin',2)
(ROOT/'faction-crest-comparison.svg').write_text(SVG(b,1920,1870,'小说工坊 · 四种势力徽记'),encoding='utf8')
manifest={'styles':[{k:v for k,v in s.items() if k!='fn'} for s in STYLES],'assets':assets,'method':'Original SVG Bezier paths; all lettering outlined; no raster tracing or embedded bitmaps.'}
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
(ROOT/'使用说明.md').write_text('''# 小说工坊 · 势力徽记实验 V4

四个方向：烬卷司（东方异兽与纸焰）、缄默圣典（哥特羽翼与秘典）、零界编纂局（未来断环与书形 F）、虚构星仪（宇宙仪轨与观测之眼）。这些名称用于设计方案区分，正式品牌名仍为「小说工坊」。

emblem.svg 为完整白色徽记；emblem-black.svg 为黑色徽记；emblem-simple.svg 为减少外层装饰的版本。完整徽记适合大尺寸品牌展示。应用图标提供满版、透明圆角和减少细节的版本。极小尺寸仍需在选定方向后继续提炼主体。

logo.svg 和 logo-on-light.svg 为中文品牌组合。所有文字已转曲，全部 SVG 均由原创贝塞尔曲线与几何路径构成，没有嵌入图片。可直接拖入 Figma 编辑。PNG 与 ICO 为导出格式。完整图形会包含装饰性描边，源稿保留描边便于编辑。

参考图仅用于理解势力徽记的视觉语言，未复制已有势力符号。图像生成服务两次返回 502，因此本次最终文件直接绘制为 SVG，未使用生成图片或自动描摹。work/build.py 为可修改的源稿生成脚本，字体不随压缩包分发。
''',encoding='utf8')
print(json.dumps({'root':str(ROOT),'svg_assets':len(assets)},ensure_ascii=False))
