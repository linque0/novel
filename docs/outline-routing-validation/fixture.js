export function fixture(workId='routing-ui-sandbox') {
  const rows=[
    {id:'routing-a',kind:'event',title:'发现异常',text:'故事从一封匿名信开始',canvasX:70,canvasY:150,w:180,h:90},
    {id:'routing-b',kind:'event',title:'追查线索',text:'选择进入旧城调查',canvasX:480,canvasY:150,w:180,h:90},
    {id:'routing-c',kind:'note',title:'支线 · 见证人',text:'提供相互矛盾的证词',canvasX:480,canvasY:390,w:180,h:90},
    {id:'routing-d',kind:'event',title:'真相浮现',text:'线索最终在此汇合',canvasX:860,canvasY:150,w:180,h:90},
    {id:'routing-obstacle',kind:'note',title:'待展开的伏笔',text:'连线将自动绕开这张卡片',canvasX:320,canvasY:120,w:110,h:140}
  ].map((n,i)=>({...n,workId,parentId:null,sortOrder:i*1000,rels:[],createdAt:1,updatedAt:1,deletedAt:null}))
  rows[0].rels=[{id:'routing-ab',toId:'routing-b',fromSide:'right',toSide:'left',label:'发现线索',kind:'因果',arrows:'->',junctions:[{id:'routing-j',t:.4}],_out:[{id:'routing-jc',fromJunction:{ownerId:'routing-a',relId:'routing-ab',junctionId:'routing-j'},toId:'routing-c',toSide:'top',kind:'伏笔',label:'另一种可能',arrows:'->',junctions:[]}]}]
  rows[1].rels=[{id:'routing-bd',toId:'routing-d',fromSide:'right',toSide:'left',label:'因果推进',kind:'因果',arrows:'<->',junctions:[]}]
  return rows
}
export function performanceFixture() {
  const nodes=Array.from({length:100},(_,i)=>({id:`perf-${i}`,workId:'routing-ui-sandbox',kind:'event',title:`情节 ${i+1}`,text:'固定性能验收场景',canvasX:(i%10)*280,canvasY:Math.floor(i/10)*160,w:160,h:70,sortOrder:i,rels:[]}))
  let count=0
  for(let y=0;y<10;y++) for(let x=0;x<9;x++) nodes[y*10+x].rels.push({id:`pe-${count++}`,toId:nodes[y*10+x+1].id,fromSide:'right',toSide:'left',arrows:'->'})
  for(let y=0;y<6;y++) for(let x=0;x<10;x++) nodes[y*10+x].rels.push({id:`pe-${count++}`,toId:nodes[(y+1)*10+x].id,fromSide:'bottom',toSide:'top',arrows:'->'})
  return nodes
}
export function surfaceFixture() {
  const rows=fixture()
  const base={workId:'routing-ui-sandbox',parentId:null,sortOrder:0,rels:[],deletedAt:null}
  return [
    {...base,id:'surface-group',kind:'container',title:'第一幕 · 线索归类',canvasX:40,canvasY:60,w:730,h:290,color:'#5b8b7b'},
    {...rows[0],parentId:'surface-group',canvasX:95,canvasY:135,w:210,h:110,rels:[{id:'surface-edge',toId:'routing-b',fromSide:'right',toSide:'left',kind:'因果',label:'发现线索',arrows:'->'}]},
    {...rows[1],parentId:'surface-group',canvasX:465,canvasY:135,w:210,h:110,rels:[]},
    {...base,id:'surface-text',kind:'textbox',title:'',text:'这一幕的情绪：\n从犹疑，到无法回头。',canvasX:95,canvasY:390,w:360,h:110},
    {...rows[2],canvasX:520,canvasY:380,w:210,h:130,rels:[]}
  ]
}
