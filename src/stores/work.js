import { defineStore } from 'pinia'
import { db, uid, now } from '../db/database'
import * as repo from '../db/repo'
import { autosave, installWordLogHook } from '../services/autosave'
import { countWords, stripTags } from '../services/wordcount'
import { useUiStore } from './ui'
import { useShelfStore } from './shelf'

const urlCache = new Map()

/** 设定条目检索用纯文本：幕布式大纲抽出全部节点文本 */
function loreText(l) {
  if (l.fmt !== 'outline') return l.content || ''
  try {
    const out = []
    const walk = (n) => {
      out.push(n.text || '')
      ;(n.children || []).forEach(walk)
    }
    ;(JSON.parse(l.content || '[]') || []).forEach(walk)
    return out.join('\n')
  } catch {
    return l.content || ''
  }
}

export const useWorkStore = defineStore('work', {
  state: () => ({
    loaded: false,
    work: null,
    volumes: [],
    chapters: [],
    outlines: [],
    characters: [],
    relations: [],
    lorecats: [],
    lore: [],
    snippets: [],
    assets: [],
    links: [],
    mubu: [],
    bookmarks: [],
    olnodes: [],
    outlineView: 'text', // 大纲视图：text 文本 | canvas 画布
    selOlnodeId: null,
    canvasFocusTick: 0, // 侧边栏请求画布居中定位的信号
    canvasPrefs: { snap: true, density: 'detail', edgeStyle: 'bezier', edgeWidth: 1.8, arrowSize: 1 }, // 画布偏好（appconfig 按作品隔离）
    olTypes: [], // 自定义模块类型（8.8.2-G2）：[{ name, color }]，节点以 mtype 引用
    olUndo: [],
    olRedo: [],
    olUndoAt: 0,
    charView: 'list', // 人物视图：list 列表 | graph 关系图
    charFocusId: null, // 关系图定位的人物 id
    charFocusTick: 0,
    charFocusHandled: 0, // 关系图已处理的定位信号（组件未挂载时请求不丢）
    prevCounts: new Map(),
    tab: 'chapters', // chapters | outline | characters | lore | snippets
    loreView: 'detail', // lore 视图：detail 详情 | overview 总览
    selChapterId: null,
    selCharacterId: null,
    selLoreId: null,
    selFolderId: null,
    selSnippetId: null,
    selOutlineId: null,
    selVolumeId: null,
    urlTick: 0
  }),

  getters: {
    liveVolumes: (s) => s.volumes.filter((v) => !v.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder),
    liveChapters: (s) => s.chapters.filter((c) => !c.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder),
    liveBookmarks: (s) =>
      s.bookmarks
        .filter((b) => !b.deletedAt)
        .map((b) => ({ ...b, title: s.chapters.find((c) => c.id === b.targetId && !c.deletedAt)?.title || '' }))
        .filter((b) => b.title),
    liveCharacters: (s) => s.characters.filter((c) => !c.deletedAt).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    liveLore: (s) =>
      s.lore
        .filter((l) => !l.deletedAt)
        .sort((a, b) => {
          const sa = a.sortOrder ?? 1e9
          const sb = b.sortOrder ?? 1e9
          return sa !== sb ? sa - sb : (a.title || '').localeCompare(b.title || '')
        }),
    liveCategories: (s) => s.lorecats.filter((c) => !c.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder),
    liveSnippets: (s) => s.snippets.filter((x) => !x.deletedAt).sort((a, b) => b.createdAt - a.createdAt),
    activeChapter() {
      return this.liveChapters.find((c) => c.id === this.selChapterId) || null
    },
    activeCharacter: (s) => s.characters.find((c) => c.id === s.selCharacterId && !c.deletedAt) || null,
    activeLore: (s) => s.lore.find((l) => l.id === s.selLoreId && !l.deletedAt) || null,
    activeSnippet: (s) => s.snippets.find((x) => x.id === s.selSnippetId && !x.deletedAt) || null,
    chapterCount() {
      return this.liveChapters.length
    },
    /** 断线检测（8.8.2-G3）：仅统计事件节点间连线——无出边=烂尾情节，无入边=缺铺垫 */
    olBroken() {
      const evs = this.liveOlnodes().filter((n) => n.kind === 'event')
      if (evs.length < 2) return { tails: [], missing: [] }
      const hasIn = new Set()
      const hasOut = new Set()
      for (const n of evs) {
        for (const rel of this.olnodeRelsOf(n.id)) {
          if (evs.some((e) => e.id === rel.toId)) {
            hasOut.add(n.id)
            hasIn.add(rel.toId)
          }
        }
      }
      return {
        tails: evs.filter((n) => !hasOut.has(n.id)),
        missing: evs.filter((n) => !hasIn.has(n.id))
      }
    },
    totalWords() {
      return this.liveChapters.reduce((sum, c) => sum + (c.wordCount || 0), 0)
    },
    treeData() {
      const chapterNode = (c) => ({
        key: 'c:' + c.id,
        label: c.title,
        suffix: (c.wordCount || 0) > 0 ? `${c.wordCount}字` : '',
        type: 'chapter',
        isLeaf: true
      })
      const nodes = this.liveVolumes.map((v) => ({
        key: 'v:' + v.id,
        label: v.title,
        type: 'volume',
        isLeaf: false,
        children: this.liveChapters.filter((c) => c.volumeId === v.id).map(chapterNode)
      }))
      const attached = new Set(this.liveVolumes.map((v) => v.id))
      const orphans = this.liveChapters.filter((c) => !attached.has(c.volumeId))
      if (orphans.length) {
        nodes.push({ key: 'v:orphans', label: '未分卷', type: 'volume', isLeaf: false, children: orphans.map(chapterNode) })
      }
      return nodes
    }
  },

  actions: {
    /* ---------- 打开 / 关闭 ---------- */
    async open(workId) {
      const b = await repo.loadWorkBundle(workId)
      this.work = b.work
      this.volumes = b.volumes
      this.chapters = b.chapters
      this.outlines = b.outlines
      this.characters = b.characters
      this.relations = b.relations
      this.lorecats = b.lorecats
      this.lore = b.lore
      this.snippets = b.snippets
      this.assets = b.assets
      this.links = b.links
      await this.migrateMubu(workId)
      this.mubu = await db.mubu.where('workId').equals(workId).toArray()
      this.bookmarks = await db.bookmarks.where('workId').equals(workId).toArray()
      await this.migrateOlnodes(workId)
      this.olnodes = await db.olnodes.where('workId').equals(workId).toArray()
      await this.loadCanvasPrefs()
      await this.loadOlTypes()
      this.prevCounts = new Map(this.liveChapters.map((c) => [c.id, c.wordCount || 0]))
      installWordLogHook(this.prevCounts)
      this.tab = 'chapters'
      this.selChapterId = this.liveChapters[0]?.id || null
      this.selVolumeId = this.liveVolumes[0]?.id || null
      this.loaded = true
      const ui = useUiStore()
      ui.view = 'work'
      ui.focusMode = false
    },

    async closeWork() {
      await autosave.flushAll()
      this.$reset()
      useUiStore().view = 'shelf'
      await useShelfStore().refresh()
    },

    /* ---------- 章节 / 卷 ---------- */
    async addVolume(title = '新卷') {
      const maxSort = this.liveVolumes.reduce((m, v) => Math.max(m, v.sortOrder), -1000)
      const vol = { id: uid(), workId: this.work.id, title, sortOrder: maxSort + 1000, createdAt: now(), updatedAt: now(), deletedAt: null }
      this.volumes.push(vol)
      autosave.mark('volumes', vol)
      const o = { id: uid(), workId: this.work.id, level: 'volume', refId: vol.id, content: '', createdAt: now(), updatedAt: now(), deletedAt: null }
      this.outlines.push(o)
      autosave.mark('outlines', o)
      this.selVolumeId = vol.id
      return vol
    },

    renameVolume(id, title) {
      const v = this.volumes.find((x) => x.id === id)
      if (!v) return
      v.title = title
      autosave.mark('volumes', v)
    },

    async deleteVolume(id) {
      const v = this.volumes.find((x) => x.id === id)
      if (!v) return
      for (const c of this.liveChapters.filter((c) => c.volumeId === id)) {
        await this.deleteChapter(c.id)
      }
      await repo.softDeleteRow('volumes', v)
      // 大纲节点树：同步移除对应卷节点（8.8）
      const vnode = this.olnodeByRef(id)
      if (vnode) this.olnodeRemove(vnode.id)
      if (this.selVolumeId === id) this.selVolumeId = null
    },

    async addChapter(volumeId, title = '新章节') {
      let vid = volumeId
      if (!vid) vid = this.selVolumeId || this.liveVolumes[0]?.id
      if (!vid) vid = (await this.addVolume('第一卷')).id
      if (vid === 'orphans') vid = null
      const siblings = this.liveChapters.filter((c) => c.volumeId === vid)
      const maxSort = siblings.reduce((m, c) => Math.max(m, c.sortOrder), -1000)
      const ch = {
        id: uid(),
        workId: this.work.id,
        volumeId: vid,
        title,
        content: '',
        wordCount: 0,
        status: 'draft',
        sortOrder: maxSort + 1000,
        createdAt: now(),
        updatedAt: now(),
        deletedAt: null
      }
      this.chapters.push(ch)
      autosave.mark('chapters', ch)
      this.prevCounts.set(ch.id, 0)
      const o = { id: uid(), workId: this.work.id, level: 'chapter', refId: ch.id, content: '', createdAt: now(), updatedAt: now(), deletedAt: null }
      this.outlines.push(o)
      autosave.mark('outlines', o)
      this.tab = 'chapters'
      this.selChapterId = ch.id
      this.selVolumeId = vid
      return ch
    },

    renameChapter(id, title) {
      const c = this.chapters.find((x) => x.id === id)
      if (!c) return
      c.title = title
      autosave.mark('chapters', c)
    },

    setChapterStatus(id, status) {
      const c = this.chapters.find((x) => x.id === id)
      if (!c) return
      c.status = status
      autosave.mark('chapters', c)
    },

    setChapterContent(id, content, fmt) {
      const c = this.chapters.find((x) => x.id === id)
      if (!c) return
      c.content = content
      if (fmt) c.fmt = fmt
      c.wordCount = countWords(c.fmt === 'html' ? stripTags(content) : content)
      autosave.mark('chapters', c)
    },

    moveChapter(id, dir) {
      const c = this.chapters.find((x) => x.id === id)
      if (!c) return
      const sibs = this.liveChapters.filter((x) => x.volumeId === c.volumeId)
      const idx = sibs.findIndex((x) => x.id === id)
      const swapIdx = idx + dir
      if (swapIdx < 0 || swapIdx >= sibs.length) return
      const other = sibs[swapIdx]
      const tmp = c.sortOrder
      c.sortOrder = other.sortOrder
      other.sortOrder = tmp
      autosave.mark('chapters', c)
      autosave.mark('chapters', other)
    },

    async moveChapterTo(id, targetVolumeId, mode, refChapterId = null) {
      const c = this.chapters.find((x) => x.id === id)
      if (!c) return
      const oldVol = c.volumeId
      const volId = targetVolumeId === 'orphans' ? null : targetVolumeId
      c.volumeId = volId
      const sibs = () => this.chapters.filter((x) => x.volumeId === volId && !x.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder)
      if (mode === 'inside' || !refChapterId) {
        const list = sibs().filter((x) => x.id !== id)
        const maxSort = list.reduce((m, x) => Math.max(m, x.sortOrder), -1000)
        c.sortOrder = maxSort + 1000
      } else {
        const ref = this.chapters.find((x) => x.id === refChapterId)
        if (ref) {
          const list = sibs().filter((x) => x.id !== id)
          const refIdx = list.findIndex((x) => x.id === refChapterId)
          const before = mode === 'before' ? refIdx : refIdx + 1
          // 先放到目标位置附近，再整体重排
          c.sortOrder = ref.sortOrder + (mode === 'before' ? -500 : 500)
          void before
        }
      }
      autosave.mark('chapters', c)
      this.reindexVolume(volId)
      if (oldVol && oldVol !== volId) this.reindexVolume(oldVol)
    },

    reindexVolume(vid) {
      const sibs = this.chapters.filter((x) => x.volumeId === vid && !x.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder)
      sibs.forEach((c, i) => {
        const target = i * 1000
        if (c.sortOrder !== target) {
          c.sortOrder = target
          autosave.mark('chapters', c)
        }
      })
    },

    async deleteChapter(id) {
      const c = this.chapters.find((x) => x.id === id)
      if (!c) return
      await repo.softDeleteRow('chapters', c)
      // 大纲节点树：同步移除对应章节点（8.8）
      const node = this.olnodeByRef(id)
      if (node) this.olnodeRemove(node.id)
      if (this.selChapterId === id) {
        const rest = this.liveChapters
        const idx = rest.findIndex((x) => x.id === id)
        const next = rest[Math.max(0, idx - 1)] || rest[0] || null
        this.selChapterId = next ? next.id : null
      }
    },

    /* ---------- 大纲 ---------- */
    outlineFor(refId) {
      return this.outlines.find((o) => o.refId === refId) || null
    },

    updateOutline(id, content) {
      const o = this.outlines.find((x) => x.id === id)
      if (!o) return
      o.content = content
      autosave.mark('outlines', o)
    },

    ensureOutline(refId) {
      let o = this.outlines.find((x) => x.refId === refId)
      if (o) return o
      const isMaster = this.work && refId === this.work.id
      const isVol = this.volumes.some((v) => v.id === refId)
      o = {
        id: uid(),
        workId: this.work.id,
        level: isMaster ? 'master' : isVol ? 'volume' : 'chapter',
        refId,
        content: '',
        createdAt: now(),
        updatedAt: now(),
        deletedAt: null
      }
      this.outlines.push(o)
      autosave.mark('outlines', o)
      return o
    },

    masterOutline() {
      return this.outlines.find((o) => o.level === 'master') || null
    },

    /* ---------- 人物 ---------- */
    /** 新建人物：内容全部留空待用户填写（name 空时列表/画布显示「未命名」兜底） */
    addCharacter(name = '') {
      const row = {
        id: uid(),
        workId: this.work.id,
        name,
        aliases: '',
        role: '配角',
        tags: [],
        fields: {},
        avatarAssetId: null,
        content: '',
        createdAt: now(),
        updatedAt: now(),
        deletedAt: null
      }
      this.characters.push(row)
      autosave.mark('characters', row)
      this.tab = 'characters'
      this.selCharacterId = row.id
      return row
    },

    updateCharacter(id, patch) {
      const c = this.characters.find((x) => x.id === id)
      if (!c) return
      Object.assign(c, patch)
      autosave.mark('characters', c)
    },

    async deleteCharacter(id) {
      const c = this.characters.find((x) => x.id === id)
      if (!c) return
      await repo.softDeleteRow('characters', c)
      const rels = this.relations.filter((r) => r.fromId === id || r.toId === id)
      for (const r of rels) {
        await db.relations.delete(r.id)
        this.relations = this.relations.filter((x) => x.id !== r.id)
      }
      // 关系图布局清理（8.8.3）
      const layout = await this.loadCharGraph()
      if (layout && layout[id] !== undefined) {
        delete layout[id]
        await this.saveCharGraph(layout)
      }
      if (this.selCharacterId === id) this.selCharacterId = null
    },

    /** 新建人物关系：label 关系名；color 线色（空=主题色）；style 线型 dashed/dotted/'' 实线 */
    addRelation(fromId, toId, label, extra = {}) {
      const row = { id: uid(), workId: this.work.id, fromId, toId, label, color: '', style: '', ...extra }
      this.relations.push(row)
      autosave.mark('relations', row)
    },

    updateRelation(id, patch) {
      const r = this.relations.find((x) => x.id === id)
      if (!r) return
      Object.assign(r, patch)
      autosave.mark('relations', r)
    },

    async removeRelation(id) {
      await db.relations.delete(id)
      this.relations = this.relations.filter((r) => r.id !== id)
    },

    /* ---------- 设定（文件夹式分类 + 条目） ---------- */
    addCategory(name = '新分类', parentId = null) {
      const siblings = this.liveCategories.filter((c) => (c.parentId || null) === (parentId || null))
      const maxSort = siblings.reduce((m, c) => Math.max(m, c.sortOrder || 0), -1)
      const row = { id: uid(), workId: this.work.id, name, parentId: parentId || null, sortOrder: maxSort + 1, deletedAt: null }
      this.lorecats.push(row)
      autosave.mark('lorecats', row)
      return row
    },

    updateLorecat(id, patch) {
      const c = this.lorecats.find((x) => x.id === id)
      if (!c) return
      Object.assign(c, typeof patch === 'string' ? { name: patch } : patch)
      autosave.mark('lorecats', c)
    },

    /** 分类子树内所有分类 id（含自身），用于防循环与级联 */
    categorySubtreeIds(id) {
      const ids = [id]
      let grew = true
      while (grew) {
        grew = false
        for (const c of this.liveCategories) {
          if (ids.includes(c.parentId) && !ids.includes(c.id)) {
            ids.push(c.id)
            grew = true
          }
        }
      }
      return ids
    },

    /** 删除文件夹：子文件夹与条目上提到其父级（数据不丢失），文件夹本身软删除 */
    async deleteCategory(id) {
      const c = this.lorecats.find((x) => x.id === id)
      if (!c) return
      const parent = c.parentId || null
      for (const sub of this.liveCategories.filter((x) => x.parentId === id)) {
        sub.parentId = parent
        autosave.mark('lorecats', sub)
      }
      for (const e of this.liveLore.filter((x) => x.categoryId === id)) {
        e.categoryId = parent
        autosave.mark('lore', e)
      }
      await repo.softDeleteRow('lorecats', c)
    },

    moveCategoryTo(id, newParentId) {
      const c = this.lorecats.find((x) => x.id === id)
      if (!c) return
      const target = newParentId || null
      if ((c.parentId || null) === target) return
      if (target && this.categorySubtreeIds(id).includes(target)) return // 不能移入自己的子级
      c.parentId = target
      autosave.mark('lorecats', c)
    },

    moveLoreTo(loreId, categoryId) {
      const l = this.lore.find((x) => x.id === loreId)
      if (!l) return
      l.categoryId = categoryId || null
      autosave.mark('lore', l)
    },

    /** 文件夹树：分类嵌套 + 各文件夹内条目；孤儿条目归入「未分类」 */
    categoryTreeData() {
      const entryNode = (l) => ({ key: 'l:' + l.id, label: l.title || '未命名条目', type: 'entry', isLeaf: true })
      const catNode = (c) => ({
        key: 'c:' + c.id,
        label: c.name,
        type: 'folder',
        isLeaf: false,
        children: [
          ...this.liveCategories.filter((x) => x.parentId === c.id).map(catNode),
          ...this.liveLore.filter((l) => l.categoryId === c.id).map(entryNode)
        ]
      })
      const roots = this.liveCategories.filter((c) => !c.parentId || !this.liveCategories.some((p) => p.id === c.parentId)).map(catNode)
      const known = new Set(this.liveCategories.map((c) => c.id))
      const orphans = this.liveLore.filter((l) => !l.categoryId || !known.has(l.categoryId))
      if (orphans.length) {
        roots.push({ key: 'c:none', label: '未分类', type: 'folder', isLeaf: false, pseudo: true, children: orphans.map(entryNode) })
      }
      return roots
    },

    /** 同文件夹内条目排序（overview 拖拽/移动用） */
    reorderLore(entryId, dir) {
      const l = this.lore.find((x) => x.id === entryId)
      if (!l) return
      const siblings = this.liveLore.filter((x) => (x.categoryId || null) === (l.categoryId || null))
      const i = siblings.findIndex((x) => x.id === entryId)
      const j = i + dir
      if (j < 0 || j >= siblings.length) return
      siblings.forEach((x, idx) => {
        if (x.sortOrder == null) x.sortOrder = idx * 1000
      })
      const tmp = siblings[i].sortOrder
      siblings[i].sortOrder = siblings[j].sortOrder
      siblings[j].sortOrder = tmp
      autosave.mark('lore', siblings[i])
      autosave.mark('lore', siblings[j])
    },

    /** 更新设定条目内单个大纲节点的文本（总览视图编辑） */
    updateOutlineNodeText(loreId, nid, text) {
      const l = this.lore.find((x) => x.id === loreId)
      if (!l || l.fmt !== 'outline') return
      try {
        const t = JSON.parse(l.content || '[]')
        const walk = (list) => {
          for (const n of list) {
            if (n.id === nid) {
              n.text = text
              return true
            }
            if (walk(n.children)) return true
          }
          return false
        }
        if (walk(t)) this.updateLore(loreId, { content: JSON.stringify(t) })
      } catch {
        /* 内容损坏时忽略 */
      }
    },

    /** 删除设定条目内单个大纲节点 */
    removeOutlineNode(loreId, nid) {
      const l = this.lore.find((x) => x.id === loreId)
      if (!l || l.fmt !== 'outline') return
      try {
        const t = JSON.parse(l.content || '[]')
        const walk = (list) => {
          const i = list.findIndex((n) => n.id === nid)
          if (i >= 0) {
            list.splice(i, 1)
            return true
          }
          return list.some((n) => walk(n.children))
        }
        if (walk(t)) this.updateLore(loreId, { content: JSON.stringify(t) })
      } catch {
        /* ignore */
      }
    },

    /** 在设定条目大纲中某节点后插入新节点（返回新节点 id） */
    insertOutlineNodeAfter(loreId, nid, text = '') {
      const l = this.lore.find((x) => x.id === loreId)
      if (!l || l.fmt !== 'outline') return null
      const fresh = { id: uid(), text, fold: false, children: [] }
      try {
        const t = JSON.parse(l.content || '[]')
        const walk = (list) => {
          const i = list.findIndex((n) => n.id === nid)
          if (i >= 0) {
            list.splice(i + 1, 0, fresh)
            return true
          }
          return list.some((n) => walk(n.children))
        }
        if (walk(t)) {
          this.updateLore(loreId, { content: JSON.stringify(t) })
          return fresh.id
        }
      } catch {
        /* ignore */
      }
      return null
    },

    /** 移动设定大纲节点到目标节点前/后（总览视图拖拽/排序） */
    moveOutlineNodeTo(loreId, nid, targetNid, after = false) {
      const l = this.lore.find((x) => x.id === loreId)
      if (!l || l.fmt !== 'outline' || nid === targetNid) return
      try {
        const t = JSON.parse(l.content || '[]')
        let moved = null
        const remove = (list) => {
          const i = list.findIndex((n) => n.id === nid)
          if (i >= 0) {
            moved = list.splice(i, 1)[0]
            return true
          }
          return list.some((n) => remove(n.children))
        }
        if (!remove(t)) return
        const insert = (list) => {
          const i = list.findIndex((n) => n.id === targetNid)
          if (i >= 0) {
            list.splice(after ? i + 1 : i, 0, moved)
            return true
          }
          return list.some((n) => insert(n.children))
        }
        if (insert(t)) this.updateLore(loreId, { content: JSON.stringify(t) })
      } catch {
        /* ignore */
      }
    },

    /** 同列表内交换两个大纲节点的顺序（Alt+↑↓） */
    moveOutlineNode(loreId, nid, dir) {
      const l = this.lore.find((x) => x.id === loreId)
      if (!l || l.fmt !== 'outline') return
      try {
        const t = JSON.parse(l.content || '[]')
        const walk = (list) => {
          const i = list.findIndex((n) => n.id === nid)
          if (i >= 0) {
            const j = i + dir
            if (j < 0 || j >= list.length) return true
            ;[list[i], list[j]] = [list[j], list[i]]
            return true
          }
          return list.some((n) => walk(n.children))
        }
        if (walk(t)) this.updateLore(loreId, { content: JSON.stringify(t) })
      } catch {
        /* ignore */
      }
    },

    /** 导入 MD 解析结果：folders = [{name, children, entries:[{title, lines}]}] */
    importLoreTree(folders, parentFolderId = null) {
      let foldersCreated = 0
      let entriesCreated = 0
      const walk = (list, parentId) => {
        for (const f of list) {
          const cat = this.addCategory(f.name || '导入文件夹', parentId)
          foldersCreated++
          for (const e of f.entries || []) {
            const row = this.addLore(cat.id)
            const lines = (e.lines || []).filter((x) => x !== null && x !== undefined)
            const tree = lines.length
              ? lines.map((t) => ({ id: uid(), text: String(t), fold: false, children: [] }))
              : [{ id: uid(), text: '', fold: false, children: [] }]
            this.updateLore(row.id, { title: e.title || '导入条目', content: JSON.stringify(tree), fmt: 'outline' })
            entriesCreated++
          }
          walk(f.children || [], cat.id)
        }
      }
      walk(folders || [], parentFolderId)
      return { foldersCreated, entriesCreated }
    },

    addLore(categoryId = null) {
      const row = {
        id: uid(),
        workId: this.work.id,
        categoryId,
        title: '新条目',
        content: '',
        tags: [],
        createdAt: now(),
        updatedAt: now(),
        deletedAt: null
      }
      this.lore.push(row)
      autosave.mark('lore', row)
      this.tab = 'lore'
      this.selLoreId = row.id
      return row
    },

    updateLore(id, patch) {
      const l = this.lore.find((x) => x.id === id)
      if (!l) return
      Object.assign(l, patch)
      autosave.mark('lore', l)
    },

    async deleteLore(id) {
      const l = this.lore.find((x) => x.id === id)
      if (!l) return
      await repo.softDeleteRow('lore', l)
      if (this.selLoreId === id) this.selLoreId = null
    },

    /* ---------- 灵感 ---------- */
    addSnippet(content = '') {
      const row = { id: uid(), workId: this.work.id, content, tags: [], createdAt: now(), updatedAt: now(), deletedAt: null }
      this.snippets.push(row)
      autosave.mark('snippets', row)
      this.tab = 'snippets'
      this.selSnippetId = row.id
      return row
    },

    updateSnippet(id, patch) {
      const s = this.snippets.find((x) => x.id === id)
      if (!s) return
      Object.assign(s, patch)
      autosave.mark('snippets', s)
    },

    async deleteSnippet(id) {
      const s = this.snippets.find((x) => x.id === id)
      if (!s) return
      await repo.softDeleteRow('snippets', s)
      if (this.selSnippetId === id) this.selSnippetId = null
    },

    /* ---------- 资产（图片等） ---------- */
    async addAssetBlob(blob, name = 'image') {
      const meta = await repo.addAssetRow(this.work.id, name, blob.type || 'application/octet-stream', blob)
      this.assets.push(meta)
      return meta
    },

    assetUrl(id) {
      return urlCache.get(id) || ''
    },

    async warmUrls(ids) {
      let changed = false
      for (const id of ids) {
        if (!id || urlCache.has(id)) continue
        const blob = await repo.getAssetBlob(id)
        if (blob) {
          urlCache.set(id, URL.createObjectURL(blob))
          changed = true
        }
      }
      if (changed) this.urlTick++
    },

    async purgeAsset(meta) {
      urlCache.delete(meta.id)
      await repo.deleteAssetRow(meta, true)
      this.assets = this.assets.filter((a) => a.id !== meta.id)
      this.links = this.links.filter((l) => l.assetId !== meta.id)
    },

    async linkAsset(entityType, entityId, assetId) {
      const row = await repo.addLink(entityType, entityId, assetId)
      this.links.push(row)
      return row
    },

    async unlinkAsset(linkId) {
      await repo.removeLink(linkId)
      this.links = this.links.filter((l) => l.id !== linkId)
    },

    linksFor(entityType, entityId) {
      return this.links.filter((l) => l.entityType === entityType && l.entityId === entityId)
    },

    /* ---------- 回收站 ---------- */
    recycleItems() {
      return {
        chapters: this.chapters.filter((c) => c.deletedAt),
        characters: this.characters.filter((c) => c.deletedAt),
        lore: [],
        mubu: this.mubu.filter((n) => n.deletedAt),
        snippets: this.snippets.filter((s) => s.deletedAt)
      }
    },

    async restoreItem(table, row) {
      await repo.restoreRow(table, row)
    },

    async purgeItem(table, row) {
      await repo.purgeRow(table, row)
      this[table] = this[table].filter((x) => x.id !== row.id)
    },

    /* ---------- 幕布节点体系（设定库） ---------- */

    /**
     * 旧「分类/条目」数据一次性迁移为幕布节点：分类→节点（保留嵌套），
     * 条目标题→节点，其大纲/正文→子节点。迁移后删除旧行。
     */
    async migrateMubu(workId) {
      const flagKey = 'mubu-mig:' + workId
      const flag = await db.appconfig.get(flagKey)
      if (flag) return
      const cats = (await db.lorecats.where('workId').equals(workId).toArray())
        .filter((c) => !c.deletedAt)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      const lores = (await db.lore.where('workId').equals(workId).toArray()).filter((l) => !l.deletedAt)
      if (cats.length || lores.length) {
        const catMap = new Map()
        let order = 0
        for (const c of cats) {
          const id = uid()
          catMap.set(c.id, id)
          await db.mubu.add({
            id, workId, parentId: c.parentId ? catMap.get(c.parentId) || null : null,
            sortOrder: order++ * 1000, text: c.name || '未命名分类', html: null, fold: false,
            deletedAt: null, createdAt: now(), updatedAt: now()
          })
        }
        const fromTextLines = (text) =>
          String(text || '').split('\n').filter((x) => x.trim()).map((x) => ({ text: x.trim() }))
        for (const l of lores) {
          const id = uid()
          const pid = l.categoryId ? catMap.get(l.categoryId) || null : null
          await db.mubu.add({
            id, workId, parentId: pid, sortOrder: order++ * 1000,
            text: l.title || '未命名条目', html: null, fold: false,
            deletedAt: null, createdAt: now(), updatedAt: now()
          })
          let outline = []
          if (l.fmt === 'outline') {
            try { outline = JSON.parse(l.content || '[]') } catch { outline = [] }
          } else if ((l.content || '').trim()) {
            outline = fromTextLines(l.content).map((x) => ({ ...x, children: [] }))
          }
          let childOrder = 0
          const walkAdd = async (list, parent) => {
            for (const n of list) {
              const cid = uid()
              await db.mubu.add({
                id: cid, workId, parentId: parent, sortOrder: childOrder++ * 1000,
                text: n.text || '', html: n.html || null, fold: !!n.fold,
                deletedAt: null, createdAt: now(), updatedAt: now()
              })
              await walkAdd(n.children || [], cid)
            }
          }
          await walkAdd(outline, id)
        }
        await db.lore.where('workId').equals(workId).delete()
        await db.lorecats.where('workId').equals(workId).delete()
      }
      await db.appconfig.put({ key: flagKey, value: 1 })
    },

    liveMubu() {
      return this.mubu
        .filter((n) => !n.deletedAt)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    },

    mubuChildren(parentId) {
      return this.liveMubu().filter((n) => (n.parentId || null) === (parentId || null))
    },

    mubuAdd(parentId, afterId = null, text = '', html = null) {
      const siblings = this.mubuChildren(parentId)
      const row = {
        id: uid(), workId: this.work.id, parentId: parentId || null,
        sortOrder: 0, text, html, fold: false, deletedAt: null,
        createdAt: now(), updatedAt: now()
      }
      if (afterId) {
        const i = siblings.findIndex((s) => s.id === afterId)
        row.sortOrder = i >= 0 ? siblings[i].sortOrder + 500 : siblings.length * 1000
        this.mubu.push(row)
        this.mubuNormalize(parentId)
      } else {
        row.sortOrder = siblings.reduce((m, s) => Math.max(m, s.sortOrder || 0), -1000) + 1000
        this.mubu.push(row)
      }
      autosave.mark('mubu', row)
      return row
    },

    mubuAddTree(parentId, afterId, treeNodes) {
      // 幕布顺序（DFS）扁平插入：栈记录每层的父节点
      const flat = []
      const walk = (list, depth) => {
        for (const n of list) {
          flat.push({ depth, text: n.text || '', html: n.html || null, fold: !!n.fold })
          walk(n.children || [], depth + 1)
        }
      }
      walk(treeNodes || [], 0)
      const stack = [parentId || null]
      let prevId = afterId
      let prevDepth = 0
      const created = []
      for (const item of flat) {
        stack.length = item.depth + 1
        const parent = stack[item.depth] != null ? stack[item.depth] : stack[stack.length - 1]
        const sameParent = prevDepth === item.depth
        const r = this.mubuAdd(parent, sameParent ? prevId : null, item.text, item.html)
        if (item.fold) {
          r.fold = true
          autosave.mark('mubu', r)
        }
        stack[item.depth] = r.id
        created.push(r)
        prevId = r.id
        prevDepth = item.depth
      }
      return created[0]
    },

    mubuNormalize(parentId) {
      const siblings = this.mubuChildren(parentId)
      siblings.forEach((s, i) => {
        if (s.sortOrder !== i * 1000) {
          s.sortOrder = i * 1000
          autosave.mark('mubu', s)
        }
      })
    },

    mubuSetText(id, text, html = undefined) {
      const n = this.mubu.find((x) => x.id === id)
      if (!n) return
      n.text = text
      if (html !== undefined) n.html = html
      autosave.mark('mubu', n)
    },

    mubuToggleFold(id) {
      const n = this.mubu.find((x) => x.id === id)
      if (!n) return
      n.fold = !n.fold
      autosave.mark('mubu', n)
    },

    mubuFoldAll(v) {
      for (const n of this.liveMubu()) {
        if (!this.mubuChildren(n.id).length) continue
        if (n.fold !== v) {
          n.fold = v
          autosave.mark('mubu', n)
        }
      }
    },

    mubuDescendants(id) {
      const out = []
      const walk = (pid) => this.mubuChildren(pid).forEach((n) => (out.push(n), walk(n.id)))
      walk(id)
      return out
    },

    mubuMove(id, targetId, zone) {
      if (id === targetId) return
      if (this.mubuDescendants(id).some((n) => n.id === targetId)) return
      const n = this.mubu.find((x) => x.id === id)
      const t = this.mubu.find((x) => x.id === targetId)
      if (!n || !t) return
      if (zone === 'inside') {
        const oldParent = n.parentId
        n.parentId = t.id
        autosave.mark('mubu', n)
        this.mubuNormalize(t.id)
        if (oldParent !== (t.id)) this.mubuNormalize(oldParent)
      } else {
        const targetParent = t.parentId || null
        const wasParent = n.parentId
        n.parentId = targetParent
        const siblings = this.mubuChildren(targetParent)
        const ti = siblings.findIndex((s) => s.id === targetId)
        siblings.splice(ti + (zone === 'after' ? 1 : 0), 0, n)
        siblings.forEach((s, i) => {
          if (s.sortOrder !== i * 1000) {
            s.sortOrder = i * 1000
            autosave.mark('mubu', s)
          }
        })
        if (wasParent !== targetParent) this.mubuNormalize(wasParent)
      }
    },

    mubuMoveOrder(id, dir) {
      const n = this.mubu.find((x) => x.id === id)
      if (!n) return
      const siblings = this.mubuChildren(n.parentId)
      const i = siblings.findIndex((s) => s.id === id)
      const j = i + dir
      if (j < 0 || j >= siblings.length) return
      const tmp = siblings[i].sortOrder
      siblings[i].sortOrder = siblings[j].sortOrder
      siblings[j].sortOrder = tmp
      autosave.mark('mubu', siblings[i])
      autosave.mark('mubu', siblings[j])
    },

    mubuRemove(id) {
      const all = [this.mubu.find((x) => x.id === id), ...this.mubuDescendants(id)].filter(Boolean)
      const t = now()
      for (const n of all) {
        n.deletedAt = t
        autosave.mark('mubu', n)
      }
    },

    mubuRestore(id) {
      const all = [this.mubu.find((x) => x.id === id), ...this.mubuDescendants(id)].filter(Boolean)
      for (const n of all) {
        n.deletedAt = null
        autosave.mark('mubu', n)
      }
    },

    async mubuPurge(id) {
      const all = [id, ...this.mubuDescendants(id).map((n) => n.id)]
      await db.mubu.bulkDelete(all)
      this.mubu = this.mubu.filter((n) => !all.includes(n.id))
    },

    /** 撤销/重做：用快照同步整棵树（增/删/改差异落库） */
    async mubuSyncTree(flatNodes) {
      const current = new Map(this.mubu.map((n) => [n.id, n]))
      const want = new Map(flatNodes.map((n) => [n.id, n]))
      const t = now()
      for (const [id, w] of want) {
        const cur = current.get(id)
        if (!cur) {
          const row = {
            id, workId: this.work.id, parentId: w.parentId || null, sortOrder: w.sortOrder || 0,
            text: w.text || '', html: w.html ?? null, fold: !!w.fold, deletedAt: null,
            createdAt: t, updatedAt: t
          }
          this.mubu.push(row)
          await db.mubu.put(JSON.parse(JSON.stringify(row)))
        } else if (
          cur.parentId !== (w.parentId || null) || cur.sortOrder !== w.sortOrder ||
          cur.text !== (w.text || '') || (cur.html ?? null) !== (w.html ?? null) ||
          !!cur.fold !== !!w.fold || !!cur.deletedAt !== !!w.deletedAt
        ) {
          cur.parentId = w.parentId || null
          cur.sortOrder = w.sortOrder || 0
          cur.text = w.text || ''
          cur.html = w.html ?? null
          cur.fold = !!w.fold
          cur.deletedAt = w.deletedAt ?? null
          cur.updatedAt = t
          await db.mubu.put(JSON.parse(JSON.stringify(cur)))
        }
      }
      for (const [id, cur] of current) {
        if (!want.has(id) && !cur.deletedAt) {
          cur.deletedAt = t
          cur.updatedAt = t
          await db.mubu.put(JSON.parse(JSON.stringify(cur)))
        }
      }
    },

    /* ---------- 大纲节点树（8.8 思维导图方向） ---------- */

    /* ---------- 大纲自由模块画布（8.8.2） ---------- */

    /**
     * 大纲节点迁移（两段式）：
     * - v1（≤v0.4.0 老数据）：仅当存在非空旧大纲内容时，导入为容器 + 条目节点（保留用户文本）；
     * - v2（本次，v0.4.1）：固定组语义降级为普通容器（可编辑可删除），卷节点保留 refId 联动，
     *   章节点转为章节锚点（anchor）；注意此阶段 this.olnodes 尚未装载，需直接读库。
     * - 全新作品：空画布，不预置任何结构（骨架模板见 OutlineCanvas 的「快速开始」）。
     * outlines 旧表保留不删（回滚安全）。
     */
    async migrateOlnodes(workId) {
      const hasLegacy = this.outlines.some((o) => !o.deletedAt && (o.content || '').trim())
      const v1Flag = await db.appconfig.get('olnodes-mig:' + workId)
      const v2Flag = await db.appconfig.get('olnodes-mig2:' + workId)
      if (v2Flag) return
      const rows = await db.olnodes.where('workId').equals(workId).toArray()
      const put = (row) => db.olnodes.put(JSON.parse(JSON.stringify(row)))

      if (!v1Flag && hasLegacy) {
        const mk = async (fields) => {
          const row = {
            id: uid(), workId, parentId: null, refId: null, kind: 'event', title: '',
            text: '', html: null, fold: false, sortOrder: 0, deletedAt: null,
            canvasX: null, canvasY: null, shape: 'process', rels: [],
            createdAt: now(), updatedAt: now(), ...fields
          }
          await db.olnodes.add(JSON.parse(JSON.stringify(row)))
          return row
        }
        const contentOf = (refId) => this.outlines.find((o) => o.refId === refId && !o.deletedAt)?.content || ''
        let order = 0
        await mk({ kind: 'container', title: '总纲', text: contentOf(this.work?.id), sortOrder: order++ * 1000 })
        const vg = await mk({ kind: 'container', title: '卷纲', sortOrder: order++ * 1000 })
        for (const v of this.liveVolumes) {
          await mk({ kind: 'volume', refId: v.id, parentId: vg.id, title: v.title, text: contentOf(v.id), sortOrder: order++ * 1000 })
        }
        const cg = await mk({ kind: 'container', title: '章纲', sortOrder: order++ * 1000 })
        for (const c of this.liveChapters) {
          await mk({ kind: 'anchor', refId: c.id, parentId: cg.id, title: c.title, text: contentOf(c.id), sortOrder: order++ * 1000 })
        }
        await mk({ kind: 'container', title: '故事线', sortOrder: order++ * 1000 })
      } else if (v1Flag || rows.length) {
        // v1 已迁移（或存在任意旧节点数据）：固定组降级、章节点转为锚点
        for (const n of rows) {
          if (['master', 'volumes', 'chapters', 'lines'].includes(n.kind)) {
            n.kind = 'container'
            await put(n)
          } else if (n.kind === 'line' || n.kind === 'note') {
            n.kind = 'event'
            await put(n)
          } else if (n.kind === 'chapter') {
            n.kind = 'anchor'
            await put(n)
          }
          if (n.canvasX == null && n.rels === undefined) {
            n.rels = []
            await put(n)
          }
        }
      }
      await db.appconfig.put({ key: 'olnodes-mig2:' + workId, value: 1 })
    },

    liveOlnodes() {
      /* v1.0.13 起连接点不再作为画布模块（改为钉在宿主连线 rel.junctions 上）；
       * 旧版本创建的 kind:'arrow' 模块一律按已删除处理，不进渲染与统计 */
      return this.olnodes
        .filter((n) => !n.deletedAt && n.kind !== 'arrow')
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    },

    olnodeChildren(parentId) {
      return this.liveOlnodes().filter((n) => (n.parentId || null) === (parentId || null))
    },

    olnodeByRef(refId) {
      return this.olnodes.find((n) => n.refId === refId && !n.deletedAt) || null
    },

    olnodeByKind(kind) {
      return this.olnodes.find((n) => n.kind === kind && !n.deletedAt) || null
    },

    olnodeAdd(parentId, fields = {}, afterId = null) {
      this.olnodePushUndo(true)
      const siblings = this.olnodeChildren(parentId)
      const row = {
        id: uid(), workId: this.work.id, parentId: parentId || null, refId: null,
        kind: 'event', title: '', text: '', html: null, fold: false, sortOrder: 0,
        canvasX: null, canvasY: null, w: null, h: null, shape: 'process', pin: false, rels: [],
        deletedAt: null, createdAt: now(), updatedAt: now(), ...fields
      }
      if (afterId) {
        const i = siblings.findIndex((s) => s.id === afterId)
        row.sortOrder = i >= 0 ? siblings[i].sortOrder + 500 : siblings.length * 1000
        this.olnodes.push(row)
        this.olnodeNormalize(parentId)
      } else {
        row.sortOrder = siblings.reduce((m, s) => Math.max(m, s.sortOrder || 0), -1000) + 1000
        this.olnodes.push(row)
      }
      autosave.mark('olnodes', row)
      return row
    },

    olnodeNormalize(parentId) {
      this.olnodeChildren(parentId).forEach((s, i) => {
        if (s.sortOrder !== i * 1000) {
          s.sortOrder = i * 1000
          autosave.mark('olnodes', s)
        }
      })
    },

    olnodeSetTitle(id, title) {
      const n = this.olnodes.find((x) => x.id === id)
      if (!n) return
      n.title = title
      autosave.mark('olnodes', n)
    },

    olnodeSetRich(id, text, html = undefined) {
      const n = this.olnodes.find((x) => x.id === id)
      if (!n) return
      n.text = text
      if (html !== undefined) n.html = html
      autosave.mark('olnodes', n)
    },

    olnodeRemove(id) {
      this.olnodePushUndo(true)
      const all = [this.olnodes.find((x) => x.id === id), ...this.olnodeDescendants(id)].filter(Boolean)
      const t = now()
      const removed = new Set(all.map((n) => n.id))
      for (const n of all) {
        n.deletedAt = t
        autosave.mark('olnodes', n)
      }
      // 清理其他节点指向被删节点的连线（统一关系层）
      for (const n of this.liveOlnodes()) {
        if (Array.isArray(n.rels) && n.rels.some((r) => removed.has(r.toId))) {
          n.rels = n.rels.filter((r) => !removed.has(r.toId))
          autosave.mark('olnodes', n)
        }
      }
      // 级联：指向被删节点连线上连接点的连线一并删除（连接点随宿主连线消亡）
      for (const rid of removed) this.olnodeRemoveCascadeJunctions(rid)
    },

    olnodeDescendants(id) {
      const out = []
      const walk = (pid) => this.olnodeChildren(pid).forEach((n) => (out.push(n), walk(n.id)))
      walk(id)
      return out
    },

    olnodeToggleFold(id) {
      const n = this.olnodes.find((x) => x.id === id)
      if (!n) return
      n.fold = !n.fold
      autosave.mark('olnodes', n)
    },

    olnodeSetCanvas(id, x, y) {
      const n = this.olnodes.find((x2) => x2.id === id)
      if (!n) return
      n.canvasX = Math.round(x)
      n.canvasY = Math.round(y)
      autosave.mark('olnodes', n)
    },

    /** 箭头模块旋转角（v1.0.9，仅 arrow 类型使用） */
    olnodeSetRot(id, rot) {
      const n = this.olnodes.find((x) => x.id === id)
      if (!n) return
      n.rot = Math.round(rot)
      autosave.mark('olnodes', n)
    },

    /** 骨架模板批量创建：调用方先 olnodePushUndo(true)，本动作不再逐条压栈；_parent 为 rows 序号（创建后回填父级） */
    olnodeBulkAdd(rows) {
      const t = now()
      const created = []
      for (const r of rows) {
        const row = {
          id: uid(), workId: this.work.id, parentId: r.parentId || null, refId: r.refId || null,
          kind: r.kind || 'event', title: r.title || '', text: r.text || '', html: null,
          fold: false, sortOrder: r.sortOrder || 0, canvasX: r.canvasX ?? null, canvasY: r.canvasY ?? null,
          shape: r.shape || 'process', w: r.w ?? null, h: r.h ?? null, rels: [], deletedAt: null, createdAt: t, updatedAt: t
        }
        this.olnodes.push(row)
        created.push(row)
        autosave.mark('olnodes', row)
      }
      for (let i = 0; i < rows.length; i++) {
        const pi = rows[i]?._parent
        if (pi != null && created[pi]) {
          created[i].parentId = created[pi].id
          autosave.mark('olnodes', created[i])
        }
      }
      return created
    },

    olnodeSetKind(id, kind) {
      const n = this.olnodes.find((x) => x.id === id)
      if (!n || n.kind === kind) return
      n.kind = kind
      autosave.mark('olnodes', n)
    },

    olnodeSetShape(id, shape) {
      const n = this.olnodes.find((x) => x.id === id)
      if (!n) return
      n.shape = shape
      autosave.mark('olnodes', n)
    },

    /** 自定义尺寸（v0.4.1 界面优化）：模块边缘拖拽调整大小，null 恢复默认 */
    olnodeSetSize(id, w, h) {
      const n = this.olnodes.find((x) => x.id === id)
      if (!n) return
      n.w = w != null ? Math.round(w) : null
      n.h = h != null ? Math.round(h) : null
      autosave.mark('olnodes', n)
    },

    /** 容器内 PPT 式文本框（v0.4.2）：textboxes = [{ id, x, y, w, h, text, opacity }]，坐标相对容器正文区 */
    olnodeTextboxesSet(id, list) {
      const n = this.olnodes.find((x) => x.id === id)
      if (!n) return
      n.textboxes = JSON.parse(JSON.stringify(list))
      autosave.mark('olnodes', n)
    },

    /** 容器颜色（v0.4.2 右键快捷栏）：color 为调色板色值，null 恢复按序自动配色 */
    olnodeSetColor(id, color) {
      const n = this.olnodes.find((x) => x.id === id)
      if (!n) return
      n.color = color || ''
      autosave.mark('olnodes', n)
    },

    /** 文本框模块透明度（v0.4.2）：0.15–1，作用于底色层 */
    olnodeSetOpacity(id, v) {
      const n = this.olnodes.find((x) => x.id === id)
      if (!n) return
      n.opacity = Math.min(1, Math.max(0.15, Number(v) || 1))
      autosave.mark('olnodes', n)
    },

    olnodeSetRels(id, rels) {
      const n = this.olnodes.find((x) => x.id === id)
      if (!n) return
      n.rels = rels
      autosave.mark('olnodes', n)
    },

    olnodeSetPin(id, pin) {
      const n = this.olnodes.find((x) => x.id === id)
      if (!n) return
      n.pin = !!pin
      autosave.mark('olnodes', n)
    },

    /** 引用卡设目标（8.8.2-G2）：refId 存 "kind:id"，标题随目标预填 */
    olnodeSetCite(id, target) {
      const n = this.olnodes.find((x) => x.id === id)
      if (!n || !target) return
      n.refId = target.kind + ':' + target.id
      n.title = target.title || ''
      autosave.mark('olnodes', n)
    },

    /** 画布偏好读写（appconfig 按作品隔离） */
    async loadCanvasPrefs() {
      try {
        const row = await db.appconfig.get('olcanvas:' + this.work?.id)
        if (row?.value) this.canvasPrefs = { snap: true, density: 'detail', edgeStyle: 'bezier', edgeWidth: 1.8, arrowSize: 1, ...row.value }
      } catch {
        /* 保持默认 */
      }
    },
    async saveCanvasPrefs() {
      if (!this.work) return
      await db.appconfig.put({ key: 'olcanvas:' + this.work.id, value: JSON.parse(JSON.stringify(this.canvasPrefs)) })
    },

    /** 自定义模块类型注册表（8.8.2-G2）：appconfig 按作品隔离，节点以 mtype 名称引用 */
    async loadOlTypes() {
      try {
        const row = await db.appconfig.get('olTypes:' + this.work?.id)
        this.olTypes = Array.isArray(row?.value) ? row.value : []
      } catch {
        this.olTypes = []
      }
    },
    async saveOlTypes() {
      if (!this.work) return
      await db.appconfig.put({ key: 'olTypes:' + this.work.id, value: JSON.parse(JSON.stringify(this.olTypes)) })
    },
    olTypeAdd(name) {
      const nameTrim = String(name || '').trim()
      if (!nameTrim || this.olTypes.some((t) => t.name === nameTrim)) return null
      const palette = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#d35400', '#16a085', '#b8860b']
      const t = { name: nameTrim, color: palette[this.olTypes.length % palette.length] }
      this.olTypes.push(t)
      this.saveOlTypes()
      return t
    },
    olTypeRemove(name) {
      this.olTypes = this.olTypes.filter((t) => t.name !== name)
      this.saveOlTypes()
    },
    olnodeSetMtype(id, mtype) {
      const n = this.olnodes.find((x) => x.id === id)
      if (!n) return
      n.mtype = String(mtype || '')
      autosave.mark('olnodes', n)
    },

    /**
     * 章节锚点懒挂载（8.8.2-G1）：首次在右栏输入本章速记时才创建锚点节点，
     * refId 关联章节（显示状态点与字数、可跳正文），不再预生成。
     */
    ensureChapterAnchor(chapterId) {
      const exist = this.olnodeByRef(chapterId)
      if (exist) return exist
      const ch = this.chapters.find((x) => x.id === chapterId && !x.deletedAt)
      if (!ch || !this.work) return null
      return this.olnodeAdd(null, { kind: 'anchor', refId: chapterId, title: ch.title, text: '' })
    },

    /* ---------- 人物关系图（8.8.3） ---------- */

    /** 人物关系图布局持久化（appconfig 按作品隔离） */
    async loadCharGraph() {
      const row = await db.appconfig.get('charGraph:' + this.work?.id)
      return row?.value || {}
    },
    async saveCharGraph(layout) {
      if (!this.work) return
      await db.appconfig.put({ key: 'charGraph:' + this.work.id, value: JSON.parse(JSON.stringify(layout)) })
    },

    /** 双链引用卡点选人物 → 跳人物模块并定位关系图 */
    jumpToCharGraph(charId) {
      const c = this.characters.find((x) => x.id === charId && !x.deletedAt)
      if (!c) return false
      this.tab = 'characters'
      this.selCharacterId = charId
      this.charView = 'graph'
      this.charFocusId = charId
      this.charFocusTick++
      return true
    },

    /** 人物节点「发送为大纲画布引用卡」（跨模块人物动线） */
    sendCharToOutline(charId) {
      const c = this.characters.find((x) => x.id === charId && !x.deletedAt)
      if (!c) return null
      const row = this.olnodeAdd(null, { kind: 'cite', refId: 'character:' + c.id, title: c.name || '未命名', text: '' })
      this.tab = 'outline'
      this.outlineView = 'canvas'
      this.selOlnodeId = row.id
      this.canvasFocusTick++
      return row
    },

    olnodeMoveOrder(id, dir) {
      const n = this.olnodes.find((x) => x.id === id)
      if (!n) return
      const siblings = this.olnodeChildren(n.parentId)
      const i = siblings.findIndex((s) => s.id === id)
      const j = i + dir
      if (j < 0 || j >= siblings.length) return
      const tmp = siblings[i].sortOrder
      siblings[i].sortOrder = siblings[j].sortOrder
      siblings[j].sortOrder = tmp
      autosave.mark('olnodes', siblings[i])
      autosave.mark('olnodes', siblings[j])
    },

    /** 拖拽重挂接（8.8 专业导图交互）：把节点移动到目标父级下（afterId 为null时追加到末尾） */
    olnodeMoveTo(id, targetParentId, afterId = null) {
      const n = this.olnodes.find((x) => x.id === id)
      if (!n || id === targetParentId) return false
      this.olnodePushUndo(true)
      // 不能挂到自己的后代下
      if (this.olnodeDescendants(id).some((d) => d.id === targetParentId)) return false
      const oldParent = n.parentId || null
      n.parentId = targetParentId || null
      const sibs = this.olnodeChildren(targetParentId || null).filter((s) => s.id !== id)
      if (afterId) {
        const i = sibs.findIndex((s) => s.id === afterId)
        n.sortOrder = i >= 0 ? sibs[i].sortOrder + 500 : sibs.length * 1000
      } else {
        n.sortOrder = sibs.reduce((m, s) => Math.max(m, s.sortOrder || 0), -1000) + 1000
      }
      autosave.mark('olnodes', n)
      if (oldParent !== (targetParentId || null)) this.olnodeNormalize(oldParent)
      this.olnodeNormalize(targetParentId || null)
      return true
    },

    /* 撤销 / 重做（快照栈）：结构操作前 force 快照，连续文本编辑按 1.2s 合并 */
    olnodePushUndo(force = false) {
      const t = Date.now()
      if (!force && this.olUndo.length && t - this.olUndoAt < 1200) {
        this.olUndoAt = t
        return
      }
      this.olUndo.push(JSON.stringify(this.olnodes.map((n) => ({ ...n }))))
      if (this.olUndo.length > 60) this.olUndo.shift()
      this.olRedo = []
      this.olUndoAt = t
    },

    olnodeUndo() {
      if (!this.olUndo.length) return false
      this.olRedo.push(JSON.stringify(this.olnodes.map((n) => ({ ...n }))))
      this.olnodes = JSON.parse(this.olUndo.pop())
      for (const n of this.olnodes) autosave.mark('olnodes', n)
      return true
    },

    olnodeRedo() {
      if (!this.olRedo.length) return false
      this.olUndo.push(JSON.stringify(this.olnodes.map((n) => ({ ...n }))))
      this.olnodes = JSON.parse(this.olRedo.pop())
      for (const n of this.olnodes) autosave.mark('olnodes', n)
      return true
    },

    /* ---------- 统一关系层（8.8.2-G3）：边存储于源节点 rels 数组 [{ id, toId, label, kind, arrows, style }] ----------
     * 连接点（v1.0.13 推倒重建）：不再作为画布模块节点，直接挂在宿主连线上——
     * rel.junctions = [{ id, t }]（t 为宿主连线路径参数 0–1）；
     * 连线可以接到连接点上：rel.toJunction = { ownerId, relId, junctionId }，
     * 连接点屏幕位置由宿主连线路径实时派生，节点挪位/整理布局后仍在原线上。 */
    olnodeRelsOf(id) {
      const n = this.olnodes.find((x) => x.id === id)
      const arr = n && Array.isArray(n.rels) ? n.rels : []
      return arr.map((r) => ({ arrows: '->', style: '', label: '', kind: '关联', junctions: [], ...r }))
    },
    olnodeRelAdd(fromId, toId, fields = {}) {
      if (fromId === toId) return null
      const n = this.olnodes.find((x) => x.id === fromId)
      if (!n) return null
      const arr = this.olnodeRelsOf(fromId)
      if (arr.some((r) => r.toId === toId && r.kind === (fields.kind || '关联'))) return null
      this.olnodePushUndo(true)
      const rel = { id: uid(), toId, label: '', kind: '关联', arrows: '->', style: '', junctions: [], ...fields }
      n.rels = [...arr, rel]
      autosave.mark('olnodes', n)
      return rel
    },
    olnodeRelUpdate(ownerId, relId, patch) {
      const n = this.olnodes.find((x) => x.id === ownerId)
      if (!n || !Array.isArray(n.rels)) return
      n.rels = n.rels.map((r) => (r.id === relId ? { ...r, ...patch } : r))
      autosave.mark('olnodes', n)
    },
    /** 通用 rel 补丁（v1.0.16 塑形用）：目标可以是节点 rels 中的连线，也可以是宿主 rel._out 中的引出连线 */
    olnodeRelPatchAny(ownerId, relId, patch) {
      const n = this.olnodes.find((x) => x.id === ownerId)
      if (!n || !Array.isArray(n.rels)) return
      for (const r of n.rels) {
        if (r.id === relId) {
          Object.assign(r, patch)
          autosave.mark('olnodes', n)
          return r
        }
        const o = (r._out || []).find((x) => x.id === relId)
        if (o) {
          Object.assign(o, patch)
          autosave.mark('olnodes', n)
          return o
        }
      }
    },
    olnodeRelRemove(ownerId, relId) {
      const n = this.olnodes.find((x) => x.id === ownerId)
      if (!n || !Array.isArray(n.rels)) return
      this.olnodePushUndo(true)
      n.rels = n.rels.filter((r) => r.id !== relId)
      autosave.mark('olnodes', n)
      // 级联：删除连线上所有连接点 → 引用这些连接点的连线一并删除（含递归：被删连线上的连接点同理）
      const dead = new Set([`${ownerId}:${relId}`])
      for (let round = 0; round < 8; round++) {
        let changed = false
        for (const n2 of this.liveOlnodes()) {
          if (!Array.isArray(n2.rels)) continue
          const kept = []
          for (const r of n2.rels) {
            if (r.toJunction && dead.has(`${r.toJunction.ownerId}:${r.toJunction.relId}`)) {
              dead.add(`${n2.id}:${r.id}`)
              changed = true
            } else kept.push(r)
          }
          if (changed && kept.length !== n2.rels.length) {
            n2.rels = kept
            autosave.mark('olnodes', n2)
          }
        }
        if (!changed) break
      }
    },

    /* ---------- 连接点（挂在宿主连线上，v1.0.13） ---------- */
    /** 在宿主连线 (ownerId, relId) 的路径参数 t 处创建连接点，返回 { id, t, bornAt }；
     * bornAt 用于创建后短暂高亮（方便确认位置），随后淡出隐藏 */
    olnodeJunctionAdd(ownerId, relId, t) {
      const n = this.olnodes.find((x) => x.id === ownerId)
      if (!n || !Array.isArray(n.rels)) return null
      const rel = n.rels.find((r) => r.id === relId)
      if (!rel) return null
      this.olnodePushUndo(true)
      const j = { id: uid(), t: Math.max(0, Math.min(1, t)), bornAt: Date.now() }
      rel.junctions = [...(rel.junctions || []), j]
      autosave.mark('olnodes', n)
      return j
    },
    olnodeJunctionRemove(ownerId, relId, junctionId) {
      const n = this.olnodes.find((x) => x.id === ownerId)
      if (!n || !Array.isArray(n.rels)) return
      const rel = n.rels.find((r) => r.id === relId)
      if (!rel || !Array.isArray(rel.junctions)) return
      this.olnodePushUndo(true)
      rel.junctions = rel.junctions.filter((j) => j.id !== junctionId)
      // 级联：从该连接点引出的连线（宿主 rel._out）一并删除
      if (Array.isArray(rel._out)) rel._out = rel._out.filter((r) => !(r.fromJunction && r.fromJunction.junctionId === junctionId))
      autosave.mark('olnodes', n)
      // 级联：接到该连接点上的连线一并删除
      for (const n2 of this.liveOlnodes()) {
        if (!Array.isArray(n2.rels)) continue
        const kept = n2.rels.filter((r) => !(r.toJunction && r.toJunction.ownerId === ownerId && r.toJunction.relId === relId && r.toJunction.junctionId === junctionId))
        if (kept.length !== n2.rels.length) {
          n2.rels = kept
          autosave.mark('olnodes', n2)
        }
      }
    },
    /** 建一条指向连接点的连线：fromId → 宿主连线上的连接点（连接点作终点） */
    olnodeRelAddToJunction(fromId, host, fields = {}) {
      const n = this.olnodes.find((x) => x.id === fromId)
      if (!n) return null
      const hostNode = this.olnodes.find((x) => x.id === host.ownerId)
      const hostRel = hostNode?.rels?.find((r) => r.id === host.relId)
      if (!hostRel || !(hostRel.junctions || []).some((j) => j.id === host.junctionId)) return null
      this.olnodePushUndo(true)
      const rel = { id: uid(), toId: null, toJunction: { ...host }, label: '', kind: '关联', arrows: '->', style: '', junctions: [], ...fields }
      n.rels = [...(n.rels || []), rel]
      autosave.mark('olnodes', n)
      return rel
    },
    /** 建一条从连接点引出的连线：连接点（起点）→ toId 目标节点 */
    olnodeRelAddFromJunction(host, toId, fields = {}) {
      const hostNode = this.olnodes.find((x) => x.id === host.ownerId)
      const hostRel = hostNode?.rels?.find((r) => r.id === host.relId)
      if (!hostRel || !(hostRel.junctions || []).some((j) => j.id === host.junctionId)) return null
      const target = this.olnodes.find((x) => x.id === toId)
      if (!target) return null
      this.olnodePushUndo(true)
      const rel = { id: uid(), toId, fromJunction: { ...host }, label: '', kind: '关联', arrows: '->', style: '', junctions: [], ...fields }
      hostRel._out = hostRel._out || [] // 引出连线挂在宿主 rel 上（与 junctions 同址，避免新建顶层结构）
      const outs = hostRel._out.filter((r) => r.toId !== toId)
      outs.push(rel)
      hostRel._out = outs
      autosave.mark('olnodes', hostNode)
      return rel
    },
    /** 建一条连接点 → 连接点的连线（线连到线，v1.0.15）：
     * fromHost 上引出，落到 toHost 的连接点上；两端都钉在各自宿主连线路径上 */
    olnodeRelAddJunctionToJunction(fromHost, toHost, fields = {}) {
      const fromNode = this.olnodes.find((x) => x.id === fromHost.ownerId)
      const fromRel = fromNode?.rels?.find((r) => r.id === fromHost.relId)
      if (!fromRel || !(fromRel.junctions || []).some((j) => j.id === fromHost.junctionId)) return null
      const toNode = this.olnodes.find((x) => x.id === toHost.ownerId)
      const toRel = toNode?.rels?.find((r) => r.id === toHost.relId)
      if (!toRel || !(toRel.junctions || []).some((j) => j.id === toHost.junctionId)) return null
      this.olnodePushUndo(true)
      const rel = { id: uid(), toId: null, toJunction: { ...toHost }, fromJunction: { ...fromHost }, label: '', kind: '关联', arrows: '->', style: '', junctions: [], ...fields }
      fromRel._out = fromRel._out || []
      /* 去重：同源同目标连接点只留一条 */
      const outs = fromRel._out.filter((r) => !(r.toJunction && r.toJunction.junctionId === toHost.junctionId))
      outs.push(rel)
      fromRel._out = outs
      autosave.mark('olnodes', fromNode)
      return rel
    },
    /** 节点删除时级联清理其 rels 中指向连接点的连线（宿主连线仍可独立存在） */
    olnodeRemoveCascadeJunctions(nodeId) {
      for (const n2 of this.liveOlnodes()) {
        if (n2.id === nodeId || !Array.isArray(n2.rels)) continue
        const kept = n2.rels.filter((r) => !(r.toJunction && r.toJunction.ownerId === nodeId))
        if (kept.length !== n2.rels.length) {
          n2.rels = kept
          autosave.mark('olnodes', n2)
        }
      }
    },

    /* ---------- 书签（章节快捷收藏） ---------- */
    isChapterBookmarked(id) {
      return this.bookmarks.some((b) => !b.deletedAt && b.targetId === id)
    },

    toggleChapterBookmark(id) {
      const ch = this.chapters.find((x) => x.id === id)
      if (!ch) return false
      const existing = this.bookmarks.find((b) => !b.deletedAt && b.targetId === id)
      if (existing) {
        this.bookmarks = this.bookmarks.filter((b) => b.id !== existing.id)
        db.bookmarks.delete(existing.id)
        return false
      }
      const row = {
        id: uid(), workId: this.work.id, targetType: 'chapter', targetId: id,
        title: ch.title || '', createdAt: now()
      }
      this.bookmarks.push(row)
      db.bookmarks.put(JSON.parse(JSON.stringify(row)))
      return true
    },

    /* ---------- 搜索 ---------- */
    search(q, scopes) {
      const ql = (q || '').trim().toLowerCase()
      if (!ql) return []
      const results = []
      const push = (r) => results.push(r)
      const grab = (text, n = 3) => {
        const t = (text || '').toLowerCase()
        const out = []
        let from = 0
        while (out.length < n) {
          const i = t.indexOf(ql, from)
          if (i < 0) break
          const start = Math.max(0, i - 20)
          out.push((start > 0 ? '…' : '') + (text || '').slice(start, i + ql.length + 30) + '…')
          from = i + ql.length
        }
        return out
      }
      if (scopes.chapters) {
        for (const c of this.liveChapters) {
          const body = c.fmt === 'html' ? stripTags(c.content) : c.content || ''
          const hay = (c.title || '') + '\n' + body
          if (hay.toLowerCase().includes(ql)) push({ type: 'chapters', id: c.id, title: c.title, hits: grab(body).concat(grab(c.title, 1)) })
        }
      }
      if (scopes.outlines) {
        for (const o of this.outlines) {
          if (!(o.content || '').toLowerCase().includes(ql)) continue
          let title = '总纲'
          if (o.level === 'chapter') title = '章纲 · ' + (this.chapters.find((c) => c.id === o.refId)?.title || '未知章节')
          if (o.level === 'volume') title = '卷纲 · ' + (this.volumes.find((v) => v.id === o.refId)?.title || '未知卷')
          push({ type: 'outlines', id: o.refId, title, hits: grab(o.content) })
        }
      }
      if (scopes.characters) {
        for (const c of this.liveCharacters) {
          if (((c.name || '') + (c.aliases || '') + (c.content || '')).toLowerCase().includes(ql)) {
            push({ type: 'characters', id: c.id, title: c.name + (c.role ? `（${c.role}）` : ''), hits: grab(c.content).concat(grab(c.aliases, 1)) })
          }
        }
      }
      if (scopes.lore) {
        for (const n of this.liveMubu()) {
          if ((n.text || '').toLowerCase().includes(ql)) {
            push({ type: 'lore', id: n.id, title: (n.text || '（空）').slice(0, 24), hits: grab(n.text) })
          }
        }
      }
      if (scopes.snippets) {
        for (const s of this.liveSnippets) {
          if ((s.content || '').toLowerCase().includes(ql)) push({ type: 'snippets', id: s.id, title: '灵感 · ' + (s.content || '').slice(0, 18), hits: grab(s.content) })
        }
      }
      return results.slice(0, 200)
    },

    navTo(type, id) {
      this.tab = type
      if (type === 'chapters') {
        this.selChapterId = id
        const c = this.chapters.find((x) => x.id === id)
        if (c) this.selVolumeId = c.volumeId
      }
      if (type === 'lore') {
        useUiStore().loreFocusId = id
      }
      if (type === 'characters') this.selCharacterId = id
      if (type === 'snippets') this.selSnippetId = id
      useUiStore().searchOpen = false
    },

    /* ---------- 版本快照 ---------- */
    async revisionsFor(chapterId) {
      return repo.listRevisions('chapter', chapterId)
    },

    async rollbackChapter(chapterId, revisionId) {
      const rev = await db.revisions.get(revisionId)
      const c = this.chapters.find((x) => x.id === chapterId)
      if (!rev || !c) return
      c.content = rev.content
      // 快照若为旧格式（Markdown/纯文本），回滚后恢复原格式标记
      if (c.fmt === 'html' && /<(p|div|h[1-6]|strong|em)\b/i.test(rev.content)) {
        /* html 快照，格式不变 */
      } else if (c.fmt === 'html') {
        c.fmt = 'md'
      }
      c.wordCount = countWords(c.fmt === 'html' ? stripTags(c.content) : c.content)
      autosave.mark('chapters', c, { forceSnapshot: true })
    }
  }
})
