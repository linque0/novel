<script setup>
import { onMounted, ref, watch } from "vue";
import { NButton, NInput, NSelect, NModal } from "naive-ui";
import { useAiStore } from "../../stores/ai";
import { useWorkStore } from "../../stores/work";
import { useUiStore } from "../../stores/ui";
import { renderChat, plainChat } from "../../services/ai/chat-text";
import PresetEvaluation from "./PresetEvaluation.vue";
import DraftCard from "./DraftCard.vue";
import PlanCard from "./PlanCard.vue";
import DiffCard from "./DiffCard.vue";
import KnowledgePanel from "./KnowledgePanel.vue";
const ai = useAiStore(),
  work = useWorkStore(),
  ui = useUiStore(),
  question = ref(ai.pendingPrompt || ""),
  knowledgeOpen = ref(false),
  evaluationOpen = ref(false),
  draftPreview = ref(null),
  chatPane = ref(null),
  refs = ref({ ...ai.pendingRefs });
watch(
  () => ai.pendingPrompt,
  (v) => {
    if (v) {
      question.value = v;
      refs.value = { ...ai.pendingRefs };
    }
  },
);
watch(
  () => ai.chat.map((m) => m.content).join(""),
  () => {
    requestAnimationFrame(() => {
      if (chatPane.value)
        chatPane.value.scrollTop = chatPane.value.scrollHeight;
    });
  },
);
onMounted(async () => {
  if (!ai.loaded) await ai.loadSettings();
  await ai.loadPresets();
});
async function send() {
  const text = question.value.trim();
  if (!text || ai.busy || !ai.ready) return;
  const contextRefs = { ...refs.value };
  const editor = window.__ns?.editor;
  if (!contextRefs.chapterId) contextRefs.chapterId = work.selChapterId;
  if (
    !contextRefs.selection &&
    editor &&
    !editor.isDestroyed &&
    work.selChapterId === contextRefs.chapterId
  ) {
    const s = editor.state.selection;
    if (!s.empty)
      contextRefs.selection = editor.state.doc.textBetween(s.from, s.to, "\n");
  }
  question.value = "";
  refs.value = {};
  ai.pendingPrompt = "";
  ai.pendingRefs = {};
  await ai.send(text, { contextRefs });
}
function onKeyDown(event) {
  if (
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.isComposing &&
    event.keyCode !== 229
  ) {
    event.preventDefault();
    send();
  }
}
watch(
  () => ai.workId,
  () => {
    question.value = "";
    refs.value = {};
  },
);
/* 面板窗口打开：await 结果并反馈失败，避免"点了没反应"（主进程未重启／网页版／被锁定） */
async function openPanel(spec, label) {
  if (!window.native?.panelOpen) {
    window.$msg?.info(`${label}窗口仅桌面版可用，网页版暂不支持`);
    return;
  }
  try {
    const r = await window.native.panelOpen(spec);
    if (!r?.ok) {
      console.warn(`[panels] ${label} 打开失败`, r);
      window.$msg?.error(
        `${label}窗口打开失败（${r?.reason || "未知原因"}）。若刚更新过主进程代码，重启应用后再试。`,
      );
    }
  } catch (e) {
    window.$msg?.error(`${label}窗口打开失败：${e?.message || e}`);
  }
}
function presets() {
  openPanel(
    {
      type: "ai-presets",
      workId: work.work?.id || "__global__",
      entityId: work.selChapterId || "",
    },
    "预设编辑",
  );
}
function draft(msg, event) {
  const body = event.currentTarget
      .closest(".chat-message")
      ?.querySelector(".chat-body"),
    selection = window.getSelection();
  const selected =
    selection &&
    body?.contains(selection.anchorNode) &&
    body?.contains(selection.focusNode)
      ? selection.toString()
      : "";
  draftPreview.value = {
    msg,
    index: msg.activeCandidate || 0,
    text: selected || plainChat(msg.content),
    selected: !!selected,
  };
}
function acceptDraft() {
  try {
    const p = draftPreview.value;
    if ((p.msg.activeCandidate || 0) !== p.index)
      throw new Error("候选已切换，请重新预览");
    ai.draftFromMessage(p.msg, p.text, { visibleSelection: p.selected });
    draftPreview.value = null;
  } catch (e) {
    window.$msg?.warning(e.message);
  }
}
function dismiss(msg, id) {
  msg.cards = msg.cards.filter((c) => c.id !== id);
}
</script>
<template>
  <div class="ai-panel">
    <div class="ai-top">
      <strong>恍然梦</strong
      ><NButton size="tiny" quaternary @click="presets">预设编辑</NButton
      ><NButton size="tiny" quaternary @click="knowledgeOpen = true"
        >作品知识</NButton
      >
      <NButton size="tiny" quaternary @click="evaluationOpen = true"
        >预设对照</NButton
      >
    </div>
    <NSelect
      :value="ai.selectedPresetId"
      :options="ai.presets.map((p) => ({ label: p.name, value: p.id }))"
      size="small"
      :disabled="ai.chatBusy"
      @update:value="
        (id) =>
          ai.selectPreset(id).catch((e) => window.$msg?.warning(e.message))
      "
    />
    <p v-if="!ai.ready" class="notice">
      请在设置中填写 API 地址、模型和密钥后开始对话。
    </p>
    <div ref="chatPane" class="chat-scroll">
      <p v-if="!ai.chat.length" class="empty">
        与恍然梦讨论作品，或直接描述想创作的内容。当前章节和选段将作为关联材料。
      </p>
      <article
        v-for="msg in ai.chat"
        :key="msg.id || msg.ts"
        class="chat-message"
        :class="msg.role"
      >
        <div class="message-head">
          {{ msg.role === "user" ? "作者" : "恍然梦"
          }}<small v-if="msg.preset"
            >{{ msg.preset.name }} · v{{ msg.preset.revision }}</small
          ><span v-if="msg.streaming">生成中…</span>
        </div>
        <div
          class="message-text chat-body"
          v-html="renderChat(msg.displayText ?? msg.content)"
        ></div>
        <details v-if="msg.rawContent" class="scope">
          <summary>原始文本</summary>
          <pre>{{ msg.rawContent }}</pre>
        </details>
        <details v-if="msg.reasoning?.rawText" class="scope">
          <summary>模型推理</summary>
          <div
            v-html="
              renderChat(msg.reasoning.displayText ?? msg.reasoning.rawText)
            "
          ></div>
        </details>
        <div
          v-if="msg.role === 'assistant' && msg.candidates?.length > 1"
          class="candidate-controls"
        >
          <NButton
            size="tiny"
            :disabled="ai.busy || msg.activeCandidate === 0"
            @click="ai.selectCandidate(msg, msg.activeCandidate - 1)"
            >‹</NButton
          >
          <span
            >候选 {{ (msg.activeCandidate || 0) + 1 }} /
            {{ msg.candidates.length }}</span
          >
          <NButton
            size="tiny"
            :disabled="
              ai.busy || msg.activeCandidate >= msg.candidates.length - 1
            "
            @click="ai.selectCandidate(msg, msg.activeCandidate + 1)"
            >›</NButton
          >
        </div>
        <template v-if="!msg.streaming"
          ><details
            v-for="card in msg.cards || []"
            :key="card.id"
            class="proposal"
          >
            <summary>
              {{
                card.title ||
                card.name ||
                (card.subject === "character" ? "人物建议" : "设定建议")
              }}
              ·
              {{
                card.status === "applied"
                  ? "已应用"
                  : card.complete === false
                    ? "未完整"
                    : "待确认"
              }}
            </summary>
            <DraftCard v-if="card.kind === 'draft'" :card="card" /><PlanCard
              v-else-if="card.kind === 'plan' && card.complete !== false"
              :card="card"
            /><DiffCard
              v-else-if="card.kind === 'diff' && card.complete !== false"
              :card="card"
              @dismiss="dismiss(msg, card.id)"
            /><NButton size="tiny" quaternary @click="dismiss(msg, card.id)"
              >放弃此提案</NButton
            >
          </details></template
        >
        <p v-if="msg.error" class="error">{{ msg.error.message }}</p>
        <details
          v-if="
            !msg.streaming &&
            !msg.complete &&
            msg.toolOutput &&
            !msg.cards?.length
          "
          class="scope"
        >
          <summary>未完整的工具输出（仅供查看）</summary>
          <div class="message-text">{{ msg.toolOutput }}</div>
        </details>
        <div
          v-if="msg.role === 'assistant' && !msg.streaming"
          class="message-actions"
        >
          <NButton
            size="tiny"
            quaternary
            :disabled="ai.busy"
            @click="ai.continueMessage(msg)"
            >继续</NButton
          ><NButton
            size="tiny"
            quaternary
            :disabled="ai.busy"
            @click="ai.regenerateMessage(msg)"
            >重新生成</NButton
          ><NButton
            size="tiny"
            quaternary
            :disabled="!msg.complete || !!msg.error"
            @click="draft(msg, $event)"
            >所选文本／回复作为正文草稿</NButton
          >
        </div>
        <details v-if="msg.context" class="scope">
          <summary>发送范围与预算</summary>
          <p
            v-for="(r, i) in [...msg.context.report, ...msg.context.warnings]"
            :key="i"
          >
            {{ r }}
          </p>
          <p v-for="d in msg.context.dropped" :key="d.label">
            裁剪：{{ d.label }}
          </p>
          <p>
            输入 {{ msg.context.tokens.used }}/{{
              msg.context.tokens.inputCap
            }}
            · 输出预留 {{ msg.context.tokens.outputReserve }}
          </p>
          <p v-for="r in msg.rounds || []" :key="r.round">
            第 {{ r.round }} 轮：{{ r.used }}/{{ r.inputCap }}
          </p>
        </details>
      </article>
    </div>
    <p v-if="ai.error" class="error" role="alert">{{ ai.error.message }}</p>
    <div class="compose">
      <p
        v-if="
          refs.chapterId || refs.outlineId || refs.characterId || refs.loreId
        "
        class="notice"
      >
        已附带创作对象{{ refs.selection ? "与选段" : "" }}，发送时冻结来源。
      </p>
      <NInput
        v-model:value="question"
        type="textarea"
        placeholder="描述需求，Enter 发送，Shift+Enter 换行"
        :autosize="{ minRows: 3, maxRows: 8 }"
        @keydown="onKeyDown"
      />
      <div class="compose-actions">
        <small
          >{{ ai.usage.session.total_tokens }} tokens ·
          {{ ai.usage.session.calls }} 次{{
            ai.usage.session.estimatedCalls ? "（含估算）" : ""
          }}</small
        ><NButton
          size="tiny"
          quaternary
          :disabled="ai.busy"
          @click="ai.clearChat().catch((e) => window.$msg?.warning(e.message))"
          >清空</NButton
        ><NButton v-if="ai.busy" size="small" type="error" @click="ai.cancel()"
          >停止</NButton
        ><NButton
          v-else
          type="primary"
          size="small"
          :disabled="!ai.ready || !question.trim()"
          @click="send"
          >发送</NButton
        >
      </div>
    </div>
    <NModal
      :show="!!draftPreview"
      preset="card"
      title="正文草稿转换预览"
      style="width: min(780px, 90vw); max-height: 85vh; overflow: auto"
      @update:show="draftPreview = null"
      ><template v-if="draftPreview"
        ><p>
          {{
            draftPreview.selected
              ? "使用实际选中的可见文本"
              : "使用当前候选去除展示 HTML 后的处理文本"
          }}
          · 候选 {{ draftPreview.index + 1 }}
        </p>
        <pre class="message-text">{{ draftPreview.text }}</pre>
        <NButton
          type="primary"
          :disabled="!draftPreview.text.trim()"
          @click="acceptDraft"
          >确认为正文草稿</NButton
        ></template
      ></NModal
    >
    <NModal
      v-model:show="evaluationOpen"
      preset="card"
      title="预设输出对照评测"
      style="width: min(1000px, 92vw); max-height: 85vh; overflow: auto"
      ><PresetEvaluation
    /></NModal>
    <NModal
      v-model:show="knowledgeOpen"
      preset="card"
      title="作品知识库"
      style="width: 900px; max-height: 85vh; overflow: auto"
      ><KnowledgePanel
    /></NModal>
  </div>
