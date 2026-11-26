# 原版午后书架实施记录

Goal: 按本次对话已批准方案实现原版书架、阅读台、实体书与环境动效。
Architecture: Bookshelf 保留数据和操作，OriginalShelf 管理展台选择和响应式展示，独立 book/dust 组件负责装帧和环境绘制。
Tech stack: Vue 3 / Pinia / Naive UI / CSS / Canvas 2D。
Spec: 本次对话“午后书房 · 作品上架”方案。

- [x] 新增原版展示组件、材质与来源记录；只接入 original 分支。
- [x] 接续章节、搜索/删除选择回退、键盘与菜单、忙碌反馈。
- [x] 测试分组和稳定书籍尺寸，编译检查，浏览器截图与交互检查。

约束：不修改其他皮肤、工作台或数据模型。复用当前工作目录，保留所有已有改动，不自动提交。
审查重点：未知状态不能丢失；选择不写最近打开；搜索后目标一致；异步章节不能串书；小屏无溢出；reduced-motion 与卸载清理。
Hindsight: 当前可调用工具目录未提供 Hindsight 工具，无法检索或记录 initiative。

