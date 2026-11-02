import { computed } from 'vue'
import { useUiStore } from '../stores/ui'

// Ownership follows the visible writing surface; Dream and its detached windows
// deliberately keep their own existing palette even when the selected skin is glaze.
export function useGlazeMuseum() {
  const ui = useUiStore()
  const panelType = new URLSearchParams(location.search).get('panel')?.split(':')[0]
  const museumActive = computed(() => ui.skin === 'glaze' && (panelType
    ? ['settings', 'chapter', 'outline', 'characters', 'lore', 'snippets'].includes(panelType)
    : ui.view === 'shelf' || ui.workbenchMode !== 'agent'))
  const museumPopoverClass = computed(() => museumActive.value ? 'glaze-museum-popover' : undefined)
  const museumLight = computed(() => museumActive.value ? ui.glazeLighting : undefined)
  return { museumActive, museumPopoverClass, museumLight }
}
