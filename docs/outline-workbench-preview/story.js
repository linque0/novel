// 大纲工作台 · 数据模型与示例数据（独立设计稿，不读写正式作品数据）
// 纸面素材复用 outline-canvas-preview/assets/，不重复打包。

const ASSETS = '../outline-canvas-preview/assets';

export const EVENT_SHAPES = {
  process:{label:'矩形',material:'冷白棉纸 · 压印细边',image:`${ASSETS}/event.webp`,original:`${ASSETS}/originals/event.png`,tone:'#f5f7f6',edge:'#b8c9cb',w:224,h:154,path:'M4 1H96Q99 1 99 4V96Q99 99 96 99H4Q1 99 1 96V4Q1 1 4 1Z'},
  diamond:{label:'菱形',material:'象牙压纹纸 · 精切斜边',image:`${ASSETS}/originals/event-diamond.png`,original:`${ASSETS}/originals/event-diamond.png`,tone:'#f6f1e4',edge:'#c8ba99',w:250,h:210,path:'M50 1L99 50L50 99L1 50Z'},
  para:{label:'平行四边形',material:'灰蓝纤维纸 · 平行压线',image:`${ASSETS}/originals/event-para.png`,original:`${ASSETS}/originals/event-para.png`,tone:'#edf3f5',edge:'#aebfc9',w:254,h:170,path:'M12 1H99L88 99H1Z'},
  ellipse:{label:'椭圆',material:'浅青柔纹纸 · 环形压边',image:`${ASSETS}/originals/event-ellipse.png`,original:`${ASSETS}/originals/event-ellipse.png`,tone:'#edf2e9',edge:'#b3c2aa',w:210,h:118,path:'M99 50A49 49 0 1 1 1 50A49 49 0 1 1 99 50Z'}
};

export function eventSurface(id,shape='process'){
  const s=EVENT_SHAPES[shape]||EVENT_SHAPES.process,key='clip-'+String(id).replace(/[^a-zA-Z0-9_-]/g,'');
  return `<svg class="event-surface" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><clipPath id="${key}"><path d="${s.path}"/></clipPath></defs><path class="event-fill" d="${s.path}"/><image class="event-paper" href="${s.image}" width="100" height="100" preserveAspectRatio="none" clip-path="url(#${key})"/><path class="event-border" d="${s.path}"/><path class="event-emboss" d="${s.path}" transform="translate(50 50) scale(.953) translate(-50 -50)"/></svg>`;
}

export const KINDS = {
  volume:{label:'卷',color:'#5c7c68',material:'深松布纹 · 黄铜细线'},
  container:{label:'容器',color:'#eaf0e1'},
  event:{label:'事件',color:'#5c7c88',material:'纸面随形 · 四种形状'},
  note:{label:'便签',color:'#9d8552',material:'浅麦纸纹 · 轻盈折角'},
  cite:{label:'引用卡',color:'#8b7e98',material:'叠页书纸 · 压印引号'},
  textbox:{label:'文本框',color:'#7c8977'},
  anchor:{label:'章节锚点',color:'#a47962',material:'象牙帘纹 · 布面书签'}
};

export const STATUS = {done:'已完成',writing:'正在写',revise:'待修改',planned:'待展开'};
export const EDGE_KINDS = {'因果':'#ae715f','关联':'#59877e','伏笔':'#8971a2','冲突':'#b28443'};
export const CONTAINER_COLORS = [['#6e8c79','苔绿'],['#a08455','麦金'],['#758b9b','雾蓝'],['#8d8196','灰紫'],['#a97868','陶红'],['#748b80','石绿']];

