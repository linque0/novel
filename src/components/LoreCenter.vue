<script setup>
import { computed } from 'vue'
import { NButton, NSelect } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { pickFiles, arrayBufferToBlob, imageMime, IMAGE_EXTS } from '../services/fileio'

const work = useWorkStore()
const l = computed(() => work.activeLore)

const catOpts = computed(() => [
  { label: '未分类', value: null },
  ...work.liveCategories.map((c) => ({ label: c.name, value: c.id }))
])

const imgs = computed(() => {
  if (!l.value) return []
  void work.urlTick
  return work.linksFor('lore', l.value.id).map((link) => ({
    link,
    url: work.assetUrl(link.assetId)
  }))
})

async function uploadImages() {
  if (!l.value) return
  const files = await pickFiles(IMAGE_EXTS)
  if (!files.length) return
  const ids = []
  for (const f of files) {
    const meta = await work.addAssetBlob(arrayBufferToBlob(f.data, imageMime(f.ext)), f.name)
    await work.linkAsset('lore', l.value.id, meta.id)
    ids.push(meta.id)
  }
  await work.warmUrls(ids)
}
</script>

<template>
  <div v-if="l" style="flex: 1; display: flex; flex-direction: column; padding: 22px 34px; min-height: 0; overflow: auto">
    <div style="display: flex; gap: 10px; margin-bottom: 12px">
      <NInput class="rp-input" :value="l.title" placeholder="条目标题" style="flex: 1; font-size: 16px; font-weight: 700" @update:value="(v) => work.updateLore(l.id, { title: v })" />
      <NSelect :value="l.categoryId" :options="catOpts" size="small" style="width: 130px" @update:value="(v) => work.updateLore(l.id, { categoryId: v })" />
      <NButton size="small" quaternary type="error" @click="work.deleteLore(l.id)">删除</NButton>
    </div>
    <NSelect
      :value="l.tags"
      multiple
      tag
      filterable
      clearable
      size="small"
      placeholder="标签（回车添加）"
      :options="[]"
      style="margin-bottom: 12px"
      @update:value="(v) => work.updateLore(l.id, { tags: v })"
    />
    <textarea
      class="rp-textarea"
      style="flex: 1; min-height: 260px; font-size: 15px; line-height: 2"
      :value="l.content"
      placeholder="在这里描述这个设定：外观、规则、历史、与其他设定的关联……"
      @input="(e) => work.updateLore(l.id, { content: e.target.value })"
    ></textarea>

    <hr class="divider" />
    <div class="rp-title">
      配图
      <NButton size="tiny" @click="uploadImages">＋上传</NButton>
    </div>
    <div class="thumb-grid">
      <div v-for="it in imgs" :key="it.link.id" class="thumb">
        <img v-if="it.url" :src="it.url" />
        <button class="x" @click="work.unlinkAsset(it.link.id)">✕</button>
      </div>
    </div>
  </div>
  <div v-else class="empty-shelf" style="padding-top: 140px">
    <div class="big">世界自成经纬</div>
    <p>从左侧选择或新建一个设定条目。</p>
  </div>
</template>
