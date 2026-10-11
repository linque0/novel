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
import { NButton, NInput, NInputNumber, NSelect, NSwitch, NTag } from 'naive-ui'
import OIcon from '../OIcon.vue'
import { useAiStore } from '../../stores/ai'

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
  model: ai.model,
  temperature: ai.temperature,
  maxContext: ai.maxContext,
  privacy: ai.privacy
})
const preset = ref('custom')
const apiKey = ref('')
const keyBusy = ref(false)
const saving = ref(false)
const testing = ref(false)
const testResult = ref(null) // { ok, text }

onMounted(async () => {
  if (!ai.loaded) await ai.loadSettings()
  syncForm()
})

function syncForm() {
  form.baseURL = ai.baseURL
  form.model = ai.model
  form.temperature = ai.temperature
  form.maxContext = ai.maxContext
  form.privacy = ai.privacy
  const hit = PRESETS.find((p) => p.baseURL && p.baseURL === ai.baseURL.trim())
  preset.value = hit ? hit.value : 'custom'
}

/** 选择预设即填 baseURL 与默认 model（仅填表单，点「保存设置」后生效） */
function onPreset(v) {
  preset.value = v
  const p = PRESETS.find((x) => x.value === v)
  if (!p) return
  if (p.baseURL) {
    form.baseURL = p.baseURL
    form.model = p.model
  }
}

async function persistForm() {
  await ai.saveSettings({
    baseURL: form.baseURL,
    model: form.model,
    temperature: form.temperature,
    maxContext: form.maxContext,
    privacy: form.privacy
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
    <div class="ai-set-row">
      <span class="lb">模型</span>
      <NInput v-model:value="form.model" size="small" placeholder="deepseek-chat / glm-4-flash / …" />
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
