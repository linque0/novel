<script setup>
/* 右侧「AI 助手」侧栏（docs/AI助手接入方案.md §五 界面形态 / §七）：
 * - 不接 props，自读 stores/ai.js 状态：任务类型与锚点、生成中流式预览、卡片列表、
 *   自由问答会话、发送范围报告、用量两行、统一错误条、未配置引导。
 * - 本组件自身零写入：卡片的应用/放弃动作在 BranchCard / PlanCard / DiffCard 内
 *   经 store/work.js 现有动作完成（写入红线 §六.1），这里只负责编排展示与移除已放弃卡片。
 */
import { computed, onMounted, ref } from 'vue'
import { NButton, NTag } from 'naive-ui'
import OIcon from '../OIcon.vue'
import BranchCard from './BranchCard.vue'
import PlanCard from './PlanCard.vue'
import DiffCard from './DiffCard.vue'
import { useAiStore } from '../../stores/ai'

const ai = useAiStore()
const question = ref('')
const reportOpen = ref(false)
const chatOpen = ref(true)

onMounted(() => {
  if (!ai.loaded) ai.loadSettings() // 面板可先于设置面板挂载，自行装载 ai.* 配置
})

const TASK_LABEL = { plot: '正文发展', outline: '大纲规划', lore: '设定扩展', character: '人物丰富' }
const PHASE_LABEL = { assembling: '装配上下文…', generating: '生成中…', ready: '待应用', failed: '失败' }

const busy = computed(() => ai.phase === 'assembling' || ai.phase === 'generating')
const showTask = computed(() => busy.value || !!ai.result)
const taskLabel = computed(() => TASK_LABEL[ai.task] || ai.task || '')
const anchorLabel = computed(() => ai.result?.anchor?.label || '')
const isWeb = computed(() => typeof window !== 'undefined' && !window.native?.credentialDecrypt)
const degradedResult = computed(() => (ai.result && ai.result.degraded ? ai.result : null))
const streamTail = computed(() => (ai.streamText.length > 600 ? '……' + ai.streamText.slice(-600) : ai.streamText))
const canSend = computed(() => ai.ready && !ai.chatBusy && !!question.value.trim())

/** 卡片按类型分桶计数（标题徽标用） */
const cardKinds = computed(() => {
  const cards = ai.result?.cards || []
  return {
    branch: cards.filter((c) => c.kind === 'branch').length,
    plan: cards.filter((c) => c.kind === 'plan').length,
    diff: cards.filter((c) => c.kind === 'diff').length
  }
})

const kindLabel = computed(() => {
  const k = cardKinds.value
  const parts = []
  if (k.branch) parts.push(`${k.branch} 张线路卡`)
  if (k.plan) parts.push(`${k.plan} 张方案卡`)
  if (k.diff) parts.push(`${k.diff} 张草案卡`)
  return parts.join(' · ')
})

const fmtUsage = (u) => `${Number(u?.total_tokens) || 0} tokens · ${Number(u?.calls) || 0} 次调用`
const usageTip = (u) => `输入 ${Number(u?.prompt_tokens) || 0} + 输出 ${Number(u?.completion_tokens) || 0} tokens`

/** 卡片「放弃」：只从提案列表移除，不触碰任何库数据（方案 §五 提案制） */
function dismissCard(cardId) {
  if (!ai.result) return
  ai.result.cards = ai.result.cards.filter((c) => c.id !== cardId)
}

async function onSend() {
  const q = question.value.trim()
  if (!q || ai.chatBusy) return
  question.value = ''
  await ai.send(q)
}

/** 问答里模型表达了写入意图 → 引导到对应能力入口（不代写入） */
function writeTaskLabel(msg) {
  return TASK_LABEL[msg.writeTask] || msg.writeHint
}

function errorText(err) {
  if (!err) return ''
  const map = {
    'not-configured': '未配置',
    network: '网络失败',
    auth: '鉴权失败',
    'rate-limit': '请求限流',
    'insufficient-balance': '余额不足',
    api: '服务商错误',
    aborted: '已取消'
  }
  return map[err.code] ? `${map[err.code]}：${err.message}` : err.message
}
</script>

