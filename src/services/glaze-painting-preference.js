// One manager per UI store. Decoding happens before a request enters the write queue;
// writes remain ordered even when earlier IndexedDB operations settle slowly.
export function createGlazePaintingPreference(state, { source, decode = decodePainting, write, notify }) {
  let requested = 0
  let epoch = 0
  let writes = Promise.resolve()
  let active = 0

  return {
    get revision() { return epoch },
    get saving() { return active > 0 },
    async choose(id) {
      const revision = ++requested
      epoch++
      active++
      try {
        await decode(source(id))
        if (revision !== requested) return false
        const operation = writes.then(async () => {
          // A later decoded choice can replace one still waiting for the DB.
          if (revision !== requested) return false
          await write({ key: 'glazePainting', value: id })
          if (revision !== requested) {
            // IndexedDB writes already in flight cannot be cancelled. Restore the
            // displayed choice before the next queued write, including when the
            // newer request fails its decode and never enters the queue.
            await write({ key: 'glazePainting', value: state.glazePainting })
            return false
          }
          state.glazePainting = id
          epoch++
          notify()
          return true
        })
        writes = operation.catch(() => {})
        return await operation
      }
      finally { active-- }
    }
  }
}

export function decodePainting(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      if (typeof image.decode === 'function') image.decode().then(resolve, reject)
      else resolve()
    }
    image.onerror = () => reject(new Error('画作加载失败'))
    image.src = src
  })
}
