<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { PAINTINGS } from '../services/book3d/theme-assets'
const props=defineProps({book:{type:Object,required:true},theme:{type:String,required:true},miniature:Boolean,pose:{type:String,default:'front'}})
const host=ref(null),image=ref(''),state=ref('loading')
const painting=computed(()=>PAINTINGS[props.book.kind]||PAINTINGS.novel)
let alive=false,visible=false,observer,api,release,generation=0
async function refresh(){
  const token=++generation
  if(!api||!visible||document.hidden)return
  await document.fonts.ready
  if(!alive||token!==generation)return
  const url=await api.getBookPoster(props.book,{theme:props.theme,size:props.miniature?'mini':props.pose==='lying'?'landscape':'hero',pose:props.pose})
  if(!alive||token!==generation)return
  image.value=url||'';state.value=url?'ready':'fallback'
}
function visibility(){if(!document.hidden)refresh()}
watch(()=>[props.book.id,props.book.title,props.book.author,props.book.intro,props.book.kind,props.theme,props.miniature,props.pose],()=>{image.value='';state.value='loading';refresh()})
onMounted(async()=>{
  alive=true
  observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)refresh()});observer.observe(host.value)
  document.addEventListener('visibilitychange',visibility)
  try{const module=await import('../services/book3d/renderer');if(!alive)return;api=module;release=api.retainBookPosters();refresh()}
  catch{if(alive)state.value='fallback'}
})
onBeforeUnmount(()=>{alive=false;generation++;observer?.disconnect();document.removeEventListener('visibilitychange',visibility);release?.()})
</script>
<template>
  <span ref="host" class="theme-book" :class="['theme-'+theme,'kind-'+(book.kind||'novel'),{'is-mini':miniature,'is-lying':pose==='lying'}]" :data-book-theme="theme" :data-poster="state" aria-hidden="true">
    <img v-if="image" class="theme-book-image" :src="image" alt="" draggable="false" />
    <span v-else class="theme-book-fallback"><span class="theme-book-fallback-front">
      <img v-if="theme==='glaze'" :src="painting" class="theme-fallback-painting" alt="" draggable="false" /><span v-else class="theme-fallback-planet"></span>
      <span class="theme-fallback-heading"><strong class="theme-fallback-title">{{book.title||'未命名作品'}}</strong><small v-if="book.author">{{book.author}} 著</small></span>
    </span></span>
  </span>
</template>
<style src="../styles/skins/theme-books.css"></style>
