import { defineStore } from 'pinia'
import { db } from '../db/database'

/* 正文字体：中西文分离。--editor-font = 西文栈 + 中文栈（拉丁字符落西文，汉字落中文）。
   素材：思源宋体/霞鹜文楷/京华老宋体/朝华标题/云游手书/Gothic One 均已本地化（src/assets/fonts） */
const CJK_FONTS = {
  song: { label: '思源宋体', stack: '"Noto Serif SC", "SimSun", serif' },
  kai: { label: '霞鹜文楷', stack: '"LXGW WenKai", "KaiTi", serif' },
  jinghua: { label: '京华老宋体', stack: '"KingHwa OldSong", "SimSun", serif' },
  zhaohua: { label: '朝华标题', stack: '"Zhaohua Title", "SimSun", serif' },
  yunyou: { label: '云游手书', stack: '"Ziyu Yunyou", "KaiTi", serif' },
  hei: { label: '系统黑体', stack: '"Microsoft YaHei", "PingFang SC", sans-serif' }
}
const LATIN_FONTS = {
  none: { label: '跟随中文', stack: '' },
  playfair: { label: 'Playfair Display', stack: '"Playfair Display"' },
  gothic: { label: 'Montenegrin Gothic One', stack: '"Montenegrin Gothic One"' }
}
export const FONT_MAP = CJK_FONTS
export const LATIN_MAP = LATIN_FONTS

export const useUiStore = defineStore('ui', {
  state: () => ({
    view: 'shelf', // shelf | work
    theme: 'xuan', // xuan 宣纸 | parchment 羊皮纸 | night 暗夜书房
    editorFont: 'song', // 中文正文（CJK_FONTS key）
    editorLatin: 'none', // 西文正文（LATIN_FONTS key）
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
      const latin = (LATIN_FONTS[state.editorLatin] || LATIN_FONTS.none).stack
      const cjk = (CJK_FONTS[state.editorFont] || CJK_FONTS.song).stack
      return {
        '--editor-font': [latin, cjk].filter(Boolean).join(', '),
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
        if (map.editorLatin) this.editorLatin = map.editorLatin
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
