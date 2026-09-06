<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { NButton, NSelect, NPopover, NColorPicker } from 'naive-ui'
import OIcon from './OIcon.vue'
import { useWorkStore } from '../stores/work'

const props = defineProps({ editor: { type: Object, required: true } })
const work = useWorkStore()

const tick = ref(0)
const onTr = () => tick.value++
props.editor.on('transaction', onTr)
onBeforeUnmount(() => props.editor.off('transaction', onTr))

const SIZES = ['12', '14', '15', '16', '18', '20', '24', '28', '32', '40'].map((s) => ({ label: s + ' 号', value: s }))
const HIGHLIGHTS = ['#fff3a3', '#ffd6a5', '#ffa8a8', '#b8f2c9', '#a8d8ff', '#e0c3fc']
const COLORS = ['#3c3427', '#8c6f4e', '#c0392b', '#d35400', '#27ae60', '#2980b9', '#8e44ad', '#7f8c8d']

const sizeVal = computed(() => {
  void tick.value
  return String(props.editor.getAttributes('textStyle')?.fontSize || '')
})
const curColor = computed(() => {
  void tick.value
  return props.editor.getAttributes('textStyle')?.color || '#3c3427'
})

/* 不带 focus() 的命令链（失焦确定性）；点击后由 refocus 恢复编辑器光标 */
const chain = () => props.editor.chain()
function refocus() {
  try {
    props.editor.view.focus()
  } catch {
    /* 后台窗口下允许失败 */
  }
}

function applySize(v) {
  if (!v) chain().unsetFontSize().run()
  else chain().setFontSize(Number(v)).run()
}

/* 书签（当前章节） */
const bmOn = computed(() => {
  const ch = work.activeChapter
  return !!ch && work.isChapterBookmarked(ch.id)
})
function toggleBm() {
  const ch = work.activeChapter
  if (!ch) return
  const added = work.toggleChapterBookmark(ch.id)
  window.$msg?.success(added ? '已加入书签' : '已移除书签')
}

/* 超链接 */
const showLink = ref(false)
const linkHref = ref('https://')
function openLink() {
  linkHref.value = props.editor.getAttributes('link')?.href || 'https://'
  showLink.value = true
}
function applyLink() {
  const href = linkHref.value.trim()
  let ok = false
  try {
    const u = new URL(href)
    const h = u.hostname.toLowerCase()
    const privateHost =
      h === 'localhost' ||
      h === '0.0.0.0' ||
      h === '::1' ||
      /^127\.|^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(h)
    ok = (u.protocol === 'http:' || u.protocol === 'https:') && !privateHost
  } catch {
    ok = false
  }
  if (!ok) {
    window.$msg?.warning('仅支持公网 http/https 链接')
    return
  }
  chain().extendMarkRange('link').setLink({ href, target: '_blank', rel: 'noopener noreferrer' }).run()
  showLink.value = false
}
function removeLink() {
  chain().extendMarkRange('link').unsetLink().run()
  showLink.value = false
}

const isActive = (name, attrs) => {
  void tick.value
  return props.editor.isActive(name, attrs)
}
</script>

