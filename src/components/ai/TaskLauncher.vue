<script setup>
import { computed, ref } from 'vue'
import { NButton, NSelect, NInput, NModal } from 'naive-ui'
import { useWorkStore } from '../../stores/work'
import { useAiStore } from '../../stores/ai'
import { useUiStore } from '../../stores/ui'
import { TASK_PROFILES } from '../../services/ai/task-profiles.js'
const props = defineProps({ module: {type:String,required:true} })
const ui = useUiStore()
const work=useWorkStore(),ai=useAiStore(),show=ref(false),type=ref(''),requirement=ref(''),chapterId=ref(null),chapterIds=ref([]),targetId=ref(null),selection=ref(''),error=ref('')
const options=computed(()=>Object.entries(TASK_PROFILES).filter(([,p])=>p.module===props.module).map(([value,p])=>({value,label:p.label})))
const selected=computed(()=>TASK_PROFILES[type.value])
const chapterOptions=computed(()=>work.liveChapters.map(c=>({value:c.id,label:c.title})))
const targetOptions=computed(()=>{
  const rows={outline:work.olnodes,lore:work.mubu,characters:work.characters,snippets:work.snippets}[props.module] || []
  return [{value:'',label:props.module==='characters'?'新人物 / 批量提取':'作品根目录'},...rows.filter(r=>!r.deletedAt).map(r=>({value:r.id,label:r.name||r.title||(r.text||r.content||'').slice(0,40)||'空条目'}))]
})
function open(){
  type.value=options.value[0]?.value||'';chapterId.value=work.selChapterId||null;chapterIds.value=chapterId.value?[chapterId.value]:[]
  targetId.value={outline:work.selOlnodeId,characters:work.selCharacterId,snippets:work.selSnippetId}[props.module]||''
  const editor=window.__ns?.editor,s=editor?.state?.selection
  selection.value=props.module==='chapters'&&editor&&!editor.isDestroyed&&!s.empty?editor.state.doc.textBetween(s.from,s.to,'\n'):''
  requirement.value='';error.value='';show.value=true
}
async function start(){
  error.value=''
  if(!ai.loaded)await ai.loadSettings()
  if(!ai.ready){error.value='请先在工坊设置中配置模型';return}
  const extraction=selected.value?.extraction
  const taskRequest={type:type.value,workId:work.work.id,chapterId:chapterId.value,targetId:props.module==='chapters'?chapterId.value:targetId.value||null,chapterIds:extraction?type.value==='memory.extract'?[chapterId.value]:chapterIds.value:[],selection:props.module==='chapters'?selection.value:''}
  ai.prepare('',{})
  const ok=await ai.send(requirement.value||selected.value.label,{taskRequest})
  if(ok){show.value=false;ai.pendingPrompt='';ai.pendingRefs={}}
  else error.value=ai.error?.message||'生成未完成，请检查模型与任务范围'
}
</script>
<template>
  <Teleport defer to="#studio-task-actions" :disabled="!ui.isStudioSkin">
    <div class="module-agent"><NButton size="tiny" :disabled="!work.work||ai.busy" @click="open">恍然梦 · {{ {chapters:'正文',outline:'大纲',lore:'设定',characters:'人物',snippets:'灵感'}[module] }}助手</NButton><span v-if="!ui.isStudioSkin">生成草稿与提案，确认后保存</span></div>
  </Teleport>
  <NModal v-model:show="show" preset="card" title="恍然梦专用任务" style="width:580px;max-width:95vw" :mask-closable="!ai.busy">
    <div class="task-form">
      <label>本模块操作<NSelect v-model:value="type" :options="options" :disabled="ai.busy" /></label>
      <label v-if="module!=='chapters'">目标条目 / 新内容的挂载位置<NSelect v-model:value="targetId" :options="targetOptions" :disabled="ai.busy" /></label>
      <label v-if="module==='chapters'">目标章节<NSelect v-model:value="chapterId" :options="chapterOptions" :disabled="ai.busy" @update:value="selection=''" /></label>
      <label v-if="selected?.extraction && type!=='memory.extract'">要完整读取的章节范围<NSelect v-model:value="chapterIds" multiple filterable :options="chapterOptions" :disabled="ai.busy" /></label>
      <p v-if="selection">已捕获正文选段：{{ selection.slice(0,100) }}{{ selection.length>100?'…':'' }}</p>
      <NInput v-model:value="requirement" type="textarea" :disabled="ai.busy" :autosize="{minRows:3,maxRows:8}" placeholder="本次目标、字数、视角、风格和限制；提取时只归纳来源正文" />
      <p>{{ selected?.instruction }}</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="task-actions"><NButton type="primary" :loading="ai.busy" :disabled="ai.busy" @click="start">生成待确认结果</NButton><NButton v-if="ai.busy" @click="ai.cancel()">取消生成</NButton><NButton v-else @click="show=false">关闭</NButton></div>
    </div>
  </NModal>
</template>
<style scoped>
.module-agent{display:flex;gap:10px;align-items:center;flex:none;padding:6px 12px;border-bottom:1px solid var(--border);font-size:11px;color:var(--text-dim);flex-wrap:wrap}
.task-form{display:grid;gap:12px}.task-form label{display:grid;gap:6px}.task-form p{font-size:12px;white-space:pre-wrap}.task-actions{display:flex;gap:8px}.error{color:#d55}
</style>
