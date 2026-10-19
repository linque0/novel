"""Build three independent, static 1440 × 900 direction studies from shared content."""
from pathlib import Path
import json
import re
from html import escape
from fontTools import subset

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
DATA = json.loads((ROOT / 'data.json').read_text(encoding='utf-8'))
BOOKS = DATA['books']

def svg(body, cls='', view='0 0 24 24'):
    return f'<svg class="{cls}" viewBox="{view}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{body}</svg>'

SUN = svg('<circle cx="20" cy="20" r="10"/><circle cx="20" cy="20" r="16" opacity=".4"/><circle cx="3" cy="20" r="2.5"/><circle cx="37" cy="20" r="2.5"/><path d="M20 0v4m0 32v4"/>', 'sunmark', '0 0 40 40')
SEARCH = svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>')
ARROW = svg('<path d="M4 12h15m-6-6 6 6-6 6"/>')
BOOKICON = svg('<path d="M4 4h5v16H4zm9 0h4l3 15-4 1z"/>')
NAV = ['书架', '正文', '大纲', '设定', '人物', '灵感', '设置']

def nav():
    return ''.join(f'<button class="navitem {"active" if i == 0 else ""}" {"aria-current=page" if i == 0 else ""}>{n}</button>' for i, n in enumerate(NAV))

def search():
    return f'<label class="search">{SEARCH}<input type="search" aria-label="搜索作品" placeholder="搜索作品"></label>'

def cover(b, i):
    shapes = [
        '<ellipse cx="40" cy="49" rx="26" ry="12" transform="rotate(-35 40 49)"/><circle cx="40" cy="49" r="18"/><circle cx="40" cy="49" r="3"/>',
        '<circle cx="40" cy="47" r="22"/><path d="M45 25a24 24 0 0 0 0 44M16 82h48"/>',
        '<path d="m8 76 24-42 10 20 10-13 19 35M20 58l12-24 11 22"/>',
        '<path d="M6 55q17-24 34 0t34 0M6 68q17-24 34 0t34 0M6 81q17-24 34 0t34 0"/><circle cx="40" cy="31" r="12"/>',
        '<path d="M20 84V30q20-20 40 0v54M28 84V33q12-13 24 0v51M18 84h44"/><circle cx="44" cy="59" r="1.5"/>',
        '<path d="M19 82 59 23Q70 62 19 82ZM19 82l39-52M29 65l23 1M37 53l21 0"/>'
    ]
    return f'<span class="cover c{i}" style="--cover:{b["color"]}" aria-hidden="true">{svg(shapes[i], "covermotif", "0 0 80 108")}<span>{escape(b["title"])}</span><small>林间</small></span>'

def action(cls='primary'):
    return f'<button class="{cls}">继续写作 {ARROW}</button>'

