{(() => {
  const ink = '#D9D2C0'
  const dim = '#8F8878'
  const bg = '#191816'
  const panel = '#232019'
  const line = '#3A352A'
  const gold = '#D4A95C'
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
  const coverColors = ['#002FA7', '#33554A', '#6B4E71']
  return (
    <Frame name="D·书架" x={0} y={5580} w={1440} h={900} bg="#191816">
      <Rectangle name="品牌印" x={32} y={16} w={32} h={32} bg={gold} rounded={6} />
      <TextImg id="t-brand-seal-n" x={32} y={21} />
      <TextImg id="t-brand-n" x={78} y={24} />
      {icon('search', 1332, 24, dim)}
      {icon('gear', 1372, 24, dim)}
      <Rectangle name="继续条" x={40} y={96} w={1360} h={96} bg={panel} rounded={10} stroke={line} strokeWidth={1} />
      <TextImg id="t-continue-label-n" x={64} y={116} />
      <Rectangle name="继续封面" x={64} y={142} w={44} h={62} bg="#002FA7" />
      <TextImg id="t-title-15n-1" x={124} y={148} />
      <TextImg id="t-meta-n-1" x={124} y={174} />
      <Rectangle name="继续按钮" x={1240} y={126} w={140} h={36} bg={gold} rounded={6} />
      <TextImg id="t-continue-btn-n" x={1262} y={134} />
      <TextImg id="t-myworks-n" x={40} y={224} />
      <TextImg id="t-count-n" x={1160} y={228} />
      <Ellipse name="夜读圆" x={1060} y={280} w={260} h={260} bg="#1E1C17" />
      <Rectangle name="夜读细线" x={840} y={620} w={560} h={1} bg={line} />
      <Rectangle name="点睛块" x={1060} y={600} w={10} h={10} bg={gold} rounded={2} />
      {coverColors.map((c, i) => <Rectangle key={'cv' + i} name={'书封-' + i} x={40 + i * 260} y={280} w={220} h={330} bg={c} />)}
      <TextImg id="t-cv-n-1" x={68} y={320} />
      <TextImg id="t-cv-n-2" x={328} y={320} />
      <TextImg id="t-cv-n-3" x={588} y={320} />
      <TextImg id="ds-cover-sub" x={68} y={356} />
      <TextImg id="ds-cover-sub" x={328} y={356} />
      <TextImg id="ds-cover-sub" x={588} y={356} />
      {coverColors.map((c, i) => <Ellipse key={'sl' + i} name={'印-' + i} x={68 + i * 260} y={530} w={48} h={48} stroke="#FBF9F3" strokeWidth={1.5} />)}
      <TextImg id="ds-seal" x={72} y={546} />
      <TextImg id="ds-seal" x={332} y={546} />
      <TextImg id="ds-seal" x={592} y={546} />
      <TextImg id="t-title-15n-1" x={44} y={624} />
      <TextImg id="t-title-15n-2" x={304} y={624} />
      <TextImg id="t-title-15n-3" x={564} y={624} />
      <TextImg id="t-meta-n-1" x={44} y={650} />
      <TextImg id="t-meta-n-2" x={304} y={650} />
      <TextImg id="t-meta-n-3" x={564} y={650} />
    </Frame>
  )
})()}
