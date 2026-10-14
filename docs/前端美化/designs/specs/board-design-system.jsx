<Frame name="设计系统总览" x={0} y={0} w={1240} h={2200} bg="#F3EEDD">
  <TextImg id="ds-board-title" x={40} y={36} />
  <TextImg id="ds-board-sub" x={40} y={86} />
  <TextImg id="ds-sec-tokens" x={40} y={140} />

  {[
    { head: 'ds-theme-head-xuan', x: 40, bg: '#F3EEDD', stroke: '#E0D6BF', dim: '#8D8271', rows: [['--bg', '#F3EEDD'], ['--bg-panel', '#FAF7EC'], ['--bg-editor', '#FCFAF2'], ['--bg-hover', '#EFE8D2'], ['--text', '#3C3427'], ['--text-dim', '#8D8271'], ['--text-faint', '#B3A892'], ['--card-ink', '#5B5142'], ['--border', '#E0D6BF'], ['--border-strong', '#D0C4A6'], ['--accent', '#8C6F4E'], ['--accent-soft', '#E5DCC9'], ['--accent-deep', '#6E5537'], ['--danger', '#B03A2E'], ['--danger-soft', '#ECDCCC'], ['--success', '#1E8449'], ['--warning', '#B9770E'], ['--text-dim-cand', '#766C5B']] },
    { head: 'ds-theme-head-parchment', x: 428, bg: '#F4EAD2', stroke: '#D6C5A0', dim: '#94826A', rows: [['--bg', '#EADFC4'], ['--bg-panel', '#F4EAD2'], ['--bg-editor', '#F8F0DA'], ['--bg-hover', '#E3D5B4'], ['--text', '#46372A'], ['--text-dim', '#94826A'], ['--text-faint', '#B5A68C'], ['--card-ink', '#6B5238'], ['--border', '#D6C5A0'], ['--border-strong', '#C4B088'], ['--accent', '#A0642F'], ['--accent-soft', '#E0CEAF'], ['--accent-deep', '#7D4C22'], ['--danger', '#A93226'], ['--danger-soft', '#E4CEB4'], ['--success', '#196F3D'], ['--warning', '#A5690D'], ['--text-dim-cand', '#77654D']] },
    { head: 'ds-theme-head-night', x: 816, bg: '#191816', stroke: '#3A352A', dim: '#8F8878', rows: [['--bg', '#191816'], ['--bg-panel', '#232019'], ['--bg-editor', '#1E1C17'], ['--bg-hover', '#2E2A20'], ['--text', '#D9D2C0'], ['--text-dim', '#8F8878'], ['--text-faint', '#5C564A'], ['--card-ink', '#D4A95C'], ['--border', '#3A352A'], ['--border-strong', '#4A4436'], ['--accent', '#D4A95C'], ['--accent-soft', '#372F21'], ['--accent-deep', '#B8893F'], ['--danger', '#E74C3C'], ['--danger-soft', '#361F1B'], ['--success', '#2ECC71'], ['--warning', '#E67E22'], ['--text-dim-cand', '#8F8878']] }
  ].map((t) => (
    <Frame name={'主题卡-' + t.head} x={t.x} y={180} w={364} h={530} bg={t.bg} rounded={10} stroke={t.stroke} strokeWidth={1}>
      {t.rows.map(([name, hex], i) => <Rectangle key={'sw' + i} name={t.head + '-' + name} x={16} y={52 + i * 25} w={18} h={18} bg={hex} rounded={4} stroke={'#00000022'} strokeWidth={1} />)}
      {t.rows.map(([name, hex], i) => <Text key={'tx' + i} x={44} y={54 + i * 25} size={11} color={t.dim}>{name + '  ' + hex}</Text>)}
    </Frame>
  ))}
  <TextImg id="ds-theme-head-xuan" x={56} y={196} />
  <TextImg id="ds-theme-head-parchment" x={444} y={196} />
  <TextImg id="ds-theme-head-night" x={832} y={196} />
  <TextImg id="ds-cand-note" x={40} y={724} />

  <TextImg id="ds-sec-fonts" x={40} y={792} />
  <Frame name="字体角色卡" x={40} y={828} w={1160} h={330} bg="#FAF7EC" rounded={10} stroke="#E0D6BF" strokeWidth={1}>
    <Text x={24} y={20} w={110} size={12} color="#5B5142">--font-ui</Text>
    <Text x={144} y={21} w={310} size={11} color="#8D8271">Microsoft YaHei · 13-14px · 400/500/600</Text>
    <TextImg id="ds-font-ui-sample" x={470} y={16} />
    <TextImg id="ds-font-ui-placeholder" x={746} y={18} />
    <Text x={24} y={86} w={110} size={12} color="#5B5142">--font-title</Text>
    <Text x={144} y={87} w={310} size={11} color="#8D8271">Noto Serif SC · 页面 24-28 / 章节 22-24 · 600</Text>
    <TextImg id="ds-font-title-sample" x={470} y={80} />
    <Text x={24} y={152} w={110} size={12} color="#5B5142">--font-cover</Text>
    <Text x={144} y={153} w={310} size={11} color="#8D8271">模板决定；打包前核对资产（OFL 子集）</Text>
    <Rectangle x={464} y={146} w={220} h={54} bg="#002FA7" rounded={6} />
    <TextImg id="ds-font-cover-sample" x={474} y={152} />
    <Text x={24} y={218} w={110} size={12} color="#5B5142">--font-body</Text>
    <Text x={144} y={219} w={310} size={11} color="#8D8271">跟随用户设置（默认思源宋体）· 17px / 1.9</Text>
    <TextImg id="ds-font-body-sample" x={470} y={214} />
    <TextImg id="ds-fonts-note" x={24} y={292} />
  </Frame>

  <TextImg id="ds-sec-invariants" x={40} y={1188} />
  <Frame name="不变量卡" x={40} y={1224} w={1160} h={340} bg="#FAF7EC" rounded={10} stroke="#E0D6BF" strokeWidth={1}>
    <Text x={24} y={24} w={90} size={12} color="#5B5142">--radius</Text>
    {[[6, 'sm'], [8, 'card'], [10, 'md'], [14, 'lg']].map(([v, nm], i) => <Rectangle key={'rd' + i} x={120 + i * 84} y={20} w={56} h={56} bg="#E5DCC9" rounded={v} stroke="#8C6F4E" strokeWidth={1} />)}
    {[[6, 'sm'], [8, 'card'], [10, 'md'], [14, 'lg']].map(([v, nm], i) => <Text key={'rt' + i} x={120 + i * 84} y={84} w={70} size={10} color="#8D8271">{nm + ' · ' + v + 'px'}</Text>)}
    <TextImg id="ds-radius-note" x={480} y={40} />
    <Text x={24} y={130} w={90} size={12} color="#5B5142">--space</Text>
    {[4, 8, 12, 16, 24, 32].map((v, i) => <Text key={'st' + i} x={120} y={134 + i * 24} w={110} size={11} color="#8D8271">{'--space-' + (i + 1) + ' · ' + v + 'px'}</Text>)}
    {[4, 8, 12, 16, 24, 32].map((v, i) => <Rectangle key={'sb' + i} x={240} y={132 + i * 24} w={v * 3} h={12} bg="#8C6F4E" rounded={3} />)}
    <Text x={620} y={130} w={60} size={12} color="#5B5142">--fs</Text>
    <Text x={620} y={136} w={80} size={11} color="#8D8271">--fs-xs</Text>
    <Text x={620} y={166} w={80} size={11} color="#8D8271">--fs-sm</Text>
    <Text x={620} y={196} w={80} size={11} color="#8D8271">--fs-md</Text>
    <Text x={620} y={226} w={80} size={11} color="#8D8271">--fs-lg</Text>
    <Text x={620} y={256} w={80} size={11} color="#8D8271">--fs-title</Text>
    <TextImg id="ds-fs-xs" x={710} y={128} />
    <TextImg id="ds-fs-sm" x={710} y={158} />
    <TextImg id="ds-fs-md" x={710} y={188} />
    <TextImg id="ds-fs-lg" x={710} y={218} />
    <TextImg id="ds-fs-title" x={710} y={248} />
    <Text x={24} y={290} w={90} size={12} color="#5B5142">--dur / --ease</Text>
    <Text x={120} y={292} w={560} size={11} color="#8D8271">--dur-fast 120ms · --dur 180ms · --dur-slow 250ms · --ease cubic-bezier(0.2, 0.6, 0.3, 1)</Text>
    <TextImg id="ds-motion-note" x={24} y={314} />
  </Frame>

  <TextImg id="ds-sec-components" x={40} y={1594} />
  <Frame name="按钮卡" x={40} y={1630} w={1160} h={120} bg="#FAF7EC" rounded={10} stroke="#E0D6BF" strokeWidth={1}>
    <Rectangle x={24} y={24} w={108} h={32} bg="#8C6F4E" rounded={6} />
    <Rectangle x={174} y={24} w={108} h={32} bg="#6E5537" rounded={6} />
    <Rectangle x={324} y={24} w={108} h={32} bg="#FAF7EC" rounded={6} stroke="#E0D6BF" strokeWidth={1} />
    <Rectangle x={474} y={24} w={108} h={32} bg="#EFE8D2" rounded={6} stroke="#8C6F4E" strokeWidth={2} />
    <Rectangle x={624} y={24} w={108} h={32} bg="#F3EEDD" rounded={6} />
    <Rectangle x={774} y={24} w={108} h={32} bg="#EFE8D2" rounded={6} />
    <TextImg id="ds-btn-primary" x={30} y={30} />
    <TextImg id="ds-btn-primary" x={180} y={30} />
    <TextImg id="ds-btn-secondary" x={330} y={30} />
    <TextImg id="ds-btn-secondary" x={480} y={30} />
    <TextImg id="ds-btn-ghost" x={630} y={30} />
    <TextImg id="ds-btn-disabled" x={780} y={30} />
    <Text x={44} y={70} w={100} size={10} color="#8D8271">primary</Text>
    <Text x={194} y={70} w={100} size={10} color="#8D8271">hover</Text>
    <Text x={336} y={70} w={100} size={10} color="#8D8271">secondary</Text>
    <Text x={488} y={70} w={100} size={10} color="#8D8271">focus</Text>
    <Text x={641} y={70} w={100} size={10} color="#8D8271">ghost</Text>
    <Text x={786} y={70} w={100} size={10} color="#8D8271">disabled</Text>
  </Frame>

  <Frame name="标签卡" x={40} y={1772} w={1160} h={104} bg="#FAF7EC" rounded={10} stroke="#E0D6BF" strokeWidth={1}>
    {['#C0392B', '#8E44AD', '#D35400', '#2980B9'].map((bg, i) => <Rectangle key={'pf' + i} x={24 + i * 88} y={24} w={64} h={24} bg={bg} rounded={12} />)}
    {[0, 1, 2].map((i) => <Rectangle key={'ps' + i} x={376 + i * 88} y={24} w={64} h={24} bg="#F3EEDD" rounded={12} stroke="#E0D6BF" strokeWidth={1} />)}
    <TextImg id="ds-tag-cause" x={24} y={27} />
    <TextImg id="ds-tag-foreshadow" x={112} y={27} />
    <TextImg id="ds-tag-conflict" x={200} y={27} />
    <TextImg id="ds-tag-rel" x={288} y={27} />
    <TextImg id="ds-tag-draft" x={376} y={27} />
    <TextImg id="ds-tag-done" x={464} y={27} />
    <TextImg id="ds-tag-revise" x={552} y={27} />
    <TextImg id="ds-tags-note" x={664} y={26} />
  </Frame>

  <Frame name="轨道卡" x={40} y={1896} w={64} h={240} bg="#FAF7EC" rounded={10} stroke="#E0D6BF" strokeWidth={1}>
    <Rectangle x={8} y={24} w={3} h={22} bg="#8C6F4E" rounded={2} />
    <TextImg id="ds-rail-wen-on" x={16} y={24} />
    <TextImg id="ds-rail-gang" x={16} y={62} />
    <TextImg id="ds-rail-ren" x={16} y={100} />
    <TextImg id="ds-rail-she" x={16} y={138} />
    <TextImg id="ds-rail-ling" x={16} y={176} />
  </Frame>
  <Frame name="空状态卡" x={128} y={1896} w={368} h={240} bg="#FAF7EC" rounded={10} stroke="#E0D6BF" strokeWidth={1}>
    <TextImg id="ds-empty-title" x={24} y={28} />
    <TextImg id="ds-empty-desc" x={24} y={66} />
    <Rectangle x={24} y={110} w={108} h={32} bg="#8C6F4E" rounded={6} />
    <TextImg id="ds-btn-primary" x={30} y={116} />
  </Frame>
  <Rectangle x={536} y={1896} w={150} h={225} bg="#002FA7" />
  <TextImg id="ds-cover-title-1" x={556} y={1940} />
  <TextImg id="ds-cover-sub" x={556} y={1974} />
  <Ellipse x={556} y={2040} w={44} h={44} stroke="#FBF9F3" strokeWidth={1.5} />
  <TextImg id="ds-seal" x={558} y={2053} />
  <Rectangle x={710} y={1896} w={150} h={225} bg="#33554A" />
  <TextImg id="ds-cover-title-2" x={730} y={1940} />
  <TextImg id="ds-cover-sub" x={730} y={1974} />
  <Ellipse x={730} y={2040} w={44} h={44} stroke="#FBF9F3" strokeWidth={1.5} />
  <TextImg id="ds-seal" x={732} y={2053} />
  <Rectangle x={884} y={1896} w={150} h={225} bg="#6B4E71" />
  <TextImg id="ds-cover-title-3" x={904} y={1940} />
  <TextImg id="ds-cover-sub" x={904} y={1974} />
  <Ellipse x={904} y={2040} w={44} h={44} stroke="#FBF9F3" strokeWidth={1.5} />
  <TextImg id="ds-seal" x={906} y={2053} />
  <TextImg id="ds-cover-note" x={536} y={2148} />
</Frame>
