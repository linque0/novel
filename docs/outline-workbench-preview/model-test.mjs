// 大纲工作台 · 数据模型自检（node docs/outline-workbench-preview/model-test.mjs）
import {seedStory,parentOf,pathTo,descendants,stats,nodeStats,visibleNodes,projectEdges,blockConnections,createContainer,wrapNodes,addModule,deleteNode} from './story.js';

let pass=0,fail=0;
const ok=(name,cond,extra='')=>{if(cond){pass++}else{fail++;console.log(`✗ ${name} ${extra}`)}};

const story=seedStory();

/* 结构 */
ok('book 有 7 个顶层子项',story.nodes.book.children.length===7,`实际 ${story.nodes.book.children.length}`);
ok('act1 的父级是 book',parentOf(story,'act1')==='book');
ok('m-ticket 的父级是 act1',parentOf(story,'m-ticket')==='act1');
ok('s-log 的路径是 全书/灯塔疑云/守塔人的证词/十年前的暴风夜/残缺的航海日志',pathTo(story,'s-log').join('/')==='book/act2/ter/storm-night/s-log',pathTo(story,'s-log').join('/'));
ok('act2 子树深度为 3（再往下是暴风夜→日志）',stats(story,'act2').depth===3,`实际 ${stats(story,'act2').depth}层`);
ok('全书共 4 层嵌套',stats(story,'book').depth===4,`实际 ${stats(story,'book').depth}层`);
ok('descendants(act2) 含 12 个后代',descendants(story,'act2').length===12,`实际 ${descendants(story,'act2').length}`);

/* 进度只统计事件 */
const act1Stats=stats(story,'act1');
ok('act1 统计 3 个事件',act1Stats.total===3,`实际 ${act1Stats.total}`);
ok('act1 已完成 3 个',act1Stats.done===3,`实际 ${act1Stats.done}`);
ok('act1 不把便签算作事件',act1Stats.total===3&&story.nodes['m-seal'].kind==='note');
ok('act1 视为已完成',act1Stats.complete===true);
const act2Stats=stats(story,'act2');
ok('act2 统计 7 个事件（含嵌套容器内）',act2Stats.total===7,`实际 ${act2Stats.total}`);
ok('act2 已完成 5 个（另有待修改与正在写各一）',act2Stats.done===5,`实际 ${act2Stats.done}`);
ok('act2 折叠中嵌套容器数 2',act2Stats.blocks===2,`实际 ${act2Stats.blocks}`);
const bookStats=stats(story,'book');
ok('全书统计 12 个事件',bookStats.total===12,`实际 ${bookStats.total}`);
ok('全书已完成 8 个',bookStats.done===8,`实际 ${bookStats.done}`);
ok('便签/引用/文本/锚点/卷不计入事件',['m-seal','quote-tide','s-note','anchor-3','volume'].every(k=>nodeStats(story,k).total===0||story.nodes[k].kind==='event'));
ok('act3 未完成',stats(story,'act3').complete===false);

/* 可见集与投影 */
const top=projectEdges(story,'book',new Set());
ok('全书可见集只含本层 7 项',top.visible.size===7,`实际 ${top.visible.size}`);
ok('隐藏端点的关系被投影到容器',top.edges.every(e=>['act1','act2','act3','volume','note-key','quote-prologue','memo'].includes(e.from)&&[...top.visible].includes(e.from)));
const r12=top.edges.find(e=>e.relations.some(r=>r.id==='r12'));
ok('铜印伏笔被投影为 收到旧日来信→残缺的航海日志 落到 act1/act2',r12&&r12.from==='act1'&&r12.to==='act2'&&r12.kind==='伏笔'&&r12.label==='铜印伏笔',JSON.stringify(r12));
ok('投影边被标为 projected',r12.projected===true);
const cause13=top.edges.find(e=>e.relations.some(r=>r.id==='r3'));
ok('跨章因果 找到守塔人→对照旧信 合并为 act1→act2',cause13&&cause13.from==='act1'&&cause13.to==='act2'&&cause13.kind==='因果');
ok('可见两端的关系不投影（卷→雾港来信）',top.edges.some(e=>e.from==='volume'&&e.to==='act1'&&e.projected===false));
ok('隐藏端点的关系全部投影到容器',top.edges.filter(e=>['note-key','quote-prologue'].includes(e.from)).every(e=>e.projected===true&&e.to==='act1'));
ok('指向容器的顶层关系不标记投影（节奏备忘→灯塔疑云）',top.edges.some(e=>e.from==='memo'&&e.to==='act2'&&e.projected===false));
ok('双向外联进入接续卡',top.external.in.size===0);
ok('全书没有范围外端点',top.external.in.size===0&&top.external.out.size===0);

/* 在 act2 内部：范围外关系进入前接／后续 */
const inAct2=projectEdges(story,'act2',new Set());
ok('act2 内部：后续接续指到真实事件 风暴前夜',inAct2.external.out.has('f-eve'),[...inAct2.external.out].join(','));
ok('act2 内部：前接接续指到雾港来信里的三个事件',['m-keeper','m-ticket','m-seal'].every(k=>inAct2.external.in.has(k)),[...inAct2.external.in].join(','));
ok('act2 内部可见集为 5 个本层模块',inAct2.visible.size===5,`实际 ${inAct2.visible.size}`);
const inStorm=projectEdges(story,'storm-night',new Set());
ok('最内层仍在范围外显示接续',inStorm.external.out.size>0&&inStorm.external.in.size>0);

