import { computed } from 'vue'
import { useUiStore } from '../stores/ui'

export function useOriginalAppearance() {
  const ui=useUiStore()
  const type=new URLSearchParams(location.search).get('panel')?.split(':')[0]
  const originalActive=computed(()=>ui.skin==='original' && (type ? ['settings','chapter','outline','characters','lore','snippets'].includes(type) : ui.workbenchMode!=='agent'))
  const originalOverlayClass=computed(()=>originalActive.value?'original-overlay':undefined)
  return {originalActive,originalOverlayClass}
}
