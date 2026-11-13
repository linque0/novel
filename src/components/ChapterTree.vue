<script setup>
import { useOriginalAppearance } from '../composables/useOriginalAppearance'
const { originalOverlayClass,originalActive }=useOriginalAppearance()
import { useGlazeMuseum } from '../composables/useGlazeMuseum'
const { museumPopoverClass, museumLight } = useGlazeMuseum()
import { computed, h, ref, watch } from 'vue'
import { NTree, NButton, NModal, NInput, NPopconfirm, NDropdown, NPopover } from 'naive-ui'
import OIcon from './OIcon.vue'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import { autosave } from '../services/autosave'
import { isLatentSkin } from '../skins/registry'
import { useChapterSort } from '../composables/useChapterSort'

const chapterQuery=ref('')
const work = useWorkStore()
const ui = useUiStore()
const chapterList = ref(null)
const chapterSort = useChapterSort(chapterList, work, chapterQuery)
const props=defineProps({inPanel:Boolean,navigationOnly:Boolean})
const emit=defineEmits(['read','window','collapse'])
const canCollapse=computed(()=>!props.inPanel&&!props.navigationOnly)
const scene=computed(()=>!props.navigationOnly&&(ui.skin==='gravity'||ui.skin==='glaze'))
const latent=computed(()=>isLatentSkin(ui.skin))
const deleteConfirm=ref(false)
const deleteTarget=ref(null)
const totalWords = computed(() => work.liveChapters.reduce((sum, c) => sum + (c.wordCount || 0), 0))

/* 树数据：书签章节加 ★ 前缀 */
const treeData = computed(() => {
  const marked = (key) => {
    if (!key || key.slice(0, 2) !== 'c:') return false
    return work.isChapterBookmarked(key.slice(2))
  }
  return work.treeData.map((v) => ({
    ...v,
    id:v.key==='v:orphans'?null:v.key.slice(2),
    children: (v.children || []).map((c) => ({
      ...c,
      id:c.key.slice(2),
      label: (marked(c.key) ? '★ ' : '') + c.label
    }))
  }))
})

/* 隐现查找：只过滤喂给 NTree 的数据，key 不变，拖拽 / 右键 / 定位语义照旧。
   卷名命中就整卷保留，否则只留命中的章；两样都不中的卷整卷收起。 */
const hitKw = (text) => String(text || '').toLowerCase().includes(chapterQuery.value.trim().toLowerCase())
const filteredTree = computed(() => {
  if (!chapterQuery.value.trim()) return treeData.value
  const out = []
  for (const v of treeData.value) {
    const volumeHit = hitKw(v.label)
    const children = volumeHit ? (v.children || []) : (v.children || []).filter((c) => hitKw(c.label))
    if (!volumeHit && !children.length) continue
    out.push({ ...v, children })
  }
  return out
})

// NTree 的 default-expand-all 会随 data 重算，显式保留用户折叠的卷。
const collapsedVolumes = ref(new Set())
const searchExpandedKeys = ref(null)
const expandedKeys = computed(() => {
  const keys = treeData.value.map((volume) => volume.key)
  if (chapterQuery.value.trim()) return searchExpandedKeys.value ?? keys
  return keys.filter((key) => !collapsedVolumes.value.has(key))
})
watch(chapterQuery, () => { searchExpandedKeys.value = null }, { flush: 'sync' })
watch(() => work.work?.id, () => { collapsedVolumes.value = new Set() })
function onExpanded(keys, _options, { node, action }) {
  if (chapterQuery.value.trim()) {
    searchExpandedKeys.value = keys
  } else if (action === 'collapse') {
    collapsedVolumes.value.add(node.key)
  } else if (action === 'expand') {
    collapsedVolumes.value.delete(node.key)
  }
}

const selectedKeys = computed(() => {
  const keys = []
  if (work.selChapterId) keys.push('c:' + work.selChapterId)
  return keys
})
const selNode = ref(null)
// Opening a chapter through search, creation or another window also moves the
// management target; clicking an already-selected NTree row can emit no keys.
watch([()=>work.selChapterId,scene],([id,enabled])=>{
  if(enabled)selNode.value=id?{type:'chapter',id,key:'c:'+id}:null
},{immediate:true})

