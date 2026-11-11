import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { originalPaneMode } from '../services/original-workspace.mjs'

export function useOriginalPanes(enabled,root,sideWidth) {
  const width=ref(typeof innerWidth==='number'?innerWidth:1440),drawer=ref('')
  const mode=computed(()=>originalPaneMode(width.value,sideWidth.value))
  const modal=computed(()=>enabled.value&&!!drawer.value&&mode.value[drawer.value])
  let observer,returnFocus
  function close(restore=true){drawer.value='';if(restore)nextTick(()=>returnFocus?.isConnected&&returnFocus.focus({preventScroll:true}))}
  async function toggle(name,event){if(drawer.value===name)return close();returnFocus=event?.currentTarget||document.activeElement;drawer.value=name;await nextTick();const pane=root.value?.querySelector(`[data-ow-pane="${name}"]`);(pane?.querySelector('button:not(:disabled),input,[tabindex="0"]')||pane)?.focus({preventScroll:true})}
  function keydown(event){
    if(!modal.value||event.defaultPrevented)return
    const pane=root.value?.querySelector(`[data-ow-pane="${drawer.value}"]`)
    const nested=[...document.querySelectorAll('.n-modal,.n-popover,.n-dropdown-menu')].some(el=>el.getClientRects().length&&!pane?.contains(el)&&(el.matches('.n-modal,[aria-modal="true"]')||el.contains(document.activeElement)))
    if(nested)return
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return}
    if(event.key!=='Tab')return
    const items=[...(pane?.querySelectorAll('button,input,select,textarea,[tabindex],[contenteditable="true"]')||[])].filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length)
    if(!items.length){event.preventDefault();return}
    if(event.shiftKey&&(document.activeElement===items[0]||!pane.contains(document.activeElement))){event.preventDefault();items.at(-1).focus()}
    else if(!event.shiftKey&&(document.activeElement===items.at(-1)||!pane.contains(document.activeElement))){event.preventDefault();items[0].focus()}
  }
  watch([enabled,mode],()=>{if(!enabled.value||drawer.value&&!mode.value[drawer.value])close(false)})
  onMounted(()=>{observer=new ResizeObserver(([entry])=>width.value=entry.contentRect.width);if(root.value)observer.observe(root.value);window.addEventListener('keydown',keydown)})
  onBeforeUnmount(()=>{observer?.disconnect();window.removeEventListener('keydown',keydown)})
  return {mode,drawer,modal,close,toggle}
}
