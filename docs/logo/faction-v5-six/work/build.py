from pathlib import Path
import os,sys,math,json,html
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
BG='#090C12';WHITE='#F0F3F5'
def P(d,c):return f'<path fill="{c}" fill-rule="evenodd" d="{d}"/>'
def L(d,w,c,op=1):return f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" opacity="{op}" stroke-linejoin="round"/>'
def R(x,y,w,h,c,rx=0):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{c}"/>'
def G(b,x=0,y=0,s=1,rot=0):return f'<g transform="translate({x},{y}) scale({s}) rotate({rot})">{b}</g>'
def pair(b):return b+f'<g transform="translate(512,0) scale(-1,1)">{b}</g>'
def diamond(x,y,s,c):return P(f'M{x} {y-s} L{x+s*.45} {y} L{x} {y+s} L{x-s*.45} {y} Z',c)
def arc(x,y,r,a,b):
 a,b=math.radians(a),math.radians(b)
 return f'M{x+r*math.cos(a):.2f} {y+r*math.sin(a):.2f} A{r} {r} 0 {int(b-a>math.pi)} 1 {x+r*math.cos(b):.2f} {y+r*math.sin(b):.2f}'
def text(t,x,y,size,c=WHITE,font='ui',space=0,center=False):
 f=FONTS[font];gs=f.getGlyphSet();cm=f.getBestCmap();scale=size/f['head'].unitsPerEm;pos=0;out=[]
 for ch in t:
  n=cm.get(ord(ch))
  if n is None:raise ValueError(f'{font} missing {ch}')
  pen=SVGPathPen(gs);gs[n].draw(pen)
  if pen.getCommands():out.append(f'<path transform="translate({pos:.3f},0)" d="{pen.getCommands()}"/>')
  pos+=f['hmtx'][n][0]+space/scale
 if center:x-=(pos*scale-space)/2
 return f'<g aria-label="{html.escape(t)}" fill="{c}" transform="translate({x:.3f},{y}) scale({scale:.7f},{-scale:.7f})">'+''.join(out)+'</g>'
def SVG(b,w=512,h=512,title='小说工坊 · 六种势力徽记'):
 return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><title>{html.escape(title)}</title>{b}</svg>'
def leaf(x,y,h,w,angle,c,vein=True):
 d=f'M0 {-h/2} C{w} {-h*.22} {w*.8} {h*.21} 0 {h/2} C{-w*.8} {h*.21} {-w} {-h*.22} 0 {-h/2} Z'
 if vein:d+=f' M0 {-h*.28} L{-w*.08} {h*.26} L{w*.1} {h*.1} Z'
 return G(P(d,c),x,y,1,angle)

def world_tree(p,detail=True):
 gold,green,ivory=p
 b=''
 if detail:
  b+=L(arc(256,251,185,202,339),1.6,gold,.8)
  b+=L(arc(256,251,196,219,316),.8,green,.7)
 # Different paths on either side make the crown botanical, not heraldic wings.
 b+=P('M241 378 C255 329 243 279 213 244 C190 220 168 207 154 187 C183 196 208 216 227 226 C204 196 197 164 204 138 C213 175 232 204 250 221 C244 185 250 158 270 134 C257 179 264 213 271 244 C283 217 305 198 329 181 L349 174 C315 204 299 235 283 270 C270 299 273 341 279 378 Z M253 253 C245 278 249 305 256 326 C262 300 267 274 253 253 Z',gold)
 b+=P('M210 243 C164 253 108 229 82 194 C112 211 142 219 177 218 C143 202 121 169 121 141 C138 174 164 190 190 194 L219 223 Z',gold)
 b+=P('M281 250 C318 252 362 229 380 202 C350 219 328 222 312 218 C338 194 352 161 350 139 C342 174 319 191 298 203 Z',gold)
 b+=P('M247 379 C221 411 174 419 142 405 C158 430 200 436 230 417 C210 445 180 451 161 448 C185 466 218 454 246 425 L256 478 L266 425 C291 452 326 460 349 445 C323 447 299 432 282 413 C319 432 356 422 373 398 C337 417 299 408 277 379 Z',gold)
 b+=P('M252 280 C248 317 255 350 256 379 L263 363 C255 332 263 301 259 280 Z',ivory)
 b+=L('M155 186 C139 172 125 156 114 139 M205 162 C191 139 186 119 188 96 M268 151 C281 125 302 107 320 100 M329 182 C353 165 370 145 379 124',4,gold)
 leaves=[(110,132,61,13,-38),(87,166,51,12,-68),(146,153,57,12,30),(177,92,66,14,-20),(211,107,64,14,28),(248,76,75,15,4),(286,104,63,14,-34),(322,94,63,14,44),(353,133,59,13,-19),(389,126,63,14,34),(385,179,56,13,65),(132,203,42,11,-55),(307,167,50,12,31)]
 for i,(x,y,h,w,a) in enumerate(leaves):
  if detail or i not in [1,2,4,10,11,12]:b+=leaf(x,y,h,w,a,green if i%4!=0 else ivory,detail)
 if detail:
  b+=pair(L('M148 437 C119 440 99 427 89 412',1.5,gold))
  b+=diamond(256,29,8,ivory)
 return b

