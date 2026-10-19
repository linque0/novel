<!-- 大纲侧边栏（8.8.2）：模块条目列表——搜索 / 类型筛选 / 新建（事件·便签·引用卡·分组）/ 定位画布 / 删除；
     断线检测列表；条目点击选中并让画布居中 -->
<script setup>
import OIcon from './OIcon.vue'
import { computed, ref, onMounted, watch } from 'vue'
import { NButton, NPopover, NModal, NInput, NDropdown } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import { useAiStore } from '../stores/ai'
import { targetById } from '../services/doublelinks'
import { STATUS } from './outline/outline-paper'
import { scopeStats, nodeStats } from './outline/outline-scope.js'
import DLinkPicker from './DLinkPicker.vue'

const work = useWorkStore()
const ui = useUiStore()
const ai = useAiStore()
const q = ref('')
const typeFilter = ref('全部')
const showBroken = ref(false)
const citePicker = ref(false)
const typeManage = ref(false)
const newTypeName = ref('')
const advancedOpen = ref(false)
const treeState = ref(new Map())
const bookStats = computed(() => scopeStats(work.liveOlnodes(), null))
const bookMark = computed(() => Array.from(work.work?.title || '故事').filter(c => /[\p{L}\p{N}]/u.test(c)).slice(0,2))
const bookSubtitle = computed(() => work.liveVolumes.find(v => v.id === work.selVolumeId)?.title || work.liveVolumes[0]?.title || '故事大纲')
const treeIsOpen = n => treeState.value.has(n.id) ? treeState.value.get(n.id) : !n.fold
function toggleTree(n) { const next = new Map(treeState.value); next.set(n.id, !treeIsOpen(n)); treeState.value = next }
function home() { work.outlineView = 'canvas'; work.selOlnodeId = null; work.canvasFocusTick++ }
watch(() => work.work?.id, () => { treeState.value = new Map(); q.value = ''; typeFilter.value = '全部' })
const statsOf = n => nodeStats(work.liveOlnodes(), n.id)

const customTypes = computed(() => work.olTypes)
/* 分层画布：侧栏新建/定位跟随当前层；进入容器后不会把模块误加到根层。 */
const canvasScopeId = computed(() => {
  const id = work.canvasPrefs.scopeId
  if (!id) return null
  return work.liveOlnodes().some((n) => n.id === id && n.kind === 'container') ? id : null
})
const scopeNode = computed(() => (canvasScopeId.value ? work.liveOlnodes().find((n) => n.id === canvasScopeId.value) : null))
const layerTitle = computed(() => scopeNode.value?.title || '全书')
const layerItems = computed(() => work.olnodeChildren(canvasScopeId.value))
/* 引力书舱按设计稿在「＋」与类型名之间留一个空格，原版保持原紧排文案 */
const addLabel = (t) => (ui.skin === 'gravity' ? '＋ ' + t : '＋' + t)
function addType() {
  const t = work.olTypeAdd(newTypeName.value)
  if (t) newTypeName.value = ''
}
function relsCount(n) {
  return (Array.isArray(n.rels) ? n.rels.length : 0) + work.liveOlnodes().filter((o) => (o.rels || []).some((r) => r.toId === n.id)).length
}

const TYPE_META = {
  event: { icon: 'diamond', label: '事件' },
  note: { icon: 'edit', label: '便签' },
  cite: { icon: 'link', label: '引用' },
  textbox: { icon: 'textbox', label: '文本框' },
  container: { icon: 'container', label: '容器' },
  volume: { icon: 'rows', label: '卷' },
  anchor: { icon: 'anchor', label: '章节' }
}
const TYPES = computed(() => ['全部', '事件', '便签', '引用', '文本框', '容器', '章节', '卷', ...customTypes.value.map((t) => t.name)])