RESET = '''
@font-face{font-family:OldSong;src:url(assets/oldsong.woff2) format('woff2');font-display:swap}
@font-face{font-family:Zhaohua;src:url(assets/zhaohua.woff2) format('woff2');font-display:swap}
*{box-sizing:border-box}html,body{margin:0;width:1440px;height:900px;overflow:hidden}body{font-family:'Microsoft YaHei','PingFang SC',sans-serif;font-size:14px;line-height:1.65}button,input{font:inherit}button{cursor:default;color:inherit;background:none;border:0;padding:0}input{color:inherit;outline:none;border:0;background:none;min-width:0;width:100%}h1,h2,h3,p{margin:0}h1,h2,h3{font-weight:400}svg{display:inline-block;width:22px;height:22px;vertical-align:middle;flex-shrink:0}button svg{width:20px;height:20px}.sunmark{width:40px;height:40px}.brand{display:flex;align-items:center;gap:13px;white-space:nowrap}.brand strong{font-family:OldSong,serif;font-size:25px;font-weight:400;letter-spacing:3px}.brand small{display:block;font-size:13px;letter-spacing:2px}.search{display:flex;align-items:center;gap:10px;width:180px;height:38px}.search svg{width:18px}.navitem{height:100%;white-space:nowrap;position:relative}.navitem.active:after{content:'';height:2px;background:currentColor;position:absolute;bottom:0;left:0;right:0}.tools{display:flex;align-items:center;gap:25px}.plus{font-size:21px;line-height:1}.avatar{width:33px;height:33px;border:1px solid currentColor;border-radius:50%;display:grid;place-items:center}.primary{display:flex;align-items:center;justify-content:space-between;gap:30px;height:49px;width:184px;padding:0 20px;font-size:15px}.quiet{font-size:14px}.status{display:flex;align-items:center;gap:8px;font-size:13px}.dot{width:5px;height:5px;border-radius:50%;display:inline-block;background:currentColor}.stats{display:flex;align-items:center;gap:21px;font-size:13px;font-variant-numeric:tabular-nums}.stats b{font-weight:400;font-size:18px;margin-right:4px}.cover{position:relative;display:block;flex-shrink:0;width:64px;height:90px;background:var(--cover);color:#f4e4bd;border-left:4px solid #ffffff18;box-shadow:3px 3px 0 #ded6c8,5px 4px 8px #0002;overflow:hidden}.cover:after{content:'';position:absolute;inset:5px;border:1px solid #dbc69e55;pointer-events:none}.covermotif{position:absolute;inset:12px 0 auto;width:100%;height:60px;opacity:.65}.cover>span{position:absolute;left:8px;right:5px;top:8px;font-family:OldSong,serif;font-size:14px;line-height:1.5;letter-spacing:1px}.cover>small{position:absolute;bottom:5px;right:8px;font-size:9px}.footerline{display:flex;align-items:center;justify-content:space-between;font-size:13px}.muted{color:var(--muted)}
'''

def document(title, css, body):
    return f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=1440"><title>{title} · 幻日剧场</title><style>{RESET}\n{css}</style></head><body>{body}</body></html>'

