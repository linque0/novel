<script setup>
import { computed } from 'vue'
import { NButton, NInput, NDropdown, NSpin } from 'naive-ui'
import OIcon from './OIcon.vue'
import SkinPicker from './SkinPicker.vue'
import GlazeCover from './GlazeCover.vue'
const props=defineProps({ works:{type:Array,required:true},total:{type:Number,required:true},loading:Boolean,busy:Boolean,query:{type:String,default:''},menuOptions:{type:Function,required:true} })
const emit=defineEmits(['update:query','open','menu','create','settings','navigate'])
const featured=computed(()=>props.works[0] || null)
const titleLines=computed(()=>{
  const title=featured.value?.title || ''
  return /^[\u3400-\u9fff]{4,6}$/.test(title) ? [title.slice(0,Math.ceil(title.length/2)),title.slice(Math.ceil(title.length/2))] : [title]
})
const stage=computed(()=>props.works.slice(0,3))
const others=computed(()=>props.works.slice(1))
const nav=[['shelf','书架','books'],['chapters','正文','manuscript'],['outline','大纲','network'],['lore','设定','layers'],['characters','人物','user'],['snippets','灵感','sparkle'],['settings','设置','gear']]
const words=n=>Number(n||0).toLocaleString('zh-CN')
const updated=t=>t?new Date(t).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):''
function navigate(key){
  if(key==='settings')emit('settings')
  else if(key!=='shelf'&&featured.value&&!props.busy)emit('navigate',key,featured.value)
}
</script>

<template>
  <section class="glaze-shelf">
    <header class="glaze-shelf-header">
      <div class="glaze-shelf-brand"><span class="glaze-brand-mark">坊</span><strong>小说工坊</strong><small>我的创作空间</small></div>
      <div class="glaze-header-actions"><SkinPicker /><NButton size="small" quaternary aria-label="外观与设置" @click="emit('settings')"><OIcon name="gear" :size="18" /></NButton></div>
    </header>
    <nav class="glaze-top-nav" aria-label="工坊导航">
      <button v-for="[key,label,icon] in nav" :key="key" type="button" :class="{active:key==='shelf'}" :aria-current="key==='shelf'?'page':undefined" :disabled="busy || (!featured&&!['shelf','settings'].includes(key))" :title="['shelf','settings'].includes(key)?label:'打开展示作品的'+label" @click="navigate(key)"><OIcon :name="icon" :size="19" />{{ label }}</button>
    </nav>
    <main class="glaze-shelf-scroll">
      <div class="glaze-shelf-tools"><h1>我的作品 <small>{{ total.toString().padStart(2,'0') }}</small></h1><div><NInput :value="query" clearable placeholder="搜索作品、作者、类型…" aria-label="搜索作品" @update:value="emit('update:query',$event)" /><NButton type="primary" @click="emit('create')">＋ 新建作品</NButton></div></div>
      <NSpin :show="loading">
        <template v-if="featured">
          <section class="glaze-shelf-hero">
            <div class="glaze-feature-copy"><p class="glaze-eyebrow">{{ query ? '搜索结果' : '最近编辑' }}<span v-if="featured.updatedAt"> · {{ updated(featured.updatedAt) }}</span></p><h2 :title="featured.title"><span v-for="(line,i) in titleLines" :key="i" class="glaze-title-line">{{ line }}</span></h2><p class="glaze-feature-intro">{{ featured.intro || '故事从这里开始。' }}</p><div class="glaze-feature-actions"><NButton type="primary" :disabled="busy" @click="emit('open',featured)">继续写作 <OIcon name="arrow-right" :size="16" /></NButton><NButton quaternary :disabled="busy" @click="emit('navigate','outline',featured)">故事大纲 ↗</NButton></div><div class="glaze-feature-meta"><span>{{ words(featured.totalWords) }} 字</span><span>{{ featured.chapterCount || 0 }} 章</span><small>{{ featured.genre }} · {{ featured.status }}</small></div></div>
            <div class="glaze-glass-deck" aria-label="作品叠册">
              <span class="glaze-orb" aria-hidden="true"></span>
              <article v-for="(book,index) in stage" :key="book.id" class="glaze-stage-book" :class="'pose-'+index">
                <button type="button" class="glaze-stage-open" :disabled="busy" :aria-label="'打开《'+book.title+'》'" @click="emit('open',book)"><GlazeCover :book="book" /></button>
                <div class="glaze-work-menu" @click.stop @keydown.stop><NDropdown trigger="click" :options="menuOptions(book)" @select="emit('menu',$event,book)"><NButton size="tiny" quaternary :aria-label="'作品菜单：'+book.title">⋯</NButton></NDropdown></div>
              </article>
            </div>
          </section>
          <section v-if="others.length" class="glaze-collection"><header><h2>故事在这里汇合</h2><span>其余 {{ others.length }} 部作品</span></header><div class="glaze-collection-grid"><article v-for="book in others" :key="book.id" class="glaze-library-card"><button type="button" class="glaze-library-open" :disabled="busy" @click="emit('open',book)"><GlazeCover :book="book" /><span><strong :title="book.title">{{ book.title }}</strong><small>{{ words(book.totalWords) }} 字 / {{ book.chapterCount || 0 }} 章</small></span></button><div class="glaze-work-menu" @click.stop @keydown.stop><NDropdown trigger="click" :options="menuOptions(book)" @select="emit('menu',$event,book)"><NButton size="tiny" quaternary :aria-label="'作品菜单：'+book.title">⋯</NButton></NDropdown></div></article></div></section>
        </template>
        <div v-else class="glaze-empty"><h2>{{ total?'没有匹配的作品':'写下你的第一个故事' }}</h2><p>{{ total?'试试其他书名、作者或类型。':'从一个念头开始，让它成为一本书。' }}</p><NButton v-if="!total" type="primary" @click="emit('create')">＋ 新建作品</NButton></div>
      </NSpin>
    </main>
  </section>
</template>
