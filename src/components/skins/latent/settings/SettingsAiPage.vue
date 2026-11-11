<script setup>
/* 模型设置页：把面板窗口的 ai 分区搬进隐现设置外壳。
 * 控件本体仍是 components/ai/AiSettings.vue（一份实现，两处复用），这里只补隐现的页面骨架：
 * 页头说明 + setting-group/setting-row/setting-copy + 嵌入区。旧皮肤的 ai-set-* / ai-mc-* / ai-tpl-*
 * 由 styles/skins/latent/settings-desktop.css 在 body[data-skin=dsh] 内映射到本页语言。 */
import AiSettings from '../../../ai/AiSettings.vue'
</script>

<template>
  <div class="desktop-layout">
    <section class="setting-group desktop-embed-group" data-setting="aiModelSettings">
      <div class="section-title">
        <h2>模型设置</h2>
        <small>供应商预设 · 模型 · 参数</small>
      </div>

      <div class="setting-row desktop-intro-row">
        <div class="setting-copy">
          <strong>供应商与模型</strong>
          <p>左侧选预设，右侧填连接、挑模型、调这套预设的生成参数；每改一项即时保存。</p>
        </div>
      </div>

      <div class="desktop-embed">
        <AiSettings />
      </div>

      <p class="section-note">预设与密钥只存在当前设备；密钥经系统凭据加密，不进备份文件。</p>
    </section>
  </div>
</template>
