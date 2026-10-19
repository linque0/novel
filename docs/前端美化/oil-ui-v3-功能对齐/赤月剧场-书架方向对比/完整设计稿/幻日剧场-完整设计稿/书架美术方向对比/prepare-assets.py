from pathlib import Path
from PIL import Image
import shutil

root=Path(__file__).resolve().parent
generated=Path('C:/Users/linque/.codex/generated_images/01a145f4-aa57-79d3-8bdc-5f8a6285f7dd')
sources={
 'mist':'exec-3b7b20a3-c99f-47f4-a806-dc104d8b4f2f.png',
 'light':'exec-3fb5200a-cb5e-49bd-a477-cbc9416c5f91.png',
 'lacquer':'exec-322be2fc-b46b-4e41-bc92-7657306fbce0.png',
}
(root/'assets/source').mkdir(parents=True,exist_ok=True)
for name,filename in sources.items():
    source=generated/filename
    shutil.copy2(source,root/'assets/source'/f'{name}.png')
    im=Image.open(source).convert('RGB')
    im.save(root/'assets'/f'{name}.webp',quality=94,method=6)
    print(name,im.size)