# A: classical proscenium, paper programme beside a real world, horizontal book shelf.
a_css = '''
:root{--paper:#f0ece3;--ink:#26303c;--muted:#657078;--gold:#927247}body{background:var(--paper);color:var(--ink)}.a-header{height:78px;margin:0 48px;border-bottom:1px solid #bfb7a655;display:flex;align-items:center;justify-content:space-between}.brand .sunmark{color:var(--gold)}.a-header .brand small{margin-left:23px;padding-left:23px;border-left:1px solid #bfb7a6;color:var(--muted);letter-spacing:1px}.a-header .tools{color:#62686b}.a-nav{display:flex;justify-content:center;gap:59px;height:52px;border-bottom:1px solid #c8c0b444}.a-nav .navitem{padding:0 8px;color:#686c70}.a-nav .navitem.active{color:#343d47}.a-toolbar{height:73px;padding:0 48px;display:flex;align-items:center;justify-content:space-between}.a-toolbar h2{font-family:OldSong,serif;font-size:27px;letter-spacing:2px}.a-toolbar h2 span{font-family:'Microsoft YaHei',sans-serif;font-size:13px;color:var(--muted);letter-spacing:0;margin-left:19px}.a-toolbar .new{display:flex;gap:9px;align-items:center;color:#374654}.a-hero{height:458px;margin:0 48px;display:grid;grid-template-columns:369px 1fr;position:relative;background:#e8e1d3;box-shadow:0 12px 25px #2b261313}.a-programme{padding:33px 30px 25px;position:relative;z-index:1;background:#ede7da}.a-programme:after{content:'';position:absolute;right:10px;top:16px;bottom:16px;border-right:1px solid #b09c7a44}.a-programme .status{color:#6d614e}.a-programme h1{font-family:OldSong,serif;font-size:65px;line-height:1.25;letter-spacing:1px;margin:18px 0 14px;white-space:nowrap}.a-synopsis{font-family:OldSong,serif;font-size:20px;line-height:1.7;color:#4b5358}.a-programme .stats{margin-top:19px;gap:20px;color:#5f6263}.a-programme .primary{background:#27394a;color:#fbf1de;margin-top:21px;width:100%;height:48px}.a-programme .chapter{border-top:1px solid #b5a98f77;padding-top:15px;margin-top:21px;font-size:15px;display:flex;align-items:center;justify-content:space-between}.a-programme .chapter small{display:block;color:#736c60;font-size:13px;margin-bottom:2px}.a-scene{position:relative;min-width:0;overflow:hidden;background:#111927}.a-scene img{width:100%;height:100%;object-fit:cover;object-position:center}.a-scene .scene-caption{position:absolute;bottom:17px;left:33px;right:33px;display:flex;justify-content:space-between;color:#f9e8c5;font-family:OldSong,serif;font-size:16px;text-shadow:0 2px 6px #000}.a-scene .scene-caption span:last-child{font-family:'Microsoft YaHei',sans-serif;font-size:13px}.a-collection{margin:30px 48px 0}.a-collection-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px}.a-collection h2{font-family:OldSong,serif;font-size:23px;letter-spacing:2px}.a-collection-head span{font-size:13px;color:var(--muted)}.a-books{display:grid;grid-template-columns:repeat(6,1fr);gap:22px}.a-book{display:flex;align-items:center;gap:14px;text-align:left;min-width:0}.a-book .cover{width:59px;height:83px}.a-book h3{font-family:OldSong,serif;font-size:20px;line-height:1.5;margin-bottom:8px;white-space:nowrap}.a-book p{font-size:13px;color:#676e70;white-space:nowrap}.a-book.selected h3{color:#7c5834}.a-book.selected .cover{outline:1px solid #9d8058;outline-offset:4px}.a-bottom{margin:30px 48px 0;border-top:1px solid #c9c0b355;padding-top:14px;color:#6c716f}.a-bottom .motto{font-family:OldSong,serif;font-size:16px;letter-spacing:1px}.a-book .c2>span{font-size:12px}
'''
a_books=''.join(f'<button class="a-book {"selected" if i==0 else ""}">{cover(b,i)}<span><h3>{b["title"]}</h3><p>{b["words"]} 字</p><p>{b["chapters"]} 章 · {"正在续写" if i==0 else b["genre"].split(" · ")[0]}</p></span></button>' for i,b in enumerate(BOOKS))
a_body=f'''
<header class="a-header"><div class="brand">{SUN}<strong>幻日剧场</strong><small>小说工坊</small></div><div class="tools"><span>林间的创作空间</span><span class="avatar">林</span></div></header>
<nav class="a-nav" aria-label="功能模块">{nav()}</nav>
<div class="a-toolbar"><h2>我的作品<span>六部故事，各有天地</span></h2><div class="tools">{search()}<button class="new"><span class="plus">＋</span>新建作品</button></div></div>
<main><section class="a-hero" aria-label="当前作品"><div class="a-programme"><p class="status"><span class="dot"></span>正在续写 · 今天 14:32</p><h1>星尘旅人</h1><p class="a-synopsis">一枚铜星的熄灭，<br>唤醒了一张被遗忘的星图。</p><div class="stats"><span><b>156,824</b> 字</span><span><b>42</b> 章</span><span>科幻 · 冒险</span></div>{action()}<div class="chapter"><span><small>接续上次的故事</small>{DATA['chapter']}</span>{ARROW}</div></div><div class="a-scene"><img src="assets/curtain.webp" alt="深蓝侧幕打开，幕内的天文港城与海湾延伸至幻日下的远方"><div class="scene-caption"><span>幕启之处，世界正在发生。</span><span>01 / 06</span></div></div></section>
<section class="a-collection" aria-label="全部作品"><div class="a-collection-head"><h2>剧目册</h2><span>按最近编辑排序 ↓</span></div><div class="a-books">{a_books}</div></section></main>
<footer class="a-bottom footerline"><span class="motto">一座剧场，万千真实世界。</span><span>所有故事，始于落笔。</span></footer>
'''

