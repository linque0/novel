"""Optimize generated stage art and subset existing licensed local fonts."""
from pathlib import Path
from PIL import Image
from fontTools import subset

root = Path(__file__).resolve().parent
generated = Path('C:/Users/linque/.codex/generated_images/01a145f4-aa57-79d3-8bdc-5f8a6285f7dd')
images = {
    'secession': 'exec-0e46d3fd-cfe0-4513-a296-e3c31a0af8cd.png',
    'mucha': 'exec-7ac8f275-5c58-4f81-8396-111709258f91.png',
    'rinpa': 'exec-5f7c2d01-b0b2-42d1-a8e0-e0d66a7969f2.png',
}
for name, filename in images.items():
    image = Image.open(generated / filename).convert('RGB')
    image.save(root / 'assets' / (name + '.webp'), quality=92, method=6)
    print(name, image.size)
for name in ('oldsong', 'wenkai'):
    options = subset.Options()
    options.flavor = 'woff2'
    font = subset.load_font(str(root.parent / 'assets' / (name + '.woff2')), options)
    sub = subset.Subsetter(options=options)
    sub.populate(text=(root / 'font-text.txt').read_text('utf-8'))
    sub.subset(font)
    subset.save_font(font, str(root / 'assets' / (name + '.woff2')), options)
    print(name, (root / 'assets' / (name + '.woff2')).stat().st_size)
