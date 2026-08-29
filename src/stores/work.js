import { defineStore } from 'pinia'
import { db, uid, now } from '../db/database'
import * as repo from '../db/repo'
import { autosave, installWordLogHook } from '../services/autosave'
import { countWords, stripTags } from '../services/wordcount'
import { useUiStore } from './ui'
import { useShelfStore } from './shelf'

const urlCache = new Map()

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
    prevCounts: new Map(),
    tab: 'chapters', // chapters | outline | characters | lore | snippets
    selChapterId: null,
    selCharacterId: null,
    selLoreId: null,
    selSnippetId: null,
    selOutlineId: null,
    selVolumeId: null,
    urlTick: 0
  }),

  getters: {
    liveVolumes: (s) => s.volumes.filter((v) => !v.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder),
    liveChapters: (s) => s.chapters.filter((c) => !c.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder),
    liveCharacters: (s) => s.characters.filter((c) => !c.deletedAt).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    liveLore: (s) => s.lore.filter((l) => !l.deletedAt).sort((a, b) => (a.title || '').localeCompare(b.title || '')),
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

    /* ---------- 设定 ---------- */
    addCategory(name = '新分类') {
      const maxSort = this.liveCategories.reduce((m, c) => Math.max(m, c.sortOrder), -1)
      const row = { id: uid(), workId: this.work.id, name, sortOrder: maxSort + 1, deletedAt: null }
      this.lorecats.push(row)
      autosave.mark('lorecats', row)
      return row
    },

    updateLorecat(id, name) {
      const c = this.lorecats.find((x) => x.id === id)
      if (!c) return
      c.name = name
      autosave.mark('lorecats', c)
    },

    async deleteCategory(id) {
      const c = this.lorecats.find((x) => x.id === id)
      if (!c) return
      await repo.softDeleteRow('lorecats', c)
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
        lore: this.lore.filter((l) => l.deletedAt),
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
        for (const l of this.liveLore) {
          if (((l.title || '') + (l.content || '')).toLowerCase().includes(ql)) {
            push({ type: 'lore', id: l.id, title: l.title, hits: grab(l.content) })
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
      if (type === 'characters') this.selCharacterId = id
      if (type === 'lore') this.selLoreId = id
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
