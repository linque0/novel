<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { NButton, NDropdown, NInput, NSpin } from 'naive-ui'
import OIcon from './OIcon.vue'
import SkinPicker from './SkinPicker.vue'
import AppTopbar from './AppTopbar.vue'
import GlazeArtwork from './GlazeArtwork.vue'
import GlazeLightingToggle from './GlazeLightingToggle.vue'
import GlazePaintingPicker from './GlazePaintingPicker.vue'
import { formatShelfOpenTime } from '../services/shelf-sort'
import { galleryIndex, gallerySelection } from '../services/glaze-gallery.js'
import { useUiStore } from '../stores/ui'
import '../styles/skins/glaze-gallery.css'

const props = defineProps({ works:{type:Array,required:true}, total:{type:Number,required:true}, firstChapter:{type:Object,default:null}, loading:Boolean, busy:Boolean, query:{type:String,default:''}, openStats:{type:Object,default:()=>({})}, menuOptions:{type:Function,required:true} })
const emit = defineEmits(['update:query','select-work','open','menu','create','settings','navigate'])
const ui = useUiStore()
const selectedId = ref(null)
const directory = ref(null)
const disabled = computed(() => props.busy || props.loading)
const activeIndex = computed(() => Math.max(0, props.works.findIndex(book => book.id === selectedId.value)))
const active = computed(() => props.works[activeIndex.value] || null)
const chapter = computed(() => props.firstChapter?.workId === active.value?.id ? props.firstChapter : null)
const words = n => Number(n || 0).toLocaleString('zh-CN')

// The parent supplies recently opened order. Searching begins at its first result;
// sorting or editing the same collection retains the selected work.
watch(() => [props.query, props.works.map(book => book.id).join('|')], (next, previous) => {
  selectedId.value = gallerySelection(props.works, selectedId.value, !previous || next[0] !== previous[0])
}, { immediate:true })
watch(selectedId, id => emit('select-work', id), { immediate:true, flush:'sync' })
function revealSelection() {
  const list = directory.value
  const row = list?.querySelector('[aria-current="true"]')
  if (!row) return
  const bounds = list.getBoundingClientRect(), item = row.getBoundingClientRect()
  if (item.top < bounds.top) list.scrollTop -= bounds.top - item.top
  else if (item.bottom > bounds.bottom) list.scrollTop += item.bottom - bounds.bottom
}
watch(selectedId, async () => { await nextTick(); revealSelection() })
let directoryObserver
watch(directory, list => {
  directoryObserver?.disconnect()
  if (list) {
    directoryObserver = new ResizeObserver(revealSelection)
    directoryObserver.observe(list)
  }
}, { flush:'post' })
onBeforeUnmount(() => directoryObserver?.disconnect())

function select(book) {
  if (disabled.value || !book || book.id === selectedId.value) return
  selectedId.value = book.id
}
function step(delta, focus = false) {
  if (disabled.value || props.works.length < 2) return
  selectedId.value = props.works[galleryIndex(activeIndex.value + delta, props.works.length)].id
  if (focus) nextTick(() => directory.value?.querySelector('[aria-current="true"]')?.focus({ preventScroll:true }))
}
function navigate(key) {
  if (key === 'settings') emit('settings')
  else if (key !== 'shelf' && active.value && !disabled.value) emit('navigate', key, active.value)
}
function rowKeydown(event, book) {
  if (disabled.value) return
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    step(event.key === 'ArrowDown' ? 1 : -1, true)
  } else if (event.key === 'Enter' && book.id === selectedId.value) {
    event.preventDefault()
    emit('open', book)
  }
}
</script>

