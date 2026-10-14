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
  const coverColors = ['#002FA7', '#33554A', '#6B4E71', '#8C3B2E', '#1E1E1E', '#4A5A78']
  const progress = [0.62, 0.44, 0.3, 0.8, 0.35, 0.14]
  return (
    <Frame name="C·书架" x={0} y={4520} w={1440} h={900} bg="#F3EEDD">
      <Rectangle name="品牌印" x={32} y={16} w={32} h={32} bg="#002FA7" rounded={6} />
      <TextImg id="t-brand-seal" x={32} y={21} />
      <TextImg id="t-brand" x={78} y={24} />
      <Rectangle name="搜索框" x={220} y={16} w={320} h={34} bg="#FAF7EC" rounded={8} stroke="#E0D6BF" strokeWidth={1} />
      {icon('search', 236, 25, dim)}
      <TextImg id="ds-font-ui-placeholder" x={260} y={23} />
      {icon('gear', 1256, 25, dim)}
      <Rectangle name="新建按钮" x={1292} y={16} w={108} h={34} bg="#8C6F4E" rounded={6} />
      <TextImg id="ds-btn-primary" x={1298} y={23} />
      <Rectangle name="筛选全部" x={40} y={72} w={64} h={26} bg="#8C6F4E" rounded={13} />
      <TextImg id="t-c-filter-all" x={48} y={77} />
      <Rectangle name="筛选连载" x={112} y={72} w={72} h={26} bg="#FAF7EC" rounded={13} stroke="#E0D6BF" strokeWidth={1} />
      <TextImg id="t-c-filter-ing" x={114} y={77} />
      <Rectangle name="筛选完结" x={192} y={72} w={72} h={26} bg="#FAF7EC" rounded={13} stroke="#E0D6BF" strokeWidth={1} />
      <TextImg id="t-c-filter-done" x={194} y={77} />
      <TextImg id="t-c-count" x={1160} y={77} />
      <Rectangle name="表头分界" x={40} y={120} w={1360} h={1} bg="#E0D6BF" />
      <TextImg id="t-c-head-work" x={108} y={132} />
      <TextImg id="t-c-head-ch" x={700} y={132} />
      <TextImg id="t-c-head-words" x={820} y={132} />
      <TextImg id="t-c-head-time" x={960} y={132} />
      <TextImg id="t-c-head-op" x={1330} y={132} />
      <Text size={13} color="#B3A892" x={48} y={196}>01</Text>
      <Text size={13} color="#B3A892" x={48} y={296}>02</Text>
      <Text size={13} color="#B3A892" x={48} y={396}>03</Text>
      <Text size={13} color="#B3A892" x={48} y={496}>04</Text>
      <Text size={13} color="#B3A892" x={48} y={596}>05</Text>
      <Text size={13} color="#B3A892" x={48} y={696}>06</Text>
      {coverColors.map((c, i) => <Rectangle key={'mc' + i} name={'迷你封-' + i} x={80} y={164 + i * 100} w={56} h={84} bg={c} />)}
      {[0, 1, 2, 3, 4].map((i) => <Rectangle key={'dv' + i} name={'行分界-' + i} x={40} y={256 + i * 100} w={1360} h={1} bg="#EDE4CE" />)}
      {progress.map((p, i) => <Rectangle key={'pb' + i} name={'进度底-' + i} x={152} y={208 + i * 100} w={300} h={4} bg="#EDE4CE" rounded={2} />)}
      {progress.map((p, i) => <Rectangle key={'pf' + i} name={'进度-' + i} x={152} y={208 + i * 100} w={300 * p} h={4} bg="#8C6F4E" rounded={2} />)}
      <TextImg id="t-title-15-1" x={152} y={178} />
      <TextImg id="t-title-15-2" x={152} y={278} />
      <TextImg id="t-title-15-3" x={152} y={378} />
      <TextImg id="t-title-15-4" x={152} y={478} />
      <TextImg id="t-title-15-5" x={152} y={578} />
      <TextImg id="t-title-15-6" x={152} y={678} />
      <TextImg id="t-c-ch-1" x={700} y={178} />
      <TextImg id="t-c-ch-2" x={700} y={278} />
      <TextImg id="t-c-ch-3" x={700} y={378} />
      <TextImg id="t-c-ch-4" x={700} y={478} />
      <TextImg id="t-c-ch-5" x={700} y={578} />
      <TextImg id="t-c-ch-6" x={700} y={678} />
      <TextImg id="t-c-words-1" x={820} y={178} />
      <TextImg id="t-c-words-2" x={820} y={278} />
      <TextImg id="t-c-words-3" x={820} y={378} />
      <TextImg id="t-c-words-4" x={820} y={478} />
      <TextImg id="t-c-words-5" x={820} y={578} />
      <TextImg id="t-c-words-6" x={820} y={678} />
      <TextImg id="t-c-time-1" x={960} y={178} />
      <TextImg id="t-c-time-2" x={960} y={278} />
      <TextImg id="t-c-time-3" x={960} y={378} />
      <TextImg id="t-c-time-4" x={960} y={478} />
      <TextImg id="t-c-time-5" x={960} y={578} />
      <TextImg id="t-c-time-6" x={960} y={678} />
      <Text size={13} color={dim} x={1338} y={196}>···</Text>
      <Text size={13} color={dim} x={1338} y={296}>···</Text>
      <Text size={13} color={dim} x={1338} y={396}>···</Text>
      <Text size={13} color={dim} x={1338} y={496}>···</Text>
      <Text size={13} color={dim} x={1338} y={596}>···</Text>
      <Text size={13} color={dim} x={1338} y={696}>···</Text>
    </Frame>
  )
})()}
