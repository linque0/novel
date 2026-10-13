<script setup>
/* AI 设置块（方案 §三 / §七「并入 SettingsPanel 的 AI 区」）：
 * - 服务商预设（DeepSeek 默认 / 智谱 GLM / OpenAI / Ollama 本地 / 自定义），选择即填 baseURL 与默认 model；
 * - baseURL / model / temperature / 上下文预算 / 隐私模式开关；
 * - API key：保存后经 window.native.credentialEncrypt（safeStorage/DPAPI）加密落 ai.credential
 *   （stores/ai.js saveSettings 完成），本组件不回显明文，只显示「已配置」+ 清除按钮（§六.4）；
 * - 「连接测试」：先把当前表单保存进 store（避免测的是旧配置），再发一条最小请求（provider.testConnection）。
 * 全部经 stores/ai.js 动作落库（db.appconfig ai.*），本组件不直接写 Dexie。
 */
import { onMounted, reactive, ref } from 'vue'
import { NButton, NInput, NInputNumber, NModal, NSelect, NSwitch, NTag } from 'naive-ui'
import OIcon from '../OIcon.vue'
import { useAiStore } from '../../stores/ai'
import { lookupModelMeta } from '../../services/ai/modelmeta'

const ai = useAiStore()

const PRESETS = [
  { value: 'deepseek', label: 'DeepSeek（默认）', baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { value: 'glm', label: '智谱 GLM', baseURL: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { value: 'openai', label: 'OpenAI', baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { value: 'ollama', label: 'Ollama 本地', baseURL: 'http://127.0.0.1:11434/v1', model: 'qwen2.5' },
  { value: 'custom', label: '自定义', baseURL: '', model: '' }
]
const presetOptions = PRESETS.map((p) => ({ label: p.label, value: p.value }))

const form = reactive({
  baseURL: ai.baseURL,
  temperature: ai.temperature,
  maxContext: ai.maxContext,
  privacy: ai.privacy,
  options: JSON.parse(JSON.stringify(ai.options))
})
const preset = ref('custom')
const apiKey = ref('')
const keyBusy = ref(false)
const saving = ref(false)
const testing = ref(false)
const testResult = ref(null) // { ok, text }
/* 模型列表：拉取结果 / 内联添加 / 提示条（列表本体在 ai.models，点行即选用） */
const adding = ref(false)
const newModel = ref('')
const fetchedIds = ref([])
const fetchMsg = ref(null) // { ok, text }
/* 编辑模型配置弹窗（逐模型专属参数） */
const editOpen = ref(false)
const editName = ref('')
const editForm = reactive({ enabled: true, contextWindow: null, maxTokens: null, temperature: null, note: '' })
const editPrefilled = ref(false) // 本次打开是否用官方参考参数补位过（弹窗内提示）

function openEdit(m) {
  editName.value = m
  const cfg = ai.modelCfg[m] || {}
  const meta = lookupModelMeta(m)
  /* 已保存的专属配置优先；缺失字段用官方参考值补位 */
  editForm.enabled = cfg.enabled !== false
  editForm.contextWindow = cfg.contextWindow ?? meta?.contextWindow ?? null
  editForm.maxTokens = cfg.maxTokens ?? meta?.maxTokens ?? null
  editForm.temperature = cfg.temperature ?? null
  editForm.note = cfg.note || meta?.note || ''
  editPrefilled.value = !!meta && (cfg.contextWindow == null || cfg.maxTokens == null)
  editOpen.value = true
}

async function saveEdit() {
  await ai.saveModelCfg(editName.value, { ...editForm })
  editOpen.value = false
  window.$msg?.success(`「${editName.value}」模型配置已保存`)
}

onMounted(async () => {
  if (!ai.loaded) await ai.loadSettings()
  syncForm()
})

function syncForm() {
  form.baseURL = ai.baseURL
  form.temperature = ai.temperature
  form.maxContext = ai.maxContext
  form.privacy = ai.privacy
  form.options = JSON.parse(JSON.stringify(ai.options))
  const hit = PRESETS.find((p) => p.baseURL && p.baseURL === ai.baseURL.trim())
  preset.value = hit ? hit.value : 'custom'
}

/** 选择预设即填 baseURL，并把该预设的默认模型加入模型列表（点「保存设置」后地址生效） */
function onPreset(v) {
  preset.value = v
  const p = PRESETS.find((x) => x.value === v)
  if (!p) return
  if (p.baseURL) {
    form.baseURL = p.baseURL
    if (p.model) ai.addModel(p.model)
  }
}

async function persistForm() {
  await ai.saveSettings({
    baseURL: form.baseURL,
    temperature: form.temperature,
    maxContext: form.maxContext,
    privacy: form.privacy,
    options: form.options
  })
}

async function saveAll() {
  saving.value = true
  try {
    await persistForm()
    window.$msg?.success('AI 设置已保存')
  } catch (e) {
    window.$msg?.error(String(e?.message || e))
  } finally {
    saving.value = false
  }
}

/** 保存密钥：明文只经 safeStorage 加密通道落库（stores/ai.js saveSettings），组件不持有明文状态 */
async function saveKey() {
  keyBusy.value = true
  try {
    await ai.saveSettings({ apiKey: apiKey.value.trim() })
    apiKey.value = ''
    window.$msg?.success(ai.hasCredential ? 'API 密钥已加密保存' : 'API 密钥已清除')
  } catch (e) {
    window.$msg?.error(String(e?.message || e))
  } finally {
    keyBusy.value = false
  }
}

async function clearKey() {
  keyBusy.value = true
  try {
    await ai.saveSettings({ apiKey: '' })
    apiKey.value = ''
    window.$msg?.success('API 密钥已清除')
  } catch (e) {
    window.$msg?.error(String(e?.message || e))
  } finally {
    keyBusy.value = false
  }
}

/** 连接测试：先保存当前表单（避免测旧配置），再发一条最小请求（provider.testConnection） */
async function onTest() {
  testing.value = true
  testResult.value = null
  try {
    await persistForm()
    const r = await ai.testConnection()
    testResult.value = r.ok
      ? { ok: true, text: `连接成功（${r.model || ai.model}）${r.reply ? ` · 回复：${String(r.reply).trim().slice(0, 40)}` : ''}` }
      : { ok: false, text: r.error?.message || '连接失败' }
  } catch (e) {
    testResult.value = { ok: false, text: String(e?.message || e) }
  } finally {
    testing.value = false
  }
}

/* ---------- 模型列表：拉取 / 手动添加 ---------- */

/** 拉取服务商模型列表：先把当前 baseURL 表单落库（避免拉旧地址），结果逐行点「＋ 添加」入列 */
async function onFetch() {
  fetchMsg.value = null
  try {
    await persistForm()
    const ids = await ai.fetchModelList()
    fetchedIds.value = ids
    fetchMsg.value = { ok: true, text: `已拉取 ${ids.length} 个模型，点「＋ 添加」加入下方列表` }
  } catch (e) {
    fetchMsg.value = { ok: false, text: String(e?.message || e) }
  }
}

async function confirmAdd() {
  const m = newModel.value.trim()
  if (!m) return
  await ai.addModel(m)
  newModel.value = ''
}

/** 模型行上下文徽标（仿 ZCode 模型列表的「1M」标）：优先取已启用专属配置，否则取参数表匹配值 */
function ctxTag(m) {
  const cfg = ai.modelCfg[m]
  const n = Number(cfg && cfg.enabled ? cfg.contextWindow : 0) || Number(lookupModelMeta(m)?.contextWindow) || 0
  if (!n) return ''
  return n >= 1000000 ? '1M' : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n)
}
</script>

<template>
  <div class="ai-settings">
    <div class="ai-set-row">
      <span class="lb">服务商</span>
      <NSelect size="small" :value="preset" :options="presetOptions" @update:value="onPreset" />
    </div>
    <div class="ai-set-row">
      <span class="lb">API 地址</span>
      <NInput v-model:value="form.baseURL" size="small" placeholder="https://api.deepseek.com/v1" />
    </div>

    <!-- 模型列表：拉取服务商 /models 或手动添加；点行即选用（立即持久化） -->
    <div class="ai-models">
      <div class="ai-models-head">
        <span class="lb">模型列表</span>
        <span class="ai-models-actions">
          <NButton size="tiny" :loading="ai.fetchingModels" :disabled="!form.baseURL.trim()" @click="onFetch">拉取模型</NButton>
          <NButton size="tiny" @click="adding = !adding">＋ 添加模型</NButton>
        </span>
      </div>
      <div v-if="adding" class="ai-model-add">
        <NInput v-model:value="newModel" size="small" placeholder="手动输入模型名，如 deepseek-chat / glm-4-flash" @keydown.enter="confirmAdd" />
        <NButton size="tiny" type="primary" :disabled="!newModel.trim()" @click="confirmAdd">添加</NButton>
      </div>
      <div v-if="fetchMsg" class="ai-fetch-msg" :class="fetchMsg.ok ? 'ok' : 'fail'">{{ fetchMsg.text }}</div>
      <div v-if="fetchedIds.length" class="ai-fetch-list">
        <div class="ai-fetch-title">
          <span>服务商返回 {{ fetchedIds.length }} 个模型</span>
          <NButton size="tiny" quaternary @click="fetchedIds = []">收起</NButton>
        </div>
        <div v-for="id in fetchedIds" :key="id" class="ai-fetch-row">
          <span class="ai-fetch-id" :title="id">{{ id }}</span>
          <NButton v-if="!ai.models.includes(id)" size="tiny" @click="ai.addModel(id)">＋ 添加</NButton>
          <NTag v-else size="tiny" type="success" :bordered="false">已添加</NTag>
        </div>
      </div>
      <div class="ai-model-list">
        <div
          v-for="m in ai.models"
          :key="m"
          class="ai-model-row"
          :class="{ on: m === ai.model }"
          :title="m === ai.model ? '当前使用的模型' : '点击选用该模型'"
          @click="ai.selectModel(m)"
        >
          <span class="ai-model-name" :title="ai.modelCfg[m]?.note ? `${ai.modelCfg[m].note}\n${m}` : m">{{ m }}</span>
          <NTag v-if="ctxTag(m)" size="tiny" :bordered="false" class="ai-model-ctx">{{ ctxTag(m) }}</NTag>
          <NTag v-if="ai.modelCfg[m]?.enabled" size="tiny" :bordered="false">专属</NTag>
          <NTag v-if="m === ai.model" size="tiny" type="success" :bordered="false">使用中</NTag>
          <button class="ai-model-edit" title="编辑模型配置" @click.stop="openEdit(m)"><OIcon name="edit" :size="11" /></button>
          <button class="ai-model-del" title="从列表移除" @click.stop="ai.removeModel(m)"><OIcon name="close" :size="11" /></button>
        </div>
        <div v-if="!ai.models.length" class="ai-model-empty">
          列表为空——「拉取模型」获取服务商可用模型，或手动添加模型名{{ ai.model ? `（当前仍使用 ${ai.model}）` : '' }}
        </div>
      </div>
      <div class="ai-models-tip">点行即选用，使用中的模型立即生效，无需再点保存设置。</div>
    </div>

    <div class="ai-set-row">
      <span class="lb">温度</span>
      <NInputNumber v-model:value="form.temperature" size="small" :min="0" :max="2" :step="0.1" style="width: 110px" />
      <span class="ai-set-hint">0 严谨 · 1.2+ 更放肆</span>
    </div>
    <div class="ai-set-row">
      <span class="lb">上下文预算</span>
      <NInputNumber v-model:value="form.maxContext" size="small" :min="1000" :max="64000" :step="500" style="width: 130px">
        <template #suffix>tokens</template>
      </NInputNumber>
    </div>
    <div class="ai-set-row">
      <span class="lb">隐私模式</span>
      <NSwitch v-model:value="form.privacy" size="small" />
      <span class="ai-set-hint">仅发送摘要，不发送正文原文与检索片段</span>
    </div>

    <div class="ai-set-row"><span class="lb">自动记忆</span><NSwitch v-model:value="form.options.kb.auto" :disabled="form.privacy" size="small" /><span class="ai-set-hint">默认关闭，开启后只更新改动章节与依赖</span></div>
    <div class="ai-set-row"><span class="lb">每日上限</span><NInputNumber v-model:value="form.options.kb.usageCap" :min="0" :step="1000" size="small" /><span class="ai-set-hint">tokens，启用自动记忆时必填；缺失 usage 用估算</span></div>
    <div class="ai-set-row"><span class="lb">语义检索</span><NSwitch v-model:value="form.options.embeddings.enabled" size="small" /><span class="ai-set-hint">默认关闭，失败回落关键词</span></div>
    <div class="ai-set-row"><span class="lb">向量模型</span><NInput v-model:value="form.options.embeddings.model" size="small" placeholder="独立 embeddings 模型名" /></div>
    <div class="ai-set-row">
      <span class="lb">API 密钥</span>
      <span class="ai-key-zone">
        <NInput
          v-model:value="apiKey"
          size="small"
          type="password"
          show-password-on="click"
          :placeholder="ai.hasCredential ? '已配置（输入新密钥可覆盖）' : '粘贴密钥，仅保存在本机（加密）'"
          class="ai-key-input"
        />
        <NButton size="tiny" :loading="keyBusy" :disabled="!apiKey.trim()" @click="saveKey">保存密钥</NButton>
        <NTag v-if="ai.hasCredential" size="tiny" type="success" :bordered="false">已配置</NTag>
        <NButton v-if="ai.hasCredential" size="tiny" quaternary type="error" :disabled="keyBusy" @click="clearKey">清除</NButton>
      </span>
    </div>
    <div class="ai-set-note">密钥经系统凭据（Windows DPAPI）加密存放，不进备份文件、不回显明文。</div>

    <div class="ai-set-actions">
      <NButton size="small" type="primary" :loading="saving" @click="saveAll">保存设置</NButton>
      <NButton size="small" :loading="testing" @click="onTest"><OIcon name="link" :size="12" /> 连接测试</NButton>
      <NTag v-if="ai.ready" size="tiny" type="success" :bordered="false">已就绪</NTag>
      <NTag v-else size="tiny" :bordered="false">未就绪</NTag>
    </div>
    <div v-if="testResult" class="ai-test-result" :class="testResult.ok ? 'ok' : 'fail'">{{ testResult.text }}</div>

    <!-- 编辑模型配置（逐模型专属参数；生效规则见弹窗底部说明） -->
    <NModal v-model:show="editOpen" preset="card" style="width: 470px" title="编辑模型配置">
      <div class="ai-mc">
        <div class="ai-mc-name">{{ editName }}</div>
        <div v-if="editPrefilled" class="ai-mc-prefill">已按官方文档预填参考参数，可自行调整</div>
        <div class="ai-mc-row">
          <span class="ai-mc-lb">启用专属参数</span>
          <NSwitch v-model:value="editForm.enabled" size="small" />
        </div>
        <div class="ai-mc-row">
          <span class="ai-mc-lb">上下文窗口</span>
          <NInputNumber
            v-model:value="editForm.contextWindow"
            size="small"
            :min="0"
            :max="2000000"
            :step="1000"
            :disabled="!editForm.enabled"
            placeholder="留空跟随全局预算"
          >
            <template #suffix>tokens</template>
          </NInputNumber>
        </div>
        <div class="ai-mc-row">
          <span class="ai-mc-lb">最大输出 Token</span>
          <NInputNumber
            v-model:value="editForm.maxTokens"
            size="small"
            :min="0"
            :max="200000"
            :step="500"
            :disabled="!editForm.enabled"
            placeholder="留空不限制"
          />
        </div>
        <div class="ai-mc-row">
          <span class="ai-mc-lb">温度覆盖</span>
          <NInputNumber
            v-model:value="editForm.temperature"
            size="small"
            :min="0"
            :max="2"
            :step="0.1"
            :disabled="!editForm.enabled"
            placeholder="留空跟随全局温度"
          />
        </div>
        <div class="ai-mc-row">
          <span class="ai-mc-lb">备注</span>
          <NInput v-model:value="editForm.note" size="small" :disabled="!editForm.enabled" placeholder="选填，如「长上下文主力」" />
        </div>
        <div class="ai-mc-hint">
          启用后：上下文窗口与全局预算取更小值作为装配预算；最大输出随请求发送 max_tokens；温度覆盖优先于全局温度。关闭开关则该模型完全跟随全局设置。
        </div>
        <div class="ai-mc-foot">
          <NButton size="small" @click="editOpen = false">取消</NButton>
          <NButton size="small" type="primary" @click="saveEdit">保存</NButton>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.ai-settings {
  font-size: 12.5px;
  color: var(--text);
}
.ai-set-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}
.ai-set-row .lb {
  flex: none;
  width: 62px;
  color: var(--text-dim);
  font-size: 11.5px;
}
.ai-set-row > :not(.lb) {
  flex: 1;
  min-width: 0;
}
.ai-set-hint {
  flex: none !important;
  color: var(--text-faint, var(--text-dim));
  font-size: 11px;
}
.ai-key-zone {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.ai-key-input {
  flex: 1 !important;
  min-width: 120px;
}
/* 模型列表区（拉取 / 内联添加 / 点选使用） */
.ai-models {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
  margin: 4px 0 6px 62px;
  background: var(--bg-editor, transparent);
}
.ai-models-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.ai-models-head .lb {
  flex: none;
  font-size: 11.5px;
  color: var(--text-dim);
}
.ai-models-actions {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
.ai-model-add {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}
.ai-fetch-msg {
  margin: 2px 0 6px;
  padding: 5px 8px;
  border-radius: 4px;
  font-size: 11.5px;
  line-height: 1.5;
  word-break: break-all;
}
.ai-fetch-msg.ok {
  border: 1px solid color-mix(in srgb, #27ae60 45%, transparent);
  background: color-mix(in srgb, #27ae60 10%, transparent);
}
.ai-fetch-msg.fail {
  border: 1px solid color-mix(in srgb, #c0392b 45%, transparent);
  background: color-mix(in srgb, #c0392b 8%, transparent);
}
.ai-fetch-list {
  border: 1px dashed var(--border);
  border-radius: 6px;
  margin-bottom: 8px;
  max-height: 200px;
  overflow: auto;
}
.ai-fetch-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  font-size: 11px;
  color: var(--text-dim);
  position: sticky;
  top: 0;
  background: var(--bg-panel);
  z-index: 1;
}
.ai-fetch-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
}
.ai-fetch-row + .ai-fetch-row {
  border-top: 1px solid var(--border);
}
.ai-fetch-id {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--editor-font);
  font-size: 11.5px;
}
.ai-model-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ai-model-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
}
.ai-model-row:hover {
  border-color: var(--accent);
}
.ai-model-row.on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}
.ai-model-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-family: var(--editor-font);
}
.ai-model-row.on .ai-model-name {
  color: var(--accent);
  font-weight: 600;
}
.ai-model-edit {
  flex: none;
  border: none;
  background: none;
  color: var(--text-dim);
  cursor: pointer;
  padding: 2px;
  display: inline-flex;
}
.ai-model-edit:hover {
  color: var(--accent);
}
.ai-model-ctx {
  font-family: var(--editor-font);
  color: var(--text-dim);
}
.ai-model-del {
  flex: none;
  border: none;
  background: none;
  color: var(--text-dim);
  cursor: pointer;
  padding: 2px;
  display: inline-flex;
}
.ai-model-del:hover {
  color: #c0392b;
}
/* 编辑模型配置弹窗 */
.ai-mc {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 12.5px;
}
.ai-mc-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
  font-family: var(--editor-font);
  word-break: break-all;
}
.ai-mc-prefill {
  margin-top: -4px;
  font-size: 11px;
  color: var(--text-dim);
  line-height: 1.5;
}
.ai-mc-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ai-mc-lb {
  flex: none;
  width: 96px;
  color: var(--text-dim);
  font-size: 12px;
}
.ai-mc-row .n-input-number,
.ai-mc-row .n-input {
  flex: 1;
}
.ai-mc-hint {
  padding: 7px 9px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  color: var(--text-dim);
  font-size: 11px;
  line-height: 1.7;
}
.ai-mc-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.ai-model-empty {
  padding: 8px;
  border: 1px dashed var(--border);
  border-radius: 6px;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--text-faint, var(--text-dim));
}
.ai-models-tip {
  padding-top: 4px;
  font-size: 11px;
  color: var(--text-faint, var(--text-dim));
}
.ai-set-note {
  padding: 2px 0 4px 72px;
  color: var(--text-faint, var(--text-dim));
  font-size: 11px;
  line-height: 1.6;
}
.ai-set-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0 0 72px;
  flex-wrap: wrap;
}
.ai-test-result {
  margin: 6px 0 0 72px;
  padding: 6px 9px;
  border-radius: 6px;
  font-size: 11.5px;
  line-height: 1.6;
  word-break: break-all;
}
.ai-test-result.ok {
  border: 1px solid color-mix(in srgb, #27ae60 45%, transparent);
  background: color-mix(in srgb, #27ae60 10%, transparent);
  color: var(--text);
}
.ai-test-result.fail {
  border: 1px solid color-mix(in srgb, #c0392b 45%, transparent);
  background: color-mix(in srgb, #c0392b 8%, transparent);
  color: var(--text);
}
</style>