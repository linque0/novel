<script setup>
import { computed, watch } from 'vue'
import { NButton, NTag, NSelect } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { pickFiles, arrayBufferToBlob, imageMime, IMAGE_EXTS } from '../services/fileio'
import { stripTags } from '../services/wordcount'

const work = useWorkStore()
const ch = computed(() => work.activeChapter)

const outline = computed(() => {
  if (!ch.value) return null
  return work.ensureOutline(ch.value.id)
})

const presentChars = computed(() => {
  if (!ch.value) return []
  const text = ch.value.fmt === 'html' ? stripTags(ch.value.content) : ch.value.content || ''
  return work.liveCharacters
    .filter((c) => {
      const names = [c.name, ...(c.aliases || '').split(/[,，、/\s]+/)].filter((n) => n && n.length >= 1)
      return names.some((n) => text.includes(n))
    })
    .map((c) => ({ id: c.id, name: c.name, role: c.role }))
})

const images = computed(() => {
  if (!ch.value) return []
  void work.urlTick
  return work.linksFor('chapter', ch.value.id).map((link) => ({ link, url: work.assetUrl(link.assetId) }))
})

async function uploadImages() {
  if (!ch.value) return
  const files = await pickFiles(IMAGE_EXTS)
  if (!files.length) return
  const ids = []
  for (const f of files) {
    const meta = await work.addAssetBlob(arrayBufferToBlob(f.data, imageMime(f.ext)), f.name)
    await work.linkAsset('chapter', ch.value.id, meta.id)
    ids.push(meta.id)
  }
  await work.warmUrls(ids)
}

watch(
  () => ch.value?.id,
  async () => {
    if (!ch.value) return
    const ids = work.linksFor('chapter', ch.value.id).map((l) => l.assetId)
    if (ids.length) await work.warmUrls(ids)
  },
  { immediate: true }
)
</script>

<template>
  <div v-if="ch" class="right-panel">
    <div class="rp-section">
      <div class="rp-title">本章大纲</div>
      <textarea
        v-if="outline"
        class="rp-textarea"
        style="min-height: 80px"
        :value="outline.content"
        placeholder="本章要点速记（在大纲页可写长版）"
        @input="(e) => work.updateOutline(outline.id, e.target.value)"
      ></textarea>
    </div>

    <div class="rp-section">
      <div class="rp-title">本章出场人物</div>
      <div v-if="!presentChars.length" style="font-size: 12px; color: var(--text-dim)">正文中暂未检测到已建人物的名字</div>
      <div
        v-for="c in presentChars"
        :key="c.id"
        class="side-item"
        style="padding: 5px 8px"
        role="button"
        tabindex="0"
        @click="work.navTo('characters', c.id)"
        @keydown.enter="work.navTo('characters', c.id)"
      >
        <NTag size="tiny" :bordered="false">{{ c.role }}</NTag>
        <span>{{ c.name }}</span>
      </div>
    </div>

    <div class="rp-section">
      <div class="rp-title">
        本章插图
        <NButton size="tiny" @click="uploadImages">＋上传</NButton>
      </div>
      <div v-if="!images.length" style="font-size: 12px; color: var(--text-dim)">拖拽或粘贴图片到正文可直接添加</div>
      <div class="thumb-grid">
        <div v-for="it in images" :key="it.link.id" class="thumb">
          <img v-if="it.url" :src="it.url" />
          <button class="x" @click="work.unlinkAsset(it.link.id)">✕</button>
        </div>
      </div>
    </div>

    <div class="rp-section">
      <div class="rp-title">本章信息</div>
      <div style="font-size: 12px; color: var(--text-dim); line-height: 2">
        字数：{{ ch.wordCount || 0 }}<br />
        状态：{{ { draft: '草稿', done: '完成', revise: '待修改' }[ch.status] }}<br />
        更新：{{ new Date(ch.updatedAt || Date.now()).toLocaleString('zh-CN') }}
      </div>
    </div>
  </div>
</template>
