from pathlib import Path
from shutil import copy2
from PIL import Image

root = Path(__file__).resolve().parent
generated = Path('C:/Users/linque/.codex/generated_images/01a1501e-4532-7942-b1fc-20cc10ec8f23')
files = {
    'curtain': 'exec-0b963dba-731d-41cb-a334-48c5e7364110.png',
    'revolve': 'exec-d8a66282-dc0e-41de-9732-b768cf2026d6.png',
    'atlas': 'exec-10a74cf2-9e0e-4085-a6c9-be598dcf129a.png',
}
for name, filename in files.items():
    source = root / 'assets/source' / (name + '.png')
    copy2(generated / filename, source)
    with Image.open(source) as original:
        image = original.convert('RGB')
        image.thumbnail((1600, 1200), Image.Resampling.LANCZOS)
        dest = root / 'assets' / (name + '.webp')
        image.save(dest, 'WEBP', quality=87, method=6)
        print(name, image.size, dest.stat().st_size, 'bytes')
