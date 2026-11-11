<script setup>
import { useOriginalAppearance } from '../composables/useOriginalAppearance'
const { originalOverlayClass }=useOriginalAppearance()
import { useGlazeMuseum } from '../composables/useGlazeMuseum'
const { museumPopoverClass, museumLight } = useGlazeMuseum()
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { NButton, NSelect, NPopover, NColorPicker } from 'naive-ui'
import OIcon from './OIcon.vue'
import { useUiStore } from '../stores/ui'
import { useWorkStore } from '../stores/work'
import { useAiStore } from '../stores/ai'
import { isLatentSkin } from '../skins/registry'

const props = defineProps({ editor: { type: Object, required: true }, compact: { type: Boolean, default: false },paperControls:{type:Boolean,default:false},bookmarkControl:{type:Boolean,default:true} })
const ui=useUiStore()
/* 隐现皮肤用插件版工具栏布局：主行只放 撤销/重做 │ B I U S │ 正文 H1-H3 │ 更多格式 ⌄ │ 发给恍然梦，
 * 字号/颜色/底色/链接/对齐/列表/引用全收进「更多格式」弹层；
 * 四套旧皮肤保持桌面原有平铺结构不动。 */
const latent = computed(() => isLatentSkin(ui.skin))
const toolbar=ref(null),toolbarWidth=ref(0)
const isCompact=computed(()=>props.compact||(props.paperControls||ui.skin==='original'&&ui.workbenchMode==='writing')&&toolbarWidth.value<1100)
const paperInMore=computed(()=>props.paperControls&&toolbarWidth.value<720)
let widthObserver
const work = useWorkStore()
const ai = useAiStore()

const tick = ref(0)
const onTr = () => tick.value++
props.editor.on('transaction', onTr)
onBeforeUnmount(() => props.editor.off('transaction', onTr))
onBeforeUnmount(()=>widthObserver?.disconnect())

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

/* 阅读模式入口（隐现「更多格式」内）。与 Workbench 齿轮菜单写同一个 ui.readMode，
 * 不新增第二套状态：两条入口进的是同一个只读视图。 */
function enterReading() {
  if (!work.activeChapter) return
  ui.readMode = true
}

/* 超链接 */
const showLink = ref(false)
const linkHref = ref('https://')
function openLink() {
  linkHref.value = props.editor.getAttributes('link')?.href || 'https://'
  showLink.value = true
}

/* 发送给恍然梦（方案 §五.1）：锚点 = 当前章，编辑器有选中文本时一并作为补充指令透传 */
const AI_UNSET_HINT = '恍然梦未配置：请先在设置中完成恍然梦配置'
function aiPlotBranch() {
  if (!ai.ready) return window.$msg?.warning(AI_UNSET_HINT)
  const ch = work.activeChapter
  if (!ch) return
  const s = props.editor.state.selection
  const sel = s && !s.empty ? props.editor.state.doc.textBetween(s.from, s.to, '\n').trim() : ''
  ai.prepare('请基于当前章节帮助我创作。', {chapterId:ch.id,selection:sel})
}

