import { defineStore } from 'pinia'
import { db } from '../db/database'
import { broadcastAppEvent } from '../services/appbus'
import { normalizeSkin, isStudioSkin } from '../skins/registry'

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
    skin: 'original',
    editorFont: 'song', // 中文正文（CJK_FONTS key）
    editorLatin: 'none', // 西文正文（LATIN_FONTS key）
    fontSize: 17,
    sideWidth: 252, // 侧栏宽度（180–480，右缘拖拽调节，appconfig 记忆）
    focusMode: false,
    readMode: false, // 正文阅读模式（巨排章号 + 限宽只读列；session 级，开书复位）
    dbError: false,
    loreFocusId: null,
    mubuSelectedId: null,
    mubuSyncTick: 0,
    mubuQuery: '', // 设定检索词（侧栏搜索框 ↔ 标签卡片点击联动；session 级）
    mubuTagPanel: null, // 设定标签面板 { nodeId, x, y } | null（全局单例；App 主窗口与 PanelHost 各挂一份）
    loreRelationPanel: null, // 关联关系设置面板 { kind:'mubu'|'character', id, x, y } | null（全局单例，同上）
    loreDetailId: null, // 设定详情页当前节点 id（全屏页；null = 未打开）
    autosave: { pending: 0, saving: false, lastSavedAt: 0 },
    searchOpen: false,
    statsOpen: false,
    trashOpen: false,
    importOpen: false,
    exportOpen: false,
    helpOpen: false,
    aiDrawerOpen: false, // 恍然梦右侧停靠列开合（点击左栏「恍然梦」）
    aiDrawerWidth: 400, // 恍然梦停靠列宽度（300–640，左缘拖拽调节，appconfig 记忆）
    rightPanelOpen: true, // 正文右侧批注栏开合（面板内收起 / 右缘展开轨恢复，appconfig 记忆）
    revisionsCtx: null
  }),
  getters: {
    isStudioSkin: (state) => isStudioSkin(state.skin),
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
        this.skin = normalizeSkin(map.skin)
        if (map.theme) this.theme = map.theme
        if (map.editorFont) this.editorFont = map.editorFont
        if (map.editorLatin) this.editorLatin = map.editorLatin
        if (map.fontSize) this.fontSize = Number(map.fontSize) || 17
        if (map.sideWidth) this.sideWidth = Math.min(480, Math.max(180, Number(map.sideWidth) || 252))
        if (map.aiDrawerWidth) this.aiDrawerWidth = Math.min(640, Math.max(300, Number(map.aiDrawerWidth) || 400))
        if (map.rightPanelOpen !== undefined) this.rightPanelOpen = !!map.rightPanelOpen
      } catch {
        /* 首次启动无配置 */
      }
    },
    async setSkin(value) {
      const skin = normalizeSkin(value)
      // Commit before displaying: a failed write leaves the current skin and theme intact.
      await db.appconfig.put({ key: 'skin', value: skin })
      this.skin = skin
      broadcastAppEvent('prefs-changed')
    },
    async setPref(key, value) {
      if (key === 'skin') return this.setSkin(value)
      this[key] = value
      await db.appconfig.put({ key, value })
      /* 跨窗口同步：其余窗口重载偏好（主题/字体等即时生效；处理端幂等，自身收到无副作用） */
      broadcastAppEvent('prefs-changed')
    }
  }
})