<template>
  <div class="ai-panel">
    <div class="rp-section">
      <div class="rp-title">
        AI 助手
        <span class="ai-head-tools">
          <NButton v-if="busy || ai.chatBusy" size="tiny" quaternary type="error" @click="ai.cancel()">停止</NButton>
          <NButton v-if="ai.chat.length" size="tiny" quaternary @click="ai.clearChat()">清空会话</NButton>
        </span>
      </div>

      <!-- 未配置引导（方案 §三：未配置时全部 AI 入口置灰，设置区可配置） -->
      <div v-if="!ai.ready" class="ai-guide">
        <template v-if="isWeb">
          AI 助手仅桌面版可用（网页版无本地凭据加密通道）。
        </template>
        <template v-else>
          还未完成配置：打开顶栏「设置」→ AI 助手区，选择服务商预设、填写 API 地址与模型，保存 API 密钥后即可使用。
          <div v-if="ai.baseURL || ai.model" class="ai-guide-miss">
            当前缺少：{{ !ai.baseURL.trim() ? 'API 地址 ' : '' }}{{ !ai.model.trim() ? '模型 ' : '' }}{{ !ai.hasCredential ? 'API 密钥' : '' }}
          </div>
        </template>
      </div>

      <!-- 统一错误提示条（能力任务与问答共用，方案 §三错误分类） -->
      <div v-if="ai.error" class="ai-error-bar" role="alert">
        <span class="ai-error-text">{{ errorText(ai.error) }}</span>
        <button class="ai-error-x" title="关闭" @click="ai.error = null"><OIcon name="close" :size="11" /></button>
      </div>
    </div>

    <!-- 当前任务：类型 / 锚点 / 流式状态 / 解析重试提示 -->
    <div v-if="showTask" class="rp-section">
      <div class="rp-title">
        当前任务
        <span class="ai-task-phase">
          <NTag size="tiny" :bordered="false" :type="ai.phase === 'failed' ? 'error' : ai.phase === 'ready' ? 'success' : 'default'">
            {{ PHASE_LABEL[ai.phase] || ai.phase }}
          </NTag>
        </span>
      </div>
      <div class="ai-task-meta">
        <span class="ai-task-kind">{{ taskLabel }}</span>
        <span v-if="anchorLabel" class="ai-task-anchor">锚点：{{ anchorLabel }}</span>
      </div>
      <div v-if="ai.retryNotice" class="ai-retry-tip">{{ ai.retryNotice }}</div>
      <pre v-if="ai.phase === 'generating' && ai.streamText" class="ai-stream">{{ streamTail }}</pre>
    </div>

    <!-- 结果：卡片列表 / 降级纯文本 / 发送范围报告 -->
    <div v-if="ai.result" class="rp-section">
      <div class="rp-title">
        提案结果
        <span class="ai-head-tools">
          <NButton size="tiny" quaternary @click="ai.resetResult()">关闭</NButton>
        </span>
      </div>

      <div v-if="kindLabel && !degradedResult" class="ai-kinds">{{ kindLabel }}</div>

      <!-- 解析失败降级：纯文本展示（方案 §五 统一交互流） -->
      <template v-if="degradedResult">
        <div class="ai-degraded">
          <div v-if="ai.result.parseError" class="ai-degraded-tip">结构化输出解析失败（{{ ai.result.parseError }}），以下为原始回答：</div>
          <pre class="ai-degraded-text">{{ ai.result.text }}</pre>
        </div>
      </template>

      <template v-for="c in ai.result.cards" :key="c.id">
        <BranchCard v-if="c.kind === 'branch'" :card="c" />
        <PlanCard v-else-if="c.kind === 'plan'" :card="c" />
        <DiffCard v-else-if="c.kind === 'diff'" :card="c" @dismiss="dismissCard" />
      </template>

      <!-- 发送范围报告（方案 §四：本次发送清单 + 裁剪透明化） -->
      <div v-if="ai.result.context" class="ai-report">
        <button class="ai-fold" type="button" @click="reportOpen = !reportOpen">
          发送范围（{{ (ai.result.context.report || []).length }} 项 · 约 {{ ai.result.context.tokens?.used || 0 }}/{{ ai.result.context.tokens?.budget || 0 }} tokens）
        </button>
        <div v-show="reportOpen" class="ai-report-body">
          <div v-if="ai.result.context.privacy" class="ai-report-privacy">隐私模式：仅发送摘要，不发送正文原文与检索片段</div>
          <ul v-if="(ai.result.context.report || []).length" class="ai-report-list">
            <li v-for="(r, i) in ai.result.context.report" :key="i">{{ r }}</li>
          </ul>
          <div v-if="(ai.result.context.dropped || []).length" class="ai-report-dropped">
            <div class="ai-report-dropped-title">已裁剪 / 压缩</div>
            <div v-for="(d, i) in ai.result.context.dropped" :key="i" class="ai-report-drop">
              <NTag size="tiny" :bordered="false">{{ d.layer }}</NTag>
              <span class="ai-report-drop-label">{{ d.label }}</span>
              <span class="ai-report-drop-reason">{{ d.reason }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空态：提示入口在各模块 -->
    <div v-if="!showTask && ai.ready" class="ai-empty">
      从编辑器右键「AI：剧情选项」、大纲节点右键「AI：规划线路」等入口发起任务；或在下方直接提问。
    </div>

    <!-- 自由问答（方案 §五.5：只读工具循环，写入意图则引导用能力卡片） -->
    <div class="rp-section">
      <div class="rp-title">自由问答</div>
      <div v-show="chatOpen" class="ai-chat">
        <div v-if="!ai.chat.length" class="ai-chat-empty">问任何关于本书的问题：人物、剧情、伏笔、设定……</div>
        <div v-for="(m, i) in ai.chat" :key="i" class="ai-msg" :class="m.role">
          <div v-if="m.role === 'user'" class="ai-bubble user">{{ m.content }}</div>
          <div v-else class="ai-bubble ai">
            <span class="ai-bubble-text">{{ m.content }}<span v-if="m.streaming" class="ai-caret"></span></span>
            <div v-if="m.writeHint && !m.streaming" class="ai-write-hint">
              检测到写入意图（{{ writeTaskLabel(m) }}）——请改用对应能力卡片，问答不会改动作品。
            </div>
            <NTag v-if="m.degraded && !m.streaming" size="tiny" :bordered="false">未按结构输出</NTag>
            <div v-if="m.error" class="ai-msg-error">{{ errorText(m.error) }}</div>
          </div>
        </div>
      </div>
      <div class="ai-chat-input">
        <textarea
          v-model="question"
          class="rp-textarea ai-question"
          rows="2"
          placeholder="自由提问（Enter 发送，Shift+Enter 换行）"
          :disabled="!ai.ready || ai.chatBusy"
          @keydown.enter.exact.prevent="onSend"
        ></textarea>
        <NButton size="tiny" type="primary" :disabled="!canSend" @click="onSend">发送</NButton>
      </div>
    </div>

    <!-- 用量两行（方案 §六.5：本会话 + 累计） -->
    <div class="ai-usage">
      <div class="ai-usage-row" :title="usageTip(ai.usage.session)">本会话：{{ fmtUsage(ai.usage.session) }}</div>
      <div class="ai-usage-row" :title="usageTip(ai.usage.total)">累计：{{ fmtUsage(ai.usage.total) }}</div>
    </div>
  </div>
</template>

<style scoped>
.ai-panel {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12.5px;
}
.ai-head-tools {
  display: inline-flex;
  gap: 4px;
}

/* 未配置引导 / 错误条 */
.ai-guide {
  border: 1px dashed var(--border-strong, var(--border));
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-dim);
  background: color-mix(in srgb, var(--accent) 5%, transparent);
}
.ai-guide-miss {
  margin-top: 4px;
  color: var(--text-faint, var(--text-dim));
}
.ai-error-bar {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 6px;
  padding: 7px 9px;
  border: 1px solid color-mix(in srgb, #c0392b 45%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, #c0392b 8%, transparent);
  color: var(--text);
  font-size: 12px;
  line-height: 1.6;
}
.ai-error-text {
  flex: 1;
  min-width: 0;
  word-break: break-all;
}
.ai-error-x {
  flex: none;
  border: none;
  background: none;
  color: var(--text-dim);
  cursor: pointer;
  padding: 1px;
}
.ai-error-x:hover {
  color: var(--text);
}

/* 当前任务 */
.ai-task-phase {
  display: inline-flex;
}
.ai-task-meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.ai-task-kind {
  font-weight: 700;
  color: var(--accent);
}
.ai-task-anchor {
  color: var(--text-dim);
  font-size: 11.5px;
}
.ai-retry-tip {
  margin-top: 5px;
  padding: 5px 8px;
  border-radius: 4px;
  background: color-mix(in srgb, #d9a94a 14%, transparent);
  color: var(--text);
  font-size: 11.5px;
}
.ai-stream {
  margin: 6px 0 0;
  max-height: 140px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-editor);
  padding: 6px 8px;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--text-dim);
  font-family: var(--editor-font);
}