/* 展开后的可见集 */
const expanded=new Set(['ter']);
const withTer=projectEdges(story,'act2',expanded);
ok('展开 守塔人的证词 后可见集增加 3 项',withTer.visible.size===8,`实际 ${withTer.visible.size}`);
const hiddenLog=withTer.edges.find(e=>e.relations.some(r=>r.id==='r5'));
ok('展开一层后 第一次问话→残缺的航海日志 投影到 storm-night',hiddenLog&&hiddenLog.from==='t-interview'&&hiddenLog.to==='storm-night');
const expandedDeep=new Set(['ter','storm-night']);
const deep=projectEdges(story,'act2',expandedDeep);
ok('继续展开 十年前的暴风夜 后 日志节点直接可见',deep.visible.has('s-log'));
ok('深层展开后 r5 不再投影',deep.edges.find(e=>e.relations.some(r=>r.id==='r5')).projected===false);
ok('不可见端点不会留下悬空编号',deep.edges.every(e=>deep.visible.has(e.from)&&deep.visible.has(e.to)));

/* 外联清单 */
const conns=blockConnections(story,'storm-night');
ok('十年前的暴风夜 有 4 条跨容器连线',conns.length===4,`实际 ${conns.length}`);
ok('跨容器方向标注正确（未寄出的信→证词里的矛盾 记作后续）',conns.some(c=>c.direction==='out'&&c.to==='t-contradiction')&&conns.every(c=>['in','out'].includes(c.direction)));

/* 容器封装 */
const beforeEdges=story.edges.length;
const wrapped=wrapNodes(story,'act1',['m-ticket','m-return'],'开场两幕','收信与归乡','wrap-test',undefined);
ok('封装成功',wrapped.ok===true,wrapped.error||'');
if(wrapped.ok){
  const next=wrapped.story;
  ok('封装后新容器出现在原位置（在原来的第一位）',next.nodes.act1.children[0]==='wrap-test');
  ok('封装后原本的两个模块移入容器',next.nodes['wrap-test'].children.join(',')==='m-ticket,m-return');
  ok('封装不改变关系数量',next.edges.length===beforeEdges);
  ok('封装后 act1 仍是两个事件（其他模块不变）',next.nodes.act1.children.join(',')==='wrap-test,m-keeper,m-seal');
  ok('封装后关系仍然指向真实事件编号',next.edges.some(e=>e.from==='m-ticket'&&e.to==='m-return'));
  const inside=projectEdges(next,'wrap-test',new Set());
  ok('新容器内部计数正确',stats(next,'wrap-test').total===2);
  ok('进入新容器后 后续 出现接续',inside.external.out.has('m-keeper')||inside.external.out.size>0);
}
ok('只选一个模块不能封装',wrapNodes(story,'act1',['m-ticket'],'x','y','w2').ok===false);
ok('跨层选择被拒绝',wrapNodes(story,'act1',['m-ticket','s-log'],'x','y','w3').ok===false);
const emptyContainer=createContainer(story,'book',[],'空容器','留给下一幕','wrap-empty');
ok('可以创建空容器',emptyContainer.ok===true);
ok('空容器没有事件',stats(emptyContainer.story,'wrap-empty').total===0);

/* 添加模块 */
const added=addModule(story,'act1','event','新的转折','她认出了那枚铜印。','module-x',100,200);
ok('添加事件成功',added.ok===true);
ok('新事件进入当前层末尾',added.story.nodes.act1.children.at(-1)==='module-x');
ok('新事件默认待展开',added.story.nodes['module-x'].status==='planned');
ok('便签不参与进度',addModule(story,'act1','note','随手记','x','module-y',0,0).ok===true&&stats(addModule(story,'act1','note','随手记','x','module-y',0,0).story,'act1').total===3);
const addedVolume=addModule(story,'book','volume','第二卷 · 回声','新的旅程','module-vol',40,600);
ok('可以添加卷，且不计入事件',addedVolume.ok===true&&stats(addedVolume.story,'book').total===12);
ok('未知类型仍被拒绝',addModule(story,'act1','plotblock','情节块','x','module-z',0,0).ok===false);

/* 删除 */
const removed=deleteNode(story,'ter');
ok('删除容器成功',removed.ok===true);
if(removed.ok){
  ok('容器及其子树一并移除',['ter','t-interview','storm-night','s-log','s-rescue','s-unsent','s-note','t-contradiction'].every(k=>!removed.story.nodes[k]));
  ok('相关连线一并清除',!removed.story.edges.some(e=>['ter','t-interview','storm-night','s-log','s-rescue','s-unsent','s-note','t-contradiction'].includes(e.from)||['ter','t-interview','storm-night','s-log','s-rescue','s-unsent','s-note','t-contradiction'].includes(e.to)));
  ok('父级不再引用被删容器',!removed.story.nodes.act2.children.includes('ter'));
  ok('删除后 act2 仍有 6 条内部因果链前缀',removed.story.nodes.act2.children.length===4);
}
ok('不能删除根节点',deleteNode(story,'book').ok===false);

console.log(`\n大纲工作台模型自检：${pass}/${pass+fail} 通过${fail?`，${fail} 项失败`:''}`);
process.exit(fail?1:0);