// 每个节点的 x/y 属于其所在画布的坐标系；容器内坐标只在“进入容器”后使用。
export function seedStory(){
  return {root:'book',nodes:{
    book:{id:'book',kind:'container',title:'山海来信',summary:'一封迟到十年的信，把林知夏带回了雾港。',color:'#667f71',children:['volume','act1','act2','act3','note-key','quote-prologue','memo']},

    volume:{id:'volume',kind:'volume',x:40,y:50,w:210,h:124,title:'第一卷 · 潮声',body:'离开与归来',index:'01'},

    act1:{id:'act1',kind:'container',x:290,y:36,w:460,chapter:'第 1—3 章',title:'雾港来信',summary:'收到父亲寄来的船票，林知夏决定回到十年前离开的故乡。',color:'#6e8c79',children:['m-ticket','m-return','m-keeper','m-seal']},
    'm-ticket':{id:'m-ticket',kind:'event',x:60,y:74,w:224,h:154,title:'收到旧日来信',body:'失联多年的父亲，寄来一张没有署名的船票。',shape:'process',status:'done',index:'01',footer:'开端 · 林知夏'},
    'm-return':{id:'m-return',kind:'event',x:352,y:60,w:254,h:170,title:'重返雾港',body:'她循着信中的地址，回到十年前离开的海边小镇。',shape:'para',status:'done',index:'02',footer:'推进 · 雾港'},
    'm-keeper':{id:'m-keeper',kind:'event',x:672,y:74,w:224,h:154,title:'找到守塔人',body:'守塔人说，父亲不可能寄出这封信。',shape:'process',status:'done',index:'03',footer:'悬念 · 守塔人'},
    'm-seal':{id:'m-seal',kind:'note',x:352,y:304,w:248,h:178,title:'那枚铜印',body:'船票角落的铜印要在开篇出现，\n到灯塔时才揭开用途。',footer:'灵感 · 待展开'},

    act2:{id:'act2',kind:'container',x:850,y:36,w:460,chapter:'第 4—8 章',title:'灯塔疑云',summary:'从互相矛盾的证词中，拼出父亲失踪那一夜的真相。',color:'#a08455',children:['p-compare','ter','p-decision','anchor-3','quote-tide']},
    'p-compare':{id:'p-compare',kind:'event',x:60,y:74,w:224,h:154,title:'对照旧信',body:'落款日期，比父亲失踪晚了三天。',shape:'process',status:'done',index:'04',footer:'推进 · 疑点'},
    ter:{id:'ter',kind:'container',x:352,y:60,w:520,chapter:'第 5—6 章',title:'守塔人的证词',summary:'他承认当年有人上过灯塔，却隐瞒了那个人的名字。',color:'#758b9b',children:['t-interview','storm-night','t-contradiction']},
    't-interview':{id:'t-interview',kind:'event',x:60,y:74,w:224,h:154,title:'第一次问话',body:'守塔人坚持说，那晚海上没有船。',shape:'process',status:'done',index:'05',footer:'推进 · 证词'},
    'storm-night':{id:'storm-night',kind:'container',x:352,y:60,w:520,chapter:'第 6 章',title:'十年前的暴风夜',summary:'日志、名单与一封未寄出的信，指向同一次救援。',color:'#8d8196',children:['s-log','s-rescue','s-unsent','s-note']},
    's-log':{id:'s-log',kind:'event',x:60,y:74,w:224,h:154,title:'残缺的航海日志',body:'纸页角落的铜印，与船票上的印记相同。',shape:'process',status:'done',index:'06',footer:'转折 · 铜印'},
    's-rescue':{id:'s-rescue',kind:'event',x:350,y:92,w:210,h:118,title:'查明救援名单',body:'最后一名乘客的名字被人划掉。',shape:'ellipse',status:'done',index:'07',footer:'推进 · 名单'},
    's-unsent':{id:'s-unsent',kind:'event',x:628,y:74,w:224,h:154,title:'未寄出的信',body:'父亲曾答应把一个人带离雾港。',shape:'process',status:'done',index:'08',footer:'推进 · 承诺'},
    's-note':{id:'s-note',kind:'textbox',x:628,y:300,w:300,h:92,title:'写作备忘',body:'这一幕的重点：他把承诺留在了纸面上，却没能兑现。'},
    't-contradiction':{id:'t-contradiction',kind:'event',x:952,y:64,w:250,h:210,title:'证词里的矛盾',body:'他认得那枚铜印，却说从未见过这张船票。',shape:'diamond',status:'revise',index:'09',footer:'转折 · 隐瞒'},
    'p-decision':{id:'p-decision',kind:'event',x:952,y:304,w:224,h:154,title:'决定再赴灯塔',body:'在下一场风暴到来前，找到被划掉的名字。',shape:'process',status:'writing',index:'10',footer:'推进 · 林知夏'},
    'anchor-3':{id:'anchor-3',kind:'anchor',x:60,y:320,w:240,h:153,title:'第三章 · 灯塔',body:'在风暴到来前，找到答案。',index:'CH.03',footer:'修订中 · 2,480 字'},
    'quote-tide':{id:'quote-tide',kind:'cite',x:620,y:320,w:264,h:177,title:'“海会带走一些人，\n也会送回一些答案。”',body:'',footer:'摘自 · 序章《潮汐》'},

    act3:{id:'act3',kind:'container',x:1410,y:36,w:460,chapter:'第 9—12 章',title:'风暴中的选择',summary:'真相浮出水面，林知夏必须决定是否把它公之于众。',color:'#a97868',children:['f-eve','f-choice','f-memo']},
    'f-eve':{id:'f-eve',kind:'event',x:60,y:74,w:224,h:154,title:'风暴前夜',body:'渡轮停航，岛上只剩最后一盏灯。',shape:'process',status:'planned',index:'11',footer:'待展开'},
    'f-choice':{id:'f-choice',kind:'event',x:352,y:74,w:224,h:154,title:'选择留下真相',body:'她终于明白，那封信写给的并不是过去。',shape:'process',status:'planned',index:'12',footer:'待展开'},
    'f-memo':{id:'f-memo',kind:'textbox',x:60,y:300,w:360,h:100,title:'写作备忘',body:'这一幕的情绪：从犹疑，到无法回头。\n不要太早给出答案。'},

    'note-key':{id:'note-key',kind:'note',x:296,y:432,w:248,h:178,title:'那枚黄铜钥匙',body:'让钥匙在开篇出现，\n到灯塔时才揭开用途。',footer:'灵感 · 待展开'},
    'quote-prologue':{id:'quote-prologue',kind:'cite',x:610,y:446,w:264,h:177,title:'“每一次归来，\n都始于一次远行。”',body:'',footer:'摘自 · 写作手记'},
    memo:{id:'memo',kind:'textbox',x:960,y:472,w:391,h:100,title:'写作备忘',body:'全书的节奏：前三章慢，第四章之后收紧，结尾留一个回响。'}
  },edges:[
    {id:'r1',from:'m-ticket',to:'m-return',kind:'因果',arrow:'forward'},
    {id:'r2',from:'m-return',to:'m-keeper',kind:'因果',arrow:'forward'},
    {id:'r3',from:'m-keeper',to:'p-compare',kind:'因果',arrow:'forward',label:'追查线索'},
    {id:'r4',from:'p-compare',to:'t-interview',kind:'因果',arrow:'forward'},
    {id:'r5',from:'t-interview',to:'s-log',kind:'因果',arrow:'forward'},
    {id:'r6',from:'s-log',to:'s-rescue',kind:'因果',arrow:'forward'},
    {id:'r7',from:'s-rescue',to:'s-unsent',kind:'因果',arrow:'forward'},
    {id:'r8',from:'s-unsent',to:'t-contradiction',kind:'因果',arrow:'forward'},
    {id:'r9',from:'t-contradiction',to:'p-decision',kind:'因果',arrow:'forward'},
    {id:'r10',from:'p-decision',to:'f-eve',kind:'因果',arrow:'forward',label:'前往下一幕'},
    {id:'r11',from:'f-eve',to:'f-choice',kind:'因果',arrow:'forward'},
    {id:'r12',from:'m-ticket',to:'s-log',kind:'伏笔',arrow:'forward',label:'铜印伏笔'},
    {id:'r13',from:'m-keeper',to:'t-contradiction',kind:'伏笔',arrow:'forward',label:'隐瞒的名字'},
    {id:'r14',from:'t-contradiction',to:'t-interview',kind:'冲突',arrow:'both',label:'证词冲突'},
    {id:'r15',from:'m-seal',to:'s-log',kind:'关联',arrow:'forward'},
    {id:'r16',from:'quote-tide',to:'p-decision',kind:'关联',arrow:'both'},
    {id:'r17',from:'p-decision',to:'anchor-3',kind:'关联',arrow:'none'},
    {id:'r18',from:'note-key',to:'m-ticket',kind:'关联',arrow:'none'},
    {id:'r19',from:'quote-prologue',to:'m-return',kind:'关联',arrow:'forward'},
    {id:'r20',from:'f-eve',to:'f-memo',kind:'关联',arrow:'none'},
    {id:'r21',from:'volume',to:'act1',kind:'关联',arrow:'none',label:'卷首'},
    {id:'r22',from:'memo',to:'act2',kind:'关联',arrow:'none',label:'节奏备忘'}
  ]};
}

