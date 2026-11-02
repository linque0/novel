import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

// Only CSS changes a pane from a column into a drawer: its Vue node, scroll,
// form drafts and the shared editor remain mounted throughout window resizing.
export function useGlazeDrawers(enabled, root) {
  const narrow = ref(false)
  const drawer = ref('')
  let media, returnFocus
  const modalDrawer = computed(() => enabled.value && narrow.value && !!drawer.value)
  function closeDrawer(restore = true) {
    drawer.value = ''
    if (restore) nextTick(() => returnFocus?.isConnected && returnFocus.focus({ preventScroll: true }))
  }
  async function toggleDrawer(name, event) {
    if (drawer.value === name) return closeDrawer()
    returnFocus = event?.currentTarget || document.activeElement
    drawer.value = name
    await nextTick()
    root.value?.querySelector(`[data-glaze-drawer="${name}"] .glaze-drawer-close`)?.focus({ preventScroll: true })
  }
  function keydown(event) {
    if (!modalDrawer.value) return
    if (event.defaultPrevented) return
    const pane = root.value?.querySelector(`[data-glaze-drawer="${drawer.value}"]`)
    // Focus tooltips have no Escape/focus owner. Only actual modals and
    // interactive popups containing the focused control defer drawer handling.
    const nestedOverlay = [...document.querySelectorAll('.n-modal, .n-popover, .n-dropdown-menu')]
      .some(el => el.getClientRects().length && !pane?.contains(el) &&
        (el.matches('.n-modal, [aria-modal="true"]') || el.contains(document.activeElement)))
    if (nestedOverlay) return
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); closeDrawer(); return
    }
    if (event.key !== 'Tab') return
    const focusable = [...(pane?.querySelectorAll('button, input, select, textarea, [tabindex], [contenteditable="true"]') || [])]
      .filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length)
    if (!focusable.length) { event.preventDefault(); return }
    const first = focusable[0], last = focusable.at(-1)
    if (event.shiftKey && (document.activeElement === first || !pane.contains(document.activeElement))) {
      event.preventDefault(); last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || !pane.contains(document.activeElement))) {
      event.preventDefault(); first.focus()
    }
  }
  onMounted(() => {
    media = window.matchMedia('(max-width: 1180px)')
    narrow.value = media.matches
    media.addEventListener('change', resize)
    window.addEventListener('keydown', keydown)
  })
  function resize(event) { narrow.value = event.matches; if (!event.matches) closeDrawer(false) }
  watch(enabled, active => { if (!active) closeDrawer(false) })
  onBeforeUnmount(() => { media?.removeEventListener('change', resize); window.removeEventListener('keydown', keydown) })
  return { narrow, drawer, modalDrawer, closeDrawer, toggleDrawer }
}
