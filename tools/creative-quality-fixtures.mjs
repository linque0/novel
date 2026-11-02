// Fixed fictional evidence corpus shared by real-model review runs. No author manuscript.
export const CREATIVE_QUALITY_CASES = [
  {id:'time',title:'时间顺序',fact:'林昭在第一个清晨离开雾都，三天后才抵达驿站。',rule:'从雾都到驿站至少需要三天。',draft:'林昭在离开雾都的当天傍晚抵达驿站。',expectation:'识别同一旅程的时长冲突，不能假设未提供的捷径。'},
  {id:'knowledge',title:'人物知情',fact:'林昭从未见过密信，也不知道守门人的真实身份。',rule:'只有读过密信的人才知道守门人名为陆衡。',draft:'林昭从未接触密信，却立刻认出了从未谋面的守门人：“陆衡，我知道你的全部计划。”',expectation:'识别知情来源缺失，不能虚构人物已经读信。'},
  {id:'cost',title:'能力代价',fact:'林昭获得铜符，尚未使用。',rule:'铜符每次释放力量都会立即消耗持有者全部体力。',draft:'铜符释放出力量。林昭没有承受任何消耗，体力仍然充盈。',expectation:'识别明确的能力代价冲突；修法应落实消耗。'},
  {id:'uncertainty',title:'审稿误报控制',fact:'林昭昨日抵达驿站，今天仍住在驿站。',rule:'林昭可以在驿站内行动。',draft:'林昭推开客房的门，来到楼下，向掌柜询问铜符的来历。',expectation:'不因未精确交代时刻或下楼步骤虚报时间、地点矛盾。'},
  {id:'foreshadow',title:'伏笔与计划边界',fact:'林昭只知道铜符会发光，其用途尚未揭晓。',rule:'铜符可以发光，但用途必须通过正文事件逐步发现。',draft:'林昭没有找到任何线索，却突然知道铜符能开启天宫，并准确说出了天宫口令。',expectation:'识别缺少发现过程；不能把后续计划当已发生事实。'},
]