export function parentOf(story,id){return Object.values(story.nodes).find(n=>n.children?.includes(id))?.id||null}
export function pathTo(story,id){const out=[],seen=new Set();while(id&&!seen.has(id)){seen.add(id);out.unshift(id);id=parentOf(story,id)}return out}
export function pathLabel(story,id){return pathTo(story,id).map(k=>story.nodes[k].title).join(' / ')}
export function descendants(story,id){const out=[],seen=new Set();function visit(k){if(seen.has(k))return;seen.add(k);for(const c of story.nodes[k]?.children||[]){out.push(c);visit(c)}}visit(id);return out}

// 进度只统计事件；便签、文本、容器、锚点不充当事件。
export function stats(story,id){
  const ids=[id,...descendants(story,id)],leaves=ids.map(k=>story.nodes[k]).filter(n=>n?.kind==='event');
  const done=leaves.filter(n=>n.status==='done').length;
  const depth=k=>Math.max(0,...(story.nodes[k]?.children||[]).map(c=>1+depth(c)));
  return {total:leaves.length,done,blocks:ids.filter(k=>story.nodes[k]?.kind==='container'&&k!==id).length,depth:depth(id),complete:leaves.length>0&&done===leaves.length};
}
export function nodeStats(story,id){const n=story.nodes[id];return n.kind!=='container'?{total:n.kind==='event'?1:0,done:n.kind==='event'&&n.status==='done'?1:0,complete:n.kind==='event'&&n.status==='done',blocks:0,depth:0}:stats(story,id)}

