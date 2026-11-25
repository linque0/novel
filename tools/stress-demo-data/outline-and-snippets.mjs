/**
 * 《压力测试》演示作品：大纲自由画布（36 节点 + 3 容器 + 34 条四类语义连线）、
 * 灵感拼板（22 张活卡片：6 标签分栏 + 2 未标记 + 全配色 + 18 条真实关联）与回收站软删样本。
 */

/**
 * 大纲自由画布设计（共 36 个节点，无重叠排布）：
 * - 3 个卷锚点（volume）
 * - 4 个关键章锚点（anchor）
 * - 12 个核心事件卡（event，一一对应三卷十二章推进轴，覆盖 process/diamond/ellipse/para 与 done/writing/revise/planned）
 * - 4 个设定引用卡（cite，动态绑定真实 mubu:<id>）
 * - 1 个独立伏笔便签（note）
 * - 1 个全书主题文本框（textbox）
 * - 3 个归组容器（container）+ 8 张容器内子便签（note）
 * 总计：3 + 4 + 12 + 4 + 1 + 1 + 3 + 8 = 36 节点
 */
export const OUTLINE_CANVAS = {
  volumes: [
    { key: 'v1', title: '第一卷 · 留白渗墨', x: 80, y: 120, w: 196, h: 56 },
    { key: 'v2', title: '第二卷 · 铁则与天平', x: 1320, y: 120, w: 204, h: 56 },
    { key: 'v3', title: '第三卷 · 纸背深渊', x: 2560, y: 120, w: 196, h: 56 }
  ],
  chapters: [
    { key: 'ch1', title: '第一章 · 听墨苑的第十三阶', x: 80, y: 540, w: 214, h: 56 },
    { key: 'ch5', title: '第五章 · 七星锁渊', x: 1320, y: 540, w: 190, h: 56 },
    { key: 'ch8', title: '第八章 · 经纬之外', x: 2250, y: 540, w: 190, h: 56 },
    { key: 'ch11', title: '第十一章 · 纸页之间', x: 3180, y: 540, w: 200, h: 56 }
  ],
  events: [
    // 第一卷主推进轴 (y = 320)
    { key: 'e1', title: '松烟负二层脱离', shape: 'process', x: 80, y: 310, w: 220, h: 112, status: 'done', text: '兰亭大学洗玉池下休谟指数跌破 62 Hu，全校下意识遗忘第十三阶楼梯，林澈显露轻度空洞病。' },
    { key: 'e2', title: '建木突入与异界界石', shape: 'diamond', x: 390, y: 310, w: 224, h: 112, status: 'done', text: '沈昼携定海稳定桩切开异化填充体，却从废墟起获刻有德特明斯「光点」纹样的界石碎片。' },
    { key: 'e3', title: '三地毫秒休谟波谷', shape: 'ellipse', x: 700, y: 310, w: 224, h: 112, status: 'done', text: '候濂溪比对衍生曲线，锁定烟桐、镜水城沉镜塔、雾雨迷蒙三地同毫秒共振。' },
    { key: 'e4', title: '青铜傩面反向注入', shape: 'para', x: 1010, y: 310, w: 224, h: 112, status: 'revise', text: '巫之集守藏史陆玄真在地下藏书窖启封聻碑残片，揭示绝地天通千年契约正在自然衰减。' },

    // 第二卷升级轴 (y = 320)
    { key: 'e5', title: '十三号线过曝与洗版', shape: 'process', x: 1320, y: 310, w: 226, h: 112, status: 'done', text: '病毒谣言引发支点撬动，苏明远以牵星实施温和覆写，周砚用息壤一夜重建塌陷街区。' },
    { key: 'e6', title: '扶桑强攻与若木截胡', shape: 'diamond', x: 1630, y: 310, w: 226, h: 112, status: 'done', text: '连武喧天攻破巫之集据点，却发现核心证物已被三科科长【烛龙】凭叙事不可见性先行抹走。' },
    { key: 'e7', title: '续国院初暾降临接管', shape: 'para', x: 1940, y: 310, w: 228, h: 112, status: 'revise', text: '顾沧持青铜方鼎院徽宣读「批准一切附带损伤」，按铁则二审查林澈，与剑横天正面交锋。' },
    { key: 'e8', title: '曙光城跨境密约', shape: 'ellipse', x: 2250, y: 310, w: 224, h: 112, status: 'writing', text: '叶知秋与艾琳·维尔纳在湖雾区查明晦暗黄金走私链直通大空洞浅层中转站。' },

    // 第三卷终局收束轴 (y = 320)
    { key: 'e9', title: '三陆旧疤同源证实', shape: 'process', x: 2560, y: 310, w: 224, h: 112, status: 'writing', text: '艾琳自雾雨迷蒙发回档案：魔宫之乱、大静默与绝地天通共享同源衰减曲线，越权调动调停部队。' },
    { key: 'e10', title: '流觞亭思辨与旧器启封', shape: 'diamond', x: 2870, y: 310, w: 228, h: 112, status: 'writing', text: '陈玄与陆玄真展开终极对谈，阐明「落墨成黑，留白生光」，以初代司天监遗器争得七分钟窗口。' },
    { key: 'e11', title: '纸页间逆向日常定锚', shape: 'ellipse', x: 3180, y: 310, w: 228, h: 112, status: 'planned', text: '大空洞投影罩顶，沈略现身示警；林澈与沈昼以烟桐人间烟火完成反向定锚，逼停封刊指令。' },
    { key: 'e12', title: '余墨未干与三封密报', shape: 'process', x: 3490, y: 310, w: 224, h: 112, status: 'planned', text: '烟桐重归晨曦，候濂溪收到顾沧暂缓令、沉镜塔重启预警与【烛龙】无署名警告纸条。' }
  ],
  cites: [
    { key: 'c1', anchor: '叙事空洞', title: '叙事空洞（Model Void）', x: 390, y: 120, w: 196, h: 56 },
    { key: 'c2', anchor: '现实铁则', title: '核心概念：现实铁则', x: 1940, y: 120, w: 190, h: 56 },
    { key: 'c3', anchor: '统一现实', title: '统一现实', x: 2250, y: 120, w: 168, h: 56 },
    { key: 'c4', anchor: '大空洞', title: '大空洞（万象枢纽）', x: 3180, y: 120, w: 196, h: 56 }
  ],
  notes: [
    { key: 'n1', title: '核心伏笔 · 烛龙去向', text: '【烛龙】在第六章截走的青铜残碑究竟交给了「烛照」还是故事会？将在第二部引爆。', x: 1630, y: 530, w: 236, h: 96 }
  ],
  textbox: {
    key: 'tb1',
    text: '全书题眼：世界是一张写满了字的纸，平凡是最坚固的堤坝——落墨成黑，留白生光。',
    x: 700,
    y: 540,
    w: 520,
    h: 68
  },
  containers: [
    {
      key: 'g1',
      title: '阵营容器 · 长明护世线（国异监三环）',
      x: 80,
      y: 700,
      w: 840,
      h: 210,
      children: [
        { title: '天衍四科分工', text: '建木断梯 / 寻木千流 / 若木掩迹 / 扶桑镇暴，四科并进却暗藏权限裂隙。', dx: 28, dy: 64, w: 248, h: 116 },
        { title: '北斗 × 堙洪闭环', text: '牵星改写记忆与舆情，息壤一夜复原街景——让十亿凡人活在可信赖的日常里。', dx: 296, dy: 64, w: 248, h: 116 },
        { title: '天工器物代价', text: '每一次启用【开物】都会推高因果张力，唐九霄最担心的不是怪兽而是回弹。', dx: 564, dy: 64, w: 248, h: 116 }
      ]
    },
    {
      key: 'g2',
      title: '阵营容器 · 铁则与掘墓（续国院 × 巫之集）',
      x: 1320,
      y: 700,
      w: 840,
      h: 210,
      children: [
        { title: '续国院的冷酷算术', text: '顾沧代表「存续高于个体」，只要推演白皮书跌破阈值，整座烟桐市都可封刊。', dx: 28, dy: 64, w: 248, h: 116 },
        { title: '巫之集的悲愿与偏执', text: '陆玄真并非疯子，他看到了千年绝地天通正在风化，于是选择提前撕开帷幕。', dx: 296, dy: 64, w: 248, h: 116 },
        { title: '陈玄的第三条路', text: '既不让铁则把世界封死，也不让巫术令凡人沦为神明草芥——留白必须可控。', dx: 564, dy: 64, w: 248, h: 116 }
      ]
    },
    {
      key: 'g3',
      title: '阵营容器 · 跨大陆与大空洞暗线',
      x: 2560,
      y: 700,
      w: 600,
      h: 210,
      children: [
        { title: '德特明斯与卡埃鲁姆呼应', text: '镜水城沉镜塔与雾雨迷蒙观测站同步异常，把局部收容事件抬升为全球级危机。', dx: 28, dy: 64, w: 260, h: 116 },
        { title: '大空洞与故事会凝视', text: '【无实否在】沈略的短暂现身，预示长明之上还有更庞大的跨世界叙事法则。', dx: 312, dy: 64, w: 260, h: 116 }
      ]
    }
  ],
  edges: [
    // 主事件推演链（11 条）
    ['e1', 'e2', { label: '封锁接管', kind: '因果', fromSide: 'right', toSide: 'left' }],
    ['e2', 'e3', { label: '物证溯源', kind: '因果', fromSide: 'right', toSide: 'left' }],
    ['e3', 'e4', { label: '锁定黑手', kind: '关联', style: 'dashed', fromSide: 'right', toSide: 'left' }],
    ['e4', 'e5', { label: '谣言引爆', kind: '冲突', arrows: '->', fromSide: 'right', toSide: 'left' }],
    ['e5', 'e6', { label: '雷霆反击', kind: '因果', fromSide: 'right', toSide: 'left' }],
    ['e6', 'e7', { label: '局势失控', kind: '冲突', arrows: '<->', fromSide: 'right', toSide: 'left' }],
    ['e7', 'e8', { label: '暗线破局', kind: '关联', style: 'dashed', fromSide: 'right', toSide: 'left' }],
    ['e8', 'e9', { label: '档案汇合', kind: '因果', fromSide: 'right', toSide: 'left' }],
    ['e9', 'e10', { label: '危局摊牌', kind: '冲突', arrows: '<->', fromSide: 'right', toSide: 'left' }],
    ['e10', 'e11', { label: '七分钟窗口', kind: '因果', edgeWidth: 2.4, arrowScale: 1.4, fromSide: 'right', toSide: 'left' }],
    ['e11', 'e12', { label: '黎明余波', kind: '因果', fromSide: 'right', toSide: 'left' }],

    // 跨卷闭环伏笔（3 条）
    ['e2', 'e8', { label: '界石伏笔回收', kind: '伏笔', style: 'dashed', fromSide: 'bottom', toSide: 'bottom' }],
    ['e6', 'e12', { label: '无署名纸条呼应', kind: '伏笔', style: 'dashed', arrows: '--', fromSide: 'bottom', toSide: 'bottom' }],
    ['e4', 'e10', { label: '旧日故交终局对谈', kind: '冲突', style: 'dashed', arrows: '<->', fromSide: 'top', toSide: 'top' }],

    // 卷/章锚点与设定引用连线（14 条）
    ['v1', 'e1', { label: '开卷', kind: '关联', fromSide: 'bottom', toSide: 'top' }],
    ['v2', 'e5', { label: '升级', kind: '关联', fromSide: 'bottom', toSide: 'top' }],
    ['v3', 'e9', { label: '总决', kind: '关联', fromSide: 'bottom', toSide: 'top' }],
    ['ch1', 'e1', { label: '落章', kind: '关联', style: 'dotted', fromSide: 'top', toSide: 'bottom' }],
    ['ch5', 'e5', { label: '落章', kind: '关联', style: 'dotted', fromSide: 'top', toSide: 'bottom' }],
    ['ch8', 'e8', { label: '落章', kind: '关联', style: 'dotted', fromSide: 'top', toSide: 'bottom' }],
    ['ch11', 'e11', { label: '落章', kind: '关联', style: 'dotted', fromSide: 'top', toSide: 'bottom' }],
    ['c1', 'e2', { label: '机制依据', kind: '伏笔', style: 'dashed', fromSide: 'bottom', toSide: 'top' }],
    ['c2', 'e7', { label: '最高法理', kind: '冲突', style: 'dashed', fromSide: 'bottom', toSide: 'top' }],
    ['c3', 'e8', { label: '跨国舞台', kind: '关联', style: 'dotted', fromSide: 'bottom', toSide: 'top' }],
    ['c4', 'e11', { label: '投影源头', kind: '伏笔', style: 'dashed', fromSide: 'bottom', toSide: 'top' }],
    ['n1', 'e6', { label: '悬念批注', kind: '伏笔', style: 'dashed', arrows: '--', fromSide: 'top', toSide: 'bottom' }],
    ['g1', 'e5', { label: '执行底座', kind: '关联', style: 'dotted', fromSide: 'top', toSide: 'bottom' }],
    ['g2', 'e7', { label: '核心矛盾', kind: '冲突', style: 'dotted', fromSide: 'top', toSide: 'bottom' }]
  ]
}