function onSelect(keys, _options, meta) {
  // A click on the active chapter emits an empty key list, but still identifies
  // its node. Keep that chapter as the management target after a volume click.
  const key = keys[keys.length - 1] || (scene.value ? meta?.node?.key : null)
  if (!key) return
  const [kind, id] = [key.slice(0, 1), key.slice(2)]
  if (kind === 'c') {
    work.selChapterId = id
    const c = work.chapters.find((x) => x.id === id)
    if (c) work.selVolumeId = c.volumeId
    selNode.value = { type: 'chapter', id, key }
  } else {
    work.selVolumeId = id === 'orphans' ? null : id
    selNode.value = { type: 'volume', id, key }
  }
}

const dragging=ref(null)
const allowDrop = ({ dragNode, node, dropPosition }) => {
  // Naive UI's allowDrop callback supplies the target, not the drag source.
  const source=dragNode||dragging.value
  if(!source)return false
  return source.type === 'volume' && node.type === 'volume' && dropPosition !== 'inside' && !!node.id
}

function onDrop({ node, dragNode, dropPosition }) {
  if (dragNode?.type !== 'volume' || node.type !== 'volume' || dropPosition === 'inside' || !node.id) return
  const ids = work.liveVolumes.map((v) => v.id)
  const from = ids.indexOf(dragNode.id)
  if (from < 0) return
  ids.splice(from, 1)
  let to = ids.indexOf(node.id)
  if (dropPosition === 'after') to += 1
  ids.splice(to, 0, dragNode.id)
  ids.forEach((id, i) => {
    const v = work.volumes.find((x) => x.id === id)
    if (v && v.sortOrder !== i * 1000) {
      v.sortOrder = i * 1000
      autosave.mark('volumes', v)
    }
  })
}

const renderSuffix = ({ option }) =>
  latent.value
    ? h('span', { class: 'chapter-count', 'data-suffix': option.type === 'volume' ? 'volume' : 'chapter' }, option.suffix || '')
    : h('span', { class: 'chapter-count', style: { color:'var(--text-dim)', fontSize:'11px', marginLeft:'6px', display:ui.isStudioSkin ? 'none' : undefined } }, option.suffix || '')
function renderLabel({ option }) {
  if(scene.value){
    const chapter=option.type==='chapter',id=option.key.slice(2)
    const index=chapter?work.chapterOrdinal(id):work.liveVolumes.findIndex(v=>v.id===id)+1
    const name=h(NPopover,{class:museumPopoverClass.value,trigger:'focus',placement:'right',style:{maxWidth:'320px'}},{
      trigger:()=>h('span',{class:'catalog-name',tabindex:0,title:option.label,'aria-label':option.label,onKeydown:e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();onSelect([option.key])}}},option.label),
      default:()=>option.label
    })
    return h('span',{class:chapter?'catalog-chapter':'catalog-volume'},[
      h('span',{class:'catalog-number','aria-hidden':'true'},index>0?String(index).padStart(2,'0'):'—'),
      h('span',{class:'catalog-copy'},chapter?[name,h('small',option.suffix||'0 字')]:[name]),
      ...(!chapter&&option.id?[h('button',{
        type:'button',class:'catalog-volume-edit',title:'编辑卷名','aria-label':'编辑卷名：'+option.label,
        'data-action':'rename-volume','data-volume-target':id,draggable:false,
        onMousedown:e=>e.stopPropagation(),onKeydown:e=>e.stopPropagation(),
        onDragstart:e=>{e.preventDefault();e.stopPropagation()},
        onClick:e=>{e.stopPropagation();openRenameById({type:'volume',id})}
      },[h(OIcon,{name:'edit',size:14})])]:[])
    ])
  }
  if (latent.value) {
    return option.type === 'volume'
      ? h('span', { class: 'ct-vol', 'data-kind': 'volume', title: option.label }, option.label)
      : h('span', { class: 'ct-label', 'data-kind': 'chapter', title: option.label }, option.label)
  }
  if (!ui.isStudioSkin || option.type !== 'chapter') return h('span', option.label)
  const index = work.chapterOrdinal(option.key.slice(2)) || 0
  return h('span', { class: 'gravity-chapter-row' }, [
    h('span', { class: 'gravity-chapter-number' }, String(index).padStart(2, '0')),
    h('span', { class: 'gravity-chapter-copy' }, [h('span', { title: option.label }, option.label), h('small', option.suffix || '0 字')])
  ])
}

