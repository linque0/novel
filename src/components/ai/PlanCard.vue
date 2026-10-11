<script setup>
/* 大纲方案卡（方案 §五.2）：方案名 + 子节点草案列表 + 连线语义标签（因果/伏笔/冲突）。
 * 「应用到选中节点」全部走 store 现有动作（写入红线 §六.1）：
 * - work.olnodeAdd() 把每个子节点草案挂到当前选中节点（selOlnodeId）下；
 * - work.olnodeRelAdd() 按草案 edge 建议生成相邻子节点间的连线（agent.js 输出的
 *   cause/foreshadow/conflict 映射为画布 REL_KINDS 的中文 kind：因果/伏笔/冲突，空则关联）。
 * 应用后跳到大纲画布并定位选中节点，便于查看落位（方案 §五.2「一键挂载为子节点」）。
 */
import { computed, ref } from 'vue'
import { NButton, NTag } from 'naive-ui'
import OIcon from '../OIcon.vue'
import { useWorkStore } from '../../stores/work'

const props = defineProps({
  card: { type: Object, required: true } // agent.js plan 卡：{ name, idea, nodes: [{ title, points, edge }] }
})

const work = useWorkStore()
const applied = ref(false)

/** agent.js schema 的英文 edge → 画布连线 kind（canvas-model.js REL_KINDS） */
const EDGE_LABEL = { cause: '因果', foreshadow: '伏笔', conflict: '冲突' }
const edgeLabel = (e) => EDGE_LABEL[e] || '关联'

const selNode = computed(() => work.olnodes.find((n) => n.id === work.selOlnodeId && !n.deletedAt) || null)
const selTitle = computed(() => (selNode.value ? selNode.value.title || '未命名节点' : ''))

function applyToSelected() {
  if (!work.work) return
  if (!selNode.value) {
    window.$msg?.warning('请先在大纲中选中一个节点，再应用该方案')
    return
  }
  const nodes = Array.isArray(props.card.nodes) ? props.card.nodes : []
  if (!nodes.length) {
    window.$msg?.warning('该方案没有可应用的子节点草案')
    return
  }
  // 批量挂载：草案依次挂为选中节点的直接子节点（olnodeAdd 内部自带撤销压栈与排序）
  const created = nodes.map((n) =>
    work.olnodeAdd(selNode.value.id, { kind: 'event', title: n.title || '子节点', text: n.points || '' })
  )
  // 连线：相邻草案节点之间按建议语义相连；无建议（edge=''）用「关联」兜底，
  // 保证方案树在画布上是一根看得见的剧情链（首节点向上无需连线——层级已表达）
  for (let i = 1; i < created.length; i++) {
    work.olnodeRelAdd(created[i - 1].id, created[i].id, { kind: edgeLabel(nodes[i]?.edge) })
  }
  // 跳到大纲画布并居中选中节点，查看落位
  work.tab = 'outline'
  work.outlineView = 'canvas'
  work.selOlnodeId = selNode.value.id
  work.canvasFocusTick++
  applied.value = true
  window.$msg?.success(`方案「${props.card.name || '未命名'}」已挂到「${selTitle.value}」下（${created.length} 个子节点${created.length > 1 ? ' + 连线' : ''}）`)
}
</script>

<template>
  <div class="ai-card">
    <div class="ai-card-head">
      <span class="ai-card-kicker">方案</span>
      <span class="ai-card-title">{{ card.name || '未命名方案' }}</span>
    </div>

    <p v-if="card.idea" class="ai-card-idea">{{ card.idea }}</p>

    <ol v-if="card.nodes?.length" class="ai-plan-nodes">
      <li v-for="(n, i) in card.nodes" :key="i" class="ai-plan-node">
        <div class="ai-plan-node-head">
          <span class="ai-plan-node-title">{{ n.title || '未命名子节点' }}</span>
          <NTag v-if="i > 0" size="tiny" :bordered="false" class="ai-plan-edge">{{ edgeLabel(n.edge) }}</NTag>
        </div>
        <div v-if="n.points" class="ai-plan-points">{{ n.points }}</div>
      </li>
    </ol>

    <div class="ai-card-actions">
      <NButton size="tiny" type="primary" :disabled="applied" @click="applyToSelected">
        {{ applied ? '已应用到「' + selTitle + '」' : '应用到选中节点' }}
      </NButton>
      <span class="ai-plan-target" :class="{ none: !selNode }">
        <OIcon name="diamond" :size="10" />
        {{ selNode ? '当前选中：' + selTitle : '未选中大纲节点' }}
      </span>
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
.ai-card-idea {
  margin: 2px 0 5px;
  color: var(--text);
}
.ai-plan-nodes {
  margin: 0;
  padding-left: 18px;
}
.ai-plan-node {
  margin-bottom: 5px;
}
.ai-plan-node-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ai-plan-node-title {
  color: var(--text);
  font-weight: 600;
}
.ai-plan-edge {
  color: var(--accent);
}
.ai-plan-points {
  color: var(--text-dim);
  font-size: 11.5px;
  white-space: pre-wrap;
  word-break: break-word;
}
.ai-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.ai-plan-target {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-dim);
  min-width: 0;
}
.ai-plan-target.none {
  color: var(--text-faint, var(--text-dim));
}
</style>
