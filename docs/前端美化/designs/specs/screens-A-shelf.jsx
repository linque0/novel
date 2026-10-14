{(() => {
  const ink = '#5B5142'
  const dim = '#8D8271'
  const icon = (d, x, y, c, s) => <svg viewBox="0 0 24 24" size={s || 16} x={x} y={y}><path d={d} stroke={c} fill="none" stroke-width={1.5} /></svg>
  const gearD = 'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'
  const searchD = 'M18 11a7 7 0 1 0-14 0a7 7 0 1 0 14 0'
  const coverColors = ['#002FA7', '#33554A', '#6B4E71', '#8C3B2E', '#1E1E1E', '#4A5A78']
  return (
    <Frame name="A·书架" x={0} y={2400} w={1440} h={900} bg="#F3EEDD">
      <Rectangle name="品牌印" x={32} y={16} w={32} h={32} bg="#002FA7" rounded={6} />
      <TextImg id="t-brand-seal" x={32} y={21} />
      <TextImg id="t-brand" x={78} y={24} />
      <Rectangle name="搜索框" x={220} y={16} w={360} h={34} bg="#FAF7EC" rounded={8} stroke="#E0D6BF" strokeWidth={1} />
      {icon(searchD, 236, 25, dim)}
      <TextImg id="ds-font-ui-placeholder" x={260} y={23} />
      {icon(gearD, 1248, 25, dim)}
      <Rectangle name="新建按钮" x={1292} y={16} w={108} h={34} bg="#8C6F4E" rounded={6} />
      <TextImg id="ds-btn-primary" x={1298} y={23} />
      <Rectangle name="继续条" x={40} y={96} w={1360} h={96} bg="#FAF7EC" rounded={10} stroke="#E0D6BF" strokeWidth={1} />
      <TextImg id="t-continue-label" x={64} y={116} />
      <Rectangle name="继续封面" x={64} y={142} w={44} h={62} bg="#002FA7" />
      <TextImg id="t-title-15-1" x={124} y={148} />
      <TextImg id="t-continue-meta" x={124} y={174} />
      <Rectangle name="继续按钮" x={1240} y={126} w={140} h={36} bg="#8C6F4E" rounded={6} />
      <TextImg id="t-continue-btn" x={1262} y={134} />
      <TextImg id="t-myworks" x={40} y={224} />
      <TextImg id="t-count" x={1160} y={228} />
      {coverColors.map((c, i) => <Rectangle key={'cv' + i} name={'书封-' + i} x={40 + i * 240} y={280} w={160} h={240} bg={c} />)}
      <Rectangle name="封面悬停菜单" x={160} y={288} w={32} h={24} bg="#FAF7EC" rounded={6} stroke="#E0D6BF" strokeWidth={1} />
      <Text x={171} y={292} size={12} color={ink}>···</Text>
      <TextImg id="t-cv-1" x={56} y={304} />
      <TextImg id="t-cv-2" x={296} y={304} />
      <TextImg id="t-cv-3" x={536} y={304} />
      <TextImg id="t-cv-4" x={776} y={304} />
      <TextImg id="t-cv-5" x={1016} y={304} />
      <TextImg id="t-cv-6" x={1256} y={304} />
      <TextImg id="ds-cover-sub" x={56} y={336} />
      <TextImg id="ds-cover-sub" x={296} y={336} />
      <TextImg id="ds-cover-sub" x={536} y={336} />
      <TextImg id="ds-cover-sub" x={776} y={336} />
      <TextImg id="ds-cover-sub" x={1016} y={336} />
      <TextImg id="ds-cover-sub" x={1256} y={336} />
      {coverColors.map((c, i) => <Ellipse key={'sl' + i} name={'印-' + i} x={56 + i * 240} y={460} w={40} h={40} stroke="#FBF9F3" strokeWidth={1.5} />)}
      <TextImg id="ds-seal" x={58} y={471} />
      <TextImg id="ds-seal" x={298} y={471} />
      <TextImg id="ds-seal" x={538} y={471} />
      <TextImg id="ds-seal" x={778} y={471} />
      <TextImg id="ds-seal" x={1018} y={471} />
      <TextImg id="ds-seal" x={1258} y={471} />
      <TextImg id="t-title-15-1" x={42} y={532} />
      <TextImg id="t-title-15-2" x={282} y={532} />
      <TextImg id="t-title-15-3" x={522} y={532} />
      <TextImg id="t-title-15-4" x={762} y={532} />
      <TextImg id="t-title-15-5" x={1002} y={532} />
      <TextImg id="t-title-15-6" x={1242} y={532} />
      <TextImg id="t-meta-1" x={42} y={558} />
      <TextImg id="t-meta-2" x={282} y={558} />
      <TextImg id="t-meta-3" x={522} y={558} />
      <TextImg id="t-meta-4" x={762} y={558} />
      <TextImg id="t-meta-5" x={1002} y={558} />
      <TextImg id="t-meta-6" x={1242} y={558} />
    </Frame>
  )
})()}
