<script setup>
import TaskLauncher from './ai/TaskLauncher.vue'
import { ref, shallowRef, computed, watch, onBeforeUnmount, onMounted } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { marked } from 'marked'
import { NButton, NDrawer, NDrawerContent, NSelect, NTag } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import { autosave } from '../services/autosave'
import { FontSize } from '../services/richtext'
import { isImageExt } from '../services/fileio'
import { DlLinkMark } from '../services/doublelinks'
import { AnnotationMark, setActiveEditor } from '../services/annotations'
import { isPopped, focusPopped } from '../services/panelwindows'
import EditorToolbar from './EditorToolbar.vue'
import EditorContextMenu from './EditorContextMenu.vue'
import ChapterTree from './ChapterTree.vue'
import OIcon from './OIcon.vue'

const work = useWorkStore()
const ui = useUiStore()
const editor = shallowRef(null)
const ctxMenu = ref(null)
const readDrawer = ref(false) // 阅读模式：章节抽屉开合

/* 章节已被拆出为面板窗口时，主窗口本章只读（9.2-W5 两级锁）；阅读模式同样只读预览（v1.0.26） */
const chapterPopped = computed(() => !!work.activeChapter && isPopped(work, 'chapter', work.activeChapter.id))
watch([chapterPopped, () => ui.readMode], ([popped, reading], [, wasReading]) => {
  editor.value?.setEditable(!popped && !reading, false)
  /* 退出阅读恢复编辑并回焦（选区由 ProseMirror state 保留） */
  if (wasReading && !reading) editor.value?.commands.focus()
})

/* 阅读模式：全书章序巨排号（依 treeData 平坦序补零） */
const chapterNo = computed(() => {
  const n = work.activeChapter ? work.chapterOrdinal(work.activeChapter.id) : null
  return n ? String(n).padStart(2, '0') : ''
})

/* 阅读模式 Esc 两级：抽屉开着先关抽屉，否则退出阅读 */
function onReadKey(e) {
  if (!ui.readMode || e.key !== 'Escape' || e.defaultPrevented) return
  if (document.querySelector('.n-modal')) return // 改名弹窗等自行处理
  e.preventDefault()
  if (readDrawer.value) readDrawer.value = false
  else ui.readMode = false
}

let savedSelRange = null // 右键时刻的选区快照（浏览器/PM 可能在右键流程中塌缩选区）

function onMouseDownCapture(e) {
  const ed = editor.value
  if (!ed) return
  if (e.button === 2) {
    const { from, to, empty } = ed.state.selection
    savedSelRange = empty ? null : { from, to }
  } else {
    savedSelRange = null
  }
}

function onContextMenu(e) {
  const ed = editor.value
  if (!ed) return
  e.preventDefault()
  if (ui.readMode) return // 阅读模式只读：不弹格式化菜单（也不放行原生菜单）
  // 快照选区且右键落在其内 → 保持选区（菜单作用于选中文字）；否则光标移到右键处（Word 习惯）
  try {
    const pos = ed.view.posAtCoords({ left: e.clientX, top: e.clientY })
    if (pos && pos.pos != null) {
      const range = savedSelRange
      const keep = !!(range && pos.pos >= range.from && pos.pos <= range.to)
      if (!keep) {
        savedSelRange = null
        ed.commands.setTextSelection(pos.pos)
      }
    } else {
      savedSelRange = null
    }
  } catch {
    savedSelRange = null
  }
  ctxMenu.value?.open(e.clientX, e.clientY, savedSelRange)
}

const extensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  Underline,
  TextStyle,
  FontSize,
  Color,
  Highlight,
  DlLinkMark,
  AnnotationMark,
  Link.configure({ openOnClick: false, autolink: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Placeholder.configure({ placeholder: '落笔成章……' })
]

/** 旧内容（Markdown/纯文本）打开时转 HTML，保存后以 fmt='html' 固化 */
function toEditorHtml(ch) {
  if (!ch) return ''
  if (ch.fmt === 'html') return ch.content || ''
  const text = ch.content || ''
  if (!text.trim()) return ''
  try {
    return marked.parse(text, { async: false, breaks: true })
  } catch {
    return '<p>' + text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '</p><p>') + '</p>'
  }
}

function handleImages(files) {
  if (!files?.length || !work.activeChapter) return false
  const imgs = [...files].filter((f) => f.type.startsWith('image/') || isImageExt((f.name.split('.').pop() || '').toLowerCase()))
  if (!imgs.length) return false
  ;(async () => {
    const ids = []
    for (const f of imgs) {
      const meta = await work.addAssetBlob(f, f.name || 'image')
      await work.linkAsset('chapter', work.activeChapter.id, meta.id)
      ids.push(meta.id)
    }
    await work.warmUrls(ids)
    window.$msg?.success(`已添加 ${imgs.length} 张插图到本章（右侧面板查看）`)
  })()
  return true
}