# B: modern black-box theatre, vertical repertoire and a panoramic stage above a bold title band.
b_css = '''
:root{--ink:#efeee8;--muted:#b2b8b6;--accent:#a6d7d0}body{background:#161918;color:var(--ink)}.b-header{height:84px;margin:0 38px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ffffff20}.b-header .brand .sunmark{color:#add5ce}.b-header .brand strong{font-family:'Microsoft YaHei',sans-serif;font-size:24px;font-weight:600;letter-spacing:4px}.b-nav{display:flex;align-items:center;gap:40px;height:84px;margin-right:40px;color:#b7beb9}.b-nav .navitem{padding:0 3px}.b-nav .active{color:#d9ede5}.b-header .avatar{color:#c3c9c1}.b-topbar{height:101px;padding:0 38px;display:flex;justify-content:space-between;align-items:center}.b-topbar h2{font-size:36px;font-weight:600;letter-spacing:-1px}.b-topbar h2 span{font-size:14px;color:#acb5b0;font-weight:400;margin-left:17px;letter-spacing:0}.b-topbar .tools{gap:25px}.b-topbar .search{width:190px;color:#c0c5be;border-bottom:1px solid #6c766c}.b-new{display:flex;align-items:center;gap:11px;color:#d1e7db}.b-main{display:grid;grid-template-columns:278px 1fr;gap:28px;margin:0 38px}.b-repertoire{padding-top:0}.b-list-head{height:37px;display:flex;justify-content:space-between;font-size:13px;color:#bac2bc}.b-list{border-top:1px solid #ffffff24}.b-book{height:91px;border-bottom:1px solid #ffffff24;width:100%;display:flex;align-items:center;gap:15px;padding:0 10px;text-align:left;position:relative}.b-book .no{font-family:Georgia,serif;font-size:17px;color:#9faea6;width:23px}.b-book .booktext{flex:1}.b-book h3{font-size:19px;font-weight:400;line-height:1.5}.b-book p{font-size:13px;color:#b1b9b2;margin-top:5px;white-space:nowrap}.b-book svg{width:18px;height:18px;color:#afbab1}.b-book.selected{background:#a9d8d0;color:#152b28;padding-left:13px}.b-book.selected .no,.b-book.selected p,.b-book.selected svg{color:#334f47}.b-sidefoot{margin-top:28px;color:#a5b1a9;font-size:13px;line-height:1.8}.b-stage{position:relative;height:442px;background:#1b2525;overflow:hidden}.b-stage img{width:100%;height:100%;object-fit:cover;object-position:center 57%}.b-stage:after{content:'';position:absolute;inset:0;background:linear-gradient(0deg,#10171588,transparent 30%);pointer-events:none}.b-stage-label{position:absolute;left:25px;bottom:20px;right:25px;display:flex;align-items:center;justify-content:space-between;z-index:1;color:#ecf4e7;font-size:13px}.b-stage-label .indicator{display:flex;gap:5px}.b-stage-label i{display:block;background:#ffffff55;height:3px;width:25px}.b-stage-label i:first-child{background:#cdebe1;width:42px}.b-titleband{display:grid;grid-template-columns:1fr 248px;gap:20px;padding-top:24px}.b-titleband .status{color:#b6d4c8;font-size:13px}.b-titleband h1{font-family:'Microsoft YaHei',sans-serif;font-size:70px;font-weight:650;letter-spacing:-4px;line-height:1.3;margin:4px 0 6px}.b-titleband .synopsis{color:#bac4bc;font-family:OldSong,serif;font-size:20px}.b-titleband .stats{color:#c5cdc5;font-size:13px;margin-top:14px;gap:25px}.b-titleband .stats b{font-size:18px;color:#e4e7dc}.b-action{padding-top:7px}.b-action .primary{width:100%;background:#acd9cf;color:#172d28;height:52px;font-weight:600}.b-action .chapter{margin-top:22px;border-top:1px solid #ffffff30;padding-top:13px;font-size:15px}.b-action .chapter small{display:block;color:#aab7ae;font-size:13px;margin-bottom:4px}.b-action .chapter span{display:flex;align-items:center;justify-content:space-between}.b-footer{margin:28px 38px 0;padding-top:15px;border-top:1px solid #ffffff1f;color:#aab8af}.b-footer .theme{letter-spacing:1px}
'''
b_books=''.join(f'<button class="b-book {"selected" if i==0 else ""}"><span class="no">0{i+1}</span><span class="booktext"><h3>{b["title"]}</h3><p>{b["words"]} 字 · {b["chapters"]} 章</p></span>{ARROW}</button>' for i,b in enumerate(BOOKS))
b_body=f'''
<header class="b-header"><div class="brand">{SUN}<strong>幻日剧场</strong></div><nav class="b-nav" aria-label="功能模块">{nav()}</nav><span class="avatar">林</span></header>
<div class="b-topbar"><h2>我的剧目<span>共六部作品</span></h2><div class="tools">{search()}<button class="b-new"><span class="plus">＋</span>新建作品</button></div></div>
<main class="b-main"><aside class="b-repertoire" aria-label="全部作品"><div class="b-list-head"><span>剧目目录</span><span>最近编辑 ↓</span></div><div class="b-list">{b_books}</div><p class="b-sidefoot">一幕开启，另一种现实。<br>每个世界，都在等待你的下一笔。</p></aside><section class="b-feature" aria-label="当前作品"><div class="b-stage"><img src="assets/revolve.webp" alt="错位转台与活动景墙接通辽阔的天文港城，侧边露出独立的沙漠世界"><div class="b-stage-label"><span>星尘旅人 · 天文港城</span><span class="indicator"><i></i><i></i><i></i><i></i><i></i><i></i></span></div></div><div class="b-titleband"><div><p class="status"><span class="dot"></span>正在续写 · 今天 14:32</p><h1>星尘旅人</h1><p class="synopsis">{DATA['synopsis']}</p><div class="stats"><span><b>156,824</b> 字</span><span><b>42</b> 章</span><span>科幻 · 冒险</span></div></div><div class="b-action">{action()}<div class="chapter"><small>接续上次的故事</small><span>{DATA['chapter']}{ARROW}</span></div></div></div></section></main>
<footer class="b-footer footerline"><span class="theme">剧场中上演的，是一个个真实世界。</span><span>林间的创作空间</span></footer>
'''