<template>
  <div class="editor-toolbar" @click="refocus">
    <button class="tb" title="撤销" @click="chain().undo().run()">↶</button>
    <button class="tb" title="重做" @click="chain().redo().run()">↷</button>
    <span class="tb-sep" />

    <button class="tb" :class="{ on: isActive('bold') }" title="加粗" @click="chain().toggleBold().run()"><b>B</b></button>
    <button class="tb" :class="{ on: isActive('italic') }" title="斜体" @click="chain().toggleItalic().run()"><i>I</i></button>
    <button class="tb" :class="{ on: isActive('underline') }" title="下划线" @click="chain().toggleUnderline().run()"><u>U</u></button>
    <button class="tb" :class="{ on: isActive('strike') }" title="删除线" @click="chain().toggleStrike().run()"><s>S</s></button>
    <span class="tb-sep" />

    <button class="tb" :class="{ on: isActive('paragraph') }" title="正文" @click="chain().setParagraph().run()">正文</button>
    <button class="tb" :class="{ on: isActive('heading', { level: 1 }) }" title="标题一" @click="chain().toggleHeading({ level: 1 }).run()">H1</button>
    <button class="tb" :class="{ on: isActive('heading', { level: 2 }) }" title="标题二" @click="chain().toggleHeading({ level: 2 }).run()">H2</button>
    <button class="tb" :class="{ on: isActive('heading', { level: 3 }) }" title="标题三" @click="chain().toggleHeading({ level: 3 }).run()">H3</button>
    <span class="tb-sep" />

    <NSelect
      size="tiny"
      :value="sizeVal"
      :options="SIZES"
      placeholder="字号"
      style="width: 88px"
      clearable
      @update:value="applySize"
    />

    <NPopover trigger="click" :show-arrow="false">
      <template #trigger>
        <button class="tb" title="字体颜色">
          <span :style="{ borderBottom: '3px solid ' + curColor, lineHeight: '13px' }">A</span>
        </button>
      </template>
      <div style="width: 208px">
        <NColorPicker
          :value="curColor"
          :swatches="COLORS"
          :show-alpha="false"
          :modes="['hex']"
          size="small"
          @update:value="(c) => chain().setColor(c).run()"
        />
      </div>
    </NPopover>

    <NPopover trigger="click" :show-arrow="false">
      <template #trigger>
        <button class="tb" :class="{ on: isActive('highlight') }" title="突出显示">底色</button>
      </template>
      <div style="display: flex; gap: 6px; align-items: center">
        <button
          v-for="c in HIGHLIGHTS"
          :key="c"
          class="tb"
          :style="{ background: c, width: '22px', height: '22px' }"
          :title="'底色 ' + c"
          @click="chain().setHighlight({ color: c }).run()"
        />
        <button class="tb" title="清除底色" @click="chain().unsetHighlight().run()"><OIcon name="close" :size="11" /></button>
      </div>
    </NPopover>

    <NPopover trigger="click" :show-arrow="false" :show="showLink" @update:show="(v) => (showLink = v)">
      <template #trigger>
        <button class="tb" :class="{ on: isActive('link') }" title="超链接" @click="openLink"><OIcon name="link" :size="14" /></button>
      </template>
      <div style="display: flex; gap: 6px; width: 300px">
        <input v-model="linkHref" class="rp-input" placeholder="https://…" style="flex: 1" @keyup.enter="applyLink" />
        <NButton size="small" type="primary" @click="applyLink">确定</NButton>
        <NButton v-if="isActive('link')" size="small" @click="removeLink">移除</NButton>
      </div>
    </NPopover>
    <span class="tb-sep" />

    <button class="tb" :class="{ on: isActive({ textAlign: 'left' }) }" title="左对齐" @click="chain().setTextAlign('left').run()">左</button>
    <button class="tb" :class="{ on: isActive({ textAlign: 'center' }) }" title="居中" @click="chain().setTextAlign('center').run()">中</button>
    <button class="tb" :class="{ on: isActive({ textAlign: 'right' }) }" title="右对齐" @click="chain().setTextAlign('right').run()">右</button>
    <button class="tb" :class="{ on: isActive({ textAlign: 'justify' }) }" title="两端对齐" @click="chain().setTextAlign('justify').run()">齐</button>
    <span class="tb-sep" />

    <button class="tb" :class="{ on: isActive('bulletList') }" title="无序列表" @click="chain().toggleBulletList().run()">•≡</button>
    <button class="tb" :class="{ on: isActive('orderedList') }" title="有序列表" @click="chain().toggleOrderedList().run()">1≡</button>
    <button class="tb" :class="{ on: isActive('blockquote') }" title="引用" @click="chain().toggleBlockquote().run()">引</button>
    <span class="tb-sep" />

    <button class="tb" title="清除格式" @click="chain().unsetAllMarks().clearNodes().run()">清除</button>
    <span class="tb-sep" />
    <button
      class="tb"
      :class="{ on: bmOn }"
      :title="bmOn ? '移除书签' : '收藏本书签'"
      @click="toggleBm"
    ><OIcon :name="bmOn ? 'star-filled' : 'star'" :size="14" /></button>
  </div>
</template>
