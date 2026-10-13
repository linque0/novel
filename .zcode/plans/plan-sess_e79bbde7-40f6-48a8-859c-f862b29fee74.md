# 方案：模型参数自动填入对齐 ZCode 行为

## 一、stores/ai.js——匹配即自动写入参数

- 新增动作 `autoFillModelCfg(name)`：该模型无已保存配置且 `lookupModelMeta(name)` 命中时，自动创建专属参数（enabled=true，上下文窗口/最大输出/备注取自参数表）并持久化
- `selectModel`（点选使用）与 `addModel`（手动添加/从拉取结果加入）末尾调用——**当前模型匹配到参数表时，参数自动填入并立即生效**（effectiveBudget 收敛、max_tokens 随请求发送），无需手动打开编辑弹窗
- 已保存过配置的模型不覆盖（用户手改值优先）

## 二、AiSettings.vue——列表行显示参数徽标

- 模型列表每行显示参数徽标（仿截图中的「1M」标）：优先取已启用专属配置的上下文窗口，否则取参数表匹配值，格式化为「1M / 500K / 256K / 131K…」；无匹配不显示
- 编辑弹窗预填保持现状（已保存配置优先，缺失字段用官方参考值补位 + 预填提示行）

## 交付

`node node_modules/vite/bin/vite.js build` 通过；不提交不推送。