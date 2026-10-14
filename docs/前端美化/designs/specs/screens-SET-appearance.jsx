{(() => {
  const ink = '#3C3427'
  const dim = '#8D8271'
  const border = '#E0D6BF'
  const panel = '#FAF7EC'
  const bg = '#F3EEDD'
  const P = {
    close: ['M6 6l12 12', 'M18 6L6 18'],
    caret: ['M6 9l6 6 6-6']
  }
  const icon = (name, x, y, c, s) => (
    <svg viewBox="0 0 24 24" size={s || 16} x={x} y={y}>
      {P[name].map((d, i) => <path key={i} d={d} stroke={c} fill="none" stroke-width={1.5} />)}
    </svg>
  )
  const navIcoY = (i) => 61 + i * 54
  return (
    <Frame name="设置·外观" x={0} y={6680} w={1000} h={700} bg={bg}>
      <Rectangle name="头部" x={0} y={0} w={1000} h={44} bg={panel} />
      <Rectangle name="头部线" x={0} y={43} w={1000} h={1} bg={border} />
      <TextImg id="st-title" x={16} y={10} />
      <TextImg id="st-sub" x={74} y={15} />
      {icon('close', 952, 14, dim)}
      <Rectangle name="导航" x={0} y={44} w={198} h={656} bg={panel} />
      <Rectangle name="导航线" x={197} y={44} w={1} h={656} bg={border} />
      <Rectangle name="导航激活" x={8} y={55} w={182} h={46} bg="#E5DCC9" rounded={6} />
      <Rectangle name="外观图标底" x={16} y={61} w={26} h={26} bg="#8C6F4E" rounded={6} />
      {[1, 2, 3].map((i) => <Rectangle key={'ib' + i} name={'图标底' + i} x={16} y={navIcoY(i)} w={26} h={26} bg={panel} rounded={6} stroke={border} strokeWidth={1} />)}
      <TextImg id="st-nav-ico-wai-on" x={16} y={63} />
      <TextImg id="st-nav-ico-meng" x={16} y={117} />
      <TextImg id="st-nav-ico-shu" x={16} y={171} />
      <TextImg id="st-nav-ico-guan" x={16} y={225} />
      <TextImg id="st-nav-app-on" x={52} y={64} />
      <TextImg id="st-nav-ai" x={52} y={118} />
      <TextImg id="st-nav-data" x={52} y={172} />
      <TextImg id="st-nav-about" x={52} y={226} />
      <TextImg id="st-nav-desc-app" x={52} y={82} />
      <TextImg id="st-nav-desc-ai" x={52} y={136} />
      <TextImg id="st-nav-desc-data" x={52} y={190} />
      <TextImg id="st-nav-desc-about" x={52} y={244} />
      <TextImg id="st-h-app" x={220} y={60} />
      <TextImg id="st-desc-app" x={220} y={90} />
      <Rectangle name="设置卡" x={220} y={120} w={764} h={216} bg={panel} rounded={8} stroke={border} strokeWidth={1} />
      <Rectangle name="行线1" x={220} y={174} w={764} h={1} bg={border} />
      <Rectangle name="行线2" x={220} y={228} w={764} h={1} bg={border} />
      <Rectangle name="行线3" x={220} y={282} w={764} h={1} bg={border} />
      <TextImg id="st-r-theme" x={238} y={132} />
      <TextImg id="st-r-theme-sub" x={238} y={150} />
      <Rectangle name="主题宣纸" x={742} y={135} w={60} h={24} bg="#8C6F4E" rounded={4} />
      <Rectangle name="主题羊皮" x={808} y={135} w={72} h={24} bg={panel} rounded={4} stroke={border} strokeWidth={1} />
      <Rectangle name="主题暗夜" x={886} y={135} w={84} h={24} bg={panel} rounded={4} stroke={border} strokeWidth={1} />
      <TextImg id="st-chip-xuan" x={742} y={138} />
      <TextImg id="st-chip-par" x={808} y={138} />
      <TextImg id="st-chip-night" x={886} y={138} />
      <TextImg id="st-r-cjk" x={238} y={186} />
      <TextImg id="st-r-cjk-sub" x={238} y={204} />
      <Rectangle name="中文字体选择" x={778} y={185} w={192} h={28} bg={panel} rounded={6} stroke={border} strokeWidth={1} />
      <TextImg id="st-sel-cjk" x={792} y={189} />
      {icon('caret', 944, 191, dim, 14)}
      <TextImg id="st-r-latin" x={238} y={240} />
      <TextImg id="st-r-latin-sub" x={238} y={258} />
      <Rectangle name="西文字体选择" x={778} y={239} w={192} h={28} bg={panel} rounded={6} stroke={border} strokeWidth={1} />
      <TextImg id="st-sel-latin" x={792} y={243} />
      {icon('caret', 944, 245, dim, 14)}
      <TextImg id="st-r-fs" x={238} y={294} />
      <TextImg id="st-r-fs-sub" x={238} y={312} />
      <Rectangle name="字号减" x={814} y={293} w={44} h={28} bg={panel} rounded={6} stroke={border} strokeWidth={1} />
      <TextImg id="st-fs-minus" x={814} y={297} />
      <TextImg id="st-fs-cur" x={864} y={296} />
      <Rectangle name="字号加" x={926} y={293} w={44} h={28} bg={panel} rounded={6} stroke={border} strokeWidth={1} />
      <TextImg id="st-fs-plus" x={926} y={297} />
      <Rectangle name="预览卡" x={220} y={352} w={764} h={206} bg={panel} rounded={8} stroke={border} strokeWidth={1} />
      <TextImg id="st-prev-body" x={238} y={368} />
      <TextImg id="ds-font-body-sample" x={238} y={390} />
      <TextImg id="st-prev-note" x={238} y={470} />
      <Rectangle name="预览分界" x={566} y={364} w={1} h={182} bg={border} />
      <TextImg id="st-prev-cover" x={586} y={368} />
      <Rectangle name="迷你封面" x={586} y={390} w={104} h={156} bg="#002FA7" />
      <TextImg id="st-cv-mini" x={598} y={412} />
      <TextImg id="ds-cover-sub" x={602} y={440} />
      <Ellipse name="迷你印" x={602} y={494} w={36} h={36} stroke="#FBF9F3" strokeWidth={1.2} />
      <TextImg id="ds-seal" x={600} y={503} />
    </Frame>
  )
})()}
