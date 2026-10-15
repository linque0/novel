<script setup>
import { ref } from 'vue'
import { NSelect, useMessage } from 'naive-ui'
import { useUiStore } from '../stores/ui'
import { SKINS } from '../skins/registry'

const ui = useUiStore()
const message = useMessage()
const saving = ref(false)
const options = SKINS.map(s => ({ label: s.label, value: s.id }))
async function select(value) {
  saving.value = true
  try { await ui.setSkin(value) }
  catch { message.error('皮肤未能保存，请重试') }
  finally { saving.value = false }
}
</script>

<template>
  <NSelect class="skin-picker" aria-label="工坊皮肤" size="small" :value="ui.skin" :options="options" :disabled="saving" :loading="saving" @update:value="select" />
</template>

<style scoped>
.skin-picker { width: 220px; flex: none; -webkit-app-region: no-drag; }
</style>