def sealed_codex(p,detail=True):
 ivory,red,gold=p
 b=''
 # A closed volume in oblique view: no open wings or central spear.
 b+=P('M139 128 L185 145 L185 414 L139 394 Z',gold)
 b+=P('M194 144 L368 91 L368 365 L194 420 Z M226 324 L226 234 C226 208 255 181 280 164 C305 165 335 181 335 205 L335 292 L280 349 Z M208 165 L354 121 L354 353 L208 400 Z M218 174 L218 386 L344 346 L344 135 Z',red)
 b+=P('M139 117 L313 62 L368 81 L188 135 Z',ivory)
 b+=P('M199 431 L373 376 L373 389 L199 444 L139 419 L139 407 L188 427 Z',ivory)
 # The gate is cut from the cover; its thin architecture belongs to the cover.
 b+=L('M213 169 L350 127 L350 350 L213 393 Z',2.6,gold)
 b+=L('M239 309 L239 236 C239 214 260 193 280 179 C300 181 321 194 321 214 L321 281',2.7,gold)
 b+=P('M270 220 L291 214 L291 295 L280 317 L270 302 Z M279 238 L279 276 L283 274 L283 237 Z',ivory)
 b+=P('M139 188 L184 205 L184 223 L139 206 Z M139 328 L184 345 L184 363 L139 346 Z',ivory)
 # A long asymmetric bookmark and a circular seal identify the object as a codex.
 b+=P('M306 391 L329 384 L329 466 L317 452 L306 472 Z',red)
 if detail:
  b+=L('M113 166 L113 385 L128 398',1.5,gold,.8)
  b+=L('M382 99 L387 109 L387 362 L381 375',1.5,gold,.8)
  b+=P('M168 153 L172 155 L172 395 L168 393 Z',red)
  b+=diamond(281,118,10,gold)
  b+=diamond(281,367,9,gold)
  b+=P('M213 169 L232 163 L213 190 Z M350 127 L350 148 L330 133 Z M213 393 L213 373 L233 387 Z M350 350 L331 356 L350 329 Z',ivory)
  b+=L('M149 96 L291 51 L321 53',1.4,gold)
  b+=P('M104 404 C97 432 115 447 140 446 C122 441 116 433 119 424 C126 415 137 421 133 430 C147 421 134 406 121 409 C115 410 110 414 106 420 Z',gold)
  b+=P('M345 404 C368 414 391 402 397 384 C401 408 381 427 356 422 Z',gold)
 return b

