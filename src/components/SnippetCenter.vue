<script setup>
import TaskLauncher from './ai/TaskLauncher.vue'
import InspirationPrompt from './InspirationPrompt.vue'
import { computed, ref } from 'vue'
import { NButton, NInput, NPopconfirm, NPopover, NDropdown, useMessage } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'
import { popOut } from '../services/panelwindows'
import DLinkTextMenu from './DLinkTextMenu.vue'
import SnippetList from './SnippetList.vue'
import artInspiration from '../assets/skins/crimson/inspiration.webp'

const work = useWorkStore()
const ui = useUiStore()
const msg = useMessage()
const s = computed(() => work.activeSnippet)
const dlMenu = ref(null)
const isNativePanel = new URLSearchParams(location.search).has('panel')
const quickOpen = ref(false)
const quickText = ref('')

/* 赤月戏：标题=正文首行，正文=余下各行；写回时按同一结构拼回，不迁移数据 */
const contentLines = computed(() => String(s.value?.content || '').split('\n'))
const ideaTitle = computed(() => (contentLines.value[0] || '').trim() || '未命名灵感')
const ideaBody = computed(() => contentLines.value.slice(1).join('\n').replace(/^\n+/, ''))
const ideaDate = computed(() => {
  const t = s.value?.createdAt
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
})
function setIdeaTitle(v) {
  if (!s.value) return
  const rest = ideaBody.value
  work.updateSnippet(s.value.id, { content: String(v || '').trim() + (rest ? '\n\n' + rest : '') })
}
function setIdeaBody(v) {
  if (!s.value) return
  work.updateSnippet(s.value.id, { content: ideaTitle.value + (v ? '\n\n' + v : '') })
}
function addQuickSnippet() {
  const v = quickText.value.trim()
  if (!v) return
  const row = work.addSnippet(v)
  if (row?.id) work.selSnippetId = row.id
  quickText.value = ''
  quickOpen.value = false
}
async function popSnippet() {
  if (!s.value) return
  await popOut(work, 'snippet', s.value.id, `${work.work?.title || ''} · 灵感`)
}
const ideaMenu = [
  { label: '转为设定', key: 'lore' },
  { label: '转为章节', key: 'chapter' },
  { type: 'divider', key: 'd1' },
  { label: '删除这条灵感', key: 'delete' }
]
function onIdeaMenu(key) {
  if (key === 'lore') toLore()
  else if (key === 'chapter') toChapter()
  else if (key === 'delete' && s.value) work.deleteSnippet(s.value.id)
}

/* 灵感内容右键快捷栏：剪切/复制/粘贴 + 添加关系链接 */
function onCtx(e) {
  if (!s.value) return
  const sn = s.value
  dlMenu.value?.open(e, { get: () => sn.content || '', set: (v) => work.updateSnippet(sn.id, { content: v }) })
}

function toChapter() {
  if (!s.value) return
  const lines = (s.value.content || '').split('\n').filter((x) => x.trim())
  const title = (lines[0] || '灵感章节').slice(0, 30)
  work.addChapter(null, title).then((ch) => {
    work.setChapterContent(ch.id, s.value.content || '')
    msg.success('已转为新章节')
  })
}
function toLore() {
  if (!s.value) return
  // 设定库已幕布化（v0.3.0）：旧 lore 表为死表，改写幕布节点——首行作标题、余行作子节点内容
  const lines = (s.value.content || '').split('\n').filter((x) => x.trim())
  const node = work.mubuAddInCurrentSet((lines[0] || '新设定').slice(0, 30))
  const body = lines.slice(1).join('\n').trim()
  if (body) work.mubuAdd(node.id, null, body)
  work.tab = 'lore'
  ui.loreFocusId = node.id
  msg.success('已转为设定节点')
}
</script>

