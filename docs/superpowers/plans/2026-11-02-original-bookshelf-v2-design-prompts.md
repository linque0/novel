# 午后藏书室：原版书架 V2 设计与提示词

状态：方案与提示词细化，尚未实施 V2、尚未生成本轮效果图。
日期：2026-11-02。
范围：ui.skin === 'original' 的书架界面。

## 1. 设计决定

方向：建筑式藏书墙。近距离、同一相机下的实体木作与实体书，底部连续阅读台承载当前作品操作。高级感来自比例、体量、低对比材质和有方向的自然光。

取代 V1 的大面积木纹背板、平面倾斜封面、固定三个状态空分区、右侧重复放大的封面与详情卡。
新提议采用桌面轻量 Three.js/WebGL 场景，DOM 承载工具与完整可访问操作；原先“不用 WebGL”不再作为 V2 的约束。复用项目已安装 three，不新增第二套渲染框架。

保留单击主书籍按钮打开作品的现有行为；独立的“查看详情”入口选择当前作品。hover/focus 只做反馈，不改变选中、排序或打开记录。

## 2. 1440×900 构图

- 0–64px：现有 AppTopbar（实际高度遵从已有响应式实现）。
- 64–128px：一行书架名称、作品总数、搜索、新书上架。
- 128–176px：全部 / 连载 / 完结 / 构思 / 搁置筛选；当前结果数量。未知状态仍可在全部找到。
- 176–728px：近距离书架场景，左右约40px；两层有进深的架格。
- 728–876px：连续阅读台；剩余空间保留呼吸感，不强制固定整页高度。

顶部占位按视口空间调节。短屏、200%缩放时允许自然纵向滚动，不压缩控件。
取消右侧固定详情栏；当前书仍在书架中，阅读台不重复绘制第二本封面。

阅读台：左侧书名/作者/状态，中间接续章节/字数/章节数，右侧继续写作/大纲/更多。简介按需展开，不塞入首屏。

作品陈列按最近打开的既有顺序。状态筛选取代一状态一层的强制分组。更新筛选只影响展示，不修改数据状态或顺序。
视觉占位与逻辑顺序使用同一份布局映射，键盘顺序和屏幕位置不能分别计算。

## 3. 柜体和书籍的物理关系

建模起点：柜体宽1.72m、高0.76m、深0.23m；两层净高约0.30–0.32m；层板厚24mm，立柱约32mm。尺寸是统一比例的起点，可随构图调整，不能分别拉伸模型填满画布。
镜头约等效60mm，接近正视，俯角约5–7°，无明显左右偏转；最终以能见到层板顶面和书页上缘为准。
相机固定，不开放轨道控制，不跟随鼠标晃动。不对每本书单独设置透视。

前后五层：前沿与立柱 → 书籍 → 书后空气 → 背板 → 外围墙面。背板使用低对比灰褐色；木纹只属于木构件。
木板有顶面、前沿、侧面和轻微倒角。书底与层板接触；倾斜书使用底角为支点，不能穿板、悬空或穿过邻书。

六本默认校准数据：2本正面或微侧展示、4本书脊/侧面陈列；分成4+2的非对称小组，不均匀拉开填满架子。其中一本为当前作品。
书脊命中不足44px时使用不重叠的对应DOM文字入口；不能扩大透明命中区域覆盖邻书。

数量策略：
- 0：保留一个完整架格与真实空位，展示创建入口。
- 1–2：集中在一个架格；当前书正面展示，其他架格安静留空。
- 6：两个有组织的小组，避免六本全做同款正封面。
- 12以上：增加连续书组与续架；不缩小到不可辨认。
- 100：场景仅维护可见架格及邻接缓冲，逻辑作品列表完整可访问；不创建巨型单canvas覆盖整条长页面。

