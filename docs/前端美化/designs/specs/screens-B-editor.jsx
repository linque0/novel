{(() => {
  const ink = '#5B5142'
  const dim = '#8D8271'
  const gearD = 'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'
  const P = {
    back: ['M19 12H5', 'M12 19l-7-7 7-7'],
    caretR: ['M9 6l6 6-6 6'],
    search: ['M18 11a7 7 0 1 0-14 0a7 7 0 1 0 14 0', 'M21 21l-4.3-4.3'],
    gear: [gearD, 'M15 12a3 3 0 1 0-6 0a3 3 0 1 0 6 0'],
    check: ['M20 6L9 17l-5-5']
  }
  const icon = (name, x, y, c, s) => (
    <svg viewBox="0 0 24 24" size={s || 16} x={x} y={y}>
      {P[name].map((d, i) => <path key={i} d={d} stroke={c} fill="none" stroke-width={1.5} />)}
    </svg>
  )
  return (
    <Frame name="B·正文" x={1520} y={3460} w={1440} h={900} bg="#F3EEDD">
      <Rectangle name="目录条" x={0} y={0} w={28} h={900} bg="#F3EEDD" />
      <Rectangle name="目录分界" x={27} y={0} w={1} h={900} bg="#E0D6BF" />
      {icon('caretR', 7, 440, dim, 14)}
      {icon('back', 48, 14, ink)}
      <TextImg id="t-top-chap" x={80} y={11} />
      {icon('check', 1156, 12, '#1E8449')}
      <TextImg id="ds-saved" x={1178} y={11} />
      {icon('search', 1332, 14, dim)}
      {icon('gear', 1372, 14, dim)}
      <Text size={96} color="#D0C4A6" x={300} y={110}>03</Text>
      <TextImg id="t-ed-title-b" x={300} y={236} />
      <Rectangle name="标题下划" x={300} y={296} w={80} h={2} bg="#8C6F4E" />
      <TextImg id="t-p1b" x={300} y={340} />
      <TextImg id="t-p2b" x={300} y={485} />
      {[0, 1, 2].map((i) => <Rectangle key={'d' + i} name={'装饰点-' + i} x={300 + i * 14} y={646} w={4} h={4} bg="#D0C4A6" rounded={2} />)}
      <TextImg id="t-words" x={1332} y={842} />
    </Frame>
  )
})()}