async function addVol() {
  const v=await work.addVolume(`第${work.liveVolumes.length + 1}卷`)
  if(scene.value&&v)selNode.value={type:'volume',id:v.id,key:'v:'+v.id}
}
function openNewVolume(){
  if(!work.work||renameSaving.value)return
  renameComposing.value=false
  rename.value={show:true,kind:'volume',id:null,workId:work.work.id,create:true,value:`第${work.liveVolumes.length+1}卷`}
}
async function addCh() {
  const c=await work.addChapter()
  if(scene.value&&c)selNode.value={type:'chapter',id:c.id,key:'c:'+c.id}
}
function moveSel(dir) {
  if (selNode.value?.type === 'chapter') work.moveChapter(selNode.value.id, dir)
}
function openRenameById(s) {
  if (!s) return
  renameComposing.value=false
  if (s.type === 'volume') {
    const v = work.volumes.find((x) => x.id === s.id)
    if(!v)return
    rename.value = { show: true, kind: 'volume', id: s.id, workId:work.work?.id, value: v.title }
  } else {
    const c = work.chapters.find((x) => x.id === s.id)
    if(!c)return
    rename.value = { show: true, kind: 'chapter', id: s.id, workId:work.work?.id, value: c.title }
  }
}
function openRename() {
  openRenameById(selNode.value)
}
/* 章节栏头部的 ⋯ 菜单已整块换成「书签章节」下拉：上移/下移/重命名/删除与章节右键菜单重复，
 * 排序另有拖拽这条正式路径，因此不再保留第二份入口（功能去重）。
 * 书签下拉直接从 work.liveBookmarks 取，与齿轮菜单「章节书签」同源，不另建一份状态。 */
const bookmarkOptions = computed(() => {
  const list = work.liveBookmarks
  if (!list.length) return [{ label: '暂无书签：右键章节或工具栏 ☆ 可添加', key: 'none', disabled: true }]
  return list.map((b) => ({ label: b.title || '（未命名章节）', key: 'bm:' + b.targetId }))
})
function openBookmark(key) {
  if (key === 'none') return
  const id = key.slice(3)
  const c = work.chapters.find((x) => x.id === id)
  if (!c || c.deletedAt) return
  work.selChapterId = id
  if (c.volumeId) work.selVolumeId = c.volumeId
}
const manageOptions=computed(()=>[
  {label:'上移',key:'up',disabled:selNode.value?.type!=='chapter'},
  {label:'下移',key:'down',disabled:selNode.value?.type!=='chapter'},
  {label:'重命名',key:'rename',disabled:!selNode.value},
  {type:'divider',key:'divider'},
  {label:'删除',key:'delete',disabled:!selNode.value}
])
function manage(key){
  if(key==='up')moveSel(-1)
  if(key==='down')moveSel(1)
  if(key==='rename')openRename()
  if(key==='delete'&&selNode.value){deleteTarget.value={...selNode.value,workId:work.work?.id};deleteConfirm.value=true}
}
async function confirmDelete(){
  const target=deleteTarget.value
  if(target&&target.workId===work.work?.id)await delById(target)
  deleteConfirm.value=false
}
function bookmark(){
  if(!work.activeChapter)return
  const added=work.toggleChapterBookmark(work.activeChapter.id)
  window.$msg?.success(added?'已加入书签':'已移除书签')
}
async function confirmRename() {
  const r = rename.value
  const title=r.value.trim()
  if (!title||renameSaving.value||renameComposing.value) return
  if(r.workId!==work.work?.id){r.show=false;return}
  renameSaving.value=true
  try{
    if(r.create){
      const v=await work.addVolume(title)
      if(scene.value&&v)selNode.value={type:'volume',id:v.id,key:'v:'+v.id}
    }else if (r.kind === 'volume') work.renameVolume(r.id, title)
    else work.renameChapter(r.id, title)
    if(rename.value===r)r.show=false
  }catch(error){window.$msg?.error('名称未能保存：'+(error?.message||'请重试'))}
  finally{renameSaving.value=false}
}
function submitRename(event){
  if(event.isComposing||event.keyCode===229||renameComposing.value)return
  event.preventDefault();confirmRename()
}
async function delById(s) {
  if (!s) return
  if (s.type === 'volume') await work.deleteVolume(s.id)
  else await work.deleteChapter(s.id)
  if (selNode.value?.id === s.id) selNode.value = null
}
async function delSel() {
  await delById(selNode.value)
}

