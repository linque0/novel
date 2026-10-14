{(() => {
  const ink = '#3C3427'
  const dim = '#8D8271'
  const border = '#E0D6BF'
  const panel = '#FAF7EC'
  const bg = '#F3EEDD'
  const P = {
    close: ['M6 6l12 12', 'M18 6L6 18'],
    caret: ['M6 9l6 6 6-6'],
    edit: ['M17 3l4 4L7 21H3v-4z', 'M14 6l4 4']
  }
  const icon = (name, x, y, c, s) => (
    <svg viewBox="0 0 24 24" size={s || 16} x={x} y={y}>
      {P[name].map((d, i) => <path key={i} d={d} stroke={c} fill="none" stroke-width={1.5} />)}
    </svg>
  )
  const navIcoY = (i) => 61 + i * 54
  const models = [
    { name: 'deepseek-chat', ctx: '64K', y: 316 },
    { name: 'deepseek-reasoner', ctx: '64K', y: 350 },
    { name: 'glm-4-flash', ctx: '128K', y: 384 },
    { name: 'qwen2.5:14b', ctx: '32K', y: 418 }
  ]
  return (
    <Frame name="设置·恍然梦" x={0} y={7420} w={1000} h={700} bg={bg}>
      <Rectangle name="头部" x={0} y={0} w={1000} h={44} bg={panel} />
      <Rectangle name="头部线" x={0} y={43} w={1000} h={1} bg={border} />
      <TextImg id="st-title" x={16} y={10} />
      <TextImg id="st-sub" x={74} y={15} />
      {icon('close', 952, 14, dim)}
      <Rectangle name="导航" x={0} y={44} w={198} h={656} bg={panel} />
      <Rectangle name="导航线" x={197} y={44} w={1} h={656} bg={border} />
      <Rectangle name="导航激活" x={8} y={109} w={182} h={46} bg="#E5DCC9" rounded={6} />
      {[0, 1, 2, 3].map((i) => <Rectangle key={'ib' + i} name={'图标底' + i} x={16} y={navIcoY(i)} w={26} h={26} bg={panel} rounded={6} stroke={border} strokeWidth={1} />)}
      <Rectangle name="梦图标底" x={16} y={navIcoY(1)} w={26} h={26} bg="#8C6F4E" rounded={6} />
      <TextImg id="st-nav-ico-meng" x={16} y={63} />
      <TextImg id="st-nav-ico-wai" x={16} y={117} />
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
      <TextImg id="st-h-ai" x={220} y={56} />
      <TextImg id="st-desc-ai" x={220} y={86} />
      <Rectangle name="连接卡" x={220} y={114} w={764} h={150} bg={panel} rounded={8} stroke={border} strokeWidth={1} />
      <Rectangle name="行线1" x={220} y={160} w={764} h={1} bg={border} />
      <Rectangle name="行线2" x={220} y={206} w={764} h={1} bg={border} />
      <TextImg id="st-ai-lb-provider" x={238} y={127} />
      <Rectangle name="服务商选择" x={778} y={124} w={192} h={28} bg={panel} rounded={6} stroke={border} strokeWidth={1} />
      <TextImg id="st-ai-sel-provider" x={792} y={128} />
      {icon('caret', 944, 130, dim, 14)}
      <TextImg id="st-ai-lb-url" x={238} y={173} />
      <Rectangle name="地址输入" x={466} y={170} w={496} h={28} bg={panel} rounded={6} stroke={border} strokeWidth={1} />
      <Text x={480} y={175} size={12.5} color={ink}>https://api.deepseek.com/v1</Text>
      <TextImg id="st-ai-lb-key" x={238} y={219} />
      <Rectangle name="密钥输入" x={466} y={216} w={296} h={28} bg={panel} rounded={6} stroke={border} strokeWidth={1} />
      <TextImg id="st-ai-key-ph" x={480} y={220} />
      <Rectangle name="保存密钥" x={770} y={216} w={84} h={28} bg={panel} rounded={6} stroke={border} strokeWidth={1} />
      <TextImg id="st-ai-btn-savekey" x={780} y={220} />
      <Rectangle name="已配置签" x={862} y={221} w={48} h={18} bg="#EAF3EA" rounded={4} />
      <TextImg id="st-ai-key-tag" x={862} y={222} />
      <TextImg id="st-ai-key-clear" x={916} y={220} />
      <Rectangle name="模型卡" x={220} y={276} w={764} h={204} bg={panel} rounded={8} stroke={border} strokeWidth={1} />
      <TextImg id="st-ai-lb-models" x={238} y={288} />
      <Rectangle name="拉取按钮" x={798} y={282} w={70} h={26} bg={panel} rounded={6} stroke={border} strokeWidth={1} />
      <TextImg id="st-ai-btn-fetch" x={801} y={286} />
      <Rectangle name="添加按钮" x={876} y={282} w={86} h={26} bg={panel} rounded={6} stroke={border} strokeWidth={1} />
      <TextImg id="st-ai-btn-add" x={877} y={286} />
      <Rectangle name="当前模型行" x={230} y={314} w={736} h={30} bg="#EFE8D2" rounded={6} />
      {models.map((m, i) => <Text key={'mn' + i} x={244} y={m.y + 7} size={13} color={ink}>{m.name}</Text>)}
      {models.map((m, i) => <Rectangle key={'mc' + i} name={'上下文签' + i} x={414} y={m.y + 7} w={36} h={16} bg="#F3EEDD" rounded={4} />)}
      {models.map((m, i) => <Text key={'mt' + i} x={421} y={m.y + 9} size={10.5} color={dim}>{m.ctx}</Text>)}
      <Rectangle name="使用中签" x={458} y={322} w={52} h={18} bg="#EAF3EA" rounded={4} />
      <TextImg id="st-ai-tag-using" x={458} y={323} />
      <Rectangle name="专属签" x={458} y={424} w={40} h={18} bg="#F3EEDD" rounded={4} />
      <TextImg id="st-ai-tag-only" x={458} y={425} />
      {icon('edit', 916, 323, dim, 13)}
      {icon('edit', 916, 357, dim, 13)}
      {icon('edit', 916, 391, dim, 13)}
      {icon('edit', 916, 425, dim, 13)}
      {icon('close', 940, 323, dim, 13)}
      {icon('close', 940, 357, dim, 13)}
      {icon('close', 940, 391, dim, 13)}
      {icon('close', 940, 425, dim, 13)}
      <TextImg id="st-ai-tip" x={238} y={458} />
      <Rectangle name="生成卡" x={220} y={492} w={764} h={132} bg={panel} rounded={8} stroke={border} strokeWidth={1} />
      <TextImg id="st-ai-lb-temp" x={238} y={506} />
      <Rectangle name="温度输入" x={330} y={503} w={64} h={24} bg={panel} rounded={6} stroke={border} strokeWidth={1} />
      <Text x={340} y={507} size={12.5} color={ink}>0.8</Text>
      <TextImg id="st-ai-hint-temp" x={404} y={507} />
      <TextImg id="st-ai-lb-ctx" x={628} y={506} />
      <Rectangle name="预算输入" x={726} y={503} w={86} h={24} bg={panel} rounded={6} stroke={border} strokeWidth={1} />
      <Text x={734} y={507} size={12.5} color={ink}>10000</Text>
      <Text x={816} y={507} size={10.5} color={dim}>tokens</Text>
      <TextImg id="st-ai-lb-privacy" x={238} y={536} />
      <Rectangle name="隐私开关底" x={330} y={535} w={36} h={20} bg="#E0D6BF" rounded={10} />
      <Ellipse name="隐私开关钮" x={332} y={537} w={16} h={16} bg="#FAF7EC" />
      <TextImg id="st-ai-hint-privacy" x={376} y={537} />
      <TextImg id="st-ai-lb-cap" x={628} y={536} />
      <Rectangle name="上限输入" x={726} y={533} w={86} h={24} bg={panel} rounded={6} stroke={border} strokeWidth={1} />
      <Text x={732} y={537} size={12.5} color={ink}>200000</Text>
      <Text x={816} y={537} size={10.5} color={dim}>tokens</Text>
      <TextImg id="st-ai-lb-kb" x={238} y={566} />
      <Rectangle name="记忆开关底" x={330} y={565} w={36} h={20} bg="#E0D6BF" rounded={10} />
      <Ellipse name="记忆开关钮" x={332} y={567} w={16} h={16} bg="#FAF7EC" />
      <TextImg id="st-ai-hint-kb" x={376} y={567} />
      <TextImg id="st-ai-lb-emb" x={628} y={566} />
      <Rectangle name="检索开关底" x={726} y={565} w={36} h={20} bg="#E0D6BF" rounded={10} />
      <Ellipse name="检索开关钮" x={728} y={567} w={16} h={16} bg="#FAF7EC" />
      <TextImg id="st-ai-hint-emb" x={770} y={567} />
      <TextImg id="st-ai-lb-vec" x={238} y={596} />
      <Rectangle name="向量输入" x={330} y={592} w={236} h={24} bg={panel} rounded={6} stroke={border} strokeWidth={1} />
      <TextImg id="st-ai-emb-ph" x={340} y={596} />
      <Rectangle name="保存设置" x={220} y={634} w={86} h={30} bg="#8C6F4E" rounded={6} />
      <TextImg id="st-ai-btn-save" x={220} y={640} />
      <Rectangle name="连接测试" x={316} y={634} w={78} h={30} bg={panel} rounded={6} stroke={border} strokeWidth={1} />
      <TextImg id="st-ai-btn-test" x={322} y={640} />
      <Rectangle name="就绪签" x={404} y={640} w={52} h={18} bg="#EAF3EA" rounded={4} />
      <TextImg id="st-ai-ready" x={406} y={641} />
      <TextImg id="st-ai-note" x={220} y={674} />
    </Frame>
  )
})()}
