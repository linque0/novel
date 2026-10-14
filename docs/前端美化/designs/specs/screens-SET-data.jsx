{(() => {
  const ink = '#3C3427'
  const dim = '#8D8271'
  const border = '#E0D6BF'
  const panel = '#FAF7EC'
  const bg = '#F3EEDD'
  const P = {
    close: ['M6 6l12 12', 'M18 6L6 18'],
    download: ['M12 3v12', 'M7 10l5 5 5-5', 'M4 21h16'],
    upload: ['M12 15V3', 'M7 8l5-5 5 5', 'M4 21h16'],
    trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13', 'M10 11v6', 'M14 11v6'],
    folder: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
    external: ['M14 4h6v6', 'M20 4l-9 9', 'M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6']
  }
  const icon = (name, x, y, c, s) => (
    <svg viewBox="0 0 24 24" size={s || 16} x={x} y={y}>
      {P[name].map((d, i) => <path key={i} d={d} stroke={c} fill="none" stroke-width={1.5} />)}
    </svg>
  )
  const navIcoY = (i) => 61 + i * 54
  return (
    <Frame name="设置·数据" x={1040} y={7420} w={1000} h={700} bg={bg}>
      <Rectangle name="头部" x={0} y={0} w={1000} h={44} bg={panel} />
      <Rectangle name="头部线" x={0} y={43} w={1000} h={1} bg={border} />
      <TextImg id="st-title" x={16} y={10} />
      <TextImg id="st-sub" x={74} y={15} />
      {icon('close', 952, 14, dim)}
      <Rectangle name="导航" x={0} y={44} w={198} h={656} bg={panel} />
      <Rectangle name="导航线" x={197} y={44} w={1} h={656} bg={border} />
      <Rectangle name="导航激活" x={8} y={163} w={182} h={46} bg="#E5DCC9" rounded={6} />
      {[0, 1, 2, 3].map((i) => <Rectangle key={'ib' + i} name={'图标底' + i} x={16} y={navIcoY(i)} w={26} h={26} bg={panel} rounded={6} stroke={border} strokeWidth={1} />)}
      <Rectangle name="数图标底" x={16} y={navIcoY(2)} w={26} h={26} bg="#8C6F4E" rounded={6} />
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
      <TextImg id="st-h-data" x={220} y={56} />
      <TextImg id="st-desc-data" x={220} y={86} />
      <Rectangle name="条目卡" x={220} y={114} w={764} h={260} bg={panel} rounded={8} stroke={border} strokeWidth={1} />
      {[1, 2, 3, 4].map((i) => <Rectangle key={'sl' + i} name={'条目线' + i} x={220} y={114 + i * 52} w={764} h={1} bg={border} />)}
      {icon('download', 238, 130, dim)}
      <TextImg id="st-d-import" x={268} y={124} />
      <TextImg id="st-d-import-sub" x={268} y={142} />
      {icon('download', 238, 182, dim)}
      <TextImg id="st-d-export" x={268} y={176} />
      <TextImg id="st-d-export-sub" x={268} y={194} />
      {icon('download', 238, 234, dim)}
      <TextImg id="st-d-backup" x={268} y={228} />
      <TextImg id="st-d-backup-sub" x={268} y={246} />
      {icon('upload', 238, 286, dim)}
      <TextImg id="st-d-restore" x={268} y={280} />
      <TextImg id="st-d-restore-sub" x={268} y={298} />
      {icon('trash', 238, 338, dim)}
      <TextImg id="st-d-trash" x={268} y={332} />
      <TextImg id="st-d-trash-sub" x={268} y={350} />
      <TextImg id="st-d-loc-h" x={220} y={390} />
      <Rectangle name="存储卡" x={220} y={418} w={764} h={268} bg={panel} rounded={8} stroke={border} strokeWidth={1} />
      <TextImg id="st-d-cur" x={238} y={432} />
      <TextImg id="st-d-cur-path" x={238} y={450} />
      <Rectangle name="默认签" x={908} y={434} w={44} h={18} bg="#F3EEDD" rounded={4} />
      <TextImg id="st-d-tag" x={910} y={435} />
      {icon('folder', 238, 484, dim)}
      <TextImg id="st-d-move" x={268} y={478} />
      <TextImg id="st-d-move-sub" x={268} y={496} />
      <TextImg id="st-d-old" x={268} y={530} />
      <TextImg id="st-d-old-sub" x={268} y={548} />
      <Rectangle name="打开钮" x={786} y={528} w={40} h={24} bg={panel} rounded={6} stroke={border} strokeWidth={1} />
      <TextImg id="st-d-b-open" x={786} y={532} />
      <Rectangle name="清理钮" x={832} y={528} w={64} h={24} bg={panel} rounded={6} stroke={border} strokeWidth={1} />
      <TextImg id="st-d-b-clean" x={832} y={532} />
      <Rectangle name="删除钮" x={902} y={528} w={64} h={24} bg={panel} rounded={6} stroke={border} strokeWidth={1} />
      <TextImg id="st-d-b-del" x={902} y={532} />
      <Rectangle name="警示条" x={236} y={582} w={726} h={50} bg="#F6ECD2" rounded={4} />
      <TextImg id="st-d-warn" x={248} y={588} />
      {icon('external', 238, 648, dim)}
      <TextImg id="st-d-open" x={268} y={642} />
      <TextImg id="st-d-open-sub" x={268} y={659} />
    </Frame>
  )
})()}
