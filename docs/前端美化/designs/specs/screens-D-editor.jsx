{(() => {
  const ink = '#D9D2C0'
  const dim = '#8F8878'
  const bg = '#191816'
  const panel = '#232019'
  const line = '#3A352A'
  const gold = '#D4A95C'
  const gearD = 'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'
  const P = {
    back: ['M19 12H5', 'M12 19l-7-7 7-7'],
    search: ['M18 11a7 7 0 1 0-14 0a7 7 0 1 0 14 0', 'M21 21l-4.3-4.3'],
    gear: [gearD, 'M15 12a3 3 0 1 0-6 0a3 3 0 1 0 6 0'],
    split: ['M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M12 4v16'],
    check: ['M20 6L9 17l-5-5'],
    caret: ['M6 9l6 6 6-6'],
    star: ['M12 3l2.7 5.4 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.3l6-.9z'],
    sun: ['M16 12a4 4 0 1 0-8 0a4 4 0 1 0 8 0', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
    plus: ['M12 5v14', 'M5 12h14'],
    undo: ['M9 14L4 9l5-5', 'M4 9h10a6 6 0 0 1 0 12h-3'],
    redo: ['M15 14l5-5-5-5', 'M20 9H10a6 6 0 0 0 0 12h3'],
    eraser: ['M6 6l12 12', 'M18 6L6 18']
  }
  const icon = (name, x, y, c, s) => (
    <svg viewBox="0 0 24 24" size={s || 16} x={x} y={y}>
      {P[name].map((d, i) => <path key={i} d={d} stroke={c} fill="none" stroke-width={1.5} />)}
    </svg>
  )
  const dot = (x, y, c) => <Ellipse x={x} y={y} w={6} h={6} bg={c} />
  return (
    <Frame name="D·正文" x={1520} y={5580} w={1440} h={900} bg="#191816">
      <Rectangle name="轨道" x={0} y={0} w={52} h={900} bg={panel} />
      <Rectangle name="轨道分界" x={51} y={0} w={1} h={900} bg={line} />
      <Rectangle name="激活条" x={4} y={18} w={3} h={24} bg={gold} rounded={2} />
      <TextImg id="t-rail-wen-on-n" x={10} y={20} />
      <TextImg id="t-rail-gang-n" x={10} y={64} />
      <TextImg id="t-rail-ren-n" x={10} y={108} />
      <TextImg id="t-rail-she-n" x={10} y={152} />
      <TextImg id="t-rail-ling-n" x={10} y={196} />
      {icon('star', 18, 776, dim)}
      {icon('sun', 18, 820, dim)}
      {icon('back', 68, 16, ink)}
      <TextImg id="t-top-work-n" x={92} y={17} />
      <TextImg id="t-top-chap-n" x={232} y={13} />
      {icon('check', 1080, 16, '#2ECC71')}
      <TextImg id="t-saved-n" x={1102} y={15} />
      {icon('search', 1332, 16, dim)}
      {icon('gear', 1404, 16, dim)}
      <Rectangle name="工具条分界" x={52} y={87} w={1388} h={1} bg={line} />
      {icon('undo', 72, 60, ink)}
      {icon('redo', 102, 60, ink)}
      <Rectangle name="分隔1" x={126} y={58} w={1} h={20} bg={line} />
      <Text x={146} y={59} size={13} color={ink}>B</Text>
      <Text x={170} y={59} size={13} color={ink}>I</Text>
      <Text x={194} y={59} size={13} color={ink}>U</Text>
      <Text x={218} y={59} size={13} color={ink}>S</Text>
      <Rectangle name="分隔2" x={242} y={58} w={1} h={20} bg={line} />
      <Rectangle name="样式下拉" x={256} y={54} w={88} h={28} bg="#2E2A20" rounded={6} stroke={line} strokeWidth={1} />
      <TextImg id="t-para-style-n" x={266} y={59} />
      {icon('caret', 324, 60, dim, 14)}
      <Rectangle name="分隔3" x={350} y={58} w={1} h={20} bg={line} />
      <Ellipse name="字色" x={366} y={62} w={14} h={14} stroke={ink} strokeWidth={1.5} />
      <Rectangle name="底色" x={394} y={62} w={14} h={14} stroke={ink} strokeWidth={1.5} rounded={2} />
      {icon('eraser', 422, 61, ink)}
      <TextImg id="t-words-n" x={1332} y={60} />
      <Rectangle name="章节树" x={52} y={88} w={228} h={812} bg={panel} />
      <Rectangle name="树分界" x={279} y={88} w={1} h={812} bg={line} />
      <TextImg id="t-tree-head-n" x={72} y={108} />
      {icon('plus', 256, 108, dim)}
      {icon('caret', 58, 146, dim, 14)}
      <TextImg id="t-vol1n" x={76} y={148} />
      {dot(64, 184, '#2ECC71')}
      <TextImg id="t-ch1n" x={80} y={178} />
      {dot(64, 216, '#2ECC71')}
      <TextImg id="t-ch2n" x={80} y={210} />
      <Rectangle name="当前章" x={60} y={236} w={208} h={32} bg="#2E2A20" rounded={6} />
      {dot(64, 248, '#E67E22')}
      <TextImg id="t-ch3-on-n" x={80} y={242} />
      {dot(64, 280, '#5C564A')}
      <TextImg id="t-ch4n" x={80} y={274} />
      {icon('caret', 58, 306, dim, 14)}
      <TextImg id="t-vol2n" x={76} y={308} />
      {dot(64, 344, '#5C564A')}
      <TextImg id="t-ch5n" x={80} y={338} />
      {dot(64, 376, '#5C564A')}
      <TextImg id="t-ch6n" x={80} y={370} />
      <Rectangle name="正文纸面" x={280} y={88} w={760} h={812} bg="#1E1C17" />
      <TextImg id="t-ed-title-n" x={420} y={160} />
      <Rectangle name="标题下划" x={420} y={206} w={40} h={2} bg="#B8893F" />
      <TextImg id="t-p1n" x={420} y={226} />
      <TextImg id="t-p2n" x={420} y={370} />
      <Rectangle name="恍然梦栏" x={1040} y={88} w={400} h={812} bg={panel} />
      <Rectangle name="恍然梦分界" x={1040} y={88} w={1} h={812} bg={line} />
      <TextImg id="t-ai-title" x={1064} y={110} />
      {icon('split', 1372, 110, dim)}
      {icon('caret', 1408, 110, dim)}
      <TextImg id="t-ai-tab-task" x={1064} y={150} />
      <Rectangle name="任务下划" x={1064} y={171} w={30} h={2} bg={gold} />
      <TextImg id="t-ai-tab-kb" x={1120} y={150} />
      <TextImg id="t-ai-tab-style" x={1180} y={150} />
      <TextImg id="t-ai-tab-flow" x={1240} y={150} />
      <Rectangle name="导航分界" x={1040} y={192} w={400} h={1} bg={line} />
      <Rectangle name="用户气泡" x={1120} y={216} w={304} h={52} bg="#372F21" rounded={10} />
      <TextImg id="t-ai-user" x={1128} y={232} />
      <TextImg id="t-ai-reply" x={1064} y={292} />
      <Rectangle name="提案卡" x={1064} y={376} w={352} h={166} bg="#2E2A20" rounded={10} stroke="#4A4436" strokeWidth={1} />
      <TextImg id="t-ai-card-title" x={1080} y={392} />
      <TextImg id="t-ai-card-item" x={1080} y={420} />
      <Rectangle name="应用按钮" x={1080} y={496} w={124} h={30} bg={gold} rounded={6} />
      <TextImg id="t-ai-apply" x={1087} y={501} />
      <Rectangle name="预览按钮" x={1216} y={496} w={100} h={30} bg={panel} rounded={6} stroke="#4A4436" strokeWidth={1} />
      <TextImg id="t-ai-diff" x={1221} y={501} />
      <TextImg id="t-ai-scope" x={1064} y={772} />
      <Rectangle name="输入框" x={1056} y={800} w={368} h={64} bg="#2E2A20" rounded={8} stroke={line} strokeWidth={1} />
      <TextImg id="t-ai-input" x={1072} y={818} />
    </Frame>
  )
})()}