<template>
  <TaskLauncher v-if="!ui.isStudioSkin" module="snippets" />
  <Teleport defer to="#crimson-bar-tools" :disabled="ui.skin !== 'crimson'">
    <div v-if="ui.skin === 'crimson'" class="crimson-bar-group">
      <input v-model="ui.snippetQuery" class="crimson-bar-search" type="search" placeholder="搜索灵感" aria-label="搜索灵感" />
      <NPopover v-model:show="quickOpen" trigger="click" placement="bottom-end" :show-arrow="false">
        <template #trigger>
          <button class="crimson-bar-button primary" type="button">＋ 记录灵感</button>
        </template>
        <div style="width: 320px; display: flex; flex-direction: column; gap: 10px">
          <NInput v-model:value="quickText" type="textarea" :rows="4" placeholder="随手记一条灵感…（Ctrl+Enter 记录）" @keydown="(e) => e.ctrlKey && e.key === 'Enter' && addQuickSnippet()" />
          <div style="display: flex; justify-content: flex-end; gap: 8px">
            <NButton size="small" @click="quickOpen = false">取消</NButton>
            <NButton size="small" type="primary" :disabled="!quickText.trim()" @click="addQuickSnippet">记录</NButton>
          </div>
        </div>
      </NPopover>
      <button class="crimson-bar-button" type="button" title="把灵感拆成独立窗口" @click="popSnippet">独立窗口 ↗</button>
    </div>
  </Teleport>
  <div v-if="s || ui.skin === 'crimson'" class="snippet-surface" :class="{ 'is-crimson': ui.skin === 'crimson' }" style="flex: 1; display: flex; flex-direction: column; padding: 22px 34px; min-height: 0">
    <template v-if="ui.skin === 'crimson'">
      <!-- 赤月戏：花窗布景 + 手记墙 + 阅读纸（照 inspiration.html） -->
      <aside class="crimson-art-pane compact" aria-hidden="true">
        <img :src="artInspiration" alt="" />
        <div class="crimson-art-copy">
          <small>{{ work.work?.title || '小说工坊' }}</small>
          <h2>幕间<em>拾光</em></h2>
          <button type="button" class="crimson-art-action" @click="ui.aiDrawerOpen = true">恍然梦 ↗</button>
        </div>
      </aside>
      <aside class="crimson-idea-wall" aria-label="灵感列表">
        <div class="crimson-idea-strip">
          <span>全部 {{ work.liveSnippets.length }} 条</span>
          <span>最近编辑 ↓</span>
        </div>
        <SnippetList bare />
      </aside>
      <section v-if="s" class="crimson-idea-reader paper">
        <div class="paper-running"><span>灵感手记</span><span>{{ ideaDate }}</span></div>
        <div class="crimson-idea-heading">
          <small>{{ ideaDate }} / 灵感记录</small>
          <textarea class="crimson-idea-title" :value="ideaTitle" rows="1" aria-label="灵感标题" placeholder="灵感标题" @change="(e) => setIdeaTitle(e.target.value)"></textarea>
        </div>
        <textarea
          class="crimson-idea-body"
          :value="ideaBody"
          aria-label="灵感内容"
          placeholder="记录灵感、桥段、对话片段……"
          data-dl-token
          @input="(e) => setIdeaBody(e.target.value)"
          @contextmenu="onCtx"
        ></textarea>
        <div class="crimson-idea-actions">
          <span>灵感记录 · 自动保存</span>
          <div>
            <NButton size="small" @click="toLore">转为设定</NButton>
            <NButton size="small" type="primary" @click="toChapter">转为章节 ↗</NButton>
            <NDropdown trigger="click" :options="ideaMenu" @select="onIdeaMenu">
              <button type="button" class="crimson-idea-more" title="灵感操作">···</button>
            </NDropdown>
          </div>
        </div>
      </section>
      <section v-else class="crimson-idea-reader paper is-empty">
        <div class="empty-shelf">
          <div class="big">灵光一现</div>
          <p>从左侧选择一条灵感，或点击右上角「＋ 记录灵感」随手记。</p>
        </div>
      </section>
    </template>
    <template v-else>
    <header v-if="ui.isStudioSkin" class="gravity-snippet-heading"><span>{{ new Date(s.createdAt).toLocaleString('zh-CN', { month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' }) }} / 灵感记录</span><h1>{{ (s.content || '未命名灵感').split('\n')[0] }}</h1></header>
    <div class="snippet-actions" style="display: flex; gap: 8px; margin-bottom: 12px; align-items: center">
      <span style="font-size: 12px; color: var(--text-dim)">灵感记录 · 自动保存</span>
      <div style="flex: 1"></div>
      <NButton size="small" @click="toChapter">转为章节</NButton>
      <NButton size="small" @click="toLore">转为设定</NButton>
      <NPopconfirm @positive-click="work.deleteSnippet(s.id)">
        <template #trigger>
          <NButton size="small" quaternary type="error">删除</NButton>
        </template>
        删除后可在回收站恢复
      </NPopconfirm>
    </div>
    <NInput
      :value="s.content"
      type="textarea"
      style="flex: 1"
      :autosize="ui.isStudioSkin ? false : { minRows: 18, maxRows: 40 }"
      placeholder="记录灵感、桥段、对话片段……"
      data-dl-token
      @update:value="(v) => work.updateSnippet(s.id, { content: v })"
      @contextmenu="onCtx"
    />
    <div v-if="ui.skin === 'glaze'" id="glaze-inspiration-tools"><InspirationPrompt /></div>
    <div v-if="ui.skin === 'gravity' && isNativePanel" class="gravity-panel-inspiration-tools"><InspirationPrompt /></div>
    </template>
  </div>
  <div v-else class="empty-shelf" style="padding-top: 140px">
    <div class="big">灵光一现</div>
    <p>从左侧选择一条灵感，或直接在左侧输入框随手记。</p>
  </div>
  <DLinkTextMenu ref="dlMenu" />
</template>
