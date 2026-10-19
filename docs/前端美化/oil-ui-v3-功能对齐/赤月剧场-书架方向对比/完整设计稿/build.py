"""Build two independently composed, offline design prototypes. Never rewrites approved originals."""
from pathlib import Path
import re, shutil, json
from PIL import Image

ROOT = Path(__file__).resolve().parent
PREV = ROOT.parent
BASE = PREV.parent
(ROOT / 'assets').mkdir(exist_ok=True)
for name in ['opera.webp', 'nouveau.webp', 'cover-a.webp', 'cover-b.webp', 'cover-c.webp', 'cover-d.webp', 'oldsong.woff2', 'wenkai.woff2']:
    shutil.copy2(PREV / 'assets' / name, ROOT / 'assets' / name)
# Use the repository fonts so newly added page titles do not fall back mid-word.
for source, target in [('kinghwa-oldsong-400.woff2', 'oldsong.woff2'), ('lxgw-wenkai-sc-400.woff2', 'wenkai.woff2')]:
    font = ROOT.parents[4] / 'src' / 'assets' / 'fonts' / 'files' / source
    if font.exists():
        shutil.copy2(font, ROOT / 'assets' / target)
for i in range(3):
    im = Image.open(BASE / 'assets' / f'person{i}.png').convert('RGB')
    im.thumbnail((720, 900))
    im.save(ROOT / 'assets' / f'person{i}.webp', quality=90)
shutil.copy2(BASE / 'data.js', ROOT / 'data.js')
for theme, title in [('opera', '赤月歌剧院'), ('nouveau', '赤月戏')]:
    old = (PREV / f'{theme}.html').read_text(encoding='utf-8')
    css = re.search(r'<style>(.*?)</style>', old, re.S).group(1)
    # Press feedback uses the independent translate property in studio.css.
    # Replacing transform here would move centred graph nodes away from the pointer.
    css = css.replace('button:active{transform:translateY(1px)}', '')
    body = re.search(r'<body[^>]*>(.*?)<script>', old, re.S).group(1)
    shelf = body.split('<footer class="preview-controls">')[0]
    (ROOT / f'{theme}-shelf.json').write_text(json.dumps(shelf, ensure_ascii=False), encoding='utf-8')
    (ROOT / f'{theme}-approved.css').write_text(css, encoding='utf-8')
    html = f'''<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} · 完整设计稿</title><link rel="stylesheet" href="{theme}-approved.css"><link rel="stylesheet" href="studio.css"></head><body class="{theme}" data-theme="{theme}"><div id="app"></div><div id="overlay"></div><div id="toast" role="status" aria-live="polite"></div><script src="data.js"></script><script src="shelf-data.js"></script><script src="studio.js"></script></body></html>'''
    (ROOT / f'{theme}.html').write_text(html, encoding='utf-8')
shelves = {theme: json.loads((ROOT / f'{theme}-shelf.json').read_text(encoding='utf-8')) for theme in ['opera', 'nouveau']}
(ROOT / 'shelf-data.js').write_text('const approvedShelves = ' + json.dumps(shelves, ensure_ascii=False) + ';', encoding='utf-8')
print('Built opera.html and nouveau.html; approved source files untouched.')