# C: an editorial programme atlas, an open spread and six typographic catalogue entries.
c_css = '''
:root{--ink:#293d42;--muted:#626b69;--red:#984b3e;--line:#a2a497}body{background:#eee9dd;color:var(--ink)}.c-header{height:94px;margin:0 50px;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #31464a}.c-header .brand strong{font-family:Zhaohua,serif;font-size:33px;letter-spacing:5px}.c-header .brand .sunmark{color:#9b4b3c;width:42px;height:42px}.c-header .brand small{font-family:OldSong,serif;font-size:17px;letter-spacing:1px;margin-left:24px;border-left:1px solid #b6b2a2;padding-left:23px}.c-header .tools{color:#626d6b}.c-navrow{height:53px;margin:0 50px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #aeb0a5}.c-nav{display:flex;gap:43px;align-items:center;height:53px}.c-nav .active{color:#9a493c}.c-navrow .search{height:35px;width:165px}.c-pagehead{height:69px;margin:0 50px;display:flex;justify-content:space-between;align-items:center}.c-pagehead h2{font-family:Zhaohua,serif;font-size:26px;letter-spacing:3px}.c-pagehead h2 span{font-family:'Microsoft YaHei',sans-serif;font-size:13px;color:#626b69;letter-spacing:0;margin-left:16px}.c-new{display:flex;gap:9px;align-items:center;color:#7b4639}.c-spread{margin:0 50px;height:435px;display:grid;grid-template-columns:385px 1fr;gap:37px}.c-text{padding:7px 0 0;position:relative}.c-text .status{color:#856246}.c-text h1{font-family:Zhaohua,serif;font-size:82px;line-height:1.15;letter-spacing:4px;margin-top:18px;width:300px}.c-text .synopsis{font-family:OldSong,serif;font-size:21px;line-height:1.65;margin-top:20px;color:#40565b}.c-text .stats{margin-top:19px;gap:19px;font-size:13px;color:#606b67}.c-text .stats b{font-size:18px;color:#334c4f}.c-text .primary{background:#944b3d;color:#fff4e4;width:183px;height:47px;margin-top:20px}.c-text .chapter{margin-top:18px;font-size:14px;display:flex;gap:16px;align-items:center;color:#4f6565}.c-art{position:relative;overflow:hidden;border-bottom:1px solid #a8a89b}.c-art img{display:block;width:100%;height:405px;object-fit:cover;object-position:center;mix-blend-mode:multiply}.c-art figcaption{display:flex;justify-content:space-between;font-family:OldSong,serif;font-size:15px;line-height:29px;color:#54605e}.c-art .plate-no{font-family:Georgia,serif;font-size:14px;color:#6b6a5c}.c-catalogue{margin:27px 50px 0;border-top:2px solid #3d5153}.c-cathead{display:flex;align-items:center;justify-content:space-between;height:43px}.c-cathead h2{font-family:Zhaohua,serif;font-size:23px;letter-spacing:2px}.c-cathead span{font-size:13px;color:#616d68}.c-books{display:grid;grid-template-columns:repeat(3,1fr);column-gap:35px}.c-book{display:flex;align-items:center;width:100%;gap:14px;height:60px;border-top:1px solid #a5aa9b;text-align:left}.c-book .no{font-family:Georgia,serif;font-size:23px;color:#8f7961;min-width:28px}.c-book h3{font-family:Zhaohua,serif;font-size:22px;flex:1;letter-spacing:1px}.c-book .meta{font-size:13px;line-height:1.7;color:#596864;text-align:right;font-variant-numeric:tabular-nums}.c-book.selected{color:#974c3f}.c-book.selected .no{color:#974c3f}.c-bottom{margin:16px 50px 0;border-top:1px solid #b4b5a7;padding-top:12px;color:#5a6863}.c-bottom .motto{font-family:OldSong,serif;font-size:16px;letter-spacing:2px}
'''
c_css += '''
.c-text h1{font-size:72px;margin-top:14px}.c-text .synopsis{font-size:20px;line-height:1.55;margin-top:14px}.c-text .stats{margin-top:16px}.c-text .primary{margin-top:18px}.c-text .chapter{margin-top:14px}
'''
c_books=''.join(f'<button class="c-book {"selected" if i==0 else ""}"><span class="no">0{i+1}</span><h3>{b["title"]}</h3><span class="meta">{b["words"]} 字<br>{b["chapters"]} 章</span></button>' for i,b in enumerate(BOOKS))
c_body=f'''
<header class="c-header"><div class="brand">{SUN}<strong>幻日剧场</strong><small>万象剧目志</small></div><div class="tools"><span>小说工坊 · 林间</span><span class="avatar">林</span></div></header>
<div class="c-navrow"><nav class="c-nav" aria-label="功能模块">{nav()}</nav>{search()}</div>
<div class="c-pagehead"><h2>我的作品<span>六部故事，各有天地</span></h2><button class="c-new"><span class="plus">＋</span>新建作品</button></div>
<main><section class="c-spread" aria-label="当前作品"><div class="c-text"><p class="status"><span class="dot"></span>正在续写 · 今天 14:32</p><h1>星尘<br>旅人</h1><p class="synopsis">一枚铜星的熄灭，<br>唤醒了一张被遗忘的星图。</p><div class="stats"><span><b>156,824</b> 字</span><span><b>42</b> 章</span><span>科幻 · 冒险</span></div>{action()}<div class="chapter">{DATA['chapter']}{ARROW}</div></div><figure class="c-art" style="margin:0"><img src="assets/atlas.webp" alt="矿物蓝与砖红套色版画，舞台帷幕后是有居民、船舶与街巷的天文港城"><figcaption><span>星图所指，皆是人间。</span><span class="plate-no">01 / 06</span></figcaption></figure></section>
<section class="c-catalogue" aria-label="全部作品"><div class="c-cathead"><h2>诸界目录</h2><span>按最近编辑排序 ↓</span></div><div class="c-books">{c_books}</div></section></main>
<footer class="c-bottom footerline"><span class="motto">每一部剧目，都是一个真实世界。</span><span>故事未完，世界仍在生长。</span></footer>
'''

