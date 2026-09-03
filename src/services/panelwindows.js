/* 功能面板拆窗服务（9.2-W5，渲染层侧）：
 * - popOut(type, entity)：经主进程打开（或聚焦）面板窗口，panel:open 内含锁仲裁
 * - 锁状态跟踪：监听 panel:event 广播，isPopped(type, entityId) 判定某实体当前是否已拆出
 *   （主窗口据此显示只读占位提示，避免双窗口同时编辑同一实体）
 */
import { ref } from 'vue'

const popped = ref(new Map()) // key(type:workId:entityId|*) -> true
let listening = false

function ensureListen() {
  if (listening || !window.native?.panelOnEvent) return
  listening = true
  window.native.panelOnEvent((ev) => {
    if (ev.kind === 'opened') popped.value.set(ev.key, true)
    if (ev.kind === 'closed') popped.value.delete(ev.key)
    popped.value = new Map(popped.value)
  })
  window.native.panelList?.().then((r) => {
    const m = new Map()
    for (const k of r?.locks || []) m.set(k, true)
    popped.value = m
  })
}

function keyOf(workId, type, entityId) {
  return `${workId}:${type}:${entityId || '*'}`
}

export function usePanels() {
  ensureListen()
  return { popped }
}

export function isPopped(work, type, entityId) {
  if (!work?.work) return false
  ensureListen()
  const m = popped.value
  if (m.has(keyOf(work.work.id, type, entityId))) return true
  // 模块级面板（entityId 为空）覆盖该模块全部实体
  for (const k of m.keys()) {
    if (k === `${work.work.id}:${type}:*`) return true
  }
  return false
}

/** 拆出功能面板。成功且为新建时返回 true；已存在时主进程会聚焦并返回 focused */
export async function popOut(work, type, entityId, title) {
  if (!window.native?.panelOpen) {
    console.warn('[panels] 当前环境不支持面板窗口（web 版请直接使用主窗口）')
    return false
  }
  if (!work?.work) return false
  ensureListen()
  const r = await window.native.panelOpen({
    type,
    workId: work.work.id,
    entityId: entityId || '',
    title: title || undefined
  })
  if (r?.ok) {
    popped.value.set(keyOf(work.work.id, type, entityId), true)
    return true
  }
  return false
}

/** 聚焦已拆出的面板窗口（主窗口只读占位上的「前往窗口」按钮） */
export function focusPopped(work, type, entityId) {
  if (!work?.work || !window.native?.panelFocus) return
  window.native.panelFocus(keyOf(work.work.id, type, entityId))
}
