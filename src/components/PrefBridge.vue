<script setup>
// 桥接 naive-ui 的 message / dialog 到全局，便于非组件模块调用
import { useMessage, useDialog } from 'naive-ui'
import { useGlazeMuseum } from '../composables/useGlazeMuseum'
const { museumPopoverClass } = useGlazeMuseum()
const msg = useMessage()
const dlg = useDialog()
window.$msg = msg
window.$dlg = Object.fromEntries(Object.keys(dlg).map(key => [key,
  ['create', 'info', 'success', 'warning', 'error'].includes(key)
    ? options => dlg[key]({ ...options, class: [museumPopoverClass.value, options?.class].filter(Boolean).join(' ') })
    : dlg[key]
]))
</script>

<template>
  <span style="display: none"></span>
</template>