/* 结果区 */
.ai-kinds {
  color: var(--text-dim);
  font-size: 11.5px;
  margin-bottom: 6px;
}
.ai-degraded-tip {
  color: var(--text-dim);
  font-size: 11.5px;
  margin-bottom: 4px;
}
.ai-degraded-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-editor);
  padding: 8px;
  max-height: 320px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.7;
  font-family: var(--editor-font);
}

/* 发送范围报告 */
.ai-report {
  margin-top: 8px;
}
.ai-fold {
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
.ai-report-body {
  margin-top: 5px;
  padding: 7px 9px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-editor);
  font-size: 11.5px;
  line-height: 1.7;
}
.ai-report-privacy {
  color: var(--accent);
  margin-bottom: 4px;
}
.ai-report-list {
  margin: 0;
  padding-left: 16px;
  color: var(--text-dim);
}
.ai-report-dropped {
  margin-top: 6px;
  border-top: 1px dashed var(--border);
  padding-top: 5px;
}
.ai-report-dropped-title {
  color: var(--text-dim);
  margin-bottom: 3px;
}
.ai-report-drop {
  display: flex;
  align-items: baseline;
  gap: 5px;
  flex-wrap: wrap;
}
.ai-report-drop-label {
  color: var(--text);
}
.ai-report-drop-reason {
  color: var(--text-faint, var(--text-dim));
  font-size: 11px;
}

