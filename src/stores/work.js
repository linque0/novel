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
      if (!c) return false
      c.status = status
      autosave.mark('chapters', c)
      // 章节标记完成时同步章纲状态（8.8-O2）；outlines.status 为非索引列，无需数据库版本升级
      if (status === 'done') {
        const o = this.outlines.find((x) => x.refId === id && x.level === 'chapter' && !x.deletedAt)
        if (o && o.status !== 'done') {
          o.status = 'done'
          autosave.mark('outlines', o)
          return true
        }
      }
      return false
    },

    setOutlineStatus(id, status) {
      const o = this.outlines.find((x) => x.id === id)
      if (!o) return
      o.status = status
      autosave.mark('outlines', o)
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
    addCharacter(name = '新人物') {
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
      if (this.selCharacterId === id) this.selCharacterId = null
    },

    addRelation(fromId, toId, label) {
      const row = { id: uid(), workId: this.work.id, fromId, toId, label }
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
