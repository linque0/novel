<script setup>
import { useGlazeMuseum } from '../composables/useGlazeMuseum'
const { museumPopoverClass, museumLight } = useGlazeMuseum()
import { ref } from 'vue'
import { NSelect, useMessage } from 'naive-ui'
import { useUiStore } from '../stores/ui'
import { selectableSkins } from '../skins/registry'

const ui = useUiStore()
const message = useMessage()
const saving = ref(false)
/* 桌面构建只列 desktop 皮肤；插件构建只列 dsh（皮肤由 installDshSkin() 强制）。
 * 引力书舱与琉光画境以 selector:false 注册，不在选择器里露出。 */
const options = selectableSkins().map(s => ({ label: s.label, value: s.id }))
async function select(value) {
  saving.value = true
  try { await ui.setSkin(value) }
  catch { message.error('皮肤未能保存，请重试') }
  finally { saving.value = false }
}
</script>

<template>
  <NSelect :menu-props="{ class: museumPopoverClass }" class="skin-picker" aria-label="工坊皮肤" size="small" :value="ui.skin" :options="options" :disabled="saving" :loading="saving" @update:value="select" />
</template>

<style scoped>
.skin-picker { width: 220px; flex: none; -webkit-app-region: no-drag; }
</style>