/**
 * 22 张活灵感卡片（首行标题 + 空行 + 正文；覆盖 6 标签分栏 + 2 未标记 + 全配色 + 18 张带真实关联）
 */
export const SNIPPETS = [
  {
    title: '洗玉池清晨的灰块地图',
    body: '开篇不要急着写怪物，先写普通人最习以为常的手机导航——当整栋松烟图书馆在电子地图上自动灰掉、连外卖定位都绕开它时，第一阶段「脱离」的寒意才真正立得住。',
    tags: ['场景构思'],
    cardColor: 'blue',
    links: [{ kind: 'chapter', ref: '第一章 · 听墨苑的第十三阶' }, { kind: 'mubu', ref: '脱离阶段' }]
  },
  {
    title: '林澈左眼的「噪点」意象',
    body: '空洞病不要写成传统超能力发光眼，而是写成类似老式胶片边缘的极细灰白雪花——每次看穿空间错位，代价都是忘掉自己前一天午饭吃了什么，用「日常记忆流失」呼应叙事空洞。',
    tags: ['人物弧光'],
    cardColor: 'lilac',
    links: [{ kind: 'character', ref: '林澈' }, { kind: 'mubu', ref: '叙事空洞' }]
  },
  {
    title: '沈昼手腕上的 0.03 秒灼痕',
    body: '把七年前「第25小时」档案（CN-Void-2018-03）变成沈昼的个人创伤：那 0.03 秒在他体感里是一整个无声灰色小时，让他养成每次进场前必须听秒针咔哒声的习惯。',
    tags: ['人物弧光', '伏笔回收'],
    cardColor: 'amber',
    links: [{ kind: 'character', ref: '沈昼' }, { kind: 'mubu', ref: '第25小时' }]
  },
  {
    title: '建木定海桩的声响设计',
    body: '【定海】打进混凝土时的声音不该像电钻，而该像巨钟在深水底下敲响——每钉入一寸，空气里漂浮的错位回声就少一层，重力重新压回队员肩头。',
    tags: ['场景构思', '设定推演'],
    cardColor: 'moss',
    links: [{ kind: 'chapter', ref: '第二章 · 建木断梯' }, { kind: 'mubu', ref: '建木' }]
  },
  {
    title: '候濂溪的冷茶与三地波谷图',
    body: '九州共识传媒表面是做短视频舆情监测的写字楼，刷过「幽荧」银月门禁卡下到负四层后，整面墙的衍生曲线像潮汐一样呼吸。三道毫秒同步的休谟低谷成为全书真正的转折点。',
    tags: ['场景构思', '跨界暗线'],
    cardColor: 'blue',
    links: [{ kind: 'character', ref: '候濂溪' }, { kind: 'chapter', ref: '第三章 · 千流归一' }, { kind: 'mubu', ref: '寻木' }]
  },
  {
    title: '陆玄真摘下青铜傩面的瞬间',
    body: '反派不要脸谱化。陆玄真戴上面具是令寻常人窒息的古巫守藏史，摘下面具后却像个守着破旧古籍库的老馆员，他甚至会在藏书窖里给霉变的孤本换防潮纸。',
    tags: ['人物弧光'],
    cardColor: 'rose',
    links: [{ kind: 'character', ref: '陆玄真' }, { kind: 'mubu', ref: '巫之集' }]
  },
  {
    title: '台词备选 · 苏明远论菜市场',
    body: '「你们总觉得神明和怪物才宏大。可你去早市听一听，三百个人同时为了两毛钱葱姜吵架，那个地方的休谟指数能飙到一百一，连神来了都得排队。」',
    tags: ['台词金句'],
    cardColor: 'amber',
    links: [{ kind: 'character', ref: '苏明远' }, { kind: 'chapter', ref: '第五章 · 七星锁渊' }]
  },
  {
    title: '地铁第十三号线的「温和覆写」',
    body: '北斗处对抗支点撬动的高光手法：不删视频、不否认诡异，而是连夜拉起「烟桐沉浸式先锋声光展」围挡，请百万粉丝博主现场打卡——大众一旦接受它是艺术装置，恐怖就瞬间失能。',
    tags: ['设定推演', '场景构思'],
    cardColor: 'moss',
    links: [{ kind: 'mubu', ref: '支点撬动' }, { kind: 'mubu', ref: '牵星' }]
  },
  {
    title: '周砚与「息壤」的一夜造园',
    body: '天亮前四十分钟，周砚站在刚铺好的桂花树与旧长椅之间，特意拿砂纸把崭新的公交站牌边角磨出三年风吹日晒的旧痕——「息壤能补齐砖石，可让市民相信它一直在这儿，得靠这点旧。」',
    tags: ['人物弧光', '场景构思'],
    cardColor: 'moss',
    links: [{ kind: 'character', ref: '周砚' }, { kind: 'mubu', ref: '息壤' }]
  },
  {
    title: '【烛龙】的「嘘」字树影',
    body: '利用若木徽章的视觉错觉：扶桑队冲进祭坛时，焦黑承重柱在应急红灯下的倒影乍看像枯树，细看是一根竖在嘴唇前的食指——连武喧天当场就知道老三先来过一步。',
    tags: ['伏笔回收', '场景构思'],
    cardColor: 'rose',
    links: [{ kind: 'character', ref: '【烛龙】' }, { kind: 'chapter', ref: '第六章 · 焦金流石' }, { kind: 'mubu', ref: '若木' }]
  },
  {
    title: '顾沧进门时温度与回声的变化',
    body: '132 Hu 的高休谟体质怎么写才不用报数值？写他走进临时指挥室后，连窗外因异常而微微扭曲的雨丝都立刻笔直落下，连原本滋滋作响的对讲机都安静下来——现实本身在向他立正。',
    tags: ['设定推演', '人物弧光'],
    cardColor: 'rose',
    links: [{ kind: 'character', ref: '顾沧' }, { kind: 'mubu', ref: '续国院' }, { kind: 'mubu', ref: '休谟指数' }]
  },
  {
    title: '台词备选 · 顾沧与剑横天的对峙',
    body: '「剑科长，你救下三百个市民，若让烟桐沦为贰级覆盖区，长明会死三千万人。续国院不是不懂慈悲，只是我们手里那杆秤，一头放着慈悲，另一头放着十亿人的明天。」',
    tags: ['台词金句'],
    cardColor: 'amber',
    links: [{ kind: 'character', ref: '顾沧' }, { kind: 'character', ref: '剑横天' }, { kind: 'chapter', ref: '第七章 · 批准附带损伤' }]
  },
  {
    title: '镜水城湖雾区的光点交易',
    body: '第八章切到境外视角时，用「光点（Lux）」的共识货币机制做呼应：在湖雾区黑市，连货币价值本身都是受控的微型共识现实实验，让叶知秋一眼看穿晦暗黄金走私界石的深意。',
    tags: ['跨界暗线', '设定推演'],
    cardColor: 'blue',
    links: [{ kind: 'character', ref: '叶知秋' }, { kind: 'mubu', ref: '镜水城' }, { kind: 'mubu', ref: '光点' }]
  },
  {
    title: '雾雨迷蒙的灰蓝琉璃灯',
    body: '第九章写内布利姆布里亚（雾雨迷蒙）加密观测站：窗台上一盏模拟「初冬薄雾」色温的手工琉璃灯，室外山脊雾水发电涡轮轻响，室内屏幕同时铺开三块大陆的古史时间轴。',
    tags: ['跨界暗线', '场景构思'],
    cardColor: 'blue',
    links: [{ kind: 'character', ref: '艾琳·维尔纳' }, { kind: 'mubu', ref: '雾雨迷蒙' }]
  },
  {
    title: '三块大陆的「同一道补丁」假说',
    body: '把设定里三个看似独立的文明大事件串成史诗级秘密：长明「绝地天通」、德特明斯「大静默」、卡埃鲁姆「魔宫之乱」，其实是同一场远古因果重构在不同大陆留下的三道防洪堤。',
    tags: ['跨界暗线', '伏笔回收'],
    cardColor: 'lilac',
    links: [{ kind: 'mubu', ref: '绝地天通' }, { kind: 'mubu', ref: '大静默' }, { kind: 'mubu', ref: '魔宫之乱' }]
  },
  {
    title: '陈玄与陆玄真的流觞亭煮茶',
    body: '第十章不要一上来就打架，让两位老友在细雨中的流觞亭对坐。曲水流觞的石槽里飘着落叶，一边是守着凡人纸页的司天监遗脉，一边是执着撕开蒙昧的守藏史，辩论「落墨」与「留白」。',
    tags: ['场景构思', '台词金句'],
    cardColor: 'default',
    links: [{ kind: 'character', ref: '陈玄' }, { kind: 'character', ref: '陆玄真' }, { kind: 'chapter', ref: '第十章 · 墨守成规' }]
  },
  {
    title: '大空洞投影中的「意象电梯」残影',
    body: '松烟图书馆负二层彻底液化后，书架化作悬空的无限廊道，空气里弥漫让人看见异界街景的以太雾；林澈耳畔响起类似电梯播报的失真女声，那是浅层中转站投影重叠的征兆。',
    tags: ['跨界暗线', '设定推演'],
    cardColor: 'lilac',
    links: [{ kind: 'chapter', ref: '第十一章 · 纸页之间' }, { kind: 'mubu', ref: '大空洞' }]
  },
  {
    title: '沈略留下的书签与「存在之证明」',
    body: '【无实否在】沈略只在第十一章露面三分钟，留给林澈一枚半透明书签（故事会「图书馆」的印记），既点出更高维观测者的存在，又不喧宾夺主抢走主角团的高光。',
    tags: ['伏笔回收', '跨界暗线'],
    cardColor: 'lilac',
    links: [{ kind: 'character', ref: '沈略' }, { kind: 'mubu', ref: '故事会' }]
  },
  {
    title: '烟桐豆浆摊作为终极叙事锚点',
    body: '击退大空洞投影的不是最强武器，而是林澈和沈昼在以太雾里死死咬住的具体日常：兰亭东门早晨六点的焦糖豆浆味、修车铺扳手敲击钢圈的节奏、旧课本页脚写歪的笔记。',
    tags: ['伏笔回收', '人物弧光'],
    cardColor: 'amber',
    links: [{ kind: 'character', ref: '林澈' }, { kind: 'character', ref: '沈昼' }, { kind: 'chapter', ref: '第十一章 · 纸页之间' }]
  },
  {
    title: '尾声钩子：纸背墨水已经醒了',
    body: '第十二章收尾要克制留白：烟桐早高峰恢复拥堵，候濂溪桌上摆着三份来自不同势力的密件，最后停在【烛龙】那张没有署名的便签上，给读者留下第二卷/续篇的宏大想象。',
    tags: ['伏笔回收', '台词金句'],
    cardColor: 'default',
    links: [{ kind: 'chapter', ref: '第十二章 · 余墨未干' }, { kind: 'character', ref: '候濂溪' }]
  },
  // 刻意保留 2 张未标记卡片，供灵感模块「未标记」筛选演示
  {
    title: '待考：沉镜塔底部水深与光学折射细节',
    body: '镜湖最深处 320 米，沉镜塔约三分之一露出水面。后续如果写镜水城分卷，需要补一段潜水器逼近塔基时仪表盘时间倒转的细节描写。',
    tags: [],
    cardColor: 'blue',
    links: []
  },
  {
    title: '随手记：续国院「恒耀」级执火者出场时机',
    body: '第一部最高只出到监察厅「初暾」顾沧，厅级「燎原」和最高决策层「恒耀」留作悬念，只通过《长明存续白皮书》印章间接显威，压迫感会更强。',
    tags: [],
    cardColor: 'default',
    links: []
  }
]

