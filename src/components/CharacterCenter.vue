<script setup>
import { computed, ref } from 'vue'
import { NButton, NInput, NSelect, NTag } from 'naive-ui'
import { useWorkStore } from '../stores/work'
import { pickFiles, arrayBufferToBlob, imageMime, IMAGE_EXTS } from '../services/fileio'
import DLinkTextMenu from './DLinkTextMenu.vue'
import CharacterGraph from './CharacterGraph.vue'

const work = useWorkStore()
const c = computed(() => work.activeCharacter)
const dlMenu = ref(null)
const ROLE_OPTS = ['主角', '配角', '反派', '龙套'].map((r) => ({ label: r, value: r }))

/* 人物小传右键快捷栏：剪切/复制/粘贴 + 添加双链 */
function onCtx(e) {
  if (!c.value) return
  const ch = c.value
  dlMenu.value?.open(e, { get: () => ch.content || '', set: (v) => work.updateCharacter(ch.id, { content: v }) })
}

const avatarUrl = computed(() => {
  void work.urlTick
  return c.value?.avatarAssetId ? work.assetUrl(c.value.avatarAssetId) : ''
})

const fieldsRows = computed(() => Object.entries(c.value?.fields || {}))

async function changeAvatar() {
  if (!c.value) return
  const files = await pickFiles(IMAGE_EXTS)
  if (!files.length) return
  const f = files[0]
  const meta = await work.addAssetBlob(arrayBufferToBlob(f.data, imageMime(f.ext)), f.name)
  work.updateCharacter(c.value.id, { avatarAssetId: meta.id })
  await work.warmUrls([meta.id])
}

function addField() {
  if (!c.value) return
  let i = 1
  while (c.value.fields['字段' + i] !== undefined) i++
  work.updateCharacter(c.value.id, { fields: { ...c.value.fields, ['字段' + i]: '' } })
}
function setFieldKey(oldKey, newKey) {
  if (!c.value || !newKey || newKey === oldKey || c.value.fields[newKey] !== undefined) return
  const f = { ...c.value.fields }
  f[newKey] = f[oldKey]
  delete f[oldKey]
  work.updateCharacter(c.value.id, { fields: f })
}
function setFieldValue(k, v) {
  if (!c.value) return
  work.updateCharacter(c.value.id, { fields: { ...c.value.fields, [k]: v } })
}
function removeField(k) {
  if (!c.value) return
  const f = { ...c.value.fields }
  delete f[k]
  work.updateCharacter(c.value.id, { fields: f })
}

const otherOpts = computed(() =>
  work.liveCharacters.filter((x) => x.id !== c.value?.id).map((x) => ({ label: x.name, value: x.id }))
)
const relOther = ref(null)
const relLabel = ref('')
const myRelations = computed(() => {
  if (!c.value) return []
  return work.relations
    .filter((r) => r.fromId === c.value.id || r.toId === c.value.id)
    .map((r) => ({ ...r, other: work.characters.find((x) => x.id === (r.fromId === c.value.id ? r.toId : r.fromId)) }))
})
function addRelation() {
  if (!c.value || !relOther.value) return
  work.addRelation(c.value.id, relOther.value, relLabel.value.trim() || '关联')
  relOther.value = null
  relLabel.value = ''
}
</script>

<template>
  <!-- 关系图视图：整幅画布（8.8.3）；列表视图：人物详情 -->
  <CharacterGraph v-if="work.charView === 'graph'" />
  <div v-else-if="c" style="flex: 1; overflow: auto; padding: 22px 34px">
    <div style="display: flex; gap: 16px; align-items: flex-start; margin-bottom: 16px">
      <img v-if="avatarUrl" :src="avatarUrl" class="avatar-lg" />
      <div v-else class="avatar-lg" style="display: flex; align-items: center; justify-content: center; font-size: 30px; color: var(--text-dim)">人</div>
      <div style="flex: 1; display: flex; flex-direction: column; gap: 8px">
        <div style="display: flex; gap: 8px">
          <NInput class="rp-input" :value="c.name" placeholder="姓名" style="flex: 1; font-size: 16px; font-weight: 700" @update:value="(v) => work.updateCharacter(c.id, { name: v })" />
          <NSelect :value="c.role" :options="ROLE_OPTS" style="width: 100px" size="small" @update:value="(v) => work.updateCharacter(c.id, { role: v })" />
        </div>
        <div style="display: flex; gap: 8px">
          <NInput class="rp-input" :value="c.aliases" placeholder="别名（用 / 分隔）" style="flex: 1" @update:value="(v) => work.updateCharacter(c.id, { aliases: v })" />
          <NButton size="small" @click="changeAvatar">{{ avatarUrl ? '换头像' : '设头像' }}</NButton>
          <NButton size="small" quaternary type="error" @click="work.deleteCharacter(c.id)">删除</NButton>
        </div>
        <NSelect
          :value="c.tags"
          multiple
          tag
          filterable
          clearable
          size="small"
          placeholder="标签（回车添加）"
          :options="[]"
          @update:value="(v) => work.updateCharacter(c.id, { tags: v })"
        />
      </div>
    </div>

    <hr class="divider" />
    <div class="rp-title">自定义字段</div>
    <div v-for="[k, v] in fieldsRows" :key="k" class="field-row">
      <NInput class="rp-input" :value="k" style="width: 120px" @change="(v) => setFieldKey(k, v)" />
      <NInput class="rp-input" :value="v" style="flex: 1" @update:value="(v2) => setFieldValue(k, v2)" />
      <NButton size="tiny" quaternary @click="removeField(k)">✕</NButton>
    </div>
    <NButton size="tiny" @click="addField">＋字段</NButton>

    <hr class="divider" />
    <div class="rp-title">人物关系</div>
    <div v-for="r in myRelations" :key="r.id" class="field-row" style="align-items: center">
      <NTag size="small" :bordered="false">{{ r.other?.name || '?' }}</NTag>
      <NInput class="rp-input" :value="r.label" style="flex: 1" @update:value="(v) => work.updateRelation(r.id, { label: v })" />
      <NButton size="tiny" quaternary @click="work.removeRelation(r.id)">✕</NButton>
    </div>
    <div class="field-row" style="align-items: center">
      <NSelect v-model:value="relOther" :options="otherOpts" size="small" placeholder="选择人物" style="width: 140px" />
      <NInput v-model:value="relLabel" size="small" placeholder="关系（如：师徒 / 宿敌）" style="flex: 1" @keyup.enter="addRelation" />
      <NButton size="tiny" @click="addRelation">添加</NButton>
    </div>

    <hr class="divider" />
    <div class="rp-title">人物小传（外貌 / 性格 / 背景 / 动机……）</div>
    <textarea
      class="rp-textarea"
      style="min-height: 220px; font-size: 14px; line-height: 1.9"
      :value="c.content"
      data-dl-token
      @input="(e) => work.updateCharacter(c.id, { content: e.target.value })"
      @contextmenu="onCtx"
    ></textarea>
  </div>
  <div v-else class="empty-shelf" style="padding-top: 140px">
    <div class="big">众生有相</div>
    <p>从左侧选择或创建一个人物。</p>
  </div>
  <DLinkTextMenu v-if="work.charView === 'list'" ref="dlMenu" />
</template>
