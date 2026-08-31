<!-- 双链悬浮预览窗：全局委托监听——悬停双链标签（富文本 span）或纯文本令牌时，在旁展示目标内容并可跳转 -->
<script setup>
import { reactive, ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { parseTarget, targetById, findByTitle, previewFor, jumpTo, KIND_LABEL, tokenAtPoint } from '../services/doublelinks'

const pop = ref(null)
const st = reactive({ show: false, x: 0, y: 0, view: null, target: null })
let curEl = null // 当前悬停的 .dl-link 元素
let curHost = null // 当前悬停的 textarea
let tokenCache = { host: null, token: null }
let hideTimer = null // 离开双链的宽限期：给鼠标移入浮窗的时间

function place() {
  const el = pop.value
  if (!el) return
  const w = el.offsetWidth
  const h = el.offsetHeight
  let x = st.x + 14
  let y = st.y + 18
  if (x + w > window.innerWidth - 8) x = Math.max(8, st.x - w - 14)
  if (y + h > window.innerHeight - 8) y = Math.max(8, st.y - h - 12)
  st.x = x
  st.y = y
}

function showFor(view, target, x, y) {
  st.view = view
  st.target = target
  st.x = x
  st.y = y
  st.show = true
  nextTick(place)
}

function missingView(title, kind) {
  return { kindLabel: KIND_LABEL[kind] || '双链', title: title || '（未知目标）', meta: '目标不存在', body: '未找到双链指向的内容——目标可能已被删除或重命名。' }
}

function resolveByEl(el) {
  const parsed = parseTarget(el.getAttribute('data-dl-target'))
  const resolved = parsed ? targetById(parsed.kind, parsed.id) : null
  const title = el.getAttribute('data-dl-title') || resolved?.title || ''
  if (resolved) return { view: previewFor(resolved) || missingView(title, parsed.kind), target: resolved }
  const byTitle = findByTitle(title)
  return byTitle ? { view: previewFor(byTitle), target: byTitle } : { view: missingView(title, parsed?.kind), target: null }
}

function cancelHide() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function hide() {
  cancelHide()
  st.show = false
  curEl = null
  curHost = null
  tokenCache = { host: null, token: null }
}

/** 离开双链：延迟消失，鼠标在此期间移入浮窗则保持显示 */
function delayHide() {
  cancelHide()
  hideTimer = setTimeout(() => {
    hideTimer = null
    st.show = false
    curEl = null
    curHost = null
    tokenCache = { host: null, token: null }
  }, 260)
}

function onMouseMove(e) {
  if (e.target?.closest?.('.dl-pop')) {
    cancelHide() // 鼠标移入浮窗：保持显示
    return
  }
  const linkEl = e.target?.closest?.('.dl-link')
  if (linkEl) {
    cancelHide()
    if (linkEl === curEl && st.show) return
    curEl = linkEl
    curHost = null
    const r = resolveByEl(linkEl)
    showFor(r.view, r.target, e.clientX, e.clientY)
    return
  }
  const taEl = e.target?.closest?.('textarea, [data-dl-token]')
  if (taEl) {
    const host = taEl.tagName === 'TEXTAREA' ? taEl : taEl.querySelector?.('textarea')
    if (host) {
      const hit = tokenAtPoint(host, e.clientX, e.clientY)
      if (hit) {
        cancelHide()
        if (curHost === host && st.show && tokenCache.token === hit.title + '|' + hit.display) return
        curEl = null
        curHost = host
        tokenCache = { host, token: hit.title + '|' + hit.display }
        const resolved = findByTitle(hit.title)
        showFor(
          resolved ? previewFor(resolved) || missingView(hit.title, resolved.kind) : missingView(hit.title),
          resolved,
          e.clientX,
          e.clientY
        )
        return
      }
    }
  }
  if (st.show) delayHide()
}

function onJump() {
  if (st.target) jumpTo(st.target)
  hide()
}

function onWinMouseDown(e) {
  if (st.show && !e.target?.closest?.('.dl-pop')) hide()
}
function onWinScroll(e) {
  if (st.show && !e.target?.closest?.('.dl-pop')) hide()
}
function onWinKey(e) {
  if (e.key === 'Escape' && st.show) hide()
}

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mousedown', onWinMouseDown, true)
  window.addEventListener('scroll', onWinScroll, true)
  window.addEventListener('keydown', onWinKey)
  window.addEventListener('resize', hide)
})
onBeforeUnmount(() => {
  cancelHide()
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mousedown', onWinMouseDown, true)
  window.removeEventListener('scroll', onWinScroll, true)
  window.removeEventListener('keydown', onWinKey)
  window.removeEventListener('resize', hide)
})
</script>

<template>
  <div v-if="st.show" ref="pop" class="dl-pop" @contextmenu.prevent>
    <div class="dl-pop-head">
      <span class="dl-kind">{{ st.view.kindLabel || '双链' }}</span>
      <span class="dl-pop-title">{{ st.view.title }}</span>
      <button v-if="st.target" class="dl-pop-jump" type="button" @click="onJump">跳转 ↗</button>
    </div>
    <div v-if="st.view.meta" class="dl-pop-meta">{{ st.view.meta }}</div>
    <div class="dl-pop-body">{{ st.view.body }}</div>
  </div>
</template>