// 当前画布可见的节点：本层子项 + 已就地展开容器的后代。
export function visibleNodes(story,scope,expanded){
  const visible=new Set();
  function walk(id){visible.add(id);const n=story.nodes[id];if(n?.kind==='container'&&expanded.has(id))for(const c of n.children)walk(c)}
  for(const id of story.nodes[scope]?.children||[])walk(id);
  return visible;
}

// 隐藏的端点投影到最近可见祖先；范围外端点进入前接／后续接续。
export function projectEdges(story,scope,expanded){
  const visible=visibleNodes(story,scope,expanded),inside=new Set([scope,...descendants(story,scope)]);
  const out=new Map(),external={in:new Set(),out:new Set()};
  const proxy=(id,end)=>{if(!inside.has(id)){external[end].add(id);return null}let k=id;while(k&&!visible.has(k))k=parentOf(story,k);return k};
  for(const edge of story.edges){
    if(!inside.has(edge.from)&&!inside.has(edge.to))continue;
    const from=proxy(edge.from,'in'),to=proxy(edge.to,'out');
    if(!from||!to||from===to)continue;
    const key=`${from}|${to}|${edge.kind}`;
    if(!out.has(key))out.set(key,{key,from,to,kind:edge.kind,label:edge.label||'',arrow:edge.arrow||'forward',relations:[],projected:false});
    const group=out.get(key);
    if(edge.label&&!group.label)group.label=edge.label;
    if((edge.arrow||'forward')!=='none'&&group.arrow==='none')group.arrow=edge.arrow||'forward';
    group.relations.push(edge);
    if(from!==edge.from||to!==edge.to)group.projected=true;
  }
  return {visible,edges:[...out.values()],external};
}

