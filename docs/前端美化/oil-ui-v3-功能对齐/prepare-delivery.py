from pathlib import Path
import json, hashlib, shutil
R=Path(__file__).resolve().parent
states=['shelf','editor','outline','world','characters','inspiration','settings','outline-text','world-detail','characters-graph']
changed=['outline','world','characters','outline-text','world-detail','characters-graph']
for p in (R/'final-evidence-d2').iterdir():
    if p.is_file(): shutil.copy2(p,R/'final-evidence/d'/p.name)
for direction in 'abcd':
    for state in changed: shutil.copy2(R/f'final-evidence/{direction}/{state}.png',R/f'gallery/{direction}/{state}.png')
    for state in states: assert (R/f'gallery/{direction}/{state}.png').is_file(), (direction,state)
baseline=json.loads((R/'software-readonly-baseline.json').read_text(encoding='utf-8-sig'))
check=[]
for row in baseline:
    current=hashlib.sha256(Path(row['Path']).read_bytes()).hexdigest().upper()
    check.append(dict(path=row['Path'],unchanged=current==row['Hash'],sha256=current))
assert all(row['unchanged'] for row in check),'Read-only baseline changed'
(R/'software-readonly-verification.json').write_text(json.dumps(check,ensure_ascii=False,indent=2),encoding='utf-8')
report=[]
for direction in 'abcd':
    rows=json.loads((R/f'final-evidence/{direction}/report.json').read_text(encoding='utf-8'))
    issues=[(r.get('file'),r.get('issues')) for r in rows if r.get('issues')]
    assert not issues, (direction,issues)
    report.append(dict(direction=direction,issues=issues,files=len(rows)))
(R/'交付校验.json').write_text(json.dumps(dict(galleryScreens=40,softwareComponents=check,evidence=report),ensure_ascii=False,indent=2),encoding='utf-8')
(R/'REVIEW.md').write_text('''# 第三轮设计稿验证记录

本轮只改 `docs/前端美化/oil-ui-v3-功能对齐` 内的独立设计原型。没有接入原应用服务或变更软件数据。只读比对的 9 个原软件组件哈希与本轮修改前一致，详见 `software-readonly-verification.json`。

## 原版功能对齐

- 大纲：模块目录、类型筛选、自由画布及文本视图；容器和六类对象保留，不强制三幕结构。双击模块可打开内容编辑，并转到同一条目的文本视图。
- 设定：幕布仍是默认编辑页。双击节点进入独立详情，面包屑、子条目、关联关系、关系图谱和幕布定位保留。新增同级/子级、折叠、搜索和缩进在预览会话演示。
- 人物：列表与可编辑档案为默认视图；姓名、角色、别名、头像、标签、自定义字段、人物关系、跨模块关联和小传保留。关系图独立切换，双击沈砚节点可打开沈砚的档案。
- 书架、灵感、设置以及正文的视觉沿用第二轮。总览含四方向 × 七个主界面及三个补充视图，共 40 张图。

## 证据与修正

`final-evidence/a,b,c,d` 为最终六种修订状态的截图、遮字图、2 倍大纲图、入场三帧与录屏。四份报告均未发现控制台错误、横向溢出、图片加载失败；修订状态未报小字对比度、过小正文或行高问题。入场探测记录侧栏与主区两个元素的短位移/透明度变化，不代表复杂拖拽与连线交互已实现。

独立评审确认：功能结构与基准对齐，目录末项、文本引用与详情关联均可通过内部滚动到达，没有硬裁切。修正 C/D 小字对比度、自定义类型输入标签以及 D 便签标题孤字换行。该轮是存量润色评审，不打分。

保留的自动提示：A/C 大纲的「卡片里套卡片」是自由画布中的真实模块与容器归组。此层级有编辑和收纳含义，属于原版功能，不是装饰卡片嵌套。

原型是桌面设计评审稿，基准视口 1440×900；复杂自由拖拽/吸附/连线、文件导入、持久化与 AI 等只展示入口，未接原软件，详细边界见 README。
''',encoding='utf-8')
print(json.dumps(dict(gallery=40,softwareHashesUnchanged=len(check),evidence=report),ensure_ascii=False))
