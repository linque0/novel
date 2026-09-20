import { defineStore } from 'pinia'
import { listWorks, createWorkRow, seedWorkDefaults, softDeleteRow } from '../db/repo'
import { autosave } from '../services/autosave'

export const useShelfStore = defineStore('shelf', {
  state: () => ({
    works: [],
    loading: false
  }),
  actions: {
    async refresh() {
      this.loading = true
      try {
        this.works = await listWorks()
      } finally {
        this.loading = false
      }
    },
    async createWork(payload) {
      const work = await createWorkRow(payload)
      await seedWorkDefaults(work.id, { withVolume: payload.withVolume !== false })
      await this.refresh()
      return work
    },
    async updateWork(work, patch) {
      Object.assign(work, patch)
      autosave.mark('works', work)
      /* 防抖写有 1s 延迟：若直接 refresh 会把库里的旧行读回来、覆盖刚做的修改
       * （编辑切换封面/标题不生效的根因）——先flush再refresh */
      await autosave.flushAll()
      await this.refresh()
    },
    async deleteWork(work) {
      await softDeleteRow('works', work)
      await this.refresh()
    }
  }
})