function chapterOf(n) {
  return n.kind === 'anchor' ? work.chapters.find((c) => c.id === n.refId && !c.deletedAt) : null
}
function volumeOf(n) {
  return n.kind === 'volume' ? work.volumes.find((v) => v.id === n.refId && !v.deletedAt) : null
}
function labelOf(n) {
  if (n.kind === 'anchor') return chapterOf(n)?.title || '（已删章节）'
  if (n.kind === 'volume') return volumeOf(n)?.title || n.title || '（已删卷）'
  if (n.kind === 'cite') {
    const t = /^(\w+):(.+)$/.exec(n.refId || '')
    const target = t ? targetById(t[1], t[2]) : null
    return n.title || target?.title || '（未选择目标）'
  }
  return n.title || (n.text || '').split('\n').find((x) => x.trim())?.trim().slice(0, 20) || '（空模块）'
}
function typeLabel(n) {
  if (n.kind === 'anchor') return '章节'
  return TYPE_META[n.kind]?.label || '事件'
}
function typeIcon(n) {
  if (n.kind === 'anchor') return '⚓'
  return TYPE_META[n.kind]?.icon || '◆'
}

const metaOf = (n, depth) => {
  const ch = chapterOf(n)
  const broken = work.olBroken
  const isTail = broken.tails.some((t) => t.id === n.id)
  const isMissing = broken.missing.some((t) => t.id === n.id)
  const rels = relsCount(n)
  const mtype = n.mtype || ''
  const parent = n.parentId ? work.olnodes.find((x) => x.id === n.parentId && !x.deletedAt) : null
  return {
    n,
    depth,
    hasKids: n.kind === 'container' && work.olnodeChildren(n.id).length > 0,
    icon: typeIcon(n),
    type: typeLabel(n),
    label: labelOf(n),
    parentLabel: parent ? parent.title || '容器' : '',
    badge: [n.kind === 'event' && n.status ? STATUS[n.status] : '', ch ? `${ch.wordCount || 0}字` : '', n.kind === 'container' ? `${work.olnodeChildren(n.id).length}项` : '', rels ? `↔${rels}` : ''].filter(Boolean).join(' '),
    mtype,
    mcolor: mtype ? work.olTypes.find((t) => t.name === mtype)?.color || 'var(--text-dim)' : '',
    broken: showBroken.value && (isTail || isMissing),
    brokenTip: isTail ? '烂尾情节（无后继）' : isMissing ? '缺铺垫（无来源）' : ''
  }
}

const modules = computed(() => {
  const kw = q.value.trim().toLowerCase()
  const nodes = work.liveOlnodes()
  const match = (m) =>
    (typeFilter.value === '全部' || m.type === typeFilter.value || m.mtype === typeFilter.value) &&
    (!kw || m.label.toLowerCase().includes(kw))
  const byParent = new Map()
  for (const n of nodes) {
    const p = n.parentId || null
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p).push(n)
  }
  for (const list of byParent.values()) list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  const out = []
  const walk = (pid, depth) => {
    for (const n of byParent.get(pid) || []) {
      const m = metaOf(n, depth)
      if (match(m)) out.push(m)
      if (n.kind === 'container' && treeIsOpen(n)) walk(n.id, depth + 1)
    }
  }
  walk(null, 0)
  // 搜索 / 筛选时补充被折叠容器隐藏的匹配项（平铺呈现，带所属容器前缀）
  if (kw || typeFilter.value !== '全部') {
    const seen = new Set(out.map((m) => m.n.id))
    for (const n of nodes) {
      if (seen.has(n.id)) continue
      const m = metaOf(n, 0)
      if (match(m)) out.push(m)
    }
  }
  return out
})

const brokenCount = computed(() => work.olBroken.tails.length + work.olBroken.missing.length)

