/**
 * 渲染层桌面端自动更新状态订阅与动作分发（插件构建下 bridge 恒为 null，完全静默）。
 * 用 observed 修订号避免初始拉取与实时推送事件乱序覆盖。
 */
import { onBeforeUnmount, onMounted, readonly, shallowRef } from 'vue'

export const DESKTOP_REPOSITORY = 'https://github.com/linque0/novel'
const state = shallowRef(null)
const bridge = __NS_PLUGIN__ ? null : window.native?.updates
let unsubscribe
let observed = 0
let users = 0

export function useDesktopUpdates() {
  onMounted(() => {
    if (!bridge || users++ > 0) return
    unsubscribe = bridge.onState(next => { observed++; state.value = next })
    const revision = observed
    bridge.state().then(next => { if (next && revision === observed) state.value = next })
      .catch(error => console.warn('[update]', error))
  })
  onBeforeUnmount(() => {
    if (bridge && --users === 0) {
      unsubscribe?.()
      unsubscribe = undefined
    }
  })
  return readonly(state)
}

export async function updateAction(action, arg) {
  if (!bridge) return
  const revision = observed
  try {
    const next = await bridge[action](arg)
    if (next && revision === observed) state.value = next
  } catch (error) {
    console.warn('[update]', error)
    if (state.value) state.value = { ...state.value, error: '无法完成更新操作，请重试。' }
  }
}

export function openUpdateLink(event, kind) {
  if (!bridge) return
  event.preventDefault()
  updateAction('open', kind)
}
