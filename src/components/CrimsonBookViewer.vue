<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import CrimsonBookObject from './CrimsonBookObject.vue'
import { BookInteraction } from '../services/book3d/interaction'

const props = defineProps({ book: { type: Object, required: true }, disabled: Boolean })
const emit = defineEmits(['open'])
const display = ref(null), canvas = ref(null), state = ref('loading'), poster = ref('')
let engine, api, observer, intersection, frame = 0, previousTime = 0, alive = false, visible = false, generation = 0, initializing = false, dirty = false
const lifetime = new AbortController()
const reduced = matchMedia('(prefers-reduced-motion: reduce)')
const input = new BookInteraction({ onOpen: () => emit('open'), onChange: invalidate, isDisabled: () => props.disabled, isReduced: () => reduced.matches })
function invalidate() {
  if (!alive || frame || !visible || document.hidden || !engine) return
  frame = requestAnimationFrame(draw)
}
function draw(time) {
  frame = 0
  if (!engine || !alive || document.hidden || !visible) return
  const moving = input.tick(Math.min(32, previousTime ? time - previousTime : 16))
  previousTime = time
  try { engine.render(input.rotation, input.zoom) }
  catch { fallback(); return }
  display.value.dataset.rotation = input.rotation.map(n => n.toFixed(5)).join(',')
  display.value.dataset.zoom = input.zoom.toFixed(3)
  if (moving) invalidate()
  else previousTime = 0
}
function resize() {
  if (!engine || !display.value) return
  engine.resize(display.value.clientWidth, display.value.clientHeight)
  invalidate()
}
function pointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  display.value.focus({ preventScroll: true })
  if (state.value !== 'ready') return
  const r = display.value.getBoundingClientRect()
  if (input.down(event.pointerId, event.clientX - r.left, event.clientY - r.top, r.width, r.height)) display.value.setPointerCapture(event.pointerId)
}
function pointerMove(event) {
  const r = display.value.getBoundingClientRect()
  input.move(event.pointerId, event.clientX - r.left, event.clientY - r.top)
}
function pointerUp(event) {
  input.up(event.pointerId)
  if (display.value.hasPointerCapture(event.pointerId)) display.value.releasePointerCapture(event.pointerId)
}
function pointerCancel(event) { if (input.pointers.has(event.pointerId)) input.cancel() }
function click(event) { if (!props.disabled && (state.value !== 'ready' || event.detail === 0)) emit('open') }
function key(event) {
  if (event.repeat && ['Enter', ' '].includes(event.key)) { event.preventDefault(); return }
  if (input.key(event.key)) event.preventDefault()
}
function wheel(event) {
  if (state.value !== 'ready' || props.disabled) return
  event.preventDefault()
  input.wheel(event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? display.value.clientHeight : 1))
}
function pause() { input.cancel(); cancelAnimationFrame(frame); frame = 0; previousTime = 0 }
function resume() { if (!engine) start(); else if (dirty) updateBook(); else { resize(); invalidate() } }
function visibility() { if (document.hidden) pause(); else if (visible) resume() }
function lost(event) { event.preventDefault(); fallback() }
function fallback() {
  pause(); state.value = 'fallback'
  canvas.value?.removeEventListener('webglcontextlost', lost)
  engine?.dispose(); engine = null
}
function capturePoster(token) {
  if (document.hidden || !visible) return
  const current = engine
  current?.capture().then(url => { if (alive && token === generation && engine === current) poster.value = url || '' }).catch(() => {})
}
async function updateBook() {
  const token = ++generation
  poster.value = ''
  if (!alive || !visible || document.hidden || !engine) { dirty = true; return }
  dirty = false; state.value = 'loading'
  try {
    await engine.setBook(props.book, { rotation: input.rotation, zoom: input.zoom })
    if (!alive || token !== generation) return
    state.value = 'ready'; resize(); capturePoster(token)
  } catch { if (alive && token === generation) fallback() }
}
async function start() {
  if (!alive || !api || !visible || document.hidden || engine || initializing || state.value === 'fallback') return
  initializing = true
  const token = generation
  try {
    const next = await api.createBookViewer(canvas.value, {
      book: props.book, width: display.value.clientWidth, height: display.value.clientHeight,
      pixelRatio: devicePixelRatio || 1, rotation: input.rotation, zoom: input.zoom,
      signal: lifetime.signal, onError: () => { if (alive) fallback() }
    })
    if (!alive) { next.dispose(); return }
    engine = next
    if (token !== generation || dirty) await updateBook()
    else { state.value = 'ready'; resize(); capturePoster(token) }
  } catch { if (alive) fallback() }
  finally { initializing = false }
}
watch(() => [props.book.id, props.book.kind, props.book.title, props.book.author, props.book.intro], (next, old) => {
  if (old && next[0] !== old[0]) input.reset()
  updateBook()
})
watch(() => props.disabled, value => { if (value) pause() })
onMounted(async () => {
  alive = true
  document.addEventListener('visibilitychange', visibility)
  reduced.addEventListener('change', pause)
  observer = new ResizeObserver(resize); observer.observe(display.value)
  intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) resume(); else pause() }); intersection.observe(display.value)
  canvas.value.addEventListener('webglcontextlost', lost)
  try {
    api = await import('../services/book3d/renderer.js')
    if (!alive) return
    await start()
  } catch { if (alive) fallback() }
})
onBeforeUnmount(() => {
  alive = false; generation++; lifetime.abort(); pause(); observer?.disconnect(); intersection?.disconnect()
  document.removeEventListener('visibilitychange', visibility); reduced.removeEventListener('change', pause)
  canvas.value?.removeEventListener('webglcontextlost', lost); engine?.dispose(); engine = null
})
</script>

<template>
  <div class="crimson-book-viewer">
    <div ref="display" class="crimson-book-display" role="button" :tabindex="disabled ? -1 : 0" :aria-disabled="disabled" :data-state="state"
      :aria-label="'《' + book.title + '》立体书籍。拖动旋转，滚轮或双指缩放；方向键旋转，Home 复位，Enter 打开作品。'"
      @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerCancel" @lostpointercapture="pointerCancel"
      @click="click" @keydown="key" @wheel="wheel">
      <canvas ref="canvas" aria-hidden="true" v-show="state === 'ready'"></canvas>
      <div v-if="state !== 'ready'" class="crimson-viewer-fallback" aria-hidden="true">
        <img v-if="poster" :src="poster" alt="" />
        <CrimsonBookObject v-else :book="book" />
      </div>
    </div>
    <div class="crimson-viewer-controls">
      <span>{{ state === 'ready' ? '拖动旋转 · 滚轮/双指缩放' : '点击书籍打开作品' }}</span>
      <button v-if="state === 'ready'" type="button" :disabled="disabled" @click="input.reset()" aria-label="复位视角">↺ <span>复位视角</span></button>
    </div>
  </div>
</template>

<style src="../styles/skins/crimson-viewer.css"></style>