书高约200–240mm，宽高比0.62–0.70。封板约2.5–3mm；纸页相对封板回缩约2mm；书脊设装订沟槽；大批量使用共享几何。
厚度继续复用固定的字数映射，转成世界单位后约16–42mm；不按当前集合归一化。零字数保留装订最小厚度。
微小尺寸差由id稳定派生；同一本书刷新、搜索、排序时不能换装帧或开本。

## 4. 材质、字体与光照

色彩角色：外围暖灰白 #E8E5DD；背板灰褐 #625F55；木作烟熏橡木参考 #9B8061；纸页 #EDE6D6；正文 #292C29；主操作深青 #284F48；当前书书签 #713B37。材质颜色以纹理与实际光照共同决定，不把这些色值直接铺成大色块。

木材：平光base color + roughness + normal，纹理随构件方向；粗糙度起点0.55–0.75。禁止将同一方向木纹平铺所有表面。
布面：细密、低对比织纹，normal幅度克制，粗糙度起点0.8–0.95。
皮面：细颗粒与宽弱高光，粗糙度起点0.5–0.7，无油亮塑料感。
纸页：近暖白，层次细密、不画成粗条纹；禁止假装实时渲染每一张纸。
金属：局部压印或极少黄铜件，面积小，避免整体金色边框。
以上是材质初始调试区间，不是已验证的最终参数；使用材质球与场景同时校准。

三种装帧：文学布面、纸面精装、深色皮面。六种kind保留身份色，kind到装帧风格采用固定映射；不同书的色相不能代表其状态。无作者不添加印章。
文字：书名/主要标题用本地Noto Serif SC；操作与正文用系统中文无衬线。DOM正文14–16px，辅助信息12–13px。小型书脊文字可作为装帧，但完整标题必须有可访问入口。
书面文字可由真实数据和本地字体生成纹理，不用生成图内的乱码；缓存更新与字体加载同步。完整文字仍由DOM提供。

主光右上进入，阴影向左下；光色偏暖，环境填光中性或轻微偏冷。书页最明亮，背板最暗，木纹处于中间。
光照层次：贴近书底的窄接触暗部、随距离变软的投影、弱材质高光、稳定的环境补光。避免重复叠加阴影把书底压成黑块。
环境贴图、色彩空间与曝光统一校准。按项目安装版本验证API。若某种光源不支持需要的投影，不靠虚假配置宣称实现；选择可投影光源并匹配柔和度。
不要默认启用SSAO、景深、bloom或全屏后处理。先用基础几何、纹理、光照完成可信体积。

灰尘最后添加，仅在实际受光区域；约12–20个、0.5–1.3px、低不透明度，不放在DOM文字上。灰尘不能成为画面最亮的东西。

## 5. 动作与产品行为

- hover/focus：沿书架深度向外抽出8–12mm，160–200ms；改变的是实际几何位置，投影与遮挡随之变化。不能向上漂浮。
- 查看详情：选择当前作品；可向外抽出约18mm并小幅转向，约220ms，保证运动包围盒不与邻书相交。
- 单击主书籍入口或Enter/Space：调用现有openWorkAt/onWorkClick，立即启动打开；动画不阻塞导航。
- 选择与最近打开记录分离。只有真正打开才写openStats。
- 搜索/筛选后，如果当前作品仍可见则保持选择；不可见则按既有排序回退；无结果清空展签。
- busy时锁住会产生冲突的打开/导航；失败保留查询、选择、焦点并允许重试。
- Esc关闭菜单并返回触发控件。删除完成后再恢复相邻可见作品的焦点；最后一本删除后回到新建入口。
- 当前书、展签、AppTopbar目标和resumeChapterOf必须指向同一作品；取消过期章节订阅，不能短暂串书。

Canvas负责视觉，DOM拥有语义与操作。选择一套命中分发，避免透明按钮和raycast同时触发两次。被3D遮挡的对象不能被穿透点击。
提供可见的焦点对应标记与完整列表/书单模式，不能只给canvas一个aria-label就宣称可访问。

## 6. 响应式与性能约束