def steel_nib(p,detail=True):
 silver,cyan,blue=p
 b=''
 # The dominant object is a fountain-pen nib, inside interrupted calibration rings.
 for r,a,z,w,col in [(181,-155,-53,4,silver),(181,-23,78,4,cyan),(181,112,203,4,silver),(197,-145,-57,1.2,blue),(197,16,68,1.2,blue),(162,129,194,1.5,cyan)]:
  if detail or w>=4:b+=L(arc(256,253,r,a,z),w,col)
 b+=P('M212 110 L300 110 L341 202 L256 427 L171 202 Z M256 186 A17 17 0 1 1 256 220 A17 17 0 1 1 256 186 Z M252 223 L260 223 L260 355 L256 389 L252 355 Z',silver)
 b+=P('M212 110 L231 110 L194 201 L239 342 L256 427 L171 202 Z',cyan)
 b+=P('M287 110 L300 110 L341 202 L274 381 L295 293 L320 201 Z',blue)
 b+=P('M223 69 L289 69 L300 96 L212 96 Z',silver)
 if detail:
  b+=L('M228 136 L208 199 L235 281 M284 136 L304 199 L277 281',2.3,blue)
  b+=L('M243 123 L256 138 L269 123',2,cyan)
  b+=L('M54 302 C27 327 57 359 122 352 C254 338 417 230 463 143 C482 107 460 98 419 104',2,cyan)
  for a in [-139,-127,-115,-103,-91,-79,25,37,49,61,133,145,157,169,181,193]:
   t=math.radians(a);r1=184;r2=192 if a%2 else 199
   b+=L(f'M{256+math.cos(t)*r1:.2f} {253+math.sin(t)*r1:.2f} L{256+math.cos(t)*r2:.2f} {253+math.sin(t)*r2:.2f}',2,silver)
  b+=P('M397 89 L427 63 L411 101 Z M84 367 L62 393 L93 380 Z',cyan)
  b+=L('M212 452 H247 L256 463 L266 452 H301',2.5,silver)
  b+=R(239,480,10,4,cyan)+R(256,480,18,4,cyan)
 return b

def floating_pages(p,detail=True):
 ivory,violet,rose=p
 b=''
 for r,a,z,w in [(178,-151,-28,2),(178,12,132,2),(196,-111,-28,1),(196,43,108,1)]:
  if detail or r==178:b+=L(arc(256,253,r,a,z),w,violet)
 if detail:
  b+=f'<ellipse cx="256" cy="253" rx="221" ry="99" transform="rotate(-29 256 253)" fill="none" stroke="{rose}" stroke-width="2.3"/>'
  b+=f'<ellipse cx="256" cy="253" rx="138" ry="178" transform="rotate(29 256 253)" fill="none" stroke="{violet}" stroke-width="1"/>'
 # A substantial open book floats with separated leaves above it.
 left='M115 208 C164 190 204 199 244 226 L244 321 C204 295 163 287 115 303 Z'
 if detail:left+=' M140 231 C172 225 199 231 222 244 L222 252 C196 240 171 235 140 240 Z M140 257 C172 251 199 257 222 270 L222 278 C196 266 171 261 140 266 Z'
 b+=P(left,ivory)
 b+=G(P(left,ivory),512,0,1).replace('scale(1)','scale(-1,1)',1)
 b+=P('M128 317 C170 306 207 318 244 341 L244 355 C206 333 170 322 128 333 Z',violet)
 b+=P('M268 341 C305 318 342 306 384 317 L384 333 C342 322 306 333 268 355 Z',violet)
 b+=P('M180 158 L244 177 L244 198 L180 179 Z M268 177 L332 158 L332 179 L268 198 Z',rose)
 b+=P('M219 117 L252 126 L252 146 L219 137 Z M260 126 L293 117 L293 137 L260 146 Z',violet)
 b+=P('M251 229 L261 229 L261 359 L256 383 L251 359 Z',rose)
 b+=P('M131 101 C70 180 68 300 134 373 C185 429 275 445 349 399 C291 460 198 461 133 414 C35 344 37 191 131 101 Z',violet)
 if detail:
  for x,y,s in [(397,92,19),(100,176,12),(414,365,13)]:
   b+=P(f'M{x} {y-s} Q{x+2} {y-2} {x+s*.6} {y} Q{x+2} {y+2} {x} {y+s} Q{x-2} {y+2} {x-s*.6} {y} Q{x-2} {y-2} {x} {y-s} Z',ivory)
  b+=diamond(256,40,10,rose)+diamond(256,476,9,ivory)
  b+=L('M178 411 C198 424 225 430 248 418',1.7,ivory)
 return b

