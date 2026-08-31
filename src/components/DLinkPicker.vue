<!-- 双链选择面板：搜索全书五模块内容插入双链 / 查询反向链接（正文、幕布、纯文本右键菜单共用） -->
<script setup>
import { ref, computed } from 'vue'
import { searchTargets, findBacklinks, jumpTo, KIND_LABEL } from '../services/doublelinks'

const emit = defineEmits(['pick'])

const q = ref('')
const mode = ref('link') // link 链接到 | back 反向链接

const results = computed(() => (mode.value === 'back' ? findBacklinks(q.value.trim()) : searchTargets(q.value, 40)))
</script>

<template>
  <div class="dl-picker">
    <div class="dl-picker-tabs">
      <button class="dl-tab" :class="{ on: mode === 'link' }" type="button" @click="mode = 'link'">链接到…</button>
      <button class="dl-tab" :class="{ on: mode === 'back' }" type="button" @click="mode = 'back'">反向链接</button>
    </div>
    <input v-model="q" class="rp-input" :placeholder="mode === 'link' ? '搜索章节 / 设定 / 人物 / 大纲 / 灵感…' : '输入标题，查询哪些内容引用了它'" />
    <div class="dl-picker-list">
      <div v-for="t in results" :key="t.kind + ':' + t.id" class="picker-item" @click="mode === 'link' ? emit('pick', t) : jumpTo(t)">
        <span class="dl-kind">{{ KIND_LABEL[t.kind] }}</span>
        <span class="picker-title">{{ t.title }}</span>
        <span v-if="t.extra" class="picker-extra">{{ t.extra }}</span>
      </div>
      <div v-if="!results.length" class="dl-picker-empty">{{ mode === 'link' ? '没有匹配的内容' : '暂无反向链接' }}</div>
    </div>
    <div class="dl-picker-tip">{{ mode === 'link' ? '选择目标后，选中文字将标记为指向它的双链。' : '点击结果可跳转到引用位置。' }}</div>
  </div>
</template>
