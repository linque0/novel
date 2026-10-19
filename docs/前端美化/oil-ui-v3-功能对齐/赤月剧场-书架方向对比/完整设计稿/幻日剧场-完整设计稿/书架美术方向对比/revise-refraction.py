from pathlib import Path
import shutil,json
from PIL import Image
root=Path(__file__).resolve().parent
archive=root/'archive/美术02-偏简素'
archive.mkdir(parents=True,exist_ok=True)
for name in ['mist','light','lacquer']:
    for sub,ext in [('assets/source','png'),('assets','webp')]:
        source=root/sub/f'{name}.{ext}'
        if source.exists() and not (archive/source.name).exists():
            shutil.copy2(source,archive/source.name)
    source=root/'screenshots'/name/'page.png'
    if source.exists() and not (archive/f'{name}-screen.png').exists():
        shutil.copy2(source,archive/f'{name}-screen.png')
generated=Path('C:/Users/linque/.codex/generated_images/01a145f4-aa57-79d3-8bdc-5f8a6285f7dd')
files={'mist':'exec-3b7b20a3-c99f-47f4-a806-dc104d8b4f2f.png','light':'exec-3fb5200a-cb5e-49bd-a477-cbc9416c5f91.png','lacquer':'exec-322be2fc-b46b-4e41-bc92-7657306fbce0.png'}
for name,filename in files.items():
    shutil.copy2(generated/filename,root/'assets/source'/f'{name}.png')
    Image.open(generated/filename).convert('RGB').save(root/'assets'/f'{name}.webp',quality=94,method=6)
p=root/'prepare-assets.py'
s=p.read_text(encoding='utf-8')
for old,new in zip(['exec-c873fa29-d9b7-43cc-8255-1c479278633d.png','exec-ab85b14c-3ca1-4400-a3a8-a0c47a9ffafa.png','exec-275e1335-e7c2-4fdc-97f1-48b5e9db071e.png'],files.values()):
    s=s.replace(old,new)
p.write_text(s,encoding='utf-8')
p=root/'build.mjs'
s=p.read_text(encoding='utf-8')
s=s.replace("top:-30px;width:1040px;height:584px;object-fit:cover;object-position:62% center","top:0;width:960px;height:504px;object-fit:fill;object-position:center")
s=s.replace('left:736px;top:220px','left:630px;top:266px')
s=s.replace('right:8px;top:344px;width:253px;padding:17px 0 0;border-top:1px solid #66607177','right:20px;top:358px;width:270px;padding:15px 18px 14px;background:#eee8dbf5;border-top:1px solid #66607177;box-shadow:0 7px 20px #171d2520')
s=s.replace('粉彩幕景：墨蓝帷幕、模糊日轮与灰紫色层','幻日穿过层叠绢幕，显出蓝色港城、赤色古城与青绿园林，台口与帷幕环绕舞台')
s=s.replace('光构舞台：钴蓝景片、杏色日轮、斜长投影与低台','一轮幻日照过三面错角镜幕，蓝色海港、青绿回廊与赤色城邦共同显现在剧场中')
s=s.replace('漆彩幕画：错位日轮、翡翠与茄紫色面及细金箔','漆艺剧场中如书页展开的景片，被同一束幻日照亮，映出三种故事世界')
s=s.replace('.mural-art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center}', '.mural-art{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;object-position:center}')
s=s.replace('margin-top:21px;gap:26px;border-top:1px solid #d8c3a83d','position:absolute;left:0;right:0;top:370px;margin:0;gap:26px;border-top:1px solid #d8c3a83d')
s=s.replace('color:#756659','color:#645247').replace('color:#79695b','color:#66564b')
s=s.replace('01 雾彩幕画','01 绢幕折光').replace('02 光构剧场','02 镜幕万象').replace('03 漆彩日轮','03 漆彩幻景')
s=s.replace("round:'幻日美术 02'","round:'幻日折光 03'")
s=s.replace("brief:'同一部《星尘旅人》与六部作品，比较三种原创舞台表达。只展示书架首屏，选定后再扩展其他模块。'","brief:'一束幻日，折映万千故事。以相同六部作品，比较绢幕、镜幕与漆彩三种剧场表达；本轮只展示书架首屏。'")
s=s.replace("name:'雾彩幕画',concept:'未被画出的世界，由记忆补完。'","name:'绢幕折光',concept:'一轮幻日穿过绢幕，每一层都是尚待写完的世界。'")
s=s.replace("traits:['干性粉彩与薄涂色层','偏轴日轮与开放边缘','两行题名、留白与横向作品册']","traits:['手绘绢幕叠映三种世界','镜框台口、侧幕与暖色幻日','两行题名、纸本信息与横向剧目册']")
s=s.replace("name:'光构剧场',concept:'空间由光与遮挡共同构造。'","name:'镜幕万象',concept:'同一束光，在不同的镜面上成为不同的故事。'")
s=s.replace("traits:['景片、狭缝与长影','全幅舞台与尺度反差','轴线排列、低台与台口剧目册']","traits:['错角镜幕与折映世界','深蓝丝绒、实体台口与中央台座','全幅舞台、横向题名与台口作品册']")
s=s.replace("name:'漆彩日轮',concept:'时间留在材质中，光从表面深处浮现。'","name:'漆彩幻景',concept:'翻开一页，便点亮一幕；书籍与剧场共同收藏世界。'")
s=s.replace("traits:['深漆、错位日轮与细金箔','壁画双联与竖向题名','右侧连续作品目录']","traits:['书页式景片与日光嵌线','漆彩、细金箔与浮雕舞台','竖向题名、暗色书封展台与侧边目录']")
p.write_text(s,encoding='utf-8')
print('Updated three scenic artworks, page layouts and direction manifest.')
