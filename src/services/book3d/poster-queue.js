// Scheduling and encoded-image caching are independent of DOM/WebGL.
export function createPosterQueue({ render, dispose, hidden = () => false, maxEntries = 48, maxBytes = 16 * 1024 * 1024 }) {
  const cache = new Map(), jobs = new Map()
  let users = 0, bytes = 0, active = null, timer = null
  function complete(job, value) {
    for (const consumer of [...job.consumers]) consumer.finish(value)
    if (jobs.get(job.key) === job) jobs.delete(job.key)
  }
  function remember(key, value) {
    const size = value.length * 2
    if (size > maxBytes) return
    if (cache.has(key)) { bytes -= cache.get(key).bytes; cache.delete(key) }
    cache.set(key, { value, bytes: size }); bytes += size
    while (cache.size > maxEntries || bytes > maxBytes) {
      const key = cache.keys().next().value
      bytes -= cache.get(key).bytes; cache.delete(key)
    }
  }
  function resume() {
    if (timer !== null || active || !users || hidden()) return
    timer = setTimeout(async () => {
      timer = null
      if (active || !users || hidden()) return
      const job = [...jobs.values()].filter(j => j.consumers.size && !j.started).sort((a, b) => b.priority - a.priority)[0]
      if (!job) return
      active = job; job.started = true
      try {
        const value = await render({ ...job.payload, signal: job.abort.signal })
        if (job.consumers.size && !job.abort.signal.aborted) {
          if (value) remember(job.key, value)
          complete(job, value || null)
        }
      } catch { complete(job, null) }
      finally { if (active === job) active = null; resume() }
    }, 0)
  }
  return {
    retain() {
      users++; let released = false
      return () => {
        if (released) return
        released = true
        if (--users) return
        clearTimeout(timer); timer = null
        for (const job of [...jobs.values()]) { job.abort.abort(); complete(job, null) }
        active = null; dispose()
      }
    },
    get(payload) {
      const { key, signal, priority = 0 } = payload
      if (!users || signal?.aborted) return Promise.resolve(null)
      if (cache.has(key)) {
        const entry = cache.get(key); cache.delete(key); cache.set(key, entry)
        return Promise.resolve(entry.value)
      }
      let job = jobs.get(key)
      if (!job) {
        job = { key, payload, priority, consumers: new Set(), abort: new AbortController(), started: false }
        jobs.set(key, job)
      }
      job.priority = Math.max(job.priority, priority)
      const promise = new Promise(resolve => {
        const consumer = { finish(value) {
          signal?.removeEventListener('abort', cancel)
          job.consumers.delete(consumer); resolve(value)
        } }
        function cancel() {
          consumer.finish(null)
          if (!job.consumers.size) {
            job.abort.abort()
            if (jobs.get(key) === job) jobs.delete(key)
          }
        }
        job.consumers.add(consumer)
        signal?.addEventListener('abort', cancel, { once: true })
      })
      resume(); return promise
    },
    resume,
    has: key => cache.has(key),
    diagnostics: () => ({ cachedPosters: cache.size, cacheBytes: bytes, queuedPosters: [...jobs.values()].filter(j => !j.started).length, pendingPosters: jobs.size })
  }
}