<template>
  <section class="glaze-shelf glaze-museum" :data-glaze-light="ui.glazeLighting">
    <AppTopbar active="shelf" :busy="disabled" :has-work="!!active" :target-title="active?.title" @navigate="navigate">
      <template #actions><GlazeLightingToggle /><SkinPicker /></template>
    </AppTopbar>
    <div class="gm-cornice" aria-hidden="true"><span></span><i></i><span></span></div>
    <main class="glaze-shelf-scroll gg-scroll">
      <NSpin :show="loading">
        <div class="gg-layout">
          <aside class="gg-exhibition" aria-label="馆藏画作">
            <div class="gg-exhibition-head"><span>馆藏画作</span><GlazePaintingPicker /></div>
            <GlazeArtwork class="gg-artwork" />
          </aside>

          <div class="gg-catalog">
            <div class="gg-catalog-head">
              <h1>我的作品 <small>{{ String(total).padStart(2,'0') }}</small></h1>
              <NButton class="gg-new" :disabled="disabled" @click="emit('create')">＋ 新建作品</NButton>
            </div>

            <template v-if="active">
              <section class="gg-plaque" :data-work-id="active.id" aria-label="当前作品">
                <div class="gg-feature-top"><span>当前手稿 · {{ String(activeIndex+1).padStart(2,'0') }} / {{ String(works.length).padStart(2,'0') }}</span><div v-if="works.length > 1" class="gg-controls"><button type="button" aria-label="上一部作品" :disabled="disabled" @click="step(-1)"><OIcon name="arrow-right" class="gg-prev-icon" :size="16" /></button><button type="button" aria-label="下一部作品" :disabled="disabled" @click="step(1)"><OIcon name="arrow-right" :size="16" /></button></div></div>
                <h2 :title="active.title">{{ active.title || '未命名作品' }}</h2>
                <p class="gg-author">{{ active.author ? `${active.author} 著` : '作者未填写' }}</p>
                <p class="gg-intro" :title="active.intro">{{ active.intro || '故事从这里开始。' }}</p>
                <div class="gg-metadata"><span>{{ words(active.totalWords) }} 字</span><span>{{ active.chapterCount || 0 }} 章</span><span>{{ active.genre || '其他' }} · {{ active.status || '构思' }}</span><span>{{ formatShelfOpenTime(openStats[active.id]?.lastOpenedAt) }}</span></div>
                <p v-if="chapter" class="gg-chapter" :data-work-id="chapter.workId"><span>接续</span><strong>{{ chapter.title || '未命名章节' }}</strong></p>
                <div class="gg-actions"><NButton type="primary" :disabled="disabled" @click="emit('open', active)">继续写作 <OIcon name="arrow-right" :size="16" /></NButton><NButton class="gg-outline" :disabled="disabled" @click="emit('navigate','outline',active)">故事大纲 ↗</NButton><div class="gg-menu" @keydown.stop><NDropdown trigger="click" :options="menuOptions(active)" @select="emit('menu',$event,active)"><NButton :disabled="disabled" :aria-label="'作品菜单：'+active.title">⋯</NButton></NDropdown></div></div>
              </section>

              <div class="gg-index-head"><span>作品目录</span><NInput :value="query" clearable placeholder="搜索作品" aria-label="搜索作品" @update:value="emit('update:query',$event)" /></div>
              <nav ref="directory" class="gg-index" aria-label="作品目录"><button v-for="(book,index) in works" :key="book.id" type="button" class="gg-index-item" :class="{'is-current':book.id===active.id}" :data-work-id="book.id" :aria-current="book.id===active.id?'true':undefined" :disabled="disabled" :title="book.title" @click="select(book)" @keydown="rowKeydown($event,book)"><span class="gg-row-number" aria-hidden="true">{{ String(index+1).padStart(2,'0') }}</span><strong>{{ book.title || '未命名作品' }}</strong><span class="gg-row-meta">{{ book.genre || '其他' }} · {{ book.status || '构思' }}</span></button></nav>
            </template>
            <div v-else class="gg-empty"><div class="gg-index-head"><span>作品目录</span><NInput :value="query" clearable placeholder="搜索作品" aria-label="搜索作品" @update:value="emit('update:query',$event)" /></div><h2>{{ total ? '没有匹配的作品' : '写下你的第一个故事' }}</h2><p>{{ total ? '试试其他书名、作者或类型。' : '从一个念头开始，让它成为一本书。' }}</p><NButton v-if="!total" type="primary" :disabled="disabled" @click="emit('create')">＋ 新建作品</NButton></div>
          </div>
        </div>
      </NSpin>
    </main>
  </section>
</template>
