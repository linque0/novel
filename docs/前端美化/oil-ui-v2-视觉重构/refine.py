from pathlib import Path
R=Path(__file__).resolve().parent
p=R/'app.js';s=p.read_text(encoding='utf-8')
start=s.index('const portrait=');end=s.index('\nfunction cover',start)
s=s[:start]+'''const portrait=(i=0,large=false)=>`<div class="portrait ${large?'large':''} p${i}"><img src="assets/person${i}.png" alt="${people[i].name}的角色肖像"></div>`;'''+s[end:]
s=s.replace('<span class="annotation-num">01</span>','').replace('<span class="annotation-num">02</span>','')
s=s.replace('<div class="event-number">0${selectedNode+1}</div>','')
s=s.replace('a:[[65,110],[350,45],[650,110],[350,325],[650,415]]','a:[[65,110],[350,45],[650,110],[350,300],[650,355]]')
old='''if(y===yy){route=`M${x+w} ${y+80}H${xx}`;tx=(x+w+xx)/2;ty=y+64}else if(k===4){route=`M${x+42} ${y+h}V${Math.max(y+h+46,yy+h+44)}H${xx+44}V${yy+h}`;tx=xx-95;ty=Math.max(y+h+46,yy+h+44)-10}else{let gap=(y+yy)/2+(y<yy?60:20);route=`M${x+w/2} ${y+h}V${gap}H${xx+w/2}V${yy}`;tx=(x+xx)/2+w/2;ty=gap-10}'''
new='''if(k===4){let ry=Math.max(y+h+35,yy+h+35);route=`M${x+42} ${y+h}V${ry}H${xx+44}V${yy+h}`;tx=(x+xx)/2+44;ty=ry-10}else if(xx>x+w){let gap=(x+w+xx)/2;route=`M${x+w} ${y+80}H${gap}V${yy+80}H${xx}`;tx=gap;ty=Math.min(y,yy)+63}else{let gap=y+h+38;route=`M${x+w/2} ${y+h}V${gap}H${xx+w/2}V${yy}`;tx=(x+xx)/2+w/2;ty=gap-10}'''
if old in s:s=s.replace(old,new)
s=s.replace('<h1>每一颗星，<br>都有它的秩序。</h1>','<h1>星图系统<br><span class="world-subtitle">观测、航线与失落坐标</span></h1>')
p.write_text(s,encoding='utf-8')
print('已更新角色美术、图谱端口与信息层级。')
