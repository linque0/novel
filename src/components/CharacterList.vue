<script setup>
import { computed } from 'vue'
import { NButton, NTag } from 'naive-ui'
import { useWorkStore } from '../stores/work'

const work = useWorkStore()
const ROLE_COLOR = { 主角: 'error', 反派: 'warning', 配角: 'info', 龙套: 'default' }
const list = computed(() =>
  work.liveCharacters.map((c) => ({ id: c.id, name: c.name, role: c.role }))
)
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100%">
    <div class="side-head">
      <NButton size="tiny" type="primary" @click="work.addCharacter()">＋人物</NButton>
      <span style="font-size: 12px; color: var(--text-dim)">{{ list.length }} 人</span>
    </div>
    <div class="side-list">
      <div
        v-for="c in list"
        :key="c.id"
        class="side-item"
        :class="{ active: work.selCharacterId === c.id }"
        role="button"
        tabindex="0"
        @click="work.selCharacterId = c.id"
        @keydown.enter="work.selCharacterId = c.id"
      >
        <NTag size="tiny" :type="ROLE_COLOR[c.role] || 'default'" :bordered="false">{{ c.role }}</NTag>
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ c.name }}</span>
      </div>
      <p v-if="!list.length" style="font-size: 12px; color: var(--text-dim); padding: 10px">
        还没有人物。点击「＋人物」创建角色卡：外貌、性格、背景、动机与自定义字段。
      </p>
    </div>
  </div>
</template>