</template>
<style scoped>
.ai-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 10px;
  color: var(--text);
}
.ai-top {
  display: flex;
  align-items: center;
  gap: 4px;
}
.ai-top strong {
  flex: 1;
}
.chat-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.chat-message {
  padding: 13px 9px;
  margin-bottom: 12px;
  border-radius: 8px;
  background: var(--bg-panel);
}
.chat-message.user {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}
.message-head {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 8px;
}
.message-head small {
  flex: 1;
}
.message-text {
  overflow-wrap: anywhere;
  font-size: 13px;
  line-height: 1.85;
  user-select: text;
}
.message-actions,
.compose-actions {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 8px;
}
.compose-actions small {
  flex: 1;
  color: var(--text-dim);
  font-size: 10px;
}
.empty {
  padding: 30px 12px;
  color: var(--text-dim);
  line-height: 1.8;
}
.proposal,
.scope {
  margin-top: 10px;
  border: 1px solid var(--border);
  padding: 8px;
}
.scope {
  font-size: 11px;
  color: var(--text-dim);
}
summary {
  cursor: pointer;
}
.error {
  font-size: 12px;
  color: #d55;
}
.notice {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.6;
}
.candidate-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 10px;
  font-size: 12px;
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.chat-body :deep(pre) {
  overflow: auto;
  background: var(--bg-hover);
  padding: 10px;
  white-space: pre-wrap;
}
.chat-body :deep(p) {
  margin: 6px 0;
}
.chat-body :deep(table) {
  border-collapse: collapse;
}
.chat-body :deep(td),
.chat-body :deep(th) {
  border: 1px solid var(--border);
  padding: 4px;
}
</style>
