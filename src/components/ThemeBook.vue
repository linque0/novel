<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { clothOf, isVerticalTitle, sealChar } from '../services/book3d/glaze-cloth'
const props=defineProps({book:{type:Object,required:true},theme:{type:String,required:true},miniature:Boolean,pose:{type:String,default:'front'}})
const host=ref(null),image=ref(''),state=ref('loading')
const cloth=computed(()=>clothOf(props.book.kind))
const vertical=computed(()=>isVerticalTitle(props.book.title))
const seal=computed(()=>sealChar(props.book))
const clothStyle=computed(()=>props.theme==='glaze'?{'--cloth':cloth.value.board,'--ink':cloth.value.title,'--foil':cloth.value.rule,'--seal':cloth.value.seal}:{})
let alive=false,visible=false,observer,api,release,generation=0,request
async function refresh(){
  request?.abort()
  const token=++generation
  if(!api||!visible||document.hidden)return
  request=new AbortController()
  try{
    const url=await api.getBookPoster(props.book,{theme:props.theme,size:props.miniature?'mini':props.pose==='lying'?'landscape':'hero',pose:props.pose,signal:request.signal,priority:props.miniature?0:props.pose==='front'?10:5})
    if(!alive||token!==generation)return
    image.value=url||'';state.value=url?'ready':'fallback'
  }catch{
    if(alive&&token===generation){image.value='';state.value='fallback'}
  }
}
function visibility(){if(!document.hidden)refresh();else{generation++;request?.abort()}}
watch(()=>[props.book.id,props.book.title,props.book.author,props.book.intro,props.book.kind,props.theme,props.miniature,props.pose],()=>{image.value='';state.value='loading';refresh()})
onMounted(async()=>{
  alive=true
  observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)refresh();else{generation++;request?.abort()}});observer.observe(host.value)
  document.addEventListener('visibilitychange',visibility)
  try{const module=await import('../services/book3d/renderer.js');if(!alive)return;api=module;release=api.retainBookPosters();refresh()}
  catch{if(alive)state.value='fallback'}
})
onBeforeUnmount(()=>{alive=false;generation++;request?.abort();observer?.disconnect();document.removeEventListener('visibilitychange',visibility);release?.()})
</script>
<template>
  <span ref="host" class="theme-book" :class="['theme-'+theme,'kind-'+(book.kind||'novel'),{'is-mini':miniature,'is-lying':pose==='lying','is-vertical-title':theme==='glaze'&&vertical,'is-horizontal-title':theme==='glaze'&&!vertical}]" :data-book-theme="theme" :data-poster="state" :style="clothStyle" aria-hidden="true">
    <img v-if="image" class="theme-book-image" :src="image" alt="" draggable="false" />
    <span v-else class="theme-book-fallback"><span class="theme-book-fallback-front">
      <span v-if="theme==='gravity'" class="theme-fallback-planet"></span>
      <span v-else class="theme-fallback-frame"></span>
      <span class="theme-fallback-heading"><strong class="theme-fallback-title">{{book.title||'未命名作品'}}</strong><small v-if="book.author">{{book.author}} 著</small></span>
      <span v-if="theme==='glaze'" class="theme-fallback-seal">{{ seal }}</span>
    </span></span>
  </span>
</template>
<style src="../styles/skins/theme-books.css"></style>
