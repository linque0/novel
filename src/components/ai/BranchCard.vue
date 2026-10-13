<script setup>
/* 正文线路卡（方案 §五.1）：线路名 / 梗概 / 张力点 / 涉及人物 / 200–400 字起笔示例 / 对伏笔与大纲的影响。
 * 两个操作都经 store 现有动作写入（写入红线 §六.1，本组件不直接碰 Dexie）：
 * - 「落到大纲」→ work.ensureChapterAnchor() 懒挂章节锚点 + work.olnodeAdd() 新增章纲子节点；
 * - 「以示例起笔续写」→ 先过 isPopped 锁门禁（§六.2，v1.0.22 writableEditorFor 教训：章节被
 *   拆出面板锁定时主窗口拒绝写入），插入前 autosave 强制版本快照（§六.3），再经活动编辑器
 *   末尾 insertContent 追加——落库走编辑器 onUpdate → work.setChapterContent() 既有 store 路径。
 */
import { computed, ref } from 'vue'
import { NButton, NTag } from 'naive-ui'
import OIcon from '../OIcon.vue'
import ProposalExtras from './ProposalExtras.vue'
import { useWorkStore } from '../../stores/work'
import { autosave } from '../../services/autosave'
import { isPopped } from '../../services/panelwindows'

const props = defineProps({
  card: { type: Object, required: true } // agent.js plot 卡：{ title, summary, tension, characters[], opening, impact, anchorId, anchorLabel }
})

const work = useWorkStore()
const appliedOutline = computed(() => props.card.appliedActions?.includes('outline'))
const appliedDraft = computed(() => props.card.appliedActions?.includes('draft'))
const openingOpen = ref(false)

const anchorLabel = computed(() => props.card.anchorLabel || '当前章节')
const openingLen = computed(() => String(props.card.opening || '').length)

/** 落到大纲：在章节锚点下新增一条章纲子节点（梗概 + 张力 + 影响合写进节点正文） */
async function applyToOutline() {
  try { await work.applyAiProposal(props.card, { action: 'outline' }); window.$msg?.success('已落到章节大纲') }
  catch (e) { window.$msg?.warning(e.message) }
}
async function continueWithOpening() {
  try { await work.applyAiProposal(props.card, { action: 'draft' }); window.$msg?.success('起笔示例已追加，可继续润色') }
  catch (e) { window.$msg?.warning(e.message) }
}
</script>

<template>
  <div class="ai-card">
    <div class="ai-card-head">
      <span class="ai-card-kicker">线路</span><NTag size="tiny" :type="card.strategy === 'twist' ? 'warning' : 'info'">{{ ({steady:'稳健推进',escalate:'冲突激化',twist:'意外转折',payoff:'伏笔回收',seed:'伏笔铺垫'})[card.strategy] }}</NTag>
      <span class="ai-card-title">{{ card.title || '未命名线路' }}</span>
    </div>

    <p v-if="card.summary" class="ai-card-summary">{{ card.summary }}</p>
    <p v-if="card.tension" class="ai-card-line"><b>张力</b>{{ card.tension }}</p>

    <div v-if="card.characters?.length" class="ai-card-chars">
      <NTag v-for="c in card.characters" :key="c" size="tiny" :bordered="false">{{ c }}</NTag>
    </div>

    <div v-if="card.opening" class="ai-card-opening">
      <button class="ai-fold" type="button" @click="openingOpen = !openingOpen">
        <OIcon :name="openingOpen ? 'minus' : 'plus'" :size="10" />
        起笔示例（约 {{ openingLen }} 字）
      </button>
      <pre v-show="openingOpen" class="ai-opening-text">{{ card.opening }}</pre>
    </div>

    <p v-for="(text, key) in card.impact" :key="key" class="ai-card-line"><b>{{ ({foreshadow:'伏笔',characters:'人物',outline:'大纲'})[key] }}</b>{{ text }}</p>
    <details v-if="card.consistency"><summary>一致性自检</summary>{{ card.consistency }}</details>
    <ProposalExtras :card="card" />

    <div class="ai-card-actions">
      <NButton size="tiny" type="primary" :disabled="appliedOutline" @click="applyToOutline">
        {{ appliedOutline ? '已落到大纲' : '落到大纲' }}
      </NButton>
      <NButton size="tiny" :disabled="appliedDraft" @click="continueWithOpening">
        {{ appliedDraft ? '已插入正文' : '以示例起笔续写' }}
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.ai-card {
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--bg-editor);
  padding: 9px 10px;
  margin-bottom: 8px;
  font-size: 12px;
  line-height: 1.7;
}
.ai-card-head {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 3px;
}
.ai-card-kicker {
  flex: none;
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  border-radius: 3px;
  padding: 0 4px;
}
.ai-card-title {
  font-weight: 700;
  color: var(--text);
  font-size: 12.5px;
}
.ai-card-summary {
  margin: 2px 0 4px;
  color: var(--text);
}
.ai-card-line {
  margin: 3px 0 0;
  color: var(--text-dim);
}
.ai-card-line b {
  display: inline-block;
  margin-right: 6px;
  color: var(--accent);
  font-weight: 600;
}
.ai-card-chars {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 5px 0 0;
}
.ai-card-opening {
  margin-top: 6px;
}
.ai-fold {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  padding: 0;
  font-size: 11.5px;
  color: var(--text-dim);
  cursor: pointer;
}
.ai-fold:hover {
  color: var(--accent);
}
.ai-opening-text {
  margin: 5px 0 0;
  padding: 8px;
  border: 1px dashed var(--border);
  border-radius: 6px;
  background: color-mix(in srgb, var(--accent) 4%, transparent);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 260px;
  overflow: auto;
  font-family: var(--editor-font);
  font-size: 12px;
  line-height: 1.8;
  color: var(--text);
}
.ai-card-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
</style>
