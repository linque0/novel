# 原版书架验收记录

2026-11-02，Windows / Node 24 / Chromium，Vite 6.4.3。独立临时浏览器配置，测试数据不写入用户的桌面应用配置。

已完成：原版独立书架组件、真实本地橡木纹理、CSS 实体书、字数厚度、状态分区、阅读台、真实接续位置查询、选中作品导航、搜索与菜单、抽书反馈、光影及受限 Canvas 灰尘。

验证：
- node --test tools/original-shelf.test.mjs：2/2。
- npm run build：成功（已有大包和动态/静态混用警告）。项目没有 lint/typecheck 脚本。
- tools/original-shelf-browser.mjs：1440/1080/800/768/390 无页面横向溢出；0/1/2/6/100 本；搜索与清空；展台选择；加载；新建弹窗；reduced-motion；持久化作品 Enter 打开、编辑、删除、删除后焦点恢复；无浏览器异常。
- 720×450、DPR 2 检查 1440×900 的200%缩放等价可用空间。不是操作系统真实浏览器缩放测试。
- inspect --app：1440/768/390，0 FAIL / 5 WARN（有明确豁免）。

设计检查豁免：gradient 用于材质受光、布纹和逐行木层板；heavy-shadow 用于实体书和木架；tiny-text 为装帧中的装饰文字及共享顶栏控件，完整作品信息由展签与可访问名称承担；covered-text 为书封受限标题，完整标题在展签提供。暖奶油色与标题/数量的两套字体来自已批准方案；Microsoft YaHei 使用系统字体回退；工具提示开发服务器。截图均在开发环境拍摄，生产构建编译已通过。

独立评审后修复：手机顶栏高度、删除异步焦点、移动端详情滚动聚焦、大量作品续架；环境画布最大800px，避免长书单产生巨型canvas。

证据：tools/_original-shelf/ 下的截图、result.json、inspect/report.json、build.log。
本轮未完成专用性能 trace，因此不声明达到严格60fps或零100ms长任务；未运行桌面Electron安装包完整回归。
