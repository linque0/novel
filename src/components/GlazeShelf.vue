<script setup>
import { computed } from 'vue'
import { NButton, NInput, NDropdown, NSpin } from 'naive-ui'
import OIcon from './OIcon.vue'
import SkinPicker from './SkinPicker.vue'
import AppTopbar from './AppTopbar.vue'
import GlazeCover from './GlazeCover.vue'
import { formatShelfOpenTime } from '../services/shelf-sort'
const props=defineProps({ works:{type:Array,required:true},total:{type:Number,required:true},firstChapter:{type:Object,default:null},loading:Boolean,busy:Boolean,query:{type:String,default:''},openStats:{type:Object,default:()=>({})},menuOptions:{type:Function,required:true} })
const emit=defineEmits(['update:query','open','menu','create','settings','navigate'])
const featured=computed(()=>props.works[0] || null)
const titleLines=computed(()=>{
  const title=featured.value?.title || ''
  return /^[\u3400-\u9fff]{4,8}$/.test(title) ? [title.slice(0,Math.ceil(title.length/2)),title.slice(Math.ceil(title.length/2))] : [title]
})
const titleScale=computed(()=>{
  const length=[...(featured.value?.title || '')].length
  return length<=4?'title-short':length<=8?'title-medium':'title-long'
})
const stage=computed(()=>props.works.slice(0,3))
const others=computed(()=>props.works.slice(1))

const words=n=>Number(n||0).toLocaleString('zh-CN')
/* 设计稿用的是相对时间（「今天 14:32」）：今天/昨天给相对说法，更早给月日 */
const updated=t=>{
  if(!t)return ''
  const d=new Date(t)
  if(!Number.isFinite(d.getTime()))return ''
  const hm=d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})
  const day=24*60*60*1000
  const atMidnight=x=>{const y=new Date(x);y.setHours(0,0,0,0);return y.getTime()}
  const diff=(atMidnight(Date.now())-atMidnight(d.getTime()))/day
  if(diff===0)return '今天 '+hm
  if(diff===1)return '昨天 '+hm
  return d.toLocaleDateString('zh-CN',{month:'long',day:'numeric'})+' '+hm
}
const featuredStat=computed(()=>props.openStats[featured.value?.id]||null)
const featuredOpenText=computed(()=>formatShelfOpenTime(featuredStat.value?.lastOpenedAt))
const openText=book=>formatShelfOpenTime(props.openStats[book?.id]?.lastOpenedAt)
function navigate(key){
  if(key==='settings')emit('settings')
  else if(key!=='shelf'&&featured.value&&!props.busy && !props.loading)emit('navigate',key,featured.value)
}
</script>

<template>
  <section class="glaze-shelf">
    <AppTopbar active="shelf" :busy="busy || loading" :has-work="!!featured" :target-title="featured?.title" @navigate="navigate">
      <template #actions><SkinPicker /></template>
    </AppTopbar>
    <main class="glaze-shelf-scroll">
      <div class="glaze-shelf-tools"><h1>我的作品 <small>{{ total.toString().padStart(2,'0') }}</small></h1><div><NInput :value="query" clearable placeholder="搜索作品" aria-label="搜索作品" @update:value="emit('update:query',$event)" /><NButton type="primary" @click="emit('create')">＋ 新建作品</NButton></div></div>
      <NSpin :show="loading">
        <template v-if="featured">
          <section class="glaze-shelf-hero">
            <div class="glaze-feature-copy" :class="titleScale"><p class="glaze-eyebrow">{{ query ? '搜索结果' : '最近打开' }}<span>　·　上次打开 {{ featuredOpenText }}</span></p><h2 :title="featured.title"><span v-for="(line,i) in titleLines" :key="i" class="glaze-title-line">{{ line }}</span></h2><p class="glaze-feature-intro">{{ featured.intro || '故事从这里开始。' }}</p><div class="glaze-feature-actions"><NButton type="primary" :disabled="busy || loading" @click="emit('open',featured)">继续写作 <OIcon name="arrow-right" :size="16" /></NButton><NButton quaternary :disabled="busy || loading" @click="emit('navigate','outline',featured)">故事大纲 ↗</NButton></div><div class="glaze-feature-meta"><span><strong>{{ words(featured.totalWords) }}</strong> 字</span><span><strong>{{ featured.chapterCount || 0 }}</strong> 章</span><small>{{ featured.genre }} · {{ featured.status }}</small></div></div>
            <div class="glaze-glass-deck" :class="'book-count-'+stage.length" aria-label="作品叠册">
              <span class="glaze-orb" aria-hidden="true"></span>
              <div v-if="stage[0]" class="glaze-feature-stack">
                <article class="glaze-stage-book pose-0">
                  <button type="button" class="glaze-stage-open" :disabled="busy || loading" :aria-label="'打开《'+stage[0].title+'》'" @click="emit('open',stage[0])"><GlazeCover :book="stage[0]" /></button>
                  <div class="glaze-work-menu" @click.stop @keydown.stop><NDropdown trigger="click" :options="menuOptions(stage[0])" @select="emit('menu',$event,stage[0])"><NButton size="tiny" quaternary :aria-label="'作品菜单：'+stage[0].title">⋯</NButton></NDropdown></div>
                </article>
                <!-- 首章白卡属于主书簇：真实数据，无章节时不保留占位。 -->
                <span v-if="firstChapter" class="glaze-chapter-note">{{ firstChapter.title }}<small>{{ updated(firstChapter.updatedAt || firstChapter.createdAt) }} 编辑</small></span>
              </div>
              <article v-for="(book,index) in stage.slice(1)" :key="book.id" class="glaze-stage-book" :class="'pose-'+(index+1)">
                <button type="button" class="glaze-stage-open" :disabled="busy || loading" :aria-label="'打开《'+book.title+'》'" @click="emit('open',book)"><GlazeCover :book="book" :pose="index===1?'lying':'front'" /></button>
                <div class="glaze-work-menu" @click.stop @keydown.stop><NDropdown trigger="click" :options="menuOptions(book)" @select="emit('menu',$event,book)"><NButton size="tiny" quaternary :aria-label="'作品菜单：'+book.title">⋯</NButton></NDropdown></div>
              </article>
            </div>
          </section>
          <section v-if="others.length" class="glaze-collection"><header><h2>故事在这里汇合</h2><span>其余 {{ others.length }} 部作品 · 按最近打开排序</span></header><div class="glaze-collection-grid"><article v-for="book in others" :key="book.id" class="glaze-library-card"><button type="button" class="glaze-library-open" :disabled="busy || loading" @click="emit('open',book)"><GlazeCover :book="book" miniature /><span><strong :title="book.title">{{ book.title }}</strong><small>{{ words(book.totalWords) }} 字　/　{{ book.chapterCount || 0 }} 章</small><small class="glaze-openat">上次打开 {{ openText(book) }}</small></span></button><div class="glaze-work-menu" @click.stop @keydown.stop><NDropdown trigger="click" :options="menuOptions(book)" @select="emit('menu',$event,book)"><NButton size="tiny" quaternary :aria-label="'作品菜单：'+book.title">⋯</NButton></NDropdown></div></article></div></section>
        </template>
        <div v-else class="glaze-empty"><h2>{{ total?'没有匹配的作品':'写下你的第一个故事' }}</h2><p>{{ total?'试试其他书名、作者或类型。':'从一个念头开始，让它成为一本书。' }}</p><NButton v-if="!total" type="primary" @click="emit('create')">＋ 新建作品</NButton></div>
      </NSpin>
    </main>
  </section>
</template>
