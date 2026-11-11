<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { NDropdown, NModal } from 'naive-ui'
import AppTopbar from './AppTopbar.vue'
import SkinPicker from './SkinPicker.vue'
import OriginalBook from './OriginalBook.vue'
import { formatShelfOpenTime } from '../services/shelf-sort'
import { booklistPage } from '../services/original-booklist.mjs'

const props = defineProps({ works: {type:Array,default:()=>[]}, total:Number, loading:Boolean, busy:Boolean, query:String, openStats:Object, firstChapter:Object, menuOptions:Function })
const emit = defineEmits(['update:query','select-work','open','menu','create','settings','navigate'])
const status = ref('全部'), page = ref(0), pageSize = ref(6), selectedId = ref(null), detailsOpen = ref(false)
const bookcase = ref(null), listRegion = ref(null), list = ref(null)
const statuses = ['全部','连载','完结','构思','搁置']
const results = computed(() => status.value === '全部' ? props.works : props.works.filter(w => w.status === status.value))
const pagination = computed(() => booklistPage(results.value, page.value, pageSize.value))
const visible = computed(() => pagination.value.items)
const selected = computed(() => visible.value.find(w => w.id === selectedId.value) || visible.value[0])
const words = n => `${(Number(n)||0).toLocaleString('zh-CN')} 字`
const lastOpened = book => props.openStats?.[book.id]?.lastOpenedAt ? '上次打开 '+formatShelfOpenTime(props.openStats[book.id].lastOpenedAt) : '尚未打开'
let deletedFocus = null

watch(() => selected.value?.id, id => { emit('select-work', id); if (!id) detailsOpen.value = false }, { immediate:true })
watch([() => props.query, status, pageSize], () => { page.value = 0; resetScroll() })
watch(() => pagination.value.page, value => { page.value = value; resetScroll() })
watch(() => props.works.map(w => w.id), async ids => {
  if (!deletedFocus || ids.includes(deletedFocus.id)) return
  const neighbour = deletedFocus.next
  deletedFocus = null
  await nextTick()
  const buttons = [...bookcase.value.querySelectorAll('.os-book-open')]
  ;(buttons.find(el => el.dataset.workId === neighbour) || buttons[0] || bookcase.value.querySelector('.os-new'))?.focus()
})
function resetScroll() { nextTick(() => { if (listRegion.value) listRegion.value.scrollTop = 0 }) }
function setPage(value) { page.value = value; selectedId.value = null; resetScroll() }
function reset() { status.value = '全部'; emit('update:query','') }
function navigate(key) { if (key === 'settings') emit('settings'); else if (key !== 'shelf' && selected.value) emit('navigate',key,selected.value) }
function details(book) { selectedId.value = book.id; detailsOpen.value = true }
function menu(key, book) {
  if (key === 'del') {
    const buttons = [...bookcase.value.querySelectorAll('.os-book-open')]
    const index = buttons.findIndex(el => el.dataset.workId === String(book.id))
    deletedFocus = { id:book.id, next:buttons[index+1]?.dataset.workId || buttons[index-1]?.dataset.workId }
  }
  emit('menu', key, book)
}
function move(event) {
  if (!['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Home','End'].includes(event.key)) return
  const buttons = [...list.value.querySelectorAll('.os-book-open')], index = buttons.indexOf(event.target)
  if (index < 0) return
  event.preventDefault()
  const columns = getComputedStyle(list.value).gridTemplateColumns.split(' ').length
  let target = index + ({ArrowLeft:-1,ArrowRight:1,ArrowDown:columns,ArrowUp:-columns}[event.key]||0)
  if (event.key === 'Home') target = 0
  if (event.key === 'End') target = buttons.length-1
  buttons[Math.max(0,Math.min(buttons.length-1,target))]?.focus()
}
</script>

