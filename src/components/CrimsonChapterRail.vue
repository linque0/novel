<script setup>
/* 赤月戏 v3 的左侧章节目录：只读 work store 的真实章节/卷数据，切章与新建走现有 action。 */
import { computed, ref, nextTick } from 'vue'
import { NModal, NInput, NButton } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import OIcon from './OIcon.vue'

const props = defineProps({
  collapsed: { type: Boolean, default: false }
})
const emit = defineEmits(['update:collapsed','bookmark','read','window','search','history'])

const work = useWorkStore()
const query = ref('')
const catalog=ref(null)
const volumeForm=ref({show:false,id:null,workId:null,value:''})
const volumeSaving=ref(false),volumeComposing=ref(false)
const fmt = (n) => Number(n || 0).toLocaleString('zh-CN')

const chapters = computed(() => work.liveChapters.slice().sort((a, b) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''))))
const volumes = computed(() => work.liveVolumes.slice().sort((a, b) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''))))

/* 章按卷分组；无卷或卷已删的章落到“未分卷”。 */
const groups = computed(() => {
  const out = []
  for (const v of volumes.value) {
    const list = chapters.value.filter((c) => c.volumeId === v.id)
    out.push({ id: v.id, title: v.title || '未命名卷', list })
  }
  const orphans = chapters.value.filter((c) => !c.volumeId || !volumes.value.some((v) => v.id === c.volumeId))
  if (orphans.length) out.push({ id: 'orphan', title: '未分卷', list: orphans })
  return out
})

const visibleGroups = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return groups.value
  return groups.value
    .map((g) => ({ ...g, list: g.list.filter((c) => String(c.title || '').toLowerCase().includes(q)) }))
    .filter((g) => g.list.length)
})

const visibleChapters = computed(() => visibleGroups.value.flatMap((g) => g.list))
const current = computed(() => chapters.value.find((c) => c.id === work.selChapterId) || null)
const currentNo = computed(() => {
  const n = work.chapterOrdinal(work.selChapterId)
  return n ? String(n).padStart(2, '0') : '—'
})
const progress = computed(() => {
  const n = work.chapterOrdinal(work.selChapterId)
  return chapters.value.length && n ? n / chapters.value.length : 0
})
const totalWords = computed(() => chapters.value.reduce((n, c) => n + (c.wordCount || 0), 0))
const totalChapters = computed(() => chapters.value.length)
const currentVolume = computed(() => {
  if (!current.value) return volumes.value[0]?.title || '未分卷'
  return volumes.value.find((v) => v.id === current.value.volumeId)?.title || '未分卷'
})

function pick(c) {
  work.selChapterId = c.id
  if (c.volumeId) work.selVolumeId = c.volumeId
}
function step(dir) {
  const list = visibleChapters.value
  if (!list.length) return
  let i = list.findIndex((c) => c.id === work.selChapterId)
  if (i < 0) i = dir > 0 ? -1 : list.length
  const target = list[i + dir]
  if (target) pick(target)
}
async function addChapter() {
  const row = await work.addChapter(work.selVolumeId)
  if (row?.id) pick(row)
}
function toggle() {
  emit('update:collapsed', !props.collapsed)
}
function openVolume(id=null){
  if(!work.work||volumeSaving.value)return
  const vol=id?volumes.value.find(v=>v.id===id):null
  if(id&&!vol)return
  volumeComposing.value=false
  volumeForm.value={show:true,id,workId:work.work.id,value:vol?.title||`第${volumes.value.length+1}卷`}
}
function selectVolume(id){if(volumes.value.some(v=>v.id===id))work.selVolumeId=id}
async function saveVolume(){
  const form=volumeForm.value,title=form.value.trim()
  if(!title||volumeSaving.value||volumeComposing.value)return
  if(form.workId!==work.work?.id){form.show=false;return}
  if(form.id&&!volumes.value.some(v=>v.id===form.id)){form.show=false;return}
  volumeSaving.value=true
  try{
    if(form.id)work.renameVolume(form.id,title)
    else{
      const vol=await work.addVolume(title)
      query.value=''
      await nextTick()
      catalog.value?.querySelector('[data-volume-id="'+CSS.escape(vol.id)+'"]')?.scrollIntoView({block:'nearest'})
    }
    if(volumeForm.value===form)form.show=false
  }catch(error){window.$msg?.error('卷名未能保存：'+(error?.message||'请重试'))}
  finally{volumeSaving.value=false}
}
function submitVolume(event){
  if(event.isComposing||event.keyCode===229||volumeComposing.value)return
  event.preventDefault();saveVolume()
}
</script>

