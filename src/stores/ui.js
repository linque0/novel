import { defineStore } from 'pinia'
import { db } from '../db/database'

const FONT_MAP = {
  song: '"Noto Serif SC", "SimSun", "宋体", serif',
  kai: '"KaiTi", "楷体", "STKaiti", serif',
  hei: '"Microsoft YaHei", "PingFang SC", sans-serif'
}

export const useUiStore = defineStore('ui', {
  state: () => ({
    view: 'shelf', // shelf | work
    theme: 'xuan', // xuan 宣纸 | parchment 羊皮纸 | night 暗夜书房
    editorFont: 'song',
    fontSize: 17,
    sideWidth: 252, // 侧栏宽度（180–480，右缘拖拽调节，appconfig 记忆）
    focusMode: false,
    dbError: false,
    loreFocusId: null,
    mubuSelectedId: null,
    mubuSyncTick: 0,
    autosave: { pending: 0, saving: false, lastSavedAt: 0 },
    searchOpen: false,
    statsOpen: false,
    trashOpen: false,
    importOpen: false,
    exportOpen: false,
    helpOpen: false,
    revisionsCtx: null
  }),
  getters: {
    rootStyle(state) {
      return {
        '--editor-font': FONT_MAP[state.editorFont] || FONT_MAP.song,
        '--editor-fs': state.fontSize + 'px'
      }
    }
  },
  actions: {
    async loadPrefs() {
      try {
        const rows = await db.appconfig.toArray()
        const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
        if (map.theme) this.theme = map.theme
        if (map.editorFont) this.editorFont = map.editorFont
        if (map.fontSize) this.fontSize = Number(map.fontSize) || 17
        if (map.sideWidth) this.sideWidth = Math.min(480, Math.max(180, Number(map.sideWidth) || 252))
      } catch {
        /* 首次启动无配置 */
      }
    },
    async setPref(key, value) {
      this[key] = value
      await db.appconfig.put({ key, value })
    }
  }
})
