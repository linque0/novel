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
      await this.refresh()
    },
    async deleteWork(work) {
      await softDeleteRow('works', work)
      await this.refresh()
    }
  }
})