/* 空态 */
.ai-empty {
  border: 1px dashed var(--border);
  border-radius: 6px;
  padding: 10px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--text-faint, var(--text-dim));
}

/* 自由问答 */
.ai-chat {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow: auto;
  margin-bottom: 8px;
}
.ai-chat-empty {
  font-size: 12px;
  color: var(--text-faint, var(--text-dim));
}
.ai-msg {
  display: flex;
}
.ai-msg.user {
  justify-content: flex-end;
}
.ai-bubble {
  max-width: 92%;
  border-radius: 8px;
  padding: 6px 9px;
  font-size: 12.5px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}
.ai-bubble.user {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--text);
}
.ai-bubble.ai {
  background: var(--bg-editor);
  border: 1px solid var(--border);
  color: var(--text);
}
.ai-bubble-text {
  white-space: pre-wrap;
}
.ai-caret {
  display: inline-block;
  width: 6px;
  height: 13px;
  margin-left: 2px;
  vertical-align: -2px;
  background: var(--accent);
  animation: ai-blink 0.9s infinite;
}
@keyframes ai-blink {
  50% {
    opacity: 0.2;
  }
}
.ai-write-hint {
  margin-top: 5px;
  padding-top: 5px;
  border-top: 1px dashed var(--border);
  color: var(--accent);
  font-size: 11.5px;
}
.ai-msg-error {
  margin-top: 5px;
  color: #c0392b;
  font-size: 11.5px;
}
.ai-chat-input {
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-items: flex-end;
}
.ai-question {
  width: 100%;
  min-height: 46px;
  resize: none;
}

/* 用量 */
.ai-usage {
  margin-top: auto;
  padding: 8px 0 2px;
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-faint, var(--text-dim));
  line-height: 1.9;
  font-variant-numeric: tabular-nums;
}
</style>
