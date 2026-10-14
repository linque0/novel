{(() => {
  const ink = '#5B5142'
  const dim = '#8D8271'
  const gearD = 'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'
  const P = {
    search: ['M18 11a7 7 0 1 0-14 0a7 7 0 1 0 14 0', 'M21 21l-4.3-4.3'],
    gear: [gearD, 'M15 12a3 3 0 1 0-6 0a3 3 0 1 0 6 0']
  }
  const icon = (name, x, y, c, s) => (
    <svg viewBox="0 0 24 24" size={s || 16} x={x} y={y}>
      {P[name].map((d, i) => <path key={i} d={d} stroke={c} fill="none" stroke-width={1.5} />)}
    </svg>
  )
  const listColors = ['#33554A', '#6B4E71', '#8C3B2E', '#1E1E1E', '#4A5A78']
  return (
    <Frame name="B·书架" x={0} y={3460} w={1440} h={900} bg="#F3EEDD">
      <Rectangle name="品牌印" x={32} y={16} w={32} h={32} bg="#002FA7" rounded={6} />
      <TextImg id="t-brand-seal" x={32} y={21} />
      <TextImg id="t-brand" x={78} y={24} />
      {icon('search', 1332, 24, dim)}
      {icon('gear', 1372, 24, dim)}
      <TextImg id="t-poster-label" x={64} y={132} />
      <TextImg id="t-poster-title" x={64} y={164} />
      <TextImg id="t-poster-meta" x={64} y={276} />
      <Rectangle name="海报细线" x={64} y={316} w={540} h={1} bg="#D0C4A6" />
      <Rectangle name="继续按钮" x={64} y={348} w={140} h={38} bg="#8C6F4E" rounded={6} />
      <TextImg id="t-continue-btn" x={86} y={357} />
      <Rectangle name="封面竖线" x={652} y={140} w={3} h={480} bg="#D0C4A6" />
      <Rectangle name="主封面" x={680} y={140} w={320} h={480} bg="#002FA7" />
      <TextImg id="t-cv-big" x={716} y={196} />
      <TextImg id="ds-cover-sub" x={716} y={254} />
      <Ellipse name="作者印" x={716} y={540} w={52} h={52} stroke="#FBF9F3" strokeWidth={1.5} />
      <TextImg id="ds-seal" x={722} y={557} />
      <TextImg id="t-b-head" x={1080} y={132} />
      <Rectangle name="列表分界" x={1080} y={166} w={320} h={1} bg="#E0D6BF" />
      {listColors.map((c, i) => <Rectangle key={'mc' + i} name={'列表封-' + i} x={1080} y={184 + i * 96} w={64} h={96} bg={c} />)}
      <TextImg id="t-title-15-2" x={1160} y={204} />
      <TextImg id="t-title-15-3" x={1160} y={300} />
      <TextImg id="t-title-15-4" x={1160} y={396} />
      <TextImg id="t-title-15-5" x={1160} y={492} />
      <TextImg id="t-title-15-6" x={1160} y={588} />
      <TextImg id="t-meta-2" x={1160} y={230} />
      <TextImg id="t-meta-3" x={1160} y={326} />
      <TextImg id="t-meta-4" x={1160} y={422} />
      <TextImg id="t-meta-5" x={1160} y={518} />
      <TextImg id="t-meta-6" x={1160} y={614} />
    </Frame>
  )
})()}