def ember_quill(p,detail=True):
 ivory,ember,crimson=p
 # A single large diagonal plume, drawn as a continuous serrated silhouette.
 vane='M129 335 C145 246 200 155 294 95 C337 68 375 50 417 27 C406 78 393 115 365 148 L394 132 C375 176 348 201 313 223 L338 211 C316 253 283 276 247 291 L264 287 C223 318 184 332 149 343 Z'
 if detail:
  vane+=' M173 286 C224 240 281 202 338 151 C287 213 231 263 173 295 Z M204 221 C242 187 288 156 330 124 C287 169 246 202 204 230 Z M251 163 C281 138 319 114 354 92 C322 124 290 148 251 172 Z'
 b=P(vane,ember)
 b+=P('M129 335 C145 247 197 157 288 99 C259 143 228 196 204 246 C183 288 170 316 149 343 Z',crimson)
 # A fine light shaft separates the red inner vane and gold outer vane.
 b+=P('M63 454 C143 348 244 232 380 79 C283 230 185 354 79 462 Z M111 407 L123 398 L301 191 L283 209 Z',ivory)
 b+=P('M63 454 L79 462 L54 486 Z',ember)
 # One sweeping ink stroke replaces a circular or symmetrical frame.
 b+=P('M96 359 C56 389 70 427 111 435 C154 444 180 415 209 406 C248 392 282 406 289 431 C296 456 270 472 251 459 C240 451 245 437 256 438 C246 452 268 458 273 443 C282 418 249 406 223 418 C192 432 158 467 112 455 C53 443 35 392 96 359 Z',crimson)
 if detail:
  b+=L('M168 361 C213 330 265 311 310 300',1.6,ember)
  b+=P('M359 176 L399 154 L380 183 Z M312 248 L345 232 L328 255 Z',ivory)
  b+=diamond(113,313,11,ember)+diamond(403,204,7,crimson)
  b+=L('M292 359 C313 365 334 360 345 350',1.7,ember)
 return b

def crystal_tree(p,detail=True):
 ice,blue,lilac=p
 b=''
 # A tall, asymmetrical faceted crown, with suspended angular roots.
 if detail:
  b+=L('M256 26 L413 183 L354 371 L256 487 L98 329 L102 182 Z',1.3,blue)
  b+=L('M256 44 L390 182 L336 361 L256 463',1,ice,.6)
 # Branches have hard orthogonal joints, unlike the organic world-tree.
 b+=P('M243 307 L243 224 L196 187 L168 132 L183 121 L209 175 L256 207 L298 157 L342 144 L350 159 L313 171 L270 229 L270 307 Z',ice)
 b+=P('M243 255 L195 252 L143 211 L152 196 L201 233 L243 235 Z M270 270 L306 229 L349 214 L360 226 L316 244 L270 295 Z',blue)
 # Separate crystal leaves make a stepped triangular canopy.
 crystals=[(169,97,56,18,-24),(203,134,49,17,23),(246,86,74,21,6),(294,116,65,18,37),(346,103,72,21,47),(380,167,58,19,64),(134,183,62,20,-43),(192,211,43,15,-29),(319,199,50,17,37)]
 for i,(x,y,h,w,a) in enumerate(crystals):
  if not detail and i in [1,7,8]:continue
  pts=f'M0 {-h/2} L{w} 0 L0 {h/2} L{-w} 0 Z M0 {-h*.32} L{-w*.42} 0 L0 {h*.22} Z'
  b+=G(P(pts,blue if i%3==0 else ice if i%3==1 else lilac),x,y,1,a)
 b+=P('M242 319 L229 353 L203 373 L195 417 L218 391 L246 374 L250 431 L256 464 L263 414 L268 373 L291 399 L318 419 L302 383 L281 354 L270 319 Z',ice)
 b+=P('M228 352 L185 366 L153 400 L189 381 L215 381 L238 365 Z M284 354 L323 351 L363 322 L341 355 L309 372 Z',lilac)
 b+=P('M225 297 L287 297 L294 309 L281 322 L233 322 L218 309 Z',blue)
 if detail:
  b+=L('M179 408 L256 477 L333 385',2,blue)
  b+=diamond(103,290,9,ice)+diamond(413,217,8,lilac)
  b+=P('M284 34 L304 55 L293 69 L279 53 Z',lilac)
  b+=L('M132 132 L109 155 L109 184 M386 261 L376 292 L361 306',1.5,ice)
 return b

