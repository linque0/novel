<script setup>
import { computed, watch } from 'vue'
import { NButton, NTag, NSelect } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { pickFiles, arrayBufferToBlob, imageMime, IMAGE_EXTS } from '../services/fileio'
import { stripTags } from '../services/wordcount'
import { parseBeats, toggleBeatLine, BEAT_RE } from '../services/outlineBeats'
import { parseTokens, findByTitle, jumpTo, KIND_LABEL } from '../services/doublelinks'

const work = useWorkStore()
const ch = computed(() => work.activeChapter)

const outline = computed(() => {
  if (!ch.value) return null
  return work.ensureOutline(ch.value.id)
})

/* 节拍勾选（8.8-O3）：与大纲页同一文本约定 */
const beats = computed(() => parseBeats(outline.value?.content))
function toggleBeat(index) {
  if (!outline.value) return
  work.updateOutline(outline.value.id, toggleBeatLine(outline.value.content, index))
}

/* 伏笔 / 引用聚合（8.8-O4）：章纲行内的 [[双链]]，清单行的勾选即"已回收 / 未回收" */
const foreshadows = computed(() => {
  const content = outline.value?.content || ''
  if (!content.trim()) return []
  const items = []
  content.split('\n').forEach((line, lineIndex) => {
    const m = line.match(BEAT_RE)
    const checked = m ? m[1].toLowerCase() === 'x' : null
    for (const tok of parseTokens(line)) {
      items.push({
        key: lineIndex + ':' + tok.start,
        lineIndex,
        checked,
        title: tok.title,
        display: tok.display || tok.title,
        resolved: findByTitle(tok.title)
      })
    }
  })
  return items
})
function toggleForeshadow(item) {
  if (item.checked === null || !outline.value) return
  work.updateOutline(outline.value.id, toggleBeatLine(outline.value.content, item.lineIndex))
}

/* 去大纲模块编辑本章章纲（8.8-O1） */
function gotoOutline() {
  if (!ch.value) return
  work.tab = 'outline'
  work.selOutlineId = ch.value.id
}

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
      <div class="rp-title">
        本章大纲
        <NButton size="tiny" title="切到大纲模块编辑本章章纲" @click="gotoOutline">去编辑</NButton>
      </div>
      <textarea
        v-if="outline"
        class="rp-textarea"
        style="min-height: 80px"
        :value="outline.content"
        placeholder="本章要点速记（在大纲页可写长版）"
        @input="(e) => work.updateOutline(outline.id, e.target.value)"
      ></textarea>
      <div v-if="beats.length" class="beat-strip" style="margin-top: 6px">
        <label v-for="b in beats" :key="b.index" class="beat-chip" :class="{ done: b.done }">
          <input type="checkbox" :checked="b.done" @change="toggleBeat(b.index)" />
          <span>{{ b.text || '（空节拍）' }}</span>
        </label>
      </div>
    </div>

    <div class="rp-section">
      <div class="rp-title">本章伏笔 / 引用</div>
      <div v-if="!foreshadows.length" style="font-size: 12px; color: var(--text-dim)">
        在章纲里用双链（选中文字 → 添加双链）指向设定 / 人物，即在此聚合为伏笔清单
      </div>
      <div v-for="it in foreshadows" :key="it.key" class="side-item" style="padding: 5px 8px" :title="it.resolved ? '点击跳转：' + it.resolved.title : '未找到目标：' + it.title">
        <button
          v-if="it.checked !== null"
          class="beat-box"
          :class="{ done: it.checked }"
          :title="it.checked ? '已回收 · 点击改为未回收' : '未回收 · 点击标记已回收'"
          @click="toggleForeshadow(it)"
        >{{ it.checked ? '✓' : '' }}</button>
        <span class="dl-kind">{{ it.resolved ? KIND_LABEL[it.resolved.kind] : '?' }}</span>
        <span
          style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer"
          :style="{ opacity: it.resolved ? 1 : 0.5 }"
          @click="it.resolved && jumpTo(it.resolved)"
        >{{ it.display }}</span>
      </div>
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