<template>
  <section ref="bookcase" class="original-shelf">
    <AppTopbar active="shelf" :busy="busy||loading" :has-work="!!selected" :target-title="selected?.title" @navigate="navigate" @create="emit('create')"><template #actions><SkinPicker /></template></AppTopbar>
    <div class="os-library">
      <header class="os-heading">
        <h1>我的藏书<span>{{ total }} 部作品</span></h1>
        <div class="os-tools">
          <label class="os-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input :value="query" aria-label="搜索作品、作者、类型" placeholder="搜索书名、作者、类型" @input="emit('update:query',$event.target.value)"/><button v-if="query" aria-label="清空搜索" @click="emit('update:query','')">×</button></label>
          <button class="os-new" :disabled="busy||loading" @click="emit('create')">＋ 新书上架</button>
        </div>
      </header>
      <div class="os-toolbar"><div class="os-filters" role="group" aria-label="按创作状态筛选"><button v-for="item in statuses" :key="item" :disabled="busy" :aria-pressed="status===item" @click="status=item">{{ item }}</button></div><span class="os-sort">按最近打开排列</span></div>
      <p class="os-sr" role="status">{{ loading ? '正在整理书单' : `共 ${results.length} 部作品，第 ${pagination.page+1} 页，显示 ${pagination.start} 至 ${pagination.end} 部` }}</p>

      <main ref="listRegion" class="os-list-region" aria-label="作品书单" :aria-busy="loading">
        <p v-if="loading" class="os-notice" role="status">正在整理书单…</p>
        <ul ref="list" class="os-list" @keydown="move">
          <li v-for="book in visible" :key="book.id" class="os-list-item" :class="{'is-selected':selected?.id===book.id}">
            <button class="os-book-open" :data-work-id="book.id" :disabled="busy||loading" :aria-label="`打开《${book.title}》，${book.author||'未署名'}，${book.status||'未分类'}，${words(book.totalWords)}`" @click="emit('open',book)">
              <span class="os-book-rest"><OriginalBook :book="book" :selected="selected?.id===book.id"/></span>
              <span class="os-list-info"><span class="os-status">{{ book.status||'未分类' }}<span v-if="book.genre"> · {{ book.genre }}</span></span><strong :title="book.title">{{ book.title }}</strong><span class="os-author">{{ book.author||'未署名' }}</span><small>{{ words(book.totalWords) }}<span>{{ book.chapterCount||0 }} 章</span></small><span class="os-opened">{{ lastOpened(book) }}</span></span>
            </button>
            <div class="os-list-actions"><button class="os-detail" :disabled="busy||loading" :aria-label="`查看《${book.title}》详情`" @click="details(book)">详情</button><NDropdown trigger="click" :options="menuOptions(book)" @select="key=>menu(key,book)"><button class="os-more" :disabled="busy||loading" :aria-label="`管理《${book.title}》`">···</button></NDropdown></div>
          </li>
        </ul>
        <div v-if="!visible.length&&!loading" class="os-empty"><span class="os-empty-mark" aria-hidden="true">册</span><h2>{{ total ? '没有找到作品' : '第一本书，从这里开始。' }}</h2><p>{{ total ? '换个关键词或创作状态，看看其他故事。' : '写下第一行，让故事在这里慢慢成书。' }}</p><button class="os-new" @click="total?reset():emit('create')">{{ total?'查看全部作品':'新书上架' }}</button></div>
      </main>

      <nav class="os-pagination" aria-label="书单分页">
        <span class="os-result-count">{{ pagination.start }}–{{ pagination.end }} / {{ results.length }} 部</span>
        <label class="os-page-size">每页<select v-model.number="pageSize" :disabled="busy||loading" aria-label="每页作品数"><option :value="6">6 本</option><option :value="12">12 本</option><option :value="24">24 本</option></select></label>
        <div class="os-page-controls"><button aria-label="第一页" :disabled="pagination.page===0||busy||loading" @click="setPage(0)">«</button><button aria-label="上一页" :disabled="pagination.page===0||busy||loading" @click="setPage(pagination.page-1)">‹</button><label><select :value="pagination.page" aria-label="跳转到页" :disabled="busy||loading" @change="setPage(Number($event.target.value))"><option v-for="index in pagination.count" :key="index" :value="index-1">第 {{ index }} 页</option></select><span>/ {{ pagination.count }}</span></label><button aria-label="下一页" :disabled="pagination.page===pagination.count-1||busy||loading" @click="setPage(pagination.page+1)">›</button><button aria-label="最后一页" :disabled="pagination.page===pagination.count-1||busy||loading" @click="setPage(pagination.count-1)">»</button></div>
      </nav>

      <aside v-if="selected" class="os-reading" aria-label="当前作品">
        <div class="os-reading-title"><span class="os-kicker">案头 · {{ selected.status||'未分类' }}</span><h2 :title="selected.title">{{ selected.title }}</h2></div>
        <div class="os-progress"><strong>{{ firstChapter?.title || (selected.chapterCount?'接续上次写作位置':'尚未开始第一章') }}</strong><small>{{ words(selected.totalWords) }} · {{ selected.chapterCount||0 }} 章</small></div>
        <div class="os-reading-actions"><button class="os-continue" :disabled="busy||loading" @click="emit('open',selected)">{{ busy?'正在开卷…':selected.chapterCount?'继续写作':'开始创作' }}<span>↗</span></button><button class="os-outline" :disabled="busy||loading" @click="emit('navigate','outline',selected)">故事大纲</button><NDropdown trigger="click" :options="menuOptions(selected)" @select="key=>menu(key,selected)"><button class="os-more" :disabled="busy||loading" aria-label="管理当前作品">···</button></NDropdown></div>
      </aside>
    </div>
    <NModal v-model:show="detailsOpen" preset="card" :title="selected?.title" style="width:580px;max-width:calc(100vw - 32px);max-height:calc(100dvh - 32px);overflow:auto" class="os-detail-modal">
      <article v-if="selected" class="os-detail-content"><p>{{ selected.author||'未署名' }} · {{ selected.status||'未分类' }} · {{ selected.genre||'其他' }}</p><p>{{ words(selected.totalWords) }} · {{ selected.chapterCount||0 }} 章</p><p class="os-detail-intro">{{ selected.intro||'尚未填写作品简介。' }}</p><p>{{ lastOpened(selected) }}</p><button class="os-modal-open" :disabled="busy||loading" @click="emit('open',selected)">{{ busy?'正在开卷…':selected.chapterCount?'继续写作':'开始创作' }} ↗</button></article>
    </NModal>
  </section>
</template>
<style scoped src="../styles/original-shelf-v2.css"></style>
