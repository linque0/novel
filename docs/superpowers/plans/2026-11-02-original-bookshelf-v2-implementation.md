# 午后藏书室 V2 Implementation Plan

Goal: 实施已批准 V2，只修改原版书架。
Architecture: OriginalShelf.vue 管理搜索/状态/分页/选择和DOM；OriginalShelfScene.vue 管理场景生命周期及投影；original-shelf-scene.mjs 管理Three几何/材质/光照；original-shelf-layout.mjs 提供纯布局。
Tech Stack: Vue 3、现有 Three.js、Naive UI。
Spec: 2026-11-02-original-bookshelf-v2-design-prompts.md。

约束：现有脏工作目录继续使用，不覆盖其他修改、不自动提交。保持其他皮肤及工作台。Hindsight工具当前未暴露，无法检索或capture。

- [x] 测试固定布局、厚度与安全空间，完成统一比例的两层架与实体书。
- [x] 接入材质、光照、投影控制及抽书动作；相机固定、阴影真实更新。
- [x] 替换原版Vue壳，状态筛选、分页和底部阅读台；保留打开/编辑/删除契约。
- [x] 手机/无WebGL书单、reduced motion、资源清理和错误降级。
- [x] 浏览器截图和真实交互检查，编译检查，独立评审后修复。

Review focus: 100本仅加载当前页8本，两层架分页，所有作品仍可搜索/书单访问；搜索/筛选/翻页选择必须一致；异步Three加载卸载竞态；上下文丢失；删除完成后焦点恢复；动画不得增加GPU常驻负载。
Ruling: 大量作品采用8本一组的书架分页，替代长页面巨型场景；显示范围/总数与显式翻页，完整书单模式可访问所有结果。

验证完成：5项Node测试；隔离浏览器完整交互；生产构建及生产WebGL资源/空闲停绘；独立评审的遮挡命中已修复。验证细节见同目录V2验收记录。