1440完整场景；1080减少外侧留白并保持书籍识别度；800可减少可见架格并允许滚动；390默认采用纵向作品书单，保留同套装帧缩略图及纸质信息，详情就地展开。
不把桌面WebGL场景缩成手机微型房间。没有WebGL、上下文丢失或用户选择简洁模式时，切换可操作的DOM书单，不保留坏掉的空画布。
200%实际浏览器缩放需验证；模拟小视口仅作为辅助，不代替真实缩放。

静止且无环境动画时按需渲染；过渡期间按帧渲染；开启灰尘时可降低环境帧率。页面隐藏/离开场景暂停；reduced-motion关闭灰尘、抽书插值与镜头过渡，保留静态体积。
可见帧DPR上限1.5作为起点，清晰度与负载实测后调整；阴影初始使用有限范围，按场景需要更新。材质和几何缓存复用，切换作品不重建整个renderer。
监听上下文丢失；卸载清理renderer、几何、材质、纹理、DOM监听、observer和RAF；重复进出不能泄漏。

暂定预算：首屏新增压缩素材≤3MB；可见几何≤150k triangles；draw calls目标≤60；目标机器hover帧时间P95≤20ms；搜索交互视觉响应目标≤100ms。必须记录设备/分辨率/作品数与测量方法，未测不能写已达标。

## 7. 提示词A：整屏视觉校准

用途：生成空间/材质概念，不是可直接使用的背景。原始生成图不承担中文排版；真实UI文案由后续DOM或设计排版完成。

```text
Use case: UI mockup / visual direction study.
Create a photorealistic material-and-composition study for a novelist's desktop bookshelf application, 1440 by 900, 16:10.

Composition: a close, almost frontal architectural view of one carefully crafted contemporary book cabinet, not a distant room. A slim neutral application header and compact toolbar occupy the upper fifth. Two genuinely deep shelf levels occupy the central area. A continuous reading counter along the bottom reserves clear space for selected-book information and actions. No right-hand detail column, no duplicated hero book.

Cabinet: finely made smoked oak uprights and substantial shelves with visible top planes, subtle rounded edges, end grain and recessed construction joints. A quiet matte grey-taupe back panel sits visibly behind the books. Wood grain is restrained and correctly oriented along each timber component. Materials must not resemble wood wallpaper.

Books: exactly six distinct hardcover volumes, arranged in deliberate groups of four and two. Two show front or three-quarter covers, four show spines or narrow side views. One selected volume faces outward within the same shelf and has a discreet oxblood ribbon. Real board thickness, inset cream page blocks, binding grooves, subtle headbands and naturally supported contact points. Vary thickness and height slightly. Use literary cloth, paper-wrapped board and restrained fine-grain leather. Reserve blank, clean title areas for later typesetting; no generated pseudo-text.

Camera: approximately 60mm equivalent, close to frontal with a gentle five-degree downward view. One coherent perspective for every object. Show shelf tops and page-block upper edges without wide-angle distortion.

Lighting: warm late-afternoon key light from the upper right, neutral soft ambient fill, shadows falling toward the lower left. Clearly readable contact shadows and soft cast shadows, subtle rough material highlights, darker recessed back panel, luminous but unbleached paper edges. Only a few barely visible dust motes inside the sunlit area.

Finish: contemporary, tactile, quiet and precisely crafted. Restrained material contrast and clean application-scale geometry. Interactive books stay sharp. No heavy sepia colour grade. No readable text, logos or watermark.
```

```text
Avoid: flat wood-texture wall, floating rectangular book cards, identical face-out covers, paper-thin shelves, disconnected contact shadows, books intersecting shelves, plastic cloth, coarse striped pages, gold frames on every book, giant empty bays, fake filler books, distant interior photography, decorative coffee cups or plants, people, wide-angle distortion, depth-of-field blur on controls, lens flare, bloom, glowing dust, orange filter, glass panels, neon, dashboard tiles, right-side duplicate book detail card.
```

## 8. 提示词B：书籍与接触关系特写