# Visual corrections after inspecting the first actual 1440 × 900 screenshots.
a_css += '''
:root{--muted:#505c61}.a-nav .navitem{color:#535e65}.a-header .tools{color:#505b5f}.a-programme .status{color:#625644}.a-programme .stats{color:#4b5354}.a-programme .chapter small{color:#5a5448}.a-book p{color:#505b5b}.a-bottom{margin-top:20px;color:#505c56;padding-top:9px}.a-scene img{object-position:center top}.a-scene .scene-caption{bottom:15px}
'''
b_css += '''
.b-stage img{object-position:center 25%}.b-footer{margin-top:17px;padding-top:9px}.b-titleband h1{font-size:66px}
'''
c_css += '''
:root{--muted:#515f59}.c-header .tools,.c-cathead span,.c-pagehead h2 span{color:#505e58}.c-book .no{color:#6d5c47}.c-art img{object-position:center top}.c-art figcaption{color:#46544e}.c-art .plate-no{color:#555648}
'''

pages = [('curtain','幕启诸界',a_css,a_body),('revolve','世界转台',b_css,b_body),('atlas','万象剧目志',c_css,c_body)]
for ident,title,css,body in pages:
    (ROOT / f'{ident}.html').write_text(document(title,css,body),encoding='utf-8')