function mountEditor() {
  editor.value?.destroy()
  editor.value = null
  const ch = work.activeChapter
  if (!ch) return
  const id = ch.id
  editor.value = new Editor({
    content: toEditorHtml(ch),
    extensions,
    editable: !chapterPopped.value && !ui.readMode,
    editorProps: {
      handleDOMEvents: {
        // 超链接在系统默认浏览器打开，不劫持应用窗口
        click: (_view, e) => {
          const a = e.target?.closest?.('a')
          if (a && a.href) {
            e.preventDefault()
            window.open(a.href, '_blank')
          }
          return false
        }
      },
      handleKeyDown: (_view, e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          autosave.flushAll()
          window.$msg?.success('已保存')
          return true
        }
        return false
      },
      handlePaste: (_view, event) => handleImages(event.clipboardData?.files),
      handleDrop: (_view, event) => handleImages(event.dataTransfer?.files)
    },
    onUpdate: ({ editor: ed }) => {
      if (work.selChapterId === id) work.setChapterContent(id, ed.getHTML(), 'html')
    }
  })
  window.__ns.editor = editor.value
  setActiveEditor(editor.value) // 右侧批注栏据此操作正文标记
}

watch(
  () => work.selChapterId,
  () => {
    autosave.flushAll()
    if (readDrawer.value) readDrawer.value = false // 抽屉内切章即收起
    mountEditor()
  }
)
onMounted(() => {
  mountEditor()
  window.addEventListener('keydown', onReadKey)
})
onBeforeUnmount(() => {
  autosave.flushAll()
  setActiveEditor(null)
  editor.value?.destroy()
  editor.value = null
  window.removeEventListener('keydown', onReadKey)
})

const STATUS_OPTS = [
  { label: '草稿', value: 'draft' },
  { label: '完成', value: 'done' },
  { label: '待修改', value: 'revise' }
]
const STATUS_COLOR = { draft: 'default', done: 'success', revise: 'warning' }

function onTitle(e) {
  if (!work.activeChapter) return
  work.renameChapter(work.activeChapter.id, e.target.value.trim() || '未命名章节')
}
function openHistory() {
  if (!work.activeChapter) return
  ui.revisionsCtx = { id: work.activeChapter.id, title: work.activeChapter.title }
}
</script>

<template>
  <TaskLauncher v-if="!ui.readMode" module="chapters" />
  <div class="editor-wrap" :class="{ 'read-mode': ui.readMode }">
    <div class="editor-head" v-if="work.activeChapter && !ui.readMode">
      <input
        class="title-input"
        :value="work.activeChapter.title"
        placeholder="章节标题"
        :readonly="chapterPopped"
        @change="onTitle"
        @keyup.enter="$event.target.blur()"
      />
      <NSelect
        size="tiny"
        :value="work.activeChapter.status"
        :options="STATUS_OPTS"
        :disabled="chapterPopped"
        style="width: 92px"
        @update:value="(v) => work.setChapterStatus(work.activeChapter.id, v)"
      />
      <NTag size="small" :bordered="false" :type="STATUS_COLOR[work.activeChapter.status]">
        {{ work.activeChapter.wordCount || 0 }} 字
      </NTag>
      <NButton size="tiny" quaternary @click="openHistory">历史</NButton>
    </div>
    <div v-if="!work.activeChapter" class="empty-shelf" style="padding-top: 140px">
      <div class="big">笔落惊风雨</div>
      <p>从左侧「＋章」新建一章开始写作，章节内容会即时自动保存。</p>
    </div>
    <template v-if="work.activeChapter && editor">
      <EditorToolbar v-show="!chapterPopped && !ui.readMode" :key="work.selChapterId" :editor="editor" />
      <div v-show="chapterPopped" class="panel-lock-note">
        <span>「{{ work.activeChapter.title }}」已在独立窗口编辑，本窗口此章暂为只读</span>
        <NButton size="small" type="primary" @click="focusPopped(work, 'chapter', work.activeChapter.id)">前往窗口</NButton>
      </div>
      <div v-show="!chapterPopped" class="rich-host paper-texture" @mousedown.capture="onMouseDownCapture" @contextmenu.capture="onContextMenu">
        <div class="ed-read-col">
          <!-- 阅读模式专用头（v1.0.26）：巨排章号 + 章题下划短线；随正文滚动，不进入文档模型 -->
          <header v-show="ui.readMode" class="ed-read-head">
            <div class="ed-read-no" aria-hidden="true">{{ chapterNo }}</div>
            <h1 class="ed-read-title">{{ work.activeChapter.title }}</h1>
            <div class="ed-read-rule"></div>
          </header>
          <EditorContent :key="work.selChapterId" :editor="editor" class="rich-inner" />
        </div>
      </div>
      <EditorContextMenu v-if="!chapterPopped && !ui.readMode" ref="ctxMenu" :editor="editor" />

      <!-- 阅读模式：目录细边条（点击滑出章节抽屉）+ 底右字数（v1.0.26） -->
      <button v-if="ui.readMode" class="ed-read-edge" type="button" title="目录：展开章节列表（Esc 关闭）" @click="readDrawer = true">
        <OIcon name="caret-right" :size="13" />
      </button>
      <div v-if="ui.readMode && !chapterPopped" class="ed-read-count">{{ work.activeChapter.wordCount || 0 }} 字</div>
      <NDrawer v-if="ui.readMode" v-model:show="readDrawer" placement="left" :width="300" :close-on-esc="false">
        <NDrawerContent title="目录" closable :native-scrollbar="false" body-content-style="padding: 6px 10px 10px;">
          <ChapterTree />
        </NDrawerContent>
      </NDrawer>
    </template>
  </div>
</template>
