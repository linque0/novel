export function seedStory(){
  return {root:'book',nodes:{
    book:{id:'book',type:'container',title:'山海来信',summary:'一封迟到十年的信，把林知夏带回了雾港。',color:'#667f71',children:['letter','lighthouse','storm']},
    letter:{id:'letter',type:'container',title:'雾港来信',summary:'收到父亲寄来的船票，林知夏决定回到十年前离开的故乡。',color:'#6e8c79',chapter:'第 1—3 章',entry:'一封没有署名的信',exit:'找到守塔人',children:['ticket','return','keeper']},
    ticket:{id:'ticket',type:'event',title:'收到旧日来信',summary:'船票上有一枚褪色的铜印。',status:'done'},
    return:{id:'return',type:'event',title:'重返雾港',summary:'熟悉的渡口已经无人认得她。',status:'done'},
    keeper:{id:'keeper',type:'event',title:'找到守塔人',summary:'守塔人说，父亲不可能寄出这封信。',status:'done'},
    lighthouse:{id:'lighthouse',type:'container',title:'灯塔疑云',summary:'从互相矛盾的证词中，拼出父亲失踪那一夜的真相。',color:'#a08455',chapter:'第 4—8 章',entry:'父亲留下的线索',exit:'决定再赴灯塔',children:['compare','testimony','decision']},
    compare:{id:'compare',type:'event',title:'对照旧信',summary:'落款日期，比父亲失踪晚了三天。',status:'done'},
    testimony:{id:'testimony',type:'container',title:'守塔人的证词',summary:'他承认当年有人上过灯塔，却隐瞒了那个人的名字。',color:'#758b9b',chapter:'第 5—6 章',entry:'第一次问话',exit:'发现证词矛盾',children:['interview','past','contradiction']},
    interview:{id:'interview',type:'event',title:'第一次问话',summary:'守塔人坚持说，那晚海上没有船。',status:'done'},
    past:{id:'past',type:'container',title:'十年前的暴风夜',summary:'日志、名单与一封未寄出的信，指向同一次救援。',color:'#8d8196',chapter:'第 6 章',entry:'残缺的航海日志',exit:'查明救援名单',children:['log','rescue','unsent']},
    log:{id:'log',type:'event',title:'残缺的航海日志',summary:'纸页角落的铜印，与船票上的印记相同。',status:'done'},
    rescue:{id:'rescue',type:'event',title:'查明救援名单',summary:'最后一名乘客的名字被人划掉。',status:'done'},
    unsent:{id:'unsent',type:'event',title:'未寄出的信',summary:'父亲曾答应把一个人带离雾港。',status:'done'},
    contradiction:{id:'contradiction',type:'event',title:'证词里的矛盾',summary:'他认得那枚铜印，却说从未见过这张船票。',status:'revise'},
    decision:{id:'decision',type:'event',title:'决定再赴灯塔',summary:'在下一场风暴到来前，找到被划掉的名字。',status:'writing'},
    storm:{id:'storm',type:'container',title:'风暴中的选择',summary:'真相浮出水面，林知夏必须决定是否把它公之于众。',color:'#a97868',chapter:'第 9—12 章',entry:'约定开始破裂',exit:'故事的答案',children:['tide','choice']},
    tide:{id:'tide',type:'event',title:'风暴前夜',summary:'渡轮停航，岛上只剩最后一盏灯。',status:'planned'},
    choice:{id:'choice',type:'event',title:'选择留下真相',summary:'她终于明白，那封信写给的并不是过去。',status:'planned'}
  },edges:[
    {id:'e1',from:'ticket',to:'return',kind:'cause',label:''},
    {id:'e2',from:'return',to:'keeper',kind:'cause',label:''},
    {id:'e3',from:'keeper',to:'compare',kind:'cause',label:'追查线索'},
    {id:'e4',from:'compare',to:'interview',kind:'cause',label:''},
    {id:'e5',from:'interview',to:'log',kind:'cause',label:''},
    {id:'e6',from:'log',to:'rescue',kind:'cause',label:''},
    {id:'e7',from:'rescue',to:'unsent',kind:'cause',label:''},
    {id:'e8',from:'unsent',to:'contradiction',kind:'cause',label:''},
    {id:'e9',from:'contradiction',to:'decision',kind:'cause',label:''},
    {id:'e10',from:'decision',to:'tide',kind:'cause',label:'前往下一幕'},
    {id:'e11',from:'tide',to:'choice',kind:'cause',label:''},
    {id:'e12',from:'ticket',to:'log',kind:'foreshadow',label:'铜印伏笔'},
    {id:'e13',from:'keeper',to:'contradiction',kind:'foreshadow',label:'隐瞒的名字'}
  ]};
}
export function parentOf(story,id){return Object.values(story.nodes).find(n=>n.children?.includes(id))?.id||null}
export function pathTo(story,id){const out=[],seen=new Set();while(id&&!seen.has(id)){seen.add(id);out.unshift(id);id=parentOf(story,id)}return out}
export function descendants(story,id){const out=[],seen=new Set();function visit(k){if(seen.has(k))return;seen.add(k);for(const c of story.nodes[k]?.children||[]){out.push(c);visit(c)}}visit(id);return out}
export function stats(story,id){
  const ids=[id,...descendants(story,id)],leaves=ids.map(k=>story.nodes[k]).filter(n=>n?.type==='event');
  const done=leaves.filter(n=>n.status==='done').length;
  const depth=k=>Math.max(0,...(story.nodes[k]?.children||[]).map(c=>1+depth(c)));
  return {total:leaves.length,done,blocks:ids.filter(k=>story.nodes[k]?.type==='container').length-1,depth:depth(id),complete:leaves.length>0&&done===leaves.length};
}
export function visibleNodes(story,scope,expanded){const visible=new Set();function walk(id){visible.add(id);const n=story.nodes[id];if(n?.type==='container'&&expanded.has(id))for(const c of n.children)walk(c)}for(const id of story.nodes[scope]?.children||[])walk(id);return visible}
export function projectEdges(story,scope,expanded){
  const visible=visibleNodes(story,scope,expanded),inside=new Set([scope,...descendants(story,scope)]),out=new Map(),external={in:new Set(),out:new Set()};
  const proxy=(id,end)=>{if(!inside.has(id)){external[end].add(id);return 'outside-'+end}let k=id;while(k&&!visible.has(k))k=parentOf(story,k);return k};
  for(const edge of story.edges){
    if(!inside.has(edge.from)&&!inside.has(edge.to))continue;
    const from=proxy(edge.from,'in'),to=proxy(edge.to,'out');if(!from||!to||from===to)continue;
    const key=from+'|'+to+'|'+edge.kind;
    if(!out.has(key))out.set(key,{key,from,to,kind:edge.kind,label:edge.label,relations:[]});
    out.get(key).relations.push(edge);
  }
  return {visible,edges:[...out.values()],external};
}
export function blockConnections(story,id){const inside=new Set([id,...descendants(story,id)]);return story.edges.filter(e=>inside.has(e.from)!==inside.has(e.to)).map(e=>({...e,direction:inside.has(e.from)?'out':'in'}))}
export function createContainer(story,scope,ids,title,summary,id){
  const parent=story.nodes[scope],selected=new Set(ids);
  if(!parent?.children||!title.trim()||story.nodes[id]||[...selected].some(k=>!parent.children.includes(k)))return {ok:false,error:'请选择同一层的模块，并填写容器名称。'};
  const next=structuredClone(story),first=selected.size?parent.children.findIndex(k=>selected.has(k)):parent.children.length,children=parent.children.filter(k=>selected.has(k));
  next.nodes[id]={id,type:'container',title:title.trim(),summary:summary.trim(),color:'#748b80',children};
  next.nodes[scope].children=parent.children.filter(k=>!selected.has(k));next.nodes[scope].children.splice(first,0,id);
  return {ok:true,story:next,id};
}

export function wrapNodes(story,scope,ids,title,summary,id){
  if(new Set(ids).size<2)return {ok:false,error:'请选择同一层至少两个模块。'};
  return createContainer(story,scope,ids,title,summary,id);
}
export function addModule(story,scope,type,title,summary,id){
  if(!story.nodes[scope]?.children||!['event','note','textbox'].includes(type)||!title.trim()||story.nodes[id])return {ok:false};
  const next=structuredClone(story);
  next.nodes[id]={id,type,title:title.trim(),summary:summary.trim(),...(type==='event'?{status:'planned'}:{})};
  next.nodes[scope].children.push(id);return {ok:true,story:next,id};
}