function pick(m) {
  work.selOlnodeId = m.n.id
  work.canvasFocusTick++
  work.outlineView = 'canvas'
}
function addModule(kind, fields = {}) {
  const siblings = work.olnodeChildren(canvasScopeId.value)
  const row = work.olnodeAdd(canvasScopeId.value, {
    kind,
    title: kind === 'event' ? '新事件' : '',
    canvasX: 60 + (siblings.length % 3) * 280,
    canvasY: 40 + Math.floor(siblings.length / 3) * 220,
    ...fields
  })
  work.selOlnodeId = row.id
  work.canvasFocusTick++
}
/* 文本框默认尺寸随皮肤：引力用设计稿的大文本框，原版保持原有 180×64 */
function addTextbox() {
  addModule('textbox', { opacity: 1 })
}
function onCitePick(t) {
  citePicker.value = false
  const siblings = work.olnodeChildren(canvasScopeId.value)
  const row = work.olnodeAdd(canvasScopeId.value, {
    kind: 'cite',
    refId: t.kind + ':' + t.id,
    title: t.title || '',
    canvasX: 60 + (siblings.length % 3) * 280,
    canvasY: 40 + Math.floor(siblings.length / 3) * 220
  })
  work.selOlnodeId = row.id
  work.canvasFocusTick++
}
function rename(m) {
  /* Electron 不支持 window.prompt（实测抛异常），改用弹窗输入 */
  renameState.value = { show: true, id: m.n.id, value: m.label }
}
function confirmRename() {
  const r = renameState.value
  if (!r.value.trim()) return
  work.olnodeSetTitle(r.id, r.value.trim())
  renameState.value = { show: false, id: null, value: '' }
}
function remove(m) {
  const hasKids = work.olnodeChildren(m.n.id).length
  if (hasKids && !window.confirm(`删除「${m.label}」及其 ${hasKids} 个子条目？`)) return
  if (!hasKids && !window.confirm(`删除「${m.label}」？`)) return
  work.olnodeRemove(m.n.id)
}

/* 附带选中大纲节点并打开对话。 */
const AI_UNSET_HINT = '恍然梦未配置：请先在设置中完成恍然梦配置'
function aiPlan(m) {
  if (!ai.ready) return window.$msg?.warning(AI_UNSET_HINT)
  ai.prepare('请讨论这个大纲节点的后续安排。', {outlineId:m.n.id})
}

const renameState = ref({ show: false, id: null, value: '' })

onMounted(() => {
  if (!ai.loaded) ai.loadSettings() // 保障入口置灰判定基于已装载的配置（幂等）
})
</script>

