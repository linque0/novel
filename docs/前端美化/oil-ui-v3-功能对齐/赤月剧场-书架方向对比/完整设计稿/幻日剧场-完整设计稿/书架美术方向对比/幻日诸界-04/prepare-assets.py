from pathlib import Path
from PIL import Image
import shutil
root=Path(__file__).resolve().parent
generated=Path('C:/Users/linque/.codex/generated_images/01a145f4-aa57-79d3-8bdc-5f8a6285f7dd')
sources={
 'proscenium':'exec-973a8523-54ed-4337-b686-cdaa4ba6e2f2.png',
 'rotunda':'exec-cd9d522e-f424-4e84-b71d-08d783d86760.png',
 'folio':'exec-954053aa-ef80-479d-8bc2-95ba0f7ccf31.png'
}
for name,filename in sources.items():
    shutil.copy2(generated/filename,root/'assets/source'/f'{name}.png')
    image=Image.open(generated/filename).convert('RGB')
    image.save(root/'assets'/f'{name}.webp',quality=95,method=6)
    print(name,image.size)
