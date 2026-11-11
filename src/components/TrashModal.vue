<script setup>
import { useGlazeMuseum } from '../composables/useGlazeMuseum'
const { museumPopoverClass, museumLight } = useGlazeMuseum()
import { useOriginalAppearance } from '../composables/useOriginalAppearance.js'
const { originalOverlayClass } = useOriginalAppearance()
import { computed, ref } from 'vue'
import { NModal, NTabs, NTabPane, NButton, NEmpty, NPopconfirm } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { useUiStore } from '../stores/ui'

const work = useWorkStore()
const ui = useUiStore()
const busy = ref(false)
async function updateItem(action, table, row) {
  if (busy.value) return false
  busy.value = true
  try {
    if (table === 'mubu') {
      if (action === 'restore') work.mubuRestore(row.id)
      else await work.mubuPurge(row.id)
    } else if (action === 'restore') await work.restoreItem(table, row)
    else await work.purgeItem(table, row)
    window.$msg?.success(action === 'restore' ? '条目已恢复' : '条目已彻底删除')
  } catch (e) {
    window.$msg?.error((action === 'restore' ? '恢复失败：' : '删除失败：') + (e?.message || e))
    return false
  } finally {
    busy.value = false
  }
}

const items = computed(() => work.recycleItems())
const total = computed(
  () => items.value.chapters.length + items.value.characters.length + items.value.mubu.length + items.value.snippets.length
)
const fmt = (t) => new Date(t).toLocaleString('zh-CN')
</script>

<template>
  <NModal :class="[museumPopoverClass, originalOverlayClass]" :data-glaze-light="museumLight" v-model:show="ui.trashOpen" :mask-closable="!busy" :close-on-esc="!busy" :closable="!busy" preset="card" title="回收站" style="width: 640px">
    <p v-if="originalOverlayClass && total" class="original-dialog-note">共 {{ total }} 条已删除资料。恢复后可继续编辑；彻底删除需要确认且无法撤销。</p>
    <NEmpty v-if="!total" description="回收站是空的" style="margin: 30px 0" />
    <NTabs v-else type="line" size="small">
      <NTabPane :name="'ch'" :tab="`正文 (${items.chapters.length})`">
        <div v-for="c in items.chapters" :key="c.id" class="trash-row">
          <span style="flex: 1">{{ c.title }} <span class="dim">{{ fmt(c.deletedAt) }}</span></span>
          <NButton size="tiny" :disabled="busy" @click="updateItem('restore', 'chapters', c)">恢复</NButton>
          <NPopconfirm :class="[museumPopoverClass, originalOverlayClass]" :data-glaze-light="museumLight" positive-text="彻底删除" negative-text="取消" @positive-click="updateItem('purge', 'chapters', c)">
            <template #trigger><NButton size="tiny" :disabled="busy" quaternary type="error">彻底删除</NButton></template>
            彻底删除后无法恢复，确定？
          </NPopconfirm>
        </div>
      </NTabPane>
      <NTabPane :name="'chars'" :tab="`人物 (${items.characters.length})`">
        <div v-for="c in items.characters" :key="c.id" class="trash-row">
          <span style="flex: 1">{{ c.name }} <span class="dim">{{ fmt(c.deletedAt) }}</span></span>
          <NButton size="tiny" :disabled="busy" @click="updateItem('restore', 'characters', c)">恢复</NButton>
          <NPopconfirm :class="[museumPopoverClass, originalOverlayClass]" :data-glaze-light="museumLight" positive-text="彻底删除" negative-text="取消" @positive-click="updateItem('purge', 'characters', c)">
            <template #trigger><NButton size="tiny" :disabled="busy" quaternary type="error">彻底删除</NButton></template>
            彻底删除后无法恢复，确定？
          </NPopconfirm>
        </div>
      </NTabPane>
      <NTabPane :name="'lore'" :tab="`设定 (${items.mubu.length})`">
        <div v-for="n in items.mubu" :key="n.id" class="trash-row">
          <span style="flex: 1">{{ (n.text || '（空）').slice(0, 24) }} <span class="dim">{{ fmt(n.deletedAt) }}</span></span>
          <NButton size="tiny" :disabled="busy" @click="updateItem('restore', 'mubu', n)">恢复</NButton>
          <NPopconfirm :class="[museumPopoverClass, originalOverlayClass]" :data-glaze-light="museumLight" positive-text="彻底删除" negative-text="取消" @positive-click="updateItem('purge', 'mubu', n)">
            <template #trigger><NButton size="tiny" :disabled="busy" quaternary type="error">彻底删除</NButton></template>
            彻底删除（含其子节点）后无法恢复，确定？
          </NPopconfirm>
        </div>
      </NTabPane>
      <NTabPane :name="'sn'" :tab="`灵感 (${items.snippets.length})`">
        <div v-for="s in items.snippets" :key="s.id" class="trash-row">
          <span style="flex: 1">{{ (s.content || '').slice(0, 20) }} <span class="dim">{{ fmt(s.deletedAt) }}</span></span>
          <NButton size="tiny" :disabled="busy" @click="updateItem('restore', 'snippets', s)">恢复</NButton>
          <NPopconfirm :class="[museumPopoverClass, originalOverlayClass]" :data-glaze-light="museumLight" positive-text="彻底删除" negative-text="取消" @positive-click="updateItem('purge', 'snippets', s)">
            <template #trigger><NButton size="tiny" :disabled="busy" quaternary type="error">彻底删除</NButton></template>
            彻底删除后无法恢复，确定？
          </NPopconfirm>
        </div>
      </NTabPane>
    </NTabs>
  </NModal>
</template>

<style scoped>
.trash-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.trash-row .dim {
  color: var(--text-dim);
  font-size: 11px;
  margin-left: 8px;
}
</style>