/* ---------- 右键快捷栏 ---------- */
const ctx = ref({ show: false, x: 0, y: 0, kind: null, id: null, bookmarked: false })

function nodeProps({ option }) {
  return {
    'data-chapter-sort-chapter': option.type === 'chapter' ? option.id : undefined,
    'data-chapter-sort-volume': option.type === 'volume' ? option.id ?? 'orphans' : undefined,
    ...((scene.value||originalActive.value)?{'data-chapter-id':option.type==='chapter'?option.key.slice(2):undefined,'data-volume-id':option.type==='volume'?option.key.slice(2):undefined}:{}),
    onContextmenu: (e) => {
      e.preventDefault()
      const id = option.key.slice(2)
      onSelect([option.key], option)
      ctx.value = {
        show: true,
        x: e.clientX,
        y: e.clientY,
        kind: option.type,
        id,
        bookmarked: option.type === 'chapter' ? work.isChapterBookmarked(id) : false
      }
    }
  }
}
function closeCtx() {
  ctx.value.show = false
}
const ctxOptions = computed(() => {
  if (ctx.value.kind === 'chapter') {
    return [
      { label: ctx.value.bookmarked ? '移除书签' : '收藏书签', key: 'bm' },
      { label: '重命名', key: 'rename' },
      { label: '删除（进回收站）', key: 'del' }
    ]
  }
  return [
    { label: '重命名卷', key: 'rename' },
    { label: '删除卷（章目上提）', key: 'del' }
  ]
})
function onCtxSelect(key) {
  const c = ctx.value
  closeCtx()
  if (key === 'bm') {
    const added = work.toggleChapterBookmark(c.id)
    window.$msg?.success(added ? '已加入书签' : '已移除书签')
    return
  }
  if (key === 'rename') return openRenameById({ type: c.kind, id: c.id })
  if (key === 'del') return delById({ type: c.kind, id: c.id })
}

const rename = ref({ show: false, kind: 'chapter', id: null, value: '' })
const renameSaving=ref(false),renameComposing=ref(false)
</script>