<template>
  <aside class="crimson-chapter-rail" :style="{ '--chapter-progress': progress }" aria-label="章节目录">
    <button class="crimson-rail-toggle" type="button" :aria-label="collapsed ? '展开章节目录' : '收起章节目录'" @click="toggle">{{ collapsed ? '›' : '‹' }}</button>

    <div class="crimson-rail-head">
      <small>赤月戏</small>
      <h2 :title="work.work?.title">{{ work.work?.title || '未命名作品' }}</h2>
      <span class="crimson-rail-seal" :title="currentVolume">{{ currentVolume }}</span>
    </div>

    <div class="crimson-rail-actions" aria-label="写作快捷工具">
      <button type="button" data-action="bookmark" :disabled="!current" :aria-pressed="work.isChapterBookmarked(work.selChapterId)" :title="work.isChapterBookmarked(work.selChapterId)?'移除本章书签':'为本章添加书签'" :aria-label="work.isChapterBookmarked(work.selChapterId)?'移除本章书签':'为本章添加书签'" @click="emit('bookmark')"><OIcon name="bookmark" :size="17" /><span>{{work.isChapterBookmarked(work.selChapterId)?'已书签':'书签'}}</span></button>
      <button type="button" data-action="read" :disabled="!current" title="进入阅读模式" aria-label="进入阅读模式" @click="emit('read')"><OIcon name="books" :size="17" /><span>阅读</span></button>
      <button type="button" data-action="window" :disabled="!current" title="在独立窗口编辑本章" aria-label="在独立窗口编辑本章" @click="emit('window')"><OIcon name="external" :size="17" /><span>独立窗口</span></button>
    </div>

    <div class="crimson-rail-volume">
      <span>章节目录 <small>{{ totalChapters }} 章</small></span>
      <button class="crimson-volume-new" type="button" data-action="new-volume" :disabled="volumeSaving" @click="openVolume()"><OIcon name="plus" :size="12" />新建卷</button>
    </div>

    <label class="crimson-rail-search">
      <svg viewBox="0 0 26 26" aria-hidden="true"><path d="M17 17l6 6M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0" /></svg>
      <input v-model="query" type="search" placeholder="搜索章节" aria-label="搜索章节" />
      <button type="button" data-action="search" title="查找作品全文" aria-label="查找作品全文" @click="emit('search')">全文</button>
    </label>

    <nav ref="catalog" class="crimson-rail-chapters" aria-label="章节列表">
      <template v-for="group in visibleGroups" :key="group.id">
        <div class="crimson-rail-volume-row" :data-volume-id="group.id" :class="{ selected:group.id===work.selVolumeId }">
          <button v-if="group.id!=='orphan'" class="crimson-volume-pick" type="button" data-action="select-volume" :aria-pressed="group.id===work.selVolumeId" :title="group.title" @click="selectVolume(group.id)">{{ group.title }}</button>
          <span v-else>{{group.title}}</span>
          <button v-if="group.id!=='orphan'" class="crimson-volume-edit" type="button" data-action="rename-volume" :data-volume-target="group.id" title="编辑卷名" :aria-label="'编辑卷名：'+group.title" @click.stop="openVolume(group.id)"><OIcon name="edit" :size="14" /></button>
        </div>
        <p v-if="!group.list.length" class="crimson-volume-empty">本卷暂无章节</p>
        <button
          v-for="c in group.list"
          :key="c.id"
          type="button"
          class="crimson-rail-chapter"
          :class="{ current: c.id === work.selChapterId }"
          :aria-current="c.id === work.selChapterId ? 'page' : undefined"
          :title="c.title"
          @click="pick(c)"
        >
          <span class="num">{{ String(work.chapterOrdinal(c.id) || '—').padStart(2, '0') }}</span>
          <span><b>{{ c.title || '未命名章节' }}</b><small>{{ fmt(c.wordCount) }} 字</small></span>
          <i>{{ c.id === work.selChapterId ? '●' : '·' }}</i>
        </button>
      </template>
      <p v-if="!visibleGroups.length" class="crimson-rail-empty">{{query.trim()?'没有匹配的章节':'暂无卷或章节'}}</p>
    </nav>

    <div class="crimson-rail-foot">
      <span>共 {{ totalChapters }} 章 · {{ fmt(totalWords) }} 字</span>
      <div class="crimson-rail-foot-actions"><button type="button" data-action="history" :disabled="!current" aria-label="章节历史" title="章节历史" @click="emit('history')"><OIcon name="history" :size="16" /></button><button class="crimson-rail-new" type="button" aria-label="新建章节" title="新建章节" @click="addChapter">＋</button></div>
    </div>

    <div class="crimson-rail-mini" aria-label="章节快捷导航">
      <span class="crimson-mini-current">{{ currentNo }}<small>章</small></span>
      <button class="crimson-mini-nav" type="button" aria-label="上一章" title="上一章" @click="step(-1)">↑</button>
      <button class="crimson-mini-nav" type="button" aria-label="下一章" title="下一章" @click="step(1)">↓</button>
    </div>
    <NModal v-model:show="volumeForm.show" preset="dialog" :title="volumeForm.id?'编辑卷名':'新建卷'">
      <NInput v-model:value="volumeForm.value" aria-label="卷名" placeholder="请输入卷名" :disabled="volumeSaving" @keydown.enter="submitVolume" @compositionstart="volumeComposing=true" @compositionend="volumeComposing=false" />
      <template #action>
        <NButton :disabled="volumeSaving" @click="volumeForm.show=false">取消</NButton>
        <NButton type="primary" :disabled="!volumeForm.value.trim()||volumeSaving" :loading="volumeSaving" @click="saveVolume">确定</NButton>
      </template>
    </NModal>
  </aside>
</template>
