<script setup>
import { computed } from 'vue'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import { tagColor } from '../services/tagcolors'

const work = useWorkStore()
const ui = useUiStore()

const visible = computed(() => {
  const live = work.liveMubu()
  const byParent = new Map()
  for (const n of live) {
    const p = n.parentId || null
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p).push(n)
  }
  const out = []
  const walk = (list, depth) => {
    for (const n of list) {
      const hasChildren = (byParent.get(n.id) || []).length > 0
      out.push({ node: n, depth, hasChildren })
      if (!n.fold) walk(byParent.get(n.id) || [], depth + 1)
    }
  }
  walk(byParent.get(null) || [], 0)
  return out
})

/* ---------- 设定检索（按节点内容或标签命中；点击定位复用 loreFocusId 展开+闪烁） ---------- */
const q = computed(() => (ui.mubuQuery || '').trim())
const hits = computed(() => {
  const kw = q.value.toLowerCase()
  if (!kw) return null
  const live = work.liveMubu()
  const byId = new Map(live.map((n) => [n.id, n]))
  /* 祖先路径（最多向上 2 层），帮助区分同名节点 */
  const pathOf = (n) => {
    const segs = []
    let p = byId.get(n.parentId)
    while (p && segs.length < 2) {
      segs.unshift(p.text || '（空）')
      p = byId.get(p.parentId)
    }
    return segs.join(' › ')
  }
  return live
    .filter((n) => (n.text || '').toLowerCase().includes(kw) || (n.tags || []).some((t) => t.toLowerCase().includes(kw)))
    .map((n) => ({ node: n, path: pathOf(n), tags: n.tags || [] }))
})
const isTagHit = (t) => !!q.value && t.toLowerCase().includes(q.value.toLowerCase())
function clearQuery() {
  ui.mubuQuery = ''
}

function select(n) {
  ui.loreFocusId = n.id
  ui.mubuSelectedId = n.id
}
/** 双击条目 → 打开设定详情页（先选中该节点） */
function openDetail(n) {
  ui.mubuSelectedId = n.id
  ui.loreDetailId = n.id
}
/** 右键条目 → 打开标签面板（先选中该节点，面板定位到右键坐标） */
function openTags(n, e) {
  e.preventDefault()
  select(n)
  ui.mubuTagPanel = { nodeId: n.id, x: e.clientX, y: e.clientY }
}
function isActive(n) {
  return ui.mubuSelectedId === n.id || ui.loreFocusId === n.id
}
function toggleFold(n, e) {
  e.stopPropagation()
  work.mubuToggleFold(n.id)
  ui.mubuSyncTick++
}
function foldAll(v) {
  work.mubuFoldAll(v)
  ui.mubuSyncTick++
}
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%">
    <div class="side-head">
      <span style="font-size: 12px; color: var(--text-dim)">节点层级 · 点击定位 · 双击详情 · 右键设标签</span>
      <div style="flex: 1"></div>
      <button class="btn-ghost" style="font-size: 11px; padding: 1px 6px" title="全部折叠" @click="foldAll(true)">▾</button>
      <button class="btn-ghost" style="font-size: 11px; padding: 1px 6px" title="全部展开" @click="foldAll(false)">▸</button>
    </div>
    <div class="side-search">
      <input v-model="ui.mubuQuery" class="rp-input" type="text" placeholder="搜索内容或标签…" spellcheck="false" />
      <button v-if="q" class="side-search-clear" type="button" title="清除搜索" @click="clearQuery">×</button>
    </div>
    <div class="side-list">
      <!-- 检索结果（有搜索词时切换为命中列表） -->
      <template v-if="hits">
        <div
          v-for="h in hits"
          :key="'h:' + h.node.id"
          class="mt-hit"
          :class="{ active: isActive(h.node) }"
          role="button"
          tabindex="0"
          :title="h.node.text"
          @click="select(h.node)"
          @keydown.enter="select(h.node)"
          @dblclick="openDetail(h.node)"
          @contextmenu="openTags(h.node, $event)"
        >
          <div class="mt-hit-main">
            <span class="mt-hit-dot" :style="{ background: h.tags.length ? tagColor(h.tags[0]) : 'var(--text-faint, #999)' }" />
            <span class="mt-hit-text">{{ h.node.text || '（空）' }}</span>
          </div>
          <div v-if="h.path || h.tags.length" class="mt-hit-sub">
            <span v-if="h.path" class="mt-hit-path" :title="h.path">{{ h.path }}</span>
            <span
              v-for="t in h.tags"
              :key="t"
              class="mt-hit-tag"
              :class="{ on: isTagHit(t) }"
              :style="{ color: tagColor(t) }"
            >{{ t }}</span>
          </div>
        </div>
        <p v-if="!hits.length" class="side-empty">没有匹配「{{ q }}」的内容或标签</p>
      </template>
      <!-- 常规树 -->
      <template v-else>
        <div
          v-for="r in visible"
          :key="r.node.id"
          class="side-item"
          :class="{ active: isActive(r.node) }"
          :style="{ paddingLeft: 6 + r.depth * 16 + 'px' }"
          role="button"
          tabindex="0"
          @click="select(r.node)"
          @keydown.enter="select(r.node)"
          @dblclick="openDetail(r.node)"
          @contextmenu="openTags(r.node, $event)"
        >
          <button
            v-if="r.hasChildren"
            class="ob-arrow"
            :class="{ folded: r.node.fold }"
            :title="r.node.fold ? '展开子节点' : '折叠子节点'"
            @click.stop="toggleFold(r.node, $event)"
          >
            {{ r.node.fold ? '▸' : '▾' }}
          </button>
          <span v-else class="ob-arrow ob-arrow-leaf">·</span>
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ r.node.text || '（空）' }}</span>
        </div>
        <p v-if="!visible.length" style="font-size: 12px; color: var(--text-dim); padding: 10px">
          设定库为空。在右侧输入内容，回车新建节点。
        </p>
      </template>
    </div>
  </div>
</template>
