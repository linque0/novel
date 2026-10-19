"""Package only glyphs used by these static drafts; leave original font files intact."""
from pathlib import Path
from fontTools import subset

root = Path(__file__).resolve().parent
for name in ('oldsong', 'wenkai'):
    options = subset.Options()
    options.flavor = 'woff2'
    font = subset.load_font(str(root.parent / 'assets' / (name + '.woff2')), options)
    glyphs = subset.Subsetter(options=options)
    glyphs.populate(text=(root / 'font-text.txt').read_text('utf-8'))
    glyphs.subset(font)
    subset.save_font(font, str(root / 'assets' / (name + '.woff2')), options)
    print(name, (root / 'assets' / (name + '.woff2')).stat().st_size)
