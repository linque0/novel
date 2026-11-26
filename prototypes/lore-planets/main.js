import { createApp, h, ref, shallowRef } from 'vue'
import LorePlanetNetwork from '../../src/components/skins/latent/lore/planets/LorePlanetNetwork.vue'
import { sets, nodes, links, satellites } from './sample.js'
import { parseLoreMarkdown } from './markdown.js'
import './preview.css'

const sampleKey = 'novel-studio:lore-planets:prototype:1'
const sample = { sets, nodes, links, satellites, workTitle: '星尘旅人' }

function loadMap(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}')
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) return saved
  } catch { /* A blocked or damaged store starts with the automatic layout. */ }
  return {}
}

function saveMap(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch { return false }
}

function preview(data, key) {
  const spacingKey = key + ':spacing'
  const orbitKey = key + ':orbits'
  return {
    key, ...data,
    initialPositions: loadMap(key),
    initialSpacing: loadMap(spacingKey),
    initialOrbitSettings: loadMap(orbitKey),
    onLayoutChange: layout => saveMap(key, layout),
    onSpacingChange: spacing => saveMap(spacingKey, spacing),
    onOrbitSettingsChange: settings => saveMap(orbitKey, settings)
  }
}

createApp({
  setup() {
    const active = shallowRef(preview(sample, sampleKey))
    const input = ref()
    const error = ref('')
    const fileName = ref('')
    let importRequest = 0

    async function openMarkdown(event) {
      const file = event.target.files[0]
      event.target.value = ''
      if (!file) return
      const request = ++importRequest
      error.value = ''
      try {
        const bytes = await file.arrayBuffer()
        const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
        const data = parseLoreMarkdown(source, file.name.replace(/\.[^.]+$/, ''))
        const digest = await crypto.subtle.digest('SHA-256', bytes)
        if (request !== importRequest) return
        const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
        const key = 'novel-studio:lore-planets:markdown:1:' + hash
        if (active.value.key !== key) active.value = preview(data, key)
        fileName.value = file.name
      } catch (reason) {
        if (request !== importRequest) return
        error.value = reason instanceof TypeError ? '读取失败，请选择 UTF-8 编码的 Markdown 文件。'
          : reason.message || '无法打开这份 Markdown 文件。'
      }
    }

    function restoreSample() {
      importRequest++
      active.value = preview(sample, sampleKey)
      fileName.value = error.value = ''
    }

    return () => {
      const { key } = active.value
      return h(LorePlanetNetwork, active.value, {
        'header-actions': () => h('div', { class: 'lpn-import' }, [
          h('input', { ref: input, type: 'file', accept: '.md,.markdown,text/markdown', hidden: true, onChange: openMarkdown }),
          h('button', { type: 'button', class: 'lpn-pill', onClick: () => input.value.click() }, '打开 Markdown'),
          key !== sampleKey && h('button', { type: 'button', class: 'lpn-pill', onClick: restoreSample }, '返回示例')
        ]),
        'source-status': () => error.value || fileName.value
          ? h('p', { class: 'lpn-source-status', role: error.value ? 'alert' : 'status' }, error.value || fileName.value)
          : null
      })
    }
  }
}).mount('#app')
