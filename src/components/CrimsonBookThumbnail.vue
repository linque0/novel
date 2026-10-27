<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import CrimsonBookObject from './CrimsonBookObject.vue'
const props = defineProps({ book: { type: Object, required: true } })
const image = ref('')
let alive = false, visible = false, generation = 0, api, release, observer
async function refresh() {
  const token = ++generation
  if (!api || !visible || document.hidden) return
  await document.fonts.ready
  if (!alive || token !== generation || !visible || document.hidden) return
  const url = await api.getBookPoster(props.book)
  if (alive && token === generation) image.value = url || ''
}
watch(() => [props.book.id, props.book.kind, props.book.title, props.book.author, props.book.intro], refresh)
onMounted(async () => {
  alive = true
  observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) refresh() })
  observer.observe(host.value)
  document.addEventListener('visibilitychange', visibility)
  try {
    const module = await import('../services/book3d/renderer')
    if (!alive) return
    api = module; release = api.retainBookPosters(); await refresh()
  } catch { /* Static binding remains available without WebGL. */ }
})
const host = ref(null)
function visibility() { if (!document.hidden) refresh() }
onBeforeUnmount(() => { alive = false; generation++; observer?.disconnect(); document.removeEventListener('visibilitychange', visibility); release?.() })
</script>
<template>
  <span ref="host" class="crimson-book-thumbnail" aria-hidden="true" :data-poster="image ? 'ready' : 'fallback'">
    <img v-if="image" :src="image" alt="" draggable="false" />
    <CrimsonBookObject v-else :book="book" variant="mini" />
  </span>
</template>