STYLES=[
 dict(id='01-world-tree',name='万象根庭',en='THE WORLDROOT',element='树',form='舒展树冠 / 有机曲线',colors=['#D9BB79','#70D4A7','#F3EBD5'],fn=world_tree,font='song'),
 dict(id='02-sealed-codex',name='缄页禁典',en='THE SEALED CODEX',element='书',form='斜立古籍 / 封印门洞',colors=['#F4E9D5','#BB3556','#D8B67C'],fn=sealed_codex,font='song'),
 dict(id='03-steel-nib',name='零界书令',en='THE NULL QUILL',element='笔',form='垂直笔尖 / 断环校准',colors=['#E2ECF3','#59DFEA','#6485F2'],fn=steel_nib,font='sans'),
 dict(id='04-floating-pages',name='悬页星仪',en='THE PAGE OBSERVATORY',element='书',form='悬浮书页 / 环形仪轨',colors=['#EEEAFB','#A48AF2','#EBA5C8'],fn=floating_pages,font='song'),
 dict(id='05-ember-quill',name='赤翎裁序',en='THE EMBER SCRIPT',element='笔',form='斜向羽笔 / 流动墨迹',colors=['#FFF0D8','#F4B75A','#D64F65'],fn=ember_quill,font='song'),
 dict(id='06-crystal-tree',name='悬根之树',en='THE CRYSTAL ARBOR',element='树',form='晶体树冠 / 几何悬根',colors=['#D6E3FF','#657FE1','#A997F2'],fn=crystal_tree,font='sans'),
]
assets=[]
for s in STYLES:
 d=ROOT/s['id'];d.mkdir(exist_ok=True)
 col=s['fn'](s['colors']);white=s['fn']([WHITE]*3);black=s['fn'](['#11151C']*3);small=s['fn'](s['colors'],False)
 def lockup(sym,color):return G(sym,20,10,.54)+text('小说工坊',350,147,63,color,s['font'],4)+text('FICTION',354,193,18,color,'roman',7)
 variants={
  'emblem-color.svg':SVG(col,title=s['name']+' · 彩色徽记'),
  'emblem-white.svg':SVG(white,title=s['name']+' · 单白徽记'),
  'emblem-black.svg':SVG(black,title=s['name']+' · 单黑徽记'),
  'emblem-simple.svg':SVG(small,title=s['name']+' · 简化徽记'),
  'logo.svg':SVG(lockup(col,WHITE),1000,300,s['name']+' · 小说工坊组合'),
  'logo-on-light.svg':SVG(lockup(black,'#11151C'),1000,300,s['name']+' · 浅底组合'),
  'app-icon.svg':SVG(R(0,0,1024,1024,BG)+G(col,82,82,1.68),1024,1024,s['name']+' · 应用图标'),
  'app-icon-rounded.svg':SVG(R(0,0,1024,1024,BG,224)+G(col,82,82,1.68),1024,1024,s['name']+' · 圆角图标'),
  'app-icon-small.svg':SVG(R(0,0,1024,1024,BG)+G(small,82,82,1.68),1024,1024,s['name']+' · 简化图标'),
  'app-icon-mono.svg':SVG(R(0,0,1024,1024,BG)+G(white,82,82,1.68),1024,1024,s['name']+' · 单色图标'),
 }
 for name,content in variants.items():
  f=d/name;f.write_text(content,encoding='utf8');assets.append(str(f.relative_to(ROOT)))