```text
Use case: photorealistic product material study, 3:2 landscape.
Close view of the same smoked-oak shelf and recessed grey-taupe back panel from the approved cabinet composition. Show three distinct hardcover books: one matte deep-teal clothbound volume in three-quarter view, one warm paper-wrapped volume showing its spine, and one charcoal fine-grain leather volume leaning gently against its neighbour. Preserve one coherent camera and light direction.
Make board thickness, inset page blocks, binding grooves and the front edge of the wooden shelf physically legible. Books have weight, rest on the shelf and cast narrow contact shadows at their bases. Soft longer shadows extend toward the lower left from warm upper-right afternoon light. Neutral ambient fill retains dark-surface detail. Textile weave and wood pores are fine, low contrast and visible only at close range. No readable titles; blank areas for real typography. No loose props, people, plastic shine, exaggerated distressing or fake bokeh.
```

## 9. 提示词C：材质制作

每条单独生成，不能把多种材质拼成一张图后直接平铺。生成结果只能作为base-color候选；真实normal/roughness需从可靠PBR素材获取或后续制作校准，不能把一张有光照的图片直接叫作PBR。

```text
Seamless tileable smoked-oak base-colour texture, straight fine grain along the vertical axis, restrained warm grey-brown colour, subtle natural pores, no large knots. Orthographic flat scan, uniform diffuse illumination. No specular highlights, cast shadows, ambient occlusion, perspective, borders, text or objects. Physically plausible furniture-scale detail. Square 2048 by 2048 material candidate.
```

```text
Seamless tileable fine bookbinding linen base-colour texture, neutral pale grey, tightly woven natural threads with very subtle irregularity. Low contrast suitable for tinting. Flat orthographic macro scan under completely uniform diffuse illumination. No directional lighting, shadows, folds, seams, moire, text or objects. Square 1024 by 1024 material candidate.
```

```text
Seamless tileable fine-grain bookbinding leather base-colour texture, neutral medium grey, restrained tiny irregular pores, matte and supple, no large wrinkles or damage. Flat orthographic scan with uniform diffuse illumination, no highlights, shadows, bevels, embossed patterns, stitching, text or objects. Square 1024 by 1024 material candidate.
```

```text
Seamless warm-ivory paper base-colour texture, extremely subtle short fibres, visually clean at normal viewing distance. Flat scanned surface, uniform neutral illumination, no page edges, ruled lines, stains, print, shadows or objects. Square 1024 by 1024 material candidate.
```

## 10. 提示词D：前端编码Agent主任务

