<!-- 纯文本编辑区（大纲 / 人物小传 / 灵感）共用右键快捷栏：剪切复制粘贴 + 添加双链（选中内容变 [[标题]] 令牌）+ 移除该双链 -->
<script setup>
import { reactive, ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import DLinkPicker from './DLinkPicker.vue'
import { buildToken, tokenAtOffset, tokenAtPoint } from '../services/doublelinks'

const st = reactive({ open: false, x: 0, y: 0, picker: false, host: null, get: null, set: null, onToken: null })
const rootEl = ref(null)

/**
 * 打开快捷栏。opts = { get: () => string, set: (v) => void } 由宿主提供读写（自动保存）。
 * e.target 须为 textarea（NInput 等包装组件经冒泡到达时也是 textarea 本体）。
 */
function open(e, opts) {
  const ta = e.target?.closest?.('textarea')
  if (!ta || !opts?.get || !opts?.set) return
  e.preventDefault()
  st.host = ta
  st.get = opts.get
  st.set = opts.set
  st.picker = false
  st.x = e.clientX
  st.y = e.clientY
  const hit = tokenAtPoint(ta, e.clientX, e.clientY)
  st.onToken = hit || tokenAtOffset(String(opts.get() || ''), ta.selectionStart ?? -1)
  st.open = true
  nextTick(clamp)
}

function clamp() {
  const el = rootEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  st.x = Math.max(8, Math.min(st.x, window.innerWidth - r.width - 8))
  st.y = Math.max(8, Math.min(st.y, window.innerHeight - r.height - 8))
}

function close() {
  st.open = false
  st.picker = false
  st.host = null
  st.onToken = null
}

const value = () => String(st.get?.() || '')
const selStart = () => st.host?.selectionStart ?? 0
const selEnd = () => st.host?.selectionEnd ?? 0
const selEmpty = () => selStart() === selEnd()
const selectedText = () => value().slice(selStart(), selEnd())

function commit(v, caret) {
  st.set(v)
  nextTick(() => {
    try {
      st.host.focus()
      if (caret != null) st.host.setSelectionRange(caret, caret)
    } catch {
      /* 后台窗口允许失败 */
    }
  })
  close()
}

function doCut() {
  const t = selectedText()
  if (!t) return close()
  window.native?.clipboardWriteText?.(t)
  const s = selStart()
  commit(value().slice(0, s) + value().slice(selEnd()), s)
}
function doCopy() {
  const t = selectedText()
  if (!t) return close()
  window.native?.clipboardWriteText?.(t)
  close()
}
async function doPaste() {
  let t = ''
  try {
    t = (await window.native?.clipboardReadText?.()) || ''
  } catch {
    t = ''
  }
  if (t) {
    const s = selStart()
    commit(value().slice(0, s) + t + value().slice(selEnd()), s + t.length)
  } else {
    close()
  }
}

function openPicker() {
  st.picker = true
}

/** 选中内容 → 双链令牌：选中文字即显示文字，目标标题为令牌头 */
function applyPick(t) {
  const token = buildToken(t.title, selectedText())
  const s = selStart()
  commit(value().slice(0, s) + token + value().slice(selEnd()), s + token.length)
}

function removeToken() {
  const tok = st.onToken
  if (!tok) return close()
  commit(value().slice(0, tok.start) + tok.display + value().slice(tok.end), tok.start + tok.display.length)
}

function onWinMouseDown(e) {
  if (st.open && rootEl.value && !rootEl.value.contains(e.target)) close()
}
function onWinKey(e) {
  if (e.key === 'Escape' && st.open) close()
}
function onWinWheel(e) {
  if (st.open && rootEl.value && !rootEl.value.contains(e.target)) close()
}

onMounted(() => {
  window.addEventListener('mousedown', onWinMouseDown, true)
  window.addEventListener('keydown', onWinKey)
  window.addEventListener('wheel', onWinWheel, { passive: true })
  window.addEventListener('resize', close)
})
onBeforeUnmount(() => {
  window.removeEventListener('mousedown', onWinMouseDown, true)
  window.removeEventListener('keydown', onWinKey)
  window.removeEventListener('wheel', onWinWheel)
  window.removeEventListener('resize', close)
})

defineExpose({ open, close })
</script>

<template>
  <div v-if="st.open" ref="rootEl" class="ctx-menu" :style="{ left: st.x + 'px', top: st.y + 'px' }" @contextmenu.prevent>
    <template v-if="st.picker">
      <div class="ctx-dlwrap">
        <DLinkPicker @pick="applyPick" />
        <div style="display: flex; margin-top: 8px">
          <button class="ctx-btn" type="button" @click="st.picker = false">返回</button>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="ctx-item" :class="{ disabled: selEmpty() }" @mousedown.prevent @click="!selEmpty() && doCut()"><span>剪切</span></div>
      <div class="ctx-item" :class="{ disabled: selEmpty() }" @mousedown.prevent @click="!selEmpty() && doCopy()"><span>复制</span></div>
      <div class="ctx-item" @mousedown.prevent @click="doPaste()"><span>粘贴为纯文本</span><span class="hint">Ctrl+V</span></div>
      <div class="ctx-sep" />
      <div class="ctx-item" @mousedown.prevent @click="openPicker()"><span>添加双链…</span><span class="hint">[[ ]]</span></div>
      <div v-if="st.onToken" class="ctx-item" @mousedown.prevent @click="removeToken()"><span>移除该双链</span></div>
    </template>
  </div>
</template>
