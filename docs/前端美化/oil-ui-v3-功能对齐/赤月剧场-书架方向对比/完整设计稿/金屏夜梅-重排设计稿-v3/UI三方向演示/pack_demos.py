"""Bundle three editable demo sources into portable, offline HTML candidates."""
from pathlib import Path
import base64
import json
import mimetypes
import re

ROOT = Path(__file__).resolve().parent

def asset_data(path):
    resolved = (ROOT / path).resolve()
    if not resolved.is_relative_to(ROOT):
        raise ValueError(f"Asset outside demo folder: {path}")
    mime = mimetypes.guess_type(str(resolved))[0] or 'application/octet-stream'
    return 'data:' + mime + ';base64,' + base64.b64encode(resolved.read_bytes()).decode('ascii')

portraits = {'portraits': [asset_data(f'assets/person{i}.webp') for i in range(3)], 'baseline': asset_data('screenshots/baseline-v3.png')}
for direction in ['ink', 'stage', 'orbit']:
    source = (ROOT / f'{direction}.html').read_text(encoding='utf-8')
    # Only the character screen is explored in this round. Keep global navigation as context.
    def context_link(match):
        attrs, content = match.group(1), match.group(2)
        if content == 'v3 原稿':
            return '<button data-baseline>v3 原稿 ↗</button>'
        attrs = re.sub(r' href="[^"]+"', '', attrs)
        return '<span' + attrs + '>' + content + '</span>'
    source = re.sub(r'<a([^>]*href="\.\./[^\"]+"[^>]*)>(.*?)</a>', context_link, source, flags=re.S)
    def inline_style(match):
        css = (ROOT / match.group(1)).read_text(encoding='utf-8')
        css = css.replace('.main-nav a', '.main-nav :is(a,span)')
        css = re.sub(r'url\([\"\']?([^\)\"\']+)[\"\']?\)', lambda m: 'url("' + asset_data(m.group(1)) + '")', css)
        return '<style>' + css + '</style>'
    source = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_style, source)
    source = re.sub(r'(<img\b[^>]*\bsrc=")([^"]+)(")', lambda m: m.group(1) + asset_data(m.group(2)) + m.group(3), source)
    # Defer scripts until body exists; preload the same embedded portraits for dynamic switching.
    source = re.sub(r'<script defer src="[^"]+"></script>', '', source)
    scripts = '<script>window.DEMO_ASSETS=' + json.dumps(portraits) + ';</script>'
    for filename in ['data.js', 'demo.js']:
        scripts += '<script>' + (ROOT / filename).read_text(encoding='utf-8') + '</script>'
    source = source.replace('</body>', scripts + '</body>')
    output = ROOT / f'{direction}.demo.html'
    output.write_text(source, encoding='utf-8')
    print(f'{output.name}: {output.stat().st_size:,} bytes')
