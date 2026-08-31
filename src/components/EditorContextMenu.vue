<script setup>
import { reactive, ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { parseTarget, targetById, findByTitle, jumpTo } from '../services/doublelinks'
import DLinkPicker from './DLinkPicker.vue'

const props = defineProps({ editor: { type: Object, required: true } })

const st = reactive({ open: false, x: 0, y: 0, sub: null, subX: 0, subY: 0, linkEdit: false, linkHref: '', dlPicker: false, dlFrom: 0, dlTo: 0, savedFrom: null, savedTo: null, dlQuery: '' })
const rootEl = ref(null)

const SIZES = [12, 14, 16, 18, 20, 24, 28, 32]
const COLORS = ['#3c3427', '#8c6f4e', '#c0392b', '#d35400', '#27ae60', '#2980b9', '#8e44ad', '#7f8c8d']
const HIGHLIGHTS = ['#fff3a3', '#ffd6a5', '#ffa8a8', '#b8f2c9', '#a8d8ff', '#e0c3fc']

/* 不带 focus() 的命令链：命令作用于 ProseMirror 内部选区，窗口失焦时也保持确定性 */
const chain = () => props.editor.chain()
const act = reactive({})

function refresh() {
  const ed = props.editor
  act.bold = ed.isActive('bold')
  act.italic = ed.isActive('italic')
  act.underline = ed.isActive('underline')
  act.strike = ed.isActive('strike')
  act.para = ed.isActive('paragraph')
  act.h1 = ed.isActive('heading', { level: 1 })
  act.h2 = ed.isActive('heading', { level: 2 })
  act.h3 = ed.isActive('heading', { level: 3 })
  act.bullet = ed.isActive('bulletList')
  act.ordered = ed.isActive('orderedList')
  act.quote = ed.isActive('blockquote')
  act.link = ed.isActive('link')
  act.linkHref = ed.getAttributes('link')?.href || ''
  act.size = String(ed.getAttributes('textStyle')?.fontSize || '')
  act.align = ['left', 'center', 'right', 'justify'].find((a) => ed.isActive({ textAlign: a })) || 'left'
  act.dl = ed.isActive('dlLink')
  act.dlTarget = ed.getAttributes('dlLink')?.target || ''
  act.dlTitle = ed.getAttributes('dlLink')?.title || ''
}

/* ---------- 双链（多模块内容互联）：选中文字标记为指向全书任意内容的双链 ---------- */
const dlDisabled = () => selEmpty() && !act.dl && st.savedFrom == null

function openDlPicker() {
  const hasSaved = st.savedFrom != null
  if (hasSaved) {
    // 用右键时刻的选区快照（此刻编辑器选区可能已被塌缩）
    st.dlFrom = st.savedFrom
    st.dlTo = st.savedTo
  } else if (act.dl) {
    // 光标落在已有双链内：把作用范围扩展到整个双链再编辑
    chain().extendMarkRange('dlLink').run()
    const sel2 = props.editor.state.selection
    st.dlFrom = sel2.from
    st.dlTo = sel2.to
  } else {
    if (selEmpty()) return
    st.dlFrom = props.editor.state.selection.from
    st.dlTo = props.editor.state.selection.to
  }
  // 选中内容作为全局搜索关键词（无选区时用当前双链标题）
  let kw = ''
  try {
    kw = hasSaved || !selEmpty() ? props.editor.state.doc.textBetween(st.dlFrom, st.dlTo, ' ') : act.dlTitle
  } catch {
    kw = ''
  }
  st.dlQuery = String(kw || '').replace(/\s+/g, ' ').trim().slice(0, 20)
  st.dlPicker = true
}
function onPickDl(t) {
  props.editor
    .chain()
    .setTextSelection({ from: st.dlFrom, to: st.dlTo })
    .setMark('dlLink', { target: t.kind + ':' + t.id, title: t.title })
    .run()
  st.dlPicker = false
  close()
  refocus()
}
function removeDl() {
  chain().extendMarkRange('dlLink').unsetMark('dlLink').run()
  close()
  refocus()
}
function jumpDl() {
  const resolved = targetById(parseTarget(act.dlTarget)?.kind, parseTarget(act.dlTarget)?.id)
  jumpTo(resolved || findByTitle(act.dlTitle))
  close()
}

const selEmpty = () => props.editor.state.selection.empty

function selectionText() {
  const { from, to, empty } = props.editor.state.selection
  return empty ? '' : props.editor.state.doc.textBetween(from, to, '\n')
}
function doCut() {
  const t = selectionText()
  if (!t) return close()
  window.native?.clipboardWriteText?.(t)
  chain().deleteSelection().run()
  close()
}
function doCopy() {
  const t = selectionText()
  if (!t) return close()
  window.native?.clipboardWriteText?.(t)
  close()
}
async function pastePlain() {
  let t = ''
  try {
    t = (await window.native?.clipboardReadText?.()) || ''
  } catch {
    t = ''
  }
  if (t) chain().insertContent(t).run()
  close()
  refocus()
}

function doLink() {
  st.linkEdit = true
  st.linkHref = act.link ? act.linkHref : 'https://'
}
function applyLink() {
  const href = st.linkHref.trim()
  let ok = false
  try {
    const u = new URL(href)
    const h = u.hostname.toLowerCase()
    ok =
      (u.protocol === 'http:' || u.protocol === 'https:') &&
      h !== 'localhost' &&
      h !== '0.0.0.0' &&
      h !== '::1' &&
      !/^127\.|^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(h)
  } catch {
    ok = false
  }
  if (!ok) {
    window.$msg?.warning('仅支持公网 http/https 链接')
    return
  }
  chain().extendMarkRange('link').setLink({ href, target: '_blank', rel: 'noopener noreferrer' }).run()
  close()
  refocus()
}
function removeLink() {
  chain().extendMarkRange('link').unsetLink().run()
  close()
  refocus()
}
function openLink() {
  if (act.linkHref) window.open(act.linkHref, '_blank')
  close()
}

function refocus() {
  try {
    props.editor.view.focus()
  } catch {
    /* 后台窗口下允许失败 */
  }
}
function run(fn) {
  fn()
  close()
  refocus()
}

async function open(x, y, savedSel = null) {
  refresh()
  st.savedFrom = savedSel && savedSel.to > savedSel.from ? savedSel.from : null
  st.savedTo = st.savedFrom != null ? savedSel.to : null
  st.dlQuery = ''
  st.x = x
  st.y = y
  st.open = true
  st.sub = null
  st.linkEdit = false
  st.dlPicker = false
  await nextTick()
  const el = rootEl.value
  if (el) {
    const r = el.getBoundingClientRect()
    st.x = Math.max(8, Math.min(x, window.innerWidth - r.width - 8))
    st.y = Math.max(8, Math.min(y, window.innerHeight - r.height - 8))
  }
}
function close() {
  st.open = false
  st.sub = null
  st.linkEdit = false
  st.dlPicker = false
}

/** 展开二级飞出菜单：fixed 定位，按父项实测坐标放置并防出屏（escape 祖先 overflow 裁剪） */
async function openSub(key, e) {
  st.sub = key
  const r = e.currentTarget.getBoundingClientRect()
  await nextTick()
  const el = document.querySelector('.ctx-sub')
  if (!el) return
  const w = el.offsetWidth
  const h = el.offsetHeight
  let x = r.right + 4
  if (x + w > window.innerWidth - 8) x = Math.max(8, r.left - w - 4)
  let y = r.top - 6
  if (y + h > window.innerHeight - 8) y = Math.max(8, window.innerHeight - 8 - h)
  st.subX = x
  st.subY = y
}

function onWinMouseDown(e) {
  if (st.open && rootEl.value && !rootEl.value.contains(e.target)) close()
}
function onKey(e) {
  if (e.key === 'Escape' && st.open) close()
}
function onScroll(e) {
  if (!st.open) return
  // 菜单内部滚动不关闭；编辑区滚动时关闭
  if (rootEl.value && rootEl.value.contains(e.target)) {
    st.sub = null
    return
  }
  close()
}
onMounted(() => {
  window.addEventListener('mousedown', onWinMouseDown, true)
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', close)
  window.addEventListener('wheel', onScroll, { passive: true })
})
onBeforeUnmount(() => {
  window.removeEventListener('mousedown', onWinMouseDown, true)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', close)
  window.removeEventListener('wheel', onScroll)
})

defineExpose({ open, close })
</script>

<template>
  <div v-if="st.open" ref="rootEl" class="ctx-menu" :style="{ left: st.x + 'px', top: st.y + 'px' }" @contextmenu.prevent @scroll="st.sub = null">
    <template v-if="st.linkEdit">
      <div class="ctx-linkedit">
        <input v-model="st.linkHref" class="rp-input" placeholder="https://…" @keyup.enter="applyLink" />
        <div style="display: flex; gap: 6px; margin-top: 8px">
          <button class="ctx-btn primary" @click="applyLink">确定</button>
          <button v-if="act.link" class="ctx-btn" @click="removeLink">移除</button>
          <button class="ctx-btn" @click="st.linkEdit = false">返回</button>
        </div>
      </div>
    </template>

    <template v-else-if="st.dlPicker">
      <div class="ctx-dlwrap">
        <DLinkPicker :initial-query="st.dlQuery" @pick="onPickDl" />
        <div style="display: flex; margin-top: 8px">
          <button class="ctx-btn" @click="st.dlPicker = false">返回</button>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="ctx-item" :class="{ disabled: selEmpty() }" @click="!selEmpty() && doCut()">
        <span>剪切</span><span class="hint">Ctrl+X</span>
      </div>
      <div class="ctx-item" :class="{ disabled: selEmpty() }" @click="!selEmpty() && doCopy()">
        <span>复制</span><span class="hint">Ctrl+C</span>
      </div>
      <div class="ctx-item" @click="run(pastePlain)"><span>粘贴为纯文本</span><span class="hint">Ctrl+V</span></div>

      <div class="ctx-sep" />
      <div class="ctx-item" :class="{ on: act.bold }" @click="run(() => chain().toggleBold().run())"><span>加粗</span><span class="hint">Ctrl+B</span></div>
      <div class="ctx-item" :class="{ on: act.italic }" @click="run(() => chain().toggleItalic().run())"><span>斜体</span><span class="hint">Ctrl+I</span></div>
      <div class="ctx-item" :class="{ on: act.underline }" @click="run(() => chain().toggleUnderline().run())"><span>下划线</span><span class="hint">Ctrl+U</span></div>
      <div class="ctx-item" :class="{ on: act.strike }" @click="run(() => chain().toggleStrike().run())"><span>删除线</span></div>

      <div class="ctx-sep" />
      <div class="ctx-item has-sub" :class="{ open: st.sub === 'heading' }" @mouseenter="openSub('heading', $event)" @click="openSub('heading', $event)">
        <span>标题</span><span class="arrow">▸</span>
        <div v-if="st.sub === 'heading'" class="ctx-sub" :style="{ left: st.subX + 'px', top: st.subY + 'px' }">
          <div class="ctx-item" :class="{ on: act.para }" @click="run(() => chain().setParagraph().run())"><span>正文</span></div>
          <div class="ctx-item" :class="{ on: act.h1 }" @click="run(() => chain().toggleHeading({ level: 1 }).run())"><span>标题一</span></div>
          <div class="ctx-item" :class="{ on: act.h2 }" @click="run(() => chain().toggleHeading({ level: 2 }).run())"><span>标题二</span></div>
          <div class="ctx-item" :class="{ on: act.h3 }" @click="run(() => chain().toggleHeading({ level: 3 }).run())"><span>标题三</span></div>
        </div>
      </div>

      <div class="ctx-item has-sub" :class="{ open: st.sub === 'size' }" @mouseenter="openSub('size', $event)" @click="openSub('size', $event)">
        <span>字号{{ act.size ? ' · ' + act.size : '' }}</span><span class="arrow">▸</span>
        <div v-if="st.sub === 'size'" class="ctx-sub" :style="{ left: st.subX + 'px', top: st.subY + 'px' }">
          <div v-for="s in SIZES" :key="s" class="ctx-item" :class="{ on: act.size === String(s) }" @click="run(() => chain().setFontSize(s).run())">
            <span>{{ s }} 号</span>
          </div>
          <div class="ctx-sep" />
          <div class="ctx-item" @click="run(() => chain().unsetFontSize().run())"><span>默认字号</span></div>
        </div>
      </div>

      <div class="ctx-item has-sub" :class="{ open: st.sub === 'color' }" @mouseenter="openSub('color', $event)" @click="openSub('color', $event)">
        <span>字体颜色</span><span class="arrow">▸</span>
        <div v-if="st.sub === 'color'" class="ctx-sub" :style="{ left: st.subX + 'px', top: st.subY + 'px' }">
          <div class="swatch-grid">
            <button v-for="c in COLORS" :key="c" class="swatch" :style="{ background: c }" :title="c" @click="run(() => chain().setColor(c).run())" />
          </div>
        </div>
      </div>

      <div class="ctx-item has-sub" :class="{ open: st.sub === 'highlight' }" @mouseenter="openSub('highlight', $event)" @click="openSub('highlight', $event)">
        <span>突出显示</span><span class="arrow">▸</span>
        <div v-if="st.sub === 'highlight'" class="ctx-sub" :style="{ left: st.subX + 'px', top: st.subY + 'px' }">
          <div class="swatch-grid">
            <button
              v-for="c in HIGHLIGHTS"
              :key="c"
              class="swatch"
              :style="{ background: c }"
              :title="c"
              @click="run(() => chain().setHighlight({ color: c }).run())"
            />
          </div>
          <div class="ctx-item" @click="run(() => chain().unsetHighlight().run())"><span>清除底色</span></div>
        </div>
      </div>

      <div class="ctx-item has-sub" :class="{ open: st.sub === 'align' }" @mouseenter="openSub('align', $event)" @click="openSub('align', $event)">
        <span>对齐</span><span class="arrow">▸</span>
        <div v-if="st.sub === 'align'" class="ctx-sub" :style="{ left: st.subX + 'px', top: st.subY + 'px' }">
          <div class="ctx-item" :class="{ on: act.align === 'left' }" @click="run(() => chain().setTextAlign('left').run())"><span>左对齐</span></div>
          <div class="ctx-item" :class="{ on: act.align === 'center' }" @click="run(() => chain().setTextAlign('center').run())"><span>居中</span></div>
          <div class="ctx-item" :class="{ on: act.align === 'right' }" @click="run(() => chain().setTextAlign('right').run())"><span>右对齐</span></div>
          <div class="ctx-item" :class="{ on: act.align === 'justify' }" @click="run(() => chain().setTextAlign('justify').run())"><span>两端对齐</span></div>
        </div>
      </div>

      <div class="ctx-sep" />
      <div class="ctx-item" :class="{ on: act.bullet }" @click="run(() => chain().toggleBulletList().run())"><span>项目符号列表</span></div>
      <div class="ctx-item" :class="{ on: act.ordered }" @click="run(() => chain().toggleOrderedList().run())"><span>编号列表</span></div>
      <div class="ctx-item" :class="{ on: act.quote }" @click="run(() => chain().toggleBlockquote().run())"><span>引用</span></div>

      <div class="ctx-sep" />
      <div class="ctx-item" @click="doLink"><span>{{ act.link ? '编辑链接…' : '超链接…' }}</span></div>
      <div v-if="act.link" class="ctx-item" @click="openLink"><span>打开链接</span></div>
      <div v-if="act.link" class="ctx-item" @click="removeLink"><span>清除链接</span></div>

      <div class="ctx-sep" />
      <div class="ctx-item" :class="{ disabled: selEmpty() && !act.dl }" @click="openDlPicker">
        <span>{{ act.dl ? '编辑双链…' : '添加双链…' }}</span><span class="hint">互联</span>
      </div>
      <div v-if="act.dl" class="ctx-item" @click="jumpDl"><span>跳转到双链目标</span></div>
      <div v-if="act.dl" class="ctx-item" @click="removeDl"><span>移除双链</span></div>

      <div class="ctx-sep" />
      <div class="ctx-item" @click="run(() => chain().undo().run())"><span>撤销</span><span class="hint">Ctrl+Z</span></div>
      <div class="ctx-item" @click="run(() => chain().redo().run())"><span>重做</span><span class="hint">Ctrl+Y</span></div>
      <div class="ctx-item" @click="run(() => chain().selectAll().run())"><span>全选</span><span class="hint">Ctrl+A</span></div>
      <div class="ctx-item" @click="run(() => chain().unsetAllMarks().clearNodes().run())"><span>清除格式</span></div>
    </template>
  </div>
</template>