<template>
  <div :class="[scene?'chapter-catalog':null,latent?'ct-root':null,canCollapse?'collapsible':null]" :data-catalog-skin="scene?ui.skin:undefined" style="display: flex; flex-direction: column; height: 100%; position: relative">
    <button v-if="canCollapse && scene" type="button" class="chapter-collapse" title="收起章节栏" aria-label="收起章节栏" aria-controls="glaze-writing-directory" aria-expanded="true" @click="emit('collapse')"><OIcon name="back" :size="13" /></button>
    <template v-if="!latent">
    <template v-if="scene">
      <header class="catalog-masthead">
        <div class="catalog-art" aria-hidden="true"></div>
        <span class="catalog-eyebrow">{{ui.skin==='gravity'?'引力书舱':'琉光画境'}} <span>章节目录</span></span>
        <h2>{{work.work?.title||'未命名作品'}}</h2>
        <div class="catalog-masthead-rule" aria-hidden="true"><i></i><i></i><i></i></div>
      </header>
      <div class="catalog-controls">
        <NButton type="primary" size="small" data-action="new-chapter" @click="addCh"><OIcon name="plus" :size="14" />新建章节</NButton>
        <NButton size="small" data-action="new-volume" :disabled="renameSaving" @click="openNewVolume">新建卷</NButton>
        <NDropdown :class="[museumPopoverClass,originalOverlayClass]" :data-glaze-light="museumLight" trigger="click" :options="manageOptions" @select="manage"><NButton size="small" aria-label="目录管理" title="排序、重命名与删除">···</NButton></NDropdown>
      </div>
    </template>
    <h2 v-else-if="ui.isStudioSkin" class="gravity-sidebar-title">章节</h2>
    <div v-if="originalActive" class="ow-chapter-head"><div><h2>章节目录</h2><span>{{work.liveChapters.length}} 章</span></div><label class="ow-chapter-search"><NInput v-model:value="chapterQuery" clearable size="small" placeholder="搜索章节或卷名" aria-label="搜索章节或卷名" /></label><div class="ow-chapter-actions"><NButton type="primary" size="small" @click="addCh">新建章节</NButton><NButton size="small" @click="openNewVolume">新建卷</NButton><NDropdown :class="originalOverlayClass" trigger="click" :options="manageOptions" @select="manage"><NButton size="small" aria-label="目录管理">···</NButton></NDropdown></div></div>
    <div v-if="!scene && !originalActive" class="side-head">
      <NButton size="tiny" @click="addVol">＋卷</NButton>
      <NButton size="tiny" type="primary" @click="addCh">＋章</NButton>
      <NButton size="tiny" :disabled="!selNode" @click="moveSel(-1)">↑</NButton>
      <NButton size="tiny" :disabled="!selNode" @click="moveSel(1)">↓</NButton>
      <NButton size="tiny" :disabled="!selNode" @click="openRename">改名</NButton>
      <NPopconfirm :class="[museumPopoverClass,originalOverlayClass]" :data-glaze-light="museumLight" @positive-click="delSel">
        <template #trigger>
          <NButton size="tiny" :disabled="!selNode" quaternary style="color: #c2564a">删除</NButton>
        </template>
        删除后可在回收站恢复
      </NPopconfirm>
    </div>
    <div ref="chapterList" class="side-list" @pointerdown="chapterSort.pointerDown" @dragstart.capture="chapterSort.nativeDrag" @click.capture="chapterSort.click">
      <NTree
        :data="treeData"
        :pattern="originalActive ? chapterQuery : ''"
        :show-irrelevant-nodes="!originalActive"
        block-line
        draggable
        :expanded-keys="expandedKeys"
        :selected-keys="selectedKeys"
        :allow-drop="allowDrop"
        :render-suffix="renderSuffix"
        :render-label="renderLabel"
        :node-props="nodeProps"
        @update:selected-keys="onSelect"
        @update:expanded-keys="onExpanded"
        @dragstart="({node})=>dragging=node"
        @dragend="dragging=null"
        @drop="onDrop"
      />
    </div>

    <footer v-if="scene" class="catalog-footer">
      <div class="catalog-shortcuts" aria-label="写作快捷工具">
        <button type="button" data-action="bookmark" :disabled="!work.activeChapter" :aria-pressed="work.isChapterBookmarked(work.selChapterId)" :title="work.isChapterBookmarked(work.selChapterId)?'移除本章书签':'为本章添加书签'" @click="bookmark"><OIcon name="bookmark" :size="17" /><span>{{work.isChapterBookmarked(work.selChapterId)?'已书签':'书签'}}</span></button>
        <button type="button" data-action="read" :disabled="!work.activeChapter" @click="emit('read')"><OIcon name="books" :size="17" /><span>阅读</span></button>
        <button type="button" data-action="window" :disabled="props.inPanel||!work.activeChapter" :title="props.inPanel?'已在当前独立窗口':'在独立窗口编辑本章'" @click="emit('window')"><OIcon name="external" :size="17" /><span>{{props.inPanel?'当前窗口':'独立窗口'}}</span></button>
      </div>
      <div class="catalog-total"><span><b>{{work.liveChapters.length}}</b> 章</span><span>{{totalWords.toLocaleString()}} 字</span></div>
    </footer>
    <div v-else-if="ui.isStudioSkin" class="gravity-catalog-footer"><b>{{ work.liveChapters.length }}</b> 章 / {{ totalWords.toLocaleString() }} 字</div>
    <div v-if="!scene && !ui.isStudioSkin && canCollapse" class="side-foot">
      <button type="button" class="side-collapse" title="收起章节栏（更多菜单亦可切回）" aria-label="收起章节栏" aria-controls="glaze-writing-directory" aria-expanded="true" @click="emit('collapse')"><OIcon name="back" :size="12" /><span>收起章节栏</span></button>
    </div>

    </template>

    <template v-else>
      <div class="side-head">
        <span class="ct-search">
          <OIcon name="search" :size="12" aria-hidden="true" />
          <input v-model="chapterQuery" type="search" placeholder="查找章节…" aria-label="查找章节" />
          <button v-if="chapterQuery" type="button" title="清除查找" aria-label="清除查找" @click="chapterQuery = ''">×</button>
        </span>
        <span class="ct-tools">
          <NDropdown trigger="click" :options="bookmarkOptions" @select="openBookmark">
            <button type="button" class="side-more side-bookmarks" :title="'书签章节：' + work.liveBookmarks.length + ' 个，点击跳转'" aria-label="书签章节">
              <OIcon name="star" :size="13" />
            </button>
          </NDropdown>
          <button v-if="canCollapse" type="button" class="side-fold" title="收起章节栏" aria-label="收起章节栏" aria-controls="glaze-writing-directory" aria-expanded="true" @click="emit('collapse')"><OIcon name="caret-right" :size="13" style="transform:rotate(180deg)" /></button>
        </span>
      </div>
      <div ref="chapterList" class="side-list" @pointerdown="chapterSort.pointerDown" @dragstart.capture="chapterSort.nativeDrag" @click.capture="chapterSort.click">
        <NTree
          :data="filteredTree"
          block-line
          draggable
          :expanded-keys="expandedKeys"
          :selected-keys="selectedKeys"
          :allow-drop="allowDrop"
          :render-suffix="renderSuffix"
          :render-label="renderLabel"
          :node-props="nodeProps"
          @update:selected-keys="onSelect"
          @update:expanded-keys="onExpanded"
          @dragstart="({node})=>dragging=node"
          @dragend="dragging=null"
          @drop="onDrop"
        />
      </div>
      <p v-if="chapterQuery && !filteredTree.length" class="ct-empty">没有匹配的章节。</p>
      <div class="side-foot">
        <NButton class="sp-new" size="small" @click="addCh">＋ 新建章</NButton>
        <button class="sp-ghost" type="button" @click="addVol">新建卷</button>
      </div>
    </template>

    <NDropdown :class="[museumPopoverClass,originalOverlayClass]" :data-glaze-light="museumLight"
      trigger="manual"
      :show="ctx.show"
      :x="ctx.x"
      :y="ctx.y"
      :options="ctxOptions"
      placement="bottom-start"
      @select="onCtxSelect"
      @clickoutside="closeCtx"
    />

    <NModal :class="[museumPopoverClass,originalOverlayClass]" :data-glaze-light="museumLight" v-model:show="deleteConfirm" preset="dialog" title="确认删除" positive-text="删除" negative-text="取消" @positive-click="confirmDelete">
      {{deleteTarget?.type==='volume'?'将删除本卷及其中章节，删除后可在回收站恢复。':'删除后可在回收站恢复。'}}
    </NModal>
    <NModal :class="[museumPopoverClass,originalOverlayClass]" :data-glaze-light="museumLight" v-model:show="rename.show" preset="dialog" :title="rename.create ? '新建卷' : rename.kind === 'volume' ? '重命名卷' : '重命名章节'">
      <NInput v-model:value="rename.value" :aria-label="rename.kind === 'volume' ? '卷名' : '名称'" :placeholder="rename.kind === 'volume' ? '请输入卷名' : '名称'" :disabled="renameSaving" @keydown.enter="submitRename" @compositionstart="renameComposing=true" @compositionend="renameComposing=false" />
      <template #action>
        <NButton :disabled="renameSaving" @click="rename.show = false">取消</NButton>
        <NButton type="primary" :loading="renameSaving" :disabled="!rename.value.trim()||renameSaving" @click="confirmRename">确定</NButton>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
