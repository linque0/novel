<!-- 设定详情页（全屏页，ui.loreDetailId 驱动；App 主窗口与 PanelHost 各挂一份）：
     面包屑（根→当前，点击祖先就地切换）/ 大标题 + 标签卡片 /
     关联关系列表（图二样式，点击：设定切换详情·人物跳转；↗ 跳原位置）/
     关系图谱（LoreGraph：可拖动 + 位置记忆 + 悬停联动列表高亮）/ 子条目树（点击切换）；
     Esc 或「返回」退出，「幕布中定位」关闭页面并闪烁定位原条目 -->
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NButton } from 'naive-ui'
import OIcon from './OIcon.vue'
import LoreRelRows from './LoreRelRows.vue'
import LoreGraph from './LoreGraph.vue'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import { jumpTo } from '../services/doublelinks'
import { tagColor } from '../services/tagcolors'

const work = useWorkStore()
const ui = useUiStore()

const node = computed(() => (ui.loreDetailId ? work.mubu.find((n) => n.id === ui.loreDetailId && !n.deletedAt) || null : null))
const entries = computed(() => (node.value ? work.loreLinksOf('mubu', node.value.id) : []))
const hoverLink = ref(null)

/** 面包屑：根 → …… → 当前（祖先可点，就地切换详情页） */
const crumbs = computed(() => {
  const out = []
  let cur = node.value
  let guard = 0
  while (cur && guard++ < 30) {
    out.unshift({ id: cur.id, text: (cur.text || '（空节点）').slice(0, 24) })
    cur = cur.parentId ? work.mubu.find((n) => n.id === cur.parentId && !n.deletedAt) || null : null
  }
  return out
})
/** 子条目（递归展开为缩进列表） */
const kids = computed(() => {
  const out = []
  if (!node.value) return out
  const walk = (list, depth) => {
    for (const n of list) {
      out.push({ id: n.id, text: (n.text || '').trim() || '（空节点）', depth, hasChildren: work.mubuChildren(n.id).length > 0 })
      walk(work.mubuChildren(n.id), depth + 1)
    }
  }
  walk(work.mubuChildren(node.value.id), 0)
  return out
})
function tagStyle(t) {
  const c = tagColor(t)
  return {
    color: c,
    borderColor: `color-mix(in srgb, ${c} 42%, transparent)`,
    background: `color-mix(in srgb, ${c} 9%, transparent)`
  }
}

function close() {
  ui.loreDetailId = null
}
function goTo(id) {
  if (id) ui.loreDetailId = id
}
/** 关系行点击：目标为设定 → 切换详情页；人物 → 关闭页面并跳人物模块 */
function pickRel(e) {
  if (e.otherKind === 'mubu') {
    ui.loreDetailId = e.otherId
    return
  }
  close()
  jumpTo({ kind: 'character', id: e.otherId })
}
/** 「↗ 跳原位置」：关闭页面 + 定位闪烁（设定）/ 跳转（人物） */
function jumpRel(e) {
  close()
  jumpTo({ kind: e.otherKind, id: e.otherId })
}
function locate() {
  const id = node.value?.id
  close()
  if (id) jumpTo({ kind: 'mubu', id })
}
function openRelPanel() {
  if (!node.value) return
  ui.loreRelationPanel = { kind: 'mubu', id: node.value.id, x: Math.max(8, window.innerWidth / 2 - 170), y: 110 }
}
function filterTag(t) {
  ui.loreDetailId = null
  ui.mubuQuery = t
}
function onHoverRel(e) {
  hoverLink.value = e ? e.linkId : null
}
function onKey(e) {
  if (e.key !== 'Escape' || !ui.loreDetailId) return
  if (document.querySelector('.n-modal')) return
  if (ui.mubuTagPanel || ui.loreRelationPanel) return // 浮层先收（各自处理 Esc）
  close()
}
/* 节点被删除 / 换作品：自动收起 */
watch(node, (n) => {
  if (ui.loreDetailId && !n) ui.loreDetailId = null
})
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div v-if="node" class="ldt-page">
    <div class="ldt-top">
      <button class="ldt-back" type="button" title="返回（Esc）" @click="close"><OIcon name="back" :size="14" /> 返回</button>
      <nav class="ldt-crumbs">
        <template v-for="(c, i) in crumbs" :key="c.id">
          <span v-if="i" class="ldt-crumb-sep">/</span>
          <button class="ldt-crumb" :class="{ cur: i === crumbs.length - 1 }" type="button" :title="c.text" @click="goTo(c.id)">{{ c.text }}</button>
        </template>
      </nav>
      <span style="flex: 1"></span>
      <NButton size="small" @click="locate"><OIcon name="map-pin" :size="12" /> 幕布中定位</NButton>
    </div>

    <div class="ldt-body">
      <h1 class="ldt-title">{{ (node.text || '').trim() || '（空节点）' }}</h1>
      <div v-if="(node.tags || []).length" class="ldt-tags">
        <button v-for="t in node.tags" :key="t" class="ob-tag" type="button" :style="tagStyle(t)" :title="`筛选标签「${t}」`" @click="filterTag(t)">{{ t }}</button>
      </div>

      <div class="ldt-sec">
        <div class="ldt-sec-head">
          <span class="ldt-sec-title">关联关系</span>
          <span class="ldt-sec-sub">{{ entries.length }} 条</span>
          <span style="flex: 1"></span>
          <NButton size="tiny" @click="openRelPanel"><OIcon name="plus" :size="11" /> 添加关系</NButton>
        </div>
        <LoreRelRows
          v-if="entries.length"
          :entries="entries"
          :hover-link="hoverLink"
          @pick="pickRel"
          @hover="onHoverRel"
        />
        <div v-else class="ldt-empty">暂无关联关系——点右上「添加关系」，或在幕布条目上右键「设置关系…」</div>
      </div>

      <div class="ldt-sec">
        <div class="ldt-sec-head">
          <span class="ldt-sec-title">关系图谱</span>
          <span class="ldt-sec-sub">拖动邻居调整布局（自动记忆）</span>
        </div>
        <div class="ldt-graph">
          <LoreGraph :node-id="node.id" :entries="entries" @pick="pickRel" @hover="onHoverRel" />
        </div>
      </div>

      <div class="ldt-sec">
        <div class="ldt-sec-head">
          <span class="ldt-sec-title">子条目</span>
          <span class="ldt-sec-sub">{{ kids.length }} 项</span>
        </div>
        <div v-if="kids.length" class="ldt-kids">
          <div
            v-for="k in kids"
            :key="k.id"
            class="ldt-kid"
            :style="{ paddingLeft: 6 + k.depth * 20 + 'px' }"
            :title="k.text"
            @click="goTo(k.id)"
          >
            <span class="ldt-kid-dot" :class="{ 'has-children': k.hasChildren }" />
            <span class="ldt-kid-text">{{ k.text }}</span>
          </div>
        </div>
        <div v-else class="ldt-empty">暂无子条目</div>
      </div>
    </div>
  </div>
</template>
