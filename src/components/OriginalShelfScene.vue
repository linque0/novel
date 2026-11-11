<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
const props=defineProps({books:Array,selectedId:[String,Number],busy:Boolean})
const emit=defineEmits(['open','select','failed','ready'])
const host=ref(null), labels=ref([])
let scene, disposed=false, observer
onMounted(async()=>{
 try {
  const {createShelfScene}=await import('../services/original-shelf-scene.mjs')
  if(disposed)return
  scene=createShelfScene(host.value,{onProject:items=>labels.value=items,onOpen:book=>{if(!props.busy)emit('open',book)},onFail:()=>emit('failed'),onReady:()=>emit('ready')})
  scene.setBooks(props.books,props.selectedId)
  observer=new ResizeObserver(()=>scene?.resize());observer.observe(host.value)
 }catch{if(!disposed)emit('failed')}
})
watch(()=>[props.books,props.selectedId],()=>scene?.setBooks(props.books,props.selectedId))
onBeforeUnmount(()=>{disposed=true;observer?.disconnect();scene?.dispose()})
function hover(id){scene?.hover(id)}
defineExpose({hover})
</script>
<template>
 <div ref="host" class="shelf-scene" aria-label="实体书架">
  <div class="scene-labels">
   <div v-for="item in labels" :key="item.book.id" class="scene-label" :style="{left:item.x+'%',top:item.y+'%',width:item.labelWidth+'px'}">
    <button class="os-book-open" :data-work-id="item.book.id" :disabled="busy" :aria-label="`打开《${item.book.title}》，${item.book.author||'未署名'}，${item.book.status||'未分类'}，${item.book.totalWords||0}字`" :title="item.book.title" @mouseenter="hover(item.book.id)" @mouseleave="hover(null)" @focus="hover(item.book.id)" @blur="hover(null)" @click="emit('open',item.book)">{{item.book.title}}</button>
    <button class="os-detail" :disabled="busy" :aria-label="`查看《${item.book.title}》详情`" :aria-pressed="item.book.id===selectedId" @click="emit('select',item.book)">详情</button>
   </div>
  </div>
 </div>
</template>
<style scoped>
.shelf-scene{position:relative;width:100%;height:100%;isolation:isolate}.shelf-scene :deep(canvas){display:block;width:100%;height:100%;position:absolute;inset:0;z-index:0}.scene-labels{position:absolute;inset:0;pointer-events:none;z-index:1}.scene-label{position:absolute;transform:translate(-50%,0);display:flex;align-items:center;gap:8px;width:160px;max-width:20%;pointer-events:auto;padding:3px 5px;background:#e5dbcae8;border:1px solid #9d8c7140;box-sizing:border-box}.scene-label button{background:none;border:0;padding:6px 2px;color:#3c3c33;cursor:pointer;font:11px/1.4 'Microsoft YaHei',sans-serif;min-height:38px}.scene-label .os-book-open{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;text-align:left}.scene-label .os-detail{flex:none;color:#28554b}.scene-label button:focus-visible{outline:2px solid #28554b;outline-offset:3px}.scene-label button:disabled{opacity:.5;cursor:wait}.os-detail[aria-pressed=true]{font-weight:600}
</style>