onMounted(() => {
  if(props.paperControls||ui.skin==='original'){widthObserver=new ResizeObserver(entries=>{toolbarWidth.value=entries[0].contentRect.width});widthObserver.observe(toolbar.value)}
  if (!ai.loaded) ai.loadSettings() // 保障入口置灰判定基于已装载的配置（幂等）
})
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
  <div ref="toolbar" class="editor-toolbar" :class="{compact:isCompact,'has-paper-controls':paperControls}" @click="refocus">
    <button class="tb" data-act="undo" title="撤销" @click="chain().undo().run()">↶</button>
    <button class="tb" data-act="redo" title="重做" @click="chain().redo().run()">↷</button>
    <span class="tb-sep" />

    <button class="tb" data-act="bold" :class="{ on: isActive('bold') }" title="加粗" @click="chain().toggleBold().run()"><b>B</b></button>
    <button class="tb" data-act="italic" :class="{ on: isActive('italic') }" title="斜体" @click="chain().toggleItalic().run()"><i>I</i></button>
    <button class="tb" data-act="underline" :class="{ on: isActive('underline') }" title="下划线" @click="chain().toggleUnderline().run()"><u>U</u></button>
    <button class="tb" data-act="strike" :class="{ on: isActive('strike') }" title="删除线" @click="chain().toggleStrike().run()"><s>S</s></button>
    <span class="tb-sep" />

    <!-- 隐现皮肤下正文/H1-H3 始终可见（插件版设计），旧皮肤保持原有的窄栏折叠行为 -->
    <template v-if="!isCompact || latent">
      <button class="tb" data-act="paragraph" :class="{ on: isActive('paragraph') }" title="正文" @click="chain().setParagraph().run()">正文</button>
      <button class="tb" data-act="h1" :class="{ on: isActive('heading', { level: 1 }) }" title="标题一" @click="chain().toggleHeading({ level: 1 }).run()">H1</button>
      <button class="tb" data-act="h2" :class="{ on: isActive('heading', { level: 2 }) }" title="标题二" @click="chain().toggleHeading({ level: 2 }).run()">H2</button>
      <button class="tb" data-act="h3" :class="{ on: isActive('heading', { level: 3 }) }" title="标题三" @click="chain().toggleHeading({ level: 3 }).run()">H3</button>
      <span class="tb-sep" />
    </template>

    <!-- 隐现皮肤：字号/颜色/底色/链接不在主行，全部收进「更多格式」弹层（见下方 latent 分支）。
         旧皮肤保持桌面原有平铺结构。 -->
    <template v-if="!latent">
    <NSelect :menu-props="{ class: [museumPopoverClass,originalOverlayClass].filter(Boolean).join(' ') }"
      size="tiny"
      :value="sizeVal || null"
      :options="SIZES"
      placeholder="字号"
      style="width: 88px"
      clearable
      @update:value="applySize"
    />

    <NPopover :class="[museumPopoverClass,originalOverlayClass]" :data-glaze-light="museumLight" trigger="click" :show-arrow="false">
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

    <NPopover :class="[museumPopoverClass,originalOverlayClass]" :data-glaze-light="museumLight" trigger="click" :show-arrow="false">
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

    <NPopover :class="[museumPopoverClass,originalOverlayClass]" :data-glaze-light="museumLight" trigger="click" :show-arrow="false" :show="showLink" @update:show="(v) => (showLink = v)">
      <template #trigger>
        <button class="tb" :class="{ on: isActive('link') }" title="超链接" @click="openLink"><OIcon name="link" :size="14" /></button>
      </template>
      <div style="display: flex; gap: 6px; width: 300px">
        <input v-model="linkHref" class="rp-input" placeholder="https://…" style="flex: 1" @keyup.enter="applyLink" />
        <NButton size="small" type="primary" @click="applyLink">确定</NButton>
        <NButton v-if="isActive('link')" size="small" @click="removeLink">移除</NButton>
      </div>
    </NPopover>
    </template>

    <!-- 隐现皮肤唯一的「更多格式」：主行的字号/颜色/底色/链接都在这里，外加书签、对齐、列表、引用、
         清除与 EditorPane 注入的章节状态。纸面模式在隐现下不提供，弹层里也不放 #paper。 -->
    <NPopover v-if="latent" :class="[museumPopoverClass,originalOverlayClass]" :data-glaze-light="museumLight" trigger="click" :show-arrow="false" placement="bottom-start">
      <template #trigger>
        <button class="tb" data-act="more-formats" title="更多格式：字号、颜色、底色、链接、书签、对齐、列表、引用、清除与章节状态">更多格式 ⌄</button>
      </template>
      <div class="tb-more">
        <NSelect :menu-props="{ class: [museumPopoverClass,originalOverlayClass].filter(Boolean).join(' ') }"
          size="tiny"
          :value="sizeVal || null"
          :options="SIZES"
          placeholder="字号"
          style="width: 88px"
          clearable
          @update:value="applySize"
        />
        <NPopover :class="[museumPopoverClass,originalOverlayClass]" :data-glaze-light="museumLight" trigger="click" :show-arrow="false">
          <template #trigger>
            <button class="tb" data-act="color" title="字体颜色">
              <span :style="{ borderBottom: '3px solid ' + curColor, lineHeight: '13px' }">A</span>
            </button>
          </template>
          <div style="width: 208px">
            <NColorPicker :value="curColor" :swatches="COLORS" :show-alpha="false" :modes="['hex']" size="small" @update:value="(c) => chain().setColor(c).run()" />
          </div>
        </NPopover>
        <NPopover :class="[museumPopoverClass,originalOverlayClass]" :data-glaze-light="museumLight" trigger="click" :show-arrow="false">
          <template #trigger>
            <button class="tb" data-act="highlight" :class="{ on: isActive('highlight') }" title="突出显示">底色</button>
          </template>
          <div style="display: flex; gap: 6px; align-items: center">
            <button v-for="c in HIGHLIGHTS" :key="c" class="tb" :style="{ background: c, width: '22px', height: '22px' }" :title="'底色 ' + c" @click="chain().setHighlight({ color: c }).run()" />
            <button class="tb" title="清除底色" @click="chain().unsetHighlight().run()"><OIcon name="close" :size="11" /></button>
          </div>
        </NPopover>
        <NPopover :class="[museumPopoverClass,originalOverlayClass]" :data-glaze-light="museumLight" trigger="click" :show-arrow="false" :show="showLink" @update:show="(v) => (showLink = v)">
          <template #trigger>
            <button class="tb" data-act="link" :class="{ on: isActive('link') }" title="超链接" @click="openLink"><OIcon name="link" :size="14" /></button>
          </template>
          <div style="display: flex; gap: 6px; width: 300px">
            <input v-model="linkHref" class="rp-input" placeholder="https://…" style="flex: 1" @keyup.enter="applyLink" />
            <NButton size="small" type="primary" @click="applyLink">确定</NButton>
            <NButton v-if="isActive('link')" size="small" @click="removeLink">移除</NButton>
          </div>
        </NPopover>
        <button
          v-if="bookmarkControl"
          class="tb"
          data-action="bookmark"
          data-act="bookmark"
          :class="{ on: bmOn }"
          :title="bmOn ? '移除书签' : '收藏本书签'"
          @click="toggleBm"
        ><OIcon :name="bmOn ? 'star-filled' : 'star'" :size="14" /></button>
        <!-- 阅读模式：工具栏在阅读态整体隐藏（EditorPane 的 v-show），所以这里只作为「进入」入口；
             退出走 Esc 与齿轮菜单的「退出阅读」，不在弹层里重复一份够不着的按钮。 -->
        <button class="tb tb-read" data-act="reading-mode" title="阅读模式：隐藏工具栏与侧栏，限宽只读" @click="enterReading"><OIcon name="books" :size="14" /></button>
        <span class="tb-sep" />
        <button class="tb" :class="{ on: isActive({ textAlign: 'left' }) }" title="左对齐" @click="chain().setTextAlign('left').run()">左</button>
        <button class="tb" :class="{ on: isActive({ textAlign: 'center' }) }" title="居中" @click="chain().setTextAlign('center').run()">中</button>
        <button class="tb" :class="{ on: isActive({ textAlign: 'right' }) }" title="右对齐" @click="chain().setTextAlign('right').run()">右</button>
        <button class="tb" :class="{ on: isActive({ textAlign: 'justify' }) }" title="两端对齐" @click="chain().setTextAlign('justify').run()">齐</button>
        <span class="tb-sep" />
        <button class="tb" :class="{ on: isActive('bulletList') }" title="无序列表" @click="chain().toggleBulletList().run()">•≡</button>
        <button class="tb" :class="{ on: isActive('orderedList') }" title="有序列表" @click="chain().toggleOrderedList().run()">1≡</button>
        <button class="tb" :class="{ on: isActive('blockquote') }" title="引用" @click="chain().toggleBlockquote().run()">引</button>
        <button class="tb" title="清除格式" @click="chain().unsetAllMarks().clearNodes().run()">清除</button>
        <div v-if="$slots['more-end']" class="tb-more-chapter" @click.stop @mousedown.stop>
          <slot name="more-end" />
        </div>
      </div>
    </NPopover>
    <!-- 旧皮肤窄栏折叠的「更多格式」；隐现已有上面的弹层，这里必须让位，否则主行出现第二个入口 -->
    <NPopover :class="[museumPopoverClass,originalOverlayClass]" :data-glaze-light="museumLight" v-if="isCompact && !latent" trigger="click" :show-arrow="false" placement="bottom-start">
      <template #trigger>
        <button class="tb" :title="paperInMore ? '更多格式：纸面、段落、对齐、列表、引用、清除与恍然梦' : '更多格式：段落、对齐、列表、引用、清除与恍然梦'">更多格式 ⌄</button>
      </template>
      <div class="tb-more">
        <span v-if="paperInMore" class="tb-paper-in-more" @click.stop><slot name="paper" /></span>
        <button class="tb" :class="{ on: isActive('paragraph') }" title="正文" @click="chain().setParagraph().run()">正文</button>
        <button class="tb" :class="{ on: isActive('heading', { level: 1 }) }" title="标题一" @click="chain().toggleHeading({ level: 1 }).run()">H1</button>
        <button class="tb" :class="{ on: isActive('heading', { level: 2 }) }" title="标题二" @click="chain().toggleHeading({ level: 2 }).run()">H2</button>
        <button class="tb" :class="{ on: isActive('heading', { level: 3 }) }" title="标题三" @click="chain().toggleHeading({ level: 3 }).run()">H3</button>
        <span class="tb-sep" />
        <button class="tb" :class="{ on: isActive({ textAlign: 'left' }) }" title="左对齐" @click="chain().setTextAlign('left').run()">左</button>
        <button class="tb" :class="{ on: isActive({ textAlign: 'center' }) }" title="居中" @click="chain().setTextAlign('center').run()">中</button>
        <button class="tb" :class="{ on: isActive({ textAlign: 'right' }) }" title="右对齐" @click="chain().setTextAlign('right').run()">右</button>
        <button class="tb" :class="{ on: isActive({ textAlign: 'justify' }) }" title="两端对齐" @click="chain().setTextAlign('justify').run()">齐</button>
        <span class="tb-sep" />
        <button class="tb" :class="{ on: isActive('bulletList') }" title="无序列表" @click="chain().toggleBulletList().run()">•≡</button>
        <button class="tb" :class="{ on: isActive('orderedList') }" title="有序列表" @click="chain().toggleOrderedList().run()">1≡</button>
        <button class="tb" :class="{ on: isActive('blockquote') }" title="引用" @click="chain().toggleBlockquote().run()">引</button>
        <button class="tb" title="清除格式" @click="chain().unsetAllMarks().clearNodes().run()">清除</button>
        <span class="tb-sep" />
        <button class="tb" :disabled="!ai.ready" :title="ai.ready ? '发送给恍然梦（锚点为当前章节，选中文本一并参考）' : AI_UNSET_HINT" @click="aiPlotBranch">发送给恍然梦</button>
      </div>
    </NPopover>
    <template v-if="!isCompact && !latent">
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
    </template>
    <button
      class="tb"
      v-if="bookmarkControl && !latent"
      data-action="bookmark"
      :class="{ on: bmOn }"
      :title="bmOn ? '移除书签' : '收藏本书签'"
      @click="toggleBm"
    ><OIcon :name="bmOn ? 'star-filled' : 'star'" :size="14" /></button>
    <template v-if="!isCompact || latent">
      <span class="tb-sep" />
      <button class="tb" data-act="send-ai" :disabled="!ai.ready" :title="ai.ready ? '发送给恍然梦（锚点为当前章节，选中文本一并参考）' : AI_UNSET_HINT" @click="aiPlotBranch">发送给恍然梦</button>
    </template>

    <!-- 纸面选择器只给旧皮肤：隐现下纸面模式不再提供，主行与弹层都不渲染 #paper -->
    <span v-if="!latent && paperControls && !paperInMore" class="tb-paper-direct" @click.stop><slot name="paper" /></span>
    <!-- 顶栏右端：章节状态 / 字数 / 历史（编辑皮肤由 EditorPane 注入；原版留在自己的 .editor-head） -->
    <slot name="bar-end" />
  </div>
</template>
