{(() => {
  const ink = '#3C3427'
  const dim = '#8D8271'
  const border = '#E0D6BF'
  const panel = '#FAF7EC'
  const bg = '#F3EEDD'
  const P = {
    close: ['M6 6l12 12', 'M18 6L6 18'],
    note: ['M4 4h16v12l-4 4H4z', 'M16 20v-4h4', 'M8 9h8', 'M8 13h5'],
    stats: ['M5 20v-8', 'M12 20V6', 'M19 20v-5', 'M3 20h18']
  }
  const icon = (name, x, y, c, s) => (
    <svg viewBox="0 0 24 24" size={s || 16} x={x} y={y}>
      {P[name].map((d, i) => <path key={i} d={d} stroke={c} fill="none" stroke-width={1.5} />)}
    </svg>
  )
  const navIcoY = (i) => 61 + i * 54
  return (
    <Frame name="设置·关于" x={0} y={8160} w={1000} h={700} bg={bg}>
      <Rectangle name="头部" x={0} y={0} w={1000} h={44} bg={panel} />
      <Rectangle name="头部线" x={0} y={43} w={1000} h={1} bg={border} />
      <TextImg id="st-title" x={16} y={10} />
      <TextImg id="st-sub" x={74} y={15} />
      {icon('close', 952, 14, dim)}
      <Rectangle name="导航" x={0} y={44} w={198} h={656} bg={panel} />
      <Rectangle name="导航线" x={197} y={44} w={1} h={656} bg={border} />
      <Rectangle name="导航激活" x={8} y={217} w={182} h={46} bg="#E5DCC9" rounded={6} />
      {[0, 1, 2, 3].map((i) => <Rectangle key={'ib' + i} name={'图标底' + i} x={16} y={navIcoY(i)} w={26} h={26} bg={panel} rounded={6} stroke={border} strokeWidth={1} />)}
      <Rectangle name="关图标底" x={16} y={navIcoY(3)} w={26} h={26} bg="#8C6F4E" rounded={6} />
      <TextImg id="st-nav-ico-wai" x={16} y={63} />
      <TextImg id="st-nav-ico-meng" x={16} y={117} />
      <TextImg id="st-nav-ico-shu" x={16} y={171} />
      <TextImg id="st-nav-ico-guan" x={16} y={225} />
      <TextImg id="st-nav-app" x={52} y={64} />
      <TextImg id="st-nav-ai" x={52} y={118} />
      <TextImg id="st-nav-data" x={52} y={172} />
      <TextImg id="st-nav-about" x={52} y={226} />
      <TextImg id="st-nav-desc-app" x={52} y={82} />
      <TextImg id="st-nav-desc-ai" x={52} y={136} />
      <TextImg id="st-nav-desc-data" x={52} y={190} />
      <TextImg id="st-nav-desc-about" x={52} y={244} />
      <TextImg id="st-h-about" x={220} y={56} />
      <TextImg id="st-desc-about" x={220} y={86} />
      <Rectangle name="关于卡" x={220} y={114} w={764} h={104} bg={panel} rounded={8} stroke={border} strokeWidth={1} />
      <Rectangle name="条目线" x={220} y={166} w={764} h={1} bg={border} />
      {icon('stats', 238, 130, dim)}
      <TextImg id="st-a-stats" x={268} y={124} />
      <TextImg id="st-a-stats-sub" x={268} y={142} />
      {icon('note', 238, 182, dim)}
      <TextImg id="st-a-help" x={268} y={176} />
      <TextImg id="st-a-help-sub" x={268} y={194} />
      <TextImg id="st-a-foot" x={220} y={246} />
    </Frame>
  )
})()}