```text
在现有小说工坊中实施“午后藏书室”V2，仅处理原版书架 ui.skin === 'original'。完整规格见 docs/superpowers/plans/2026-11-02-original-bookshelf-v2-design-prompts.md。

优先目标：书架是真实有进深的木作，书籍是有厚度的几何体，所有对象在同一相机和光照体系中。先让无纹理灰模的体积、支撑、遮挡和阴影成立，再处理材质、装帧、中文排版和动效。不能通过继续给旧版矩形加倾斜、box-shadow和木纹宣称完成。

桌面使用项目现有Three.js；DOM负责导航、搜索、状态筛选、展签、菜单、键盘与无障碍。取消固定右侧封面详情栏，使用两层藏书墙加底部阅读台。状态是筛选，不强制一状态一层。当前作品不重复绘制第二本。

先阅读实际 OriginalShelf.vue、OriginalBook.vue、OriginalDust.vue、Bookshelf.vue、shelf store、sortShelfWorks、resumeChapterOf、openWorkAt，以及已安装three版本。沿用已经可用的数据/事件接口，场景只接收workId和展示数据，不读写数据库、不维护第二份作品store。新视觉布局函数与业务排序分开，id稳定，键盘顺序与画面映射一致。

保留：搜索书名/作者/类型；既有最近打开排序；创建/编辑弹窗；删除和错误处理；接续章节；AppTopbar目标；busy去重。单击书籍主入口、Enter/Space立即打开。独立查看详情入口选择作品；hover/focus仅反馈。只有成功走实际打开流程才沿用原逻辑记录openStats。不要重新实现打开记录。

两层书架呈现层板顶面、前沿、立柱、后退背板；书底接触层板。书有封板、封底、纸页和装订沟槽。厚度由固定字数映射，不按集合归一化。六本校准状态采用两本封面/微侧展示和四本书脊/侧面陈列。遵从完整规格中的物理尺寸、材质、光照与数量布局策略。

作品变化后处理选择回退、长标题、无作者/章节、零字数、未知状态、加载、打开失败、空搜索和删除最后一本。展签、导航和章节接续必须是同一本；异步结果取消和过期检查沿用现有实现。

一个canvas负责视觉，一套DOM语义与操作映射；避免双事件、穿透命中、看不见焦点。canvas不能替代可访问作品列表。390采用可用DOM书单，详情就地展开；WebGL不可用或上下文丢失时有完整操作降级。

抽书沿深度方向，不能向上浮起；移动时阴影真实更新，不得穿模。相机稳定。静止按需渲染，隐藏暂停，reduced-motion不播放环境或抽书过渡。资源共享缓存，卸载彻底清理，不为100本作品创建巨型画布或解码100张独立大纹理。

所有素材本地化并记录来源/许可/处理方式；不把别的皮肤的画作或模型搬进来。共享组件改动限制在原版书架上下文，不修改工作台、其他皮肤、数据模型、导入导出与恍然梦。

实施顺序：
1. 建立同相机下的灰模书架+六本书，检查体积与接触。
2. 加入本地木材/布面/纸页材质、统一光照和真实标题，产出1440×900实际截图。
3. 对照规格自查，先修空间与材质，再接抽书动作、完整数据与响应式。
4. 最后加入低对比灰尘；无灰尘时也应成立。
5. 执行已有检查与真实浏览器/桌面交互验证，记录设备和性能测量；未做的检查如实列出。

完整验收：0/1/2/6/100本、单一状态、四状态和未知状态、长中文/混排标题、无作者/简介/章节、搜索无结果、加载、busy、打开失败、删除当前/最后一本、创建编辑、方向键/Enter/Space/Esc、触屏、1440/1080/800/390、实际200%缩放、reduced-motion、WebGL失败降级、反复进入退出的资源清理。

交付可运行界面、前后截图、测试与性能证据、素材来源、实际剩余问题。生成效果图不能替代实际运行截图；自动检查通过不等于设计质量达标。
```

## 11. 提示词E：视觉审查

```text
只审当前实际运行截图及交互，不根据代码意图评分。
首先看1440×900全屏，再看书籍与层板局部、390小屏及200%缩放。
依次回答：
1. 去掉文字后，第一眼是实体书与木作，还是木纹底上的卡片？
2. 去掉纹理后，层板厚度、书体积、前后遮挡仍成立吗？
3. 书底有重量与接触吗？有悬空、穿板、投影方向矛盾吗？
4. 木纹是否抢过作品？近看才出现的细节有没有被做成远看可见的噪点？
5. 六本书是否有自然混合陈列，还是六个换色矩形？
6. 当前作品、继续写作、搜索、新建能否在首屏找到？长书名是否有完整入口？
7. 抽书是否沿空间深度移动，邻书和阴影是否合理？
8. 小屏是否有独立可用结构，焦点和触摸是否明确？
每条指出截图位置与具体修法。优先报告最影响真实感的三项，不用增加装饰解决结构问题。不得用检查脚本通过代替视觉判断。
```

## 12. 交付门槛

先比较同视口V1/V2六本作品截图；不得更换数据数量或裁切掩盖构图问题。
视觉样片阶段先评实际灰模/材质样片，未达到体积与材质标准时不宣称V2完成。
最终状态覆盖：完整场景、真实长标题、少量作品、100本、空架、小屏、缩放、无WebGL和reduced-motion。
这份文件构建设计与提示词，不代表V2的画面、性能或行为已经验证。
