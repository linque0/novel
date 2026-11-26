export const sets = [
  { id: 'world', title: '世界设定', color: '#a1c7bb', createdAt: '2026-04-12' },
  { id: 'orders', title: '组织与势力', color: '#c5adcf', createdAt: '2026-04-18' },
  { id: 'history', title: '历史纪事', color: '#d5ac8b', createdAt: '2026-05-08' },
  { id: 'notes', title: '未归档札记', color: '#a8a7c4', createdAt: '2026-05-08' },
  { id: 'empty', title: '待建档案', color: '#b9b2a2' }
]

const groups = {
  world: ['界脊', '雾都钟楼', '星图', '穹顶大厅', '铜刻星辰', '雾海航线', '白鸦港', '巡航塔', '第十二响', '暮色观测站', '旧世界边界', '沉眠之海', '石门',
    '盐霜坡', '长夜井', '断桥集市', '雾灯塔', '水位碑', '渡鸦渡口', '旧河床', '东岬', '枯星台', '弧光轨道',
    '铁羽仓', '北岸石窟', '巡雾钟', '石灰堤', '钟摆室', '折光峡谷', '双月码头', '雨幕街', '退潮线以北的铜刻星图观测站'],
  orders: ['领航员公会', '白鸦议会', '铜钟守望者', '观测站联盟', '远航商队', '旧城密使', '星炉工会', '黑砂船团', '潮汐记录者'],
  history: ['铜符失窃', '星图初醒', '北境失联', '雾海之战', '钟楼封存', '白鸦来信', '最后一次远航'],
  notes: ['未解的刻印', '陌生航标', '雨夜手记', '旧地图残页']
}
const samples = {
  '世界设定': '围绕界脊、雾都和航路展开的地理、设施与传说。',
  界脊: '横贯大陆的断崖。崖壁上的铜刻标记着旧星图的起点。',
  星图: '每一枚星点都对应一处可抵达的坐标，钟声会改变其中的航路。',
  雾都钟楼: '钟楼为雾海中的船只校准方向。第十二响只在潮位最低时出现。',
  领航员公会: '维护航路并核发远航资格，掌握界脊以东的观测记录。'
}
const parents = {
  world: {
    0: [2, 4, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
    1: [8, 9, 23, 24, 25, 26, 27, 28, 30], 2: [31], 5: [6, 7, 11, 29]
  },
  orders: { 0: [2, 3, 6], 1: [5, 8], 4: [7] }
}
export const nodes = Object.entries(groups).flatMap(([setId, titles]) => {
  const byChild = new Map(Object.entries(parents[setId] || {}).flatMap(([parent, children]) =>
    children.map(child => [child, setId + '-' + parent])))
  return titles.map((title, index) => ({
    id: setId + '-' + index, setId, parentId: byChild.get(index), title, summary: samples[title] || ''
  }))
})

const relations = [
  ['world-0','world-2','刻录坐标'], ['world-0','world-4','保存铜刻'], ['world-0','world-6','毗邻'],
  ['world-2','world-1','校准'], ['world-2','world-3','存放于'], ['world-2','world-5','指引'],
  ['world-2','world-4','记录'], ['world-1','world-8','发出'], ['world-3','world-7','连通'],
  ['world-3','world-9','观测'], ['world-5','world-6','经过'], ['world-4','world-10','标示'],
  ['world-8','world-7','通报'], ['world-6','world-9','补给'], ['world-10','world-11','相接'],
  ['world-3','world-27','相通'], ['world-5','world-29','停靠'], ['world-16','world-18','照亮'],
  ['world-17','world-31','记录'], ['world-19','world-30','相邻'], ['world-21','world-22','观测'],
  ['world-25','world-8','响应'], ['world-24','world-14','相通'], ['world-26','world-20','毗邻'],
  ['orders-0','orders-3','共同维护'], ['orders-0','orders-2','协作'], ['orders-0','orders-6','采购'],
  ['orders-1','orders-5','指派'], ['orders-4','orders-7','争夺航路'], ['orders-7','orders-8','交换情报'],
  ['history-0','history-4','先于'], ['history-1','history-6','留下记录'], ['history-2','history-3','引发'],
  ['world-2','orders-0','使用'], ['world-0','orders-0','驻守'], ['world-1','orders-2','看守'],
  ['world-3','orders-3','观测'], ['world-5','orders-4','通航'], ['world-6','orders-1','管辖'],
  ['world-7','orders-3','管理'], ['world-8','orders-8','记录'],
  ['world-2','history-1','出现于'], ['orders-1','history-5','收到']
]
export const links = relations.map(([from, to, label], index) => ({ id: 'relation-' + index, from, to, label }))

const characters = {
  lin: { kind: 'character', id: 'lin', title: '林远', summary: '在雾都钟楼值守的观测员，负责解读第十二响的航线讯号。' },
  bai: { kind: 'character', id: 'bai', title: '白鸦', summary: '常年穿行雾海的领航员，保管着星图散失的几张抄本。' },
  qiao: { kind: 'character', id: 'qiao', title: '乔岑', summary: '领航员公会的记录员，正在核对旧航线上的失踪记录。' }
}
export const satellites = [
  { nodeId: 'world-2', target: characters.lin, label: '解读' },
  { nodeId: 'world-2', target: characters.bai, label: '保管抄本' },
  { nodeId: 'world-1', target: characters.lin, label: '值守' },
  { nodeId: 'orders-0', target: characters.qiao, label: '成员' },
  { nodeId: 'history-1', target: characters.bai, label: '目击' }
]