# Ship only used glyphs, with original licensed fonts kept in the project.
chars = ''.join(re.sub('<[^>]+>', '', b) for _,_,_,b in pages) + ''.join(NAV) + '0123456789→＋↓↗ /,.·'
for src,name in [('kinghwa-oldsong-400.woff2','oldsong'),('zhaohua-title-400.woff2','zhaohua')]:
    options = subset.Options()
    options.flavor = 'woff2'
    font = subset.load_font(str(REPO / 'src/assets/fonts/files' / src), options)
    sub = subset.Subsetter(options=options)
    sub.populate(text=chars)
    sub.subset(font)
    subset.save_font(font,str(ROOT / 'assets' / f'{name}.woff2'),options)

manifest = {
 'schemaVersion':1,'lang':'zh','project':'幻日剧场 · 书架首屏三方向',
 'round':'诸界登台 · 2026-10-19',
 'brief':DATA['theme']+'。相同六部作品、相同主动作，比较古典镜框、现代转台与文学版画三种表达。',
 'nativeViewport':'1440x900',
 'candidates':[
   {'id':'curtain','name':'幕启诸界','concept':'台口有边界，幕内的真实世界没有。','typography':'京华老宋体 65px 作品名，20px 简介；微软雅黑 13–15px 功能字。','palette':['#f0ece3','#26394a','#927247','#24465a'],'traits':['古典镜框与深蓝侧幕，幕内港城延伸至远方','纸本节目笺承载续写与最近章节','下方六本实体书册组成横向书架'],'source':'curtain.html'},
   {'id':'revolve','name':'世界转台','concept':'转动剧场空间，让另一个现实登场。','typography':'微软雅黑 66px 粗体作品名、36px 栏目名；老宋体 20px 简介。','palette':['#161918','#a6d7d0','#efeee8','#5f9ea4'],'traits':['现代黑盒剧场与错位活动景墙','纵向剧目目录，以整行实色标记当前作品','全幅景观在上，大标题与续写信息带在下'],'source':'revolve.html'},
   {'id':'atlas','name':'万象剧目志','concept':'一本展开的剧目志，记录一个个正在发生的世界。','typography':'朝华标题 72px 两行书名、22px 目录；老宋体 20px 简介与15px图注。','palette':['#eee9dd','#293d42','#984b3e','#8f7961'],'traits':['暖白纸面与矿物蓝砖红套色版画','展开的书名与世界长景形成跨页阅读','三列两行剧目目录，以字号与细线组织信息'],'source':'atlas.html'}
 ]}
(ROOT / 'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('Built 3 independent HTML studies, 2 subset fonts and manifest.json')
