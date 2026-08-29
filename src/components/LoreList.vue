<script setup>
import { computed, ref } from 'vue'
import { NButton, NModal, NInput, NPopconfirm } from 'naive-ui'
import { useWorkStore } from '../stores/work'

const work = useWorkStore()
const catFilter = ref('all') // all | none | categoryId
const showCatMgr = ref(false)
const catDraft = ref([])

const filtered = computed(() => {
  let list = work.liveLore
  if (catFilter.value === 'none') list = list.filter((l) => !work.liveCategories.some((c) => c.id === l.categoryId))
  else if (catFilter.value !== 'all') list = list.filter((l) => l.categoryId === catFilter.value)
  return list
})

function openCatMgr() {
  catDraft.value = work.liveCategories.map((c) => ({ ...c }))
  showCatMgr.value = true
}
function saveCatMgr() {
  for (const d of catDraft.value) {
    const orig = work.lorecats.find((c) => c.id === d.id)
    if (orig && orig.name !== d.name) work.updateLorecat(orig.id, d.name)
  }
  showCatMgr.value = false
}
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%">
    <div class="side-head">
      <NButton size="tiny" type="primary" @click="work.addLore(catFilter === 'all' || catFilter === 'none' ? null : catFilter)">＋条目</NButton>
      <NButton size="tiny" @click="work.addCategory(`新分类${work.liveCategories.length + 1}`)">＋分类</NButton>
      <NButton size="tiny" quaternary @click="openCatMgr">管理</NButton>
    </div>
    <div style="padding: 0 10px; display: flex; flex-wrap: wrap; gap: 4px">
      <span class="mini-tag" style="cursor: pointer" :style="catFilter === 'all' ? 'color:var(--accent);border-color:var(--accent)' : ''" @click="catFilter = 'all'">全部</span>
      <span
        v-for="cat in work.liveCategories"
        :key="cat.id"
        class="mini-tag"
        style="cursor: pointer"
        :style="catFilter === cat.id ? 'color:var(--accent);border-color:var(--accent)' : ''"
        @click="catFilter = cat.id"
      >
        {{ cat.name }}
      </span>
      <span class="mini-tag" style="cursor: pointer" :style="catFilter === 'none' ? 'color:var(--accent);border-color:var(--accent)' : ''" @click="catFilter = 'none'">未分类</span>
    </div>
    <div class="side-list">
      <div
        v-for="l in filtered"
        :key="l.id"
        class="side-item"
        :class="{ active: work.selLoreId === l.id }"
        role="button"
        tabindex="0"
        @click="work.selLoreId = l.id"
        @keydown.enter="work.selLoreId = l.id"
      >
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ l.title }}</span>
        <span class="dim">{{ (l.content || '').length > 0 ? l.content.length + '字' : '' }}</span>
      </div>
      <p v-if="!filtered.length" style="font-size: 12px; color: var(--text-dim); padding: 10px">
        设定库为空。可建立「地点 / 势力 / 物品 / 体系 / 大事记」等条目，构建你的世界观。
      </p>
    </div>

    <NModal v-model:show="showCatMgr" preset="dialog" title="管理分类">
      <div style="display: flex; flex-direction: column; gap: 6px; max-height: 320px; overflow: auto">
        <div v-for="(cat, i) in catDraft" :key="cat.id" class="field-row">
          <NInput v-model:value="cat.name" size="small" />
          <NButton size="tiny" quaternary type="error" @click="catDraft.splice(i, 1)">✕</NButton>
        </div>
      </div>
      <template #action>
        <NButton @click="showCatMgr = false">取消</NButton>
        <NPopconfirm @positive-click="saveCatMgr">
          <template #trigger>
            <NButton type="primary">保存（删除的分类不会删除条目）</NButton>
          </template>
          确认保存分类修改？
        </NPopconfirm>
      </template>
    </NModal>
  </div>
</template>
