<script setup>
/* 知识库模型页：面板窗口的 knowledge 分区搬进隐现设置外壳。
 * 控件本体仍是 components/ai/KnowledgeModelSettings.vue；空态里的「前往模型设置」照旧抛 go-ai，
 * 由外壳接到模型设置页（面板窗口里也是同一跳法：@go-ai="page = 'ai'"）。 */
import KnowledgeModelSettings from '../../../ai/KnowledgeModelSettings.vue'

const emit = defineEmits(['go-ai'])
</script>

<template>
  <div class="desktop-layout">
    <section class="setting-group desktop-embed-group" data-setting="knowledgeModel">
      <div class="section-title">
        <h2>知识库模型</h2>
        <small>向量模型 · 语义检索</small>
      </div>

      <div class="setting-row desktop-intro-row">
        <div class="setting-copy">
          <strong>跟随当前预设</strong>
          <p>向量模型不另设连接，沿用当前供应商预设的地址与密钥；换地址请先到「模型设置」。</p>
        </div>
      </div>

      <div class="desktop-embed">
        <KnowledgeModelSettings @go-ai="emit('go-ai')" />
      </div>

      <p class="section-note">语义检索默认关闭，失败时回落关键词检索；改动在下次检索或建库时生效。</p>
    </section>
  </div>
</template>