/* 收起章节栏：固定在面板右上角，悬停才实化；上方行留出 30px，按钮不与新建/删除按钮抢位。 */
.chapter-collapse{position:absolute;top:8px;right:6px;z-index:4;display:grid;place-items:center;width:24px;height:24px;padding:0;border:1px solid transparent;border-radius:4px;background:transparent;color:inherit;opacity:.42;cursor:pointer;transition:opacity .16s,background .16s,border-color .16s}
.chapter-collapse:hover,.chapter-collapse:focus-visible{opacity:1;border-color:color-mix(in srgb,currentColor 30%,transparent);background:var(--scene-hover,rgba(140,111,78,.12))}
.collapsible .catalog-masthead{padding-right:34px}
.side-foot{flex:none;display:flex;justify-content:flex-end;padding:6px 10px 8px}
.side-collapse{display:inline-flex;flex:none;align-items:center;gap:5px;height:24px;padding:0 8px;border:1px solid color-mix(in srgb,currentColor 26%,transparent);border-radius:4px;background:transparent;color:inherit;font:12px/1 inherit;opacity:.62;cursor:pointer;transition:opacity .16s,background .16s}
.side-collapse:hover,.side-collapse:focus-visible{opacity:1;background:color-mix(in srgb,currentColor 10%,transparent)}
</style>
