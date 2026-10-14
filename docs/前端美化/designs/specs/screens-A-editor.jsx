{(() => {
  const ink = '#5B5142'
  const dim = '#8D8271'
  const gearD = 'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'
  const P = {
    back: ['M19 12H5', 'M12 19l-7-7 7-7'],
    search: ['M18 11a7 7 0 1 0-14 0a7 7 0 1 0 14 0', 'M21 21l-4.3-4.3'],
    gear: [gearD, 'M15 12a3 3 0 1 0-6 0a3 3 0 1 0 6 0'],
    check: ['M20 6L9 17l-5-5'],
    split: ['M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M12 4v16'],
    caret: ['M6 9l6 6 6-6'],
    plus: ['M12 5v14', 'M5 12h14'],
    star: ['M12 3l2.7 5.4 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.3l6-.9z'],
    moon: ['M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z'],
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
  const chapters = [
    { t: 't-ch1', y: 172, c: '#27AE60' },
    { t: 't-ch2', y: 204, c: '#27AE60' },
    { t: 't-ch4', y: 268, c: '#7F8C8D' },
    { t: 't-ch5', y: 332, c: '#7F8C8D' },
    { t: 't-ch6', y: 364, c: '#7F8C8D' }
  ]
  return (
    <Frame name="A·正文" x={1520} y={2400} w={1440} h={900} bg="#F3EEDD">
      <Rectangle name="轨道" x={0} y={0} w={52} h={900} bg="#FAF7EC" />
      <Rectangle name="轨道分界" x={51} y={0} w={1} h={900} bg="#E0D6BF" />
      <Rectangle name="激活条" x={4} y={18} w={3} h={24} bg="#8C6F4E" rounded={2} />
      <TextImg id="ds-rail-wen-on" x={10} y={20} />
      <TextImg id="ds-rail-gang" x={10} y={64} />
      <TextImg id="ds-rail-ren" x={10} y={108} />
      <TextImg id="ds-rail-she" x={10} y={152} />
      <TextImg id="ds-rail-ling" x={10} y={196} />
      {icon('star', 18, 776, dim)}
      {icon('moon', 18, 820, dim)}
      {icon('back', 68, 16, ink)}
      <TextImg id="t-top-work" x={92} y={17} />
      <TextImg id="t-top-chap" x={232} y={13} />
      {icon('check', 1080, 16, '#1E8449')}
      <TextImg id="ds-saved" x={1102} y={15} />
      {icon('search', 1332, 16, dim)}
      {icon('split', 1372, 16, dim)}
      {icon('gear', 1404, 16, dim)}
      <Rectangle name="工具条分界" x={52} y={87} w={1388} h={1} bg="#E0D6BF" />
      {icon('undo', 72, 60, ink)}
      {icon('redo', 102, 60, ink)}
      <Rectangle name="分隔1" x={126} y={58} w={1} h={20} bg="#E0D6BF" />
      <Text x={146} y={59} size={13} color={ink}>B</Text>
      <Text x={170} y={59} size={13} color={ink}>I</Text>
      <Text x={194} y={59} size={13} color={ink}>U</Text>
      <Text x={218} y={59} size={13} color={ink}>S</Text>
      <Rectangle name="分隔2" x={242} y={58} w={1} h={20} bg="#E0D6BF" />
      <Rectangle name="样式下拉" x={256} y={54} w={88} h={28} bg="#FAF7EC" rounded={6} stroke="#E0D6BF" strokeWidth={1} />
      <TextImg id="t-para-style" x={266} y={59} />
      {icon('caret', 324, 60, dim, 14)}
      <Rectangle name="分隔3" x={350} y={58} w={1} h={20} bg="#E0D6BF" />
      <Ellipse name="字色" x={366} y={62} w={14} h={14} stroke={ink} strokeWidth={1.5} />
      <Rectangle name="底色" x={394} y={62} w={14} h={14} stroke={ink} strokeWidth={1.5} rounded={2} />
      {icon('eraser', 422, 61, ink)}
      <TextImg id="t-words" x={1332} y={60} />
      <Rectangle name="章节树" x={52} y={88} w={252} h={812} bg="#FAF7EC" />
      <Rectangle name="树分界" x={303} y={88} w={1} h={812} bg="#E0D6BF" />
      <TextImg id="t-tree-head" x={72} y={108} />
      {icon('plus', 272, 108, dim)}
      {icon('caret', 58, 146, dim, 14)}
      <TextImg id="t-vol1" x={76} y={148} />
      {icon('caret', 58, 306, dim, 14)}
      <TextImg id="t-vol2" x={76} y={308} />
      {chapters.map((c, i) => dot(64, c.y + 12, c.c))}
      <TextImg id="t-ch1" x={80} y={178} />
      <TextImg id="t-ch2" x={80} y={210} />
      <Rectangle name="当前章" x={60} y={236} w={236} h={32} bg="#EFE8D2" rounded={6} />
      {dot(64, 248, '#D35400')}
      <TextImg id="t-ch3-on" x={80} y={242} />
      <TextImg id="t-ch4" x={80} y={274} />
      <TextImg id="t-ch5" x={80} y={338} />
      <TextImg id="t-ch6" x={80} y={370} />
      <Rectangle name="正文纸面" x={304} y={88} w={856} h={812} bg="#FCFAF2" />
      <TextImg id="t-ed-title" x={426} y={160} />
      <Rectangle name="标题下划" x={426} y={204} w={40} h={2} bg="#8C6F4E" />
      <Rectangle name="选区高亮" x={426} y={294} w={340} h={38} bg="#E5DCC9" rounded={3} />
      <TextImg id="t-p1" x={426} y={232} />
      <TextImg id="t-p2" x={426} y={361} />
      <TextImg id="t-p3" x={426} y={490} />
      <Rectangle name="批注栏" x={1160} y={88} w={280} h={812} bg="#FAF7EC" />
      <Rectangle name="批注栏分界" x={1160} y={88} w={1} h={812} bg="#E0D6BF" />
      <TextImg id="t-tab-ann" x={1176} y={112} />
      <Rectangle name="页签下划" x={1176} y={133} w={36} h={2} bg="#8C6F4E" />
      <TextImg id="t-tab-out" x={1228} y={112} />
      <TextImg id="t-tab-chr" x={1280} y={112} />
      <TextImg id="t-tab-img" x={1332} y={112} />
      <Rectangle name="批注卡1" x={1176} y={156} w={248} h={100} bg="#F3EEDD" rounded={8} />
      <Rectangle name="批注色条1" x={1176} y={156} w={3} h={100} bg="#C0392B" />
      <TextImg id="t-ann1" x={1192} y={174} />
      <Rectangle name="定位签" x={1192} y={228} w={60} h={18} bg="#ECDCCC" rounded={4} />
      <TextImg id="t-ann1-chip" x={1192} y={230} />
      <Rectangle name="批注卡2" x={1176} y={268} w={248} h={76} bg="#F3EEDD" rounded={8} />
      <Rectangle name="批注色条2" x={1176} y={268} w={3} h={76} bg="#1E8449" />
      <TextImg id="t-ann2" x={1192} y={286} />
    </Frame>
  )
})()}