<template>
  <div class="ol-side-root ol-paper-sidebar">
    <div class="ol-side-scroll">
      <button class="ol-book-root" type="button" title="返回全书画布" @click="home">
        <span class="ol-book-mark" aria-hidden="true"><span v-for="(c,i) in bookMark" :key="i">{{ c }}</span></span>
        <span class="ol-book-text"><strong>{{ work.work?.title || '未命名作品' }}</strong><small>{{ bookSubtitle }}</small></span>
      </button>
      <div class="ol-side-section"><span>故事结构</span><span>{{ bookStats.total ? bookStats.done + ' / ' + bookStats.total : '0' }} 事件</span></div>
      <label class="ol-story-search"><OIcon name="search" :size="13" /><input v-model="q" placeholder="查找模块…" aria-label="侧栏搜索模块" /><button type="button" :aria-expanded="advancedOpen" title="类型筛选与管理" @click.prevent="advancedOpen = !advancedOpen"><OIcon name="gear" :size="13" /></button></label>
      <div v-if="advancedOpen" class="ol-story-filters">
        <div class="ol-typefilter"><button v-for="t in TYPES" :key="t" type="button" class="om-chip" :class="{on:typeFilter===t}" :aria-pressed="typeFilter===t" @click="typeFilter=t">{{ t }}</button><button class="om-chip" type="button" title="管理自定义类型" :aria-expanded="typeManage" @click="typeManage=!typeManage"><OIcon name="plus" :size="11" /> 类型</button></div>
        <div v-if="typeManage" class="ol-type-manage">
          <div v-for="t in customTypes" :key="t.name" class="ol-type-row"><span class="om-mtype" :style="{color:t.color,borderColor:t.color}">{{ t.name }}</span><button class="ol-op" :title="'删除类型 '+t.name" @click="work.olTypeRemove(t.name)"><OIcon name="close" :size="11" /></button></div>
          <div class="ol-type-row"><input v-model="newTypeName" class="rp-input" placeholder="新类型名…" @keyup.enter="addType" /><button class="ol-op" title="添加类型" @click="addType"><OIcon name="plus" :size="11" /></button></div>
        </div>
      </div>
      <div class="ol-story-tree" aria-label="故事结构树">
        <div v-for="m in modules" :key="m.n.id" class="ol-story-row" :class="{active:work.selOlnodeId===m.n.id,current:canvasScopeId===m.n.id,'ol-broken-item':m.broken}" :data-story-id="m.n.id" :style="{'--depth':m.depth}" :title="m.brokenTip || m.label">
          <button v-if="m.hasKids" type="button" class="ol-tree-toggle" :aria-label="(treeIsOpen(m.n)?'收起':'展开')+m.label+'结构'" :aria-expanded="treeIsOpen(m.n)" @click="toggleTree(m.n)"><OIcon :name="treeIsOpen(m.n)?'caret-down':'caret-right'" :size="10" /></button><span v-else class="ol-tree-dot" aria-hidden="true"></span>
          <button class="ol-tree-name" type="button" :title="'定位：'+m.label" @click="pick(m)">{{ m.label }}</button>
          <span v-if="m.n.kind==='container'" class="ol-tree-count">{{ statsOf(m.n).total }}</span><i v-else class="ol-tree-state" :class="m.n.status || ''" :title="STATUS[m.n.status] || m.type"></i>
          <NDropdown trigger="click" :options="[{key:'rename',label:'重命名'},{key:'ai',label:'发送给恍然梦',disabled:!ai.ready},{key:'remove',label:'删除'}]" @select="key=>key==='rename'?rename(m):key==='ai'?aiPlan(m):remove(m)"><button class="ol-tree-more" type="button" :aria-label="m.label+'的操作'" @click.stop>⋯</button></NDropdown>
        </div>
        <p v-if="!modules.length" class="ol-side-empty">{{ q || typeFilter!=='全部'?'没有匹配的模块。':'添加模块，开始搭建故事。' }}</p>
      </div>
      <div class="ol-side-section"><span>添加模块</span><span>工具箱</span></div>
      <div class="ol-paper-palette" aria-label="模块工具箱">
        <button type="button" @click="addModule('event')"><OIcon name="diamond" :size="16" />事件</button>
        <button type="button" @click="addModule('note',{title:'新便签'})"><OIcon name="edit" :size="16" />便签</button>
        <NPopover trigger="click" :show-arrow="false"><template #trigger><button type="button" title="添加引用卡"><OIcon name="link" :size="16" />引用卡</button></template><DLinkPicker @pick="onCitePick" /></NPopover>
        <button type="button" @click="addTextbox"><OIcon name="textbox" :size="16" />文本框</button>
        <button type="button" title="添加章节锚点（可在设置中绑定章节）" @click="addModule('anchor')"><OIcon name="anchor" :size="16" />章节锚点</button>
        <button type="button" title="添加卷锚点" @click="addModule('volume',{refId:work.selVolumeId || work.liveVolumes[0]?.id || null})"><OIcon name="rows" :size="16" />卷</button>
        <button class="ol-add-container" type="button" @click="addModule('container',{title:'新容器'})"><OIcon name="container" :size="16" />容器<span>＋</span></button>
      </div>
      <div class="ol-side-section"><span>本层模块</span><span>{{ layerItems.length }}</span></div>
      <div class="ol-layer-list" aria-label="本层模块列表"><button v-for="n in layerItems" :key="n.id" type="button" :class="{active:work.selOlnodeId===n.id}" @click="pick({n})"><OIcon :name="TYPE_META[n.kind]?.icon || 'diamond'" :size="13" /><span>{{ labelOf(n) }}</span><small v-if="n.kind==='container'">{{ statsOf(n).total ? statsOf(n).done + '/' + statsOf(n).total : '空容器' }}</small></button></div>
    </div>
    <div class="ol-paper-side-footer"><span class="ol-paper-stamp" aria-hidden="true">PAPER<br>STORIES</span><button type="button" :class="{on:showBroken}" title="断线检测：烂尾 / 缺铺垫" @click="showBroken=!showBroken">断线 {{ brokenCount }}</button></div>
    <NModal v-model:show="renameState.show" preset="dialog" title="重命名模块">
      <NInput v-model:value="renameState.value" placeholder="模块名称" @keyup.enter="confirmRename" />
      <template #action>
        <NButton size="small" @click="renameState.show = false">取消</NButton>
        <NButton size="small" type="primary" @click="confirmRename">确定</NButton>
      </template>
    </NModal>
  </div>
</template>
