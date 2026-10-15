<script setup>
defineProps({ book: { type: Object, required: true } })
</script>

<template>
  <span class="gravity-cover" :class="'gravity-cover--' + (book.kind || 'novel')">
    <span class="gravity-cover-edition">小说工坊 <span>·</span> {{ book.genre || '其他' }}</span>
    <span class="gravity-cover-title" :class="{ 'is-long': (book.title || '').length > 8 }">{{ book.title }}</span>
    <svg class="gravity-cover-orbits" viewBox="0 0 240 260" fill="none" aria-hidden="true">
      <circle cx="120" cy="136" r="74" />
      <ellipse cx="120" cy="136" rx="114" ry="32" transform="rotate(-32 120 136)" />
      <ellipse cx="120" cy="136" rx="86" ry="110" transform="rotate(24 120 136)" />
      <path d="M120 25V247M15 136H225" stroke-dasharray="2 7" />
      <circle cx="184" cy="98" r="5" fill="currentColor" />
    </svg>
    <span class="gravity-cover-author">{{ book.author ? book.author + ' 著' : '未署名' }}</span>
    <span class="gravity-cover-status">{{ book.status || '构思' }}</span>
  </span>
</template>