/** 回收站软删除样本（展示可恢复状态） */
export const TRASH_SAMPLES = {
  chapter: {
    volumeTitle: '第一卷 · 留白渗墨',
    title: '废稿 · 旧版序章（单视角校园日常）',
    status: 'draft',
    html: '<p>（已弃用旧稿：原计划前两章纯写兰亭大学选修课日常，后改为多 POV 群像史诗开篇，直接从松烟图书馆第十三阶脱离异常切入。）</p>'
  },
  character: {
    name: '废案 · 无名摆渡人',
    role: '龙套',
    aliases: '旧版大空洞向导',
    tags: ['弃用方案'],
    content: '早期构思的大空洞向导角色，后合并为设定原有人物【无实否在】沈略，避免人物线冗余。',
    fields: { 弃用原因: '与沈略职能重叠，归档至回收站备查' }
  },
  snippets: [
    {
      title: '弃用结局：烟桐市启动局部封刊',
      body: '早期草案考虑让续国院真把兰亭大学整片校区封刊抹除，后觉得过暗且背离「平凡是宝贵的」核心题旨，改为主角团以日常锚定逼停封刊。',
      tags: ['伏笔回收'],
      cardColor: 'rose'
    },
    {
      title: '弃用台词：纯硬科幻术语解释休谟场',
      body: '原本打算用三页量子退相干公式解释叙事空洞，实测拖慢开篇节奏，改为保留《新人入职指引》里「写满字的纸与纸背墨水」的直观比喻。',
      tags: ['设定推演'],
      cardColor: 'default'
    }
  ]
}