// 跨出（或跨入）某个容器真实边界的关系；用于容器设置面板。
export function blockConnections(story,id){
  const inside=new Set([id,...descendants(story,id)]);
  return story.edges.filter(e=>inside.has(e.from)!==inside.has(e.to)).map(e=>({...e,direction:inside.has(e.from)?'out':'in'}));
}

export function createContainer(story,scope,ids,title,summary,id,color){
  const parent=story.nodes[scope],selected=new Set(ids);
  if(!parent?.children||!title.trim()||story.nodes[id]||[...selected].some(k=>!parent.children.includes(k)))return {ok:false,error:'请选择同一层的模块，并填写容器名称。'};
  const next=structuredClone(story),first=selected.size?parent.children.findIndex(k=>selected.has(k)):parent.children.length,children=parent.children.filter(k=>selected.has(k));
  next.nodes[id]={id,kind:'container',title:title.trim(),summary:summary.trim(),color:color||'#748b80',children,
    x:selected.size?Math.min(...children.map(k=>next.nodes[k].x)):160,y:selected.size?Math.min(...children.map(k=>next.nodes[k].y)):160,w:520};
  next.nodes[scope].children=parent.children.filter(k=>!selected.has(k));
  next.nodes[scope].children.splice(first,0,id);
  return {ok:true,story:next,id};
}

export function wrapNodes(story,scope,ids,title,summary,id,color){
  if(new Set(ids).size<2)return {ok:false,error:'请选择同一层至少两个模块。'};
  return createContainer(story,scope,ids,title,summary,id,color);
}

export function addModule(story,scope,kind,title,summary,id,x,y){
  if(!story.nodes[scope]?.children||!['event','note','cite','textbox','anchor','volume'].includes(kind)||!title.trim()||story.nodes[id])return {ok:false};
  const next=structuredClone(story);
  const size={event:[EVENT_SHAPES.process.w,EVENT_SHAPES.process.h],note:[248,178],cite:[264,177],textbox:[360,96],anchor:[240,153],volume:[210,124]}[kind];
  next.nodes[id]={id,kind,title:title.trim(),body:summary.trim(),x,y,w:size[0],h:size[1],
    ...(kind==='event'?{shape:'process',status:'planned',index:String((next.nodes[scope].children.length+1)).padStart(2,'0')}:{})};
  next.nodes[scope].children.push(id);return {ok:true,story:next,id};
}

// 删除节点及其子树，并清掉所有相关关系；只作用于设计稿内存数据。
export function deleteNode(story,id){
  const n=story.nodes[id];if(!n||id==='book')return {ok:false};
  const next=structuredClone(story),gone=new Set([id,...descendants(story,id)]);
  for(const k of gone)delete next.nodes[k];
  next.edges=next.edges.filter(e=>!gone.has(e.from)&&!gone.has(e.to));
  const parent=Object.values(next.nodes).find(p=>p.children?.includes(id));
  if(parent)parent.children=parent.children.filter(k=>k!==id);
  return {ok:true,story:next,removed:[...gone]};
}