def board(mono=False):
 b=R(0,0,2400,1940,BG)
 b+=text('FICTION',74,94,46,WHITE,'roman',8)
 b+=text('小说工坊 / 六种势力徽记',77,139,20,'#A7ADB9','ui',1)
 b+=text('TREE / BOOK / PEN',1860,94,18,'#A7ADB9','latin',2)
 b+=text('MONOCHROME STUDIES' if mono else 'COLOR STUDIES  /  SERIES 05',1860,133,11,'#A7ADB9','latin',1)
 b+=R(74,180,2252,1,'#27303C')
 for i,s in enumerate(STYLES):
  x=74+(i%3)*776;y=211+(i//3)*814
  q=text(f'0{i+1} / '+s['element'],0,34,15,WHITE if mono else s['colors'][1],'ui',1)
  q+=text(s['form'],100,34,13,'#929CA9','ui')
  q+=G(s['fn']([WHITE]*3 if mono else s['colors']),72,47,1.12)
  q+=text(s['name'],359,667,34,WHITE,s['font'],3,True)
  q+=text(s['en'],359,700,10,'#9CA4B2','latin',2,True)
  if not mono:
   for j,c in enumerate(s['colors']):q+=R(271+j*62,733,48,7,c)
  q+=R(85,781,548,1,'#27303C')
  b+=G(q,x,y)
 b+=R(74,1872,2252,1,'#27303C')
 b+=text('小说工坊',76,1914,23,WHITE,'song',2)
 b+=text('SIX ORIGINAL FACTION CRESTS / EDITABLE SVG',1730,1910,11,'#929CA9','latin',1)
 return SVG(b,2400,1940,'小说工坊 · 六版'+('单色' if mono else '彩色')+'势力徽记')
(ROOT/'six-faction-crests-color.svg').write_text(board(),encoding='utf8')
(ROOT/'six-faction-crests-mono.svg').write_text(board(True),encoding='utf8')
manifest={'styles':[{k:v for k,v in s.items() if k!='fn'} for s in STYLES],'assets':assets,'method':'Original SVG paths; outlined lettering; flat color; no embedded rasters.'}
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
(ROOT/'设计说明.md').write_text('''# 小说工坊 · 六种势力徽记 V5

本轮重新设计相似的前两版，并将方案拓展为六种。以树、书、笔各两个方向分配主体，每个方案保持一种明确的主要意象。名称仅用于区分设计方向，正式品牌仍为「小说工坊」。

| 方案 | 核心元素 | 轮廓与构图 | 配色 |
| --- | --- | --- | --- |
| 万象根庭 | 树 | 宽树冠、自然分叉、盘绕树根 | 古金、翡翠绿、骨白 |
| 缄页禁典 | 书 | 斜立封印古籍、门洞、垂落书签 | 绛红、象牙白、黄铜 |
| 零界书令 | 笔 | 钢笔笔尖、断环、校准刻度 | 银白、冰青、电蓝 |
| 悬页星仪 | 书 | 悬浮翻页、新月、倾斜星轨 | 月白、紫罗兰、淡玫瑰 |
| 赤翎裁序 | 笔 | 单支斜向羽笔、长弧墨迹 | 赤金、胭脂红、纸白 |
| 悬根之树 | 树 | 硬折晶体树冠、下垂悬根、菱形框架 | 冰白、靛蓝、丁香紫 |

每套提供彩色、单白、单黑与简化徽记，中文组合 Logo、满版与圆角应用图标及简化图标。所有 SVG 为真实可编辑路径，文字均已转曲；未使用位图嵌入或自动描摹。配色使用纯色填充。完整徽记用于较大尺寸的品牌展示，极小尺寸图标可在选定方向后继续提炼。

将 SVG 拖入 Figma 即可编辑。PNG 为透明徽记或应用预览；ICO 内含多档尺寸。源脚本位于 work/，字体不随压缩包分发。彩色与单色总览用于检查轮廓差异，单色版保留相同构图。
''',encoding='utf8')
print(json.dumps({'root':str(ROOT),'svg_assets':len(assets),'styles':len(STYLES)},ensure_ascii=False))
