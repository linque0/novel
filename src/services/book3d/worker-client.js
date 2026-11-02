const clients = new Set()
let frames = 0
export function workerDiagnostics() {
  const result = { workers: clients.size, viewers: 0, posterRenderers: 0, models: 0, frames }
  for (const client of clients) for (const key of ['viewers','posterRenderers','models']) result[key] += client.stats[key] || 0
  return result
}

export function createWorkerClient(onError = () => {}) {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') throw new Error('Background book rendering unavailable')
  const worker = new Worker(new URL('./render.worker.js', import.meta.url), { type: 'module', name: 'book-renderer' })
  const pending = new Map()
  let sequence = 0, disposed = false, previousFrames = 0
  let hidden = typeof document !== 'undefined' && document.hidden
  const client = { stats: {}, request, dispose }
  clients.add(client)
  function dispose(reason = new Error('Book renderer released')) {
    if (disposed) return
    disposed = true; worker.terminate(); clients.delete(client)
    documentIfAvailable()?.removeEventListener('visibilitychange', visibility)
    for (const request of [...pending.values()]) request.finish(reason)
  }
  function fail(reason) { dispose(reason); onError(reason) }
  function visibility() {
    hidden = document.hidden
    for (const request of pending.values()) { if (hidden) request.pause(); else request.resume() }
    worker.postMessage({ type:'visibility', data:{ hidden } })
  }
  function documentIfAvailable() { return typeof document === 'undefined' ? null : document }
  documentIfAvailable()?.addEventListener('visibilitychange', visibility)
  worker.postMessage({ type:'visibility', data:{ hidden } })
  worker.onerror = event => { event.preventDefault(); fail(new Error(event.message || 'Book worker failed')) }
  worker.onmessageerror = () => fail(new Error('Book worker response failed'))
  worker.onmessage = ({ data }) => {
    if (data.fatal) { fail(new Error(data.fatal)); return }
    if (data.stats) {
      client.stats = data.stats
      frames += Math.max(0, data.stats.frames - previousFrames)
      previousFrames = data.stats.frames
    }
    pending.get(data.id)?.finish(data.error ? new Error(data.error) : null, data.value)
  }
  function request(type, data, { signal, transfer = [] } = {}) {
    if (disposed || signal?.aborted) return Promise.reject(new Error('Book request cancelled'))
    const id = ++sequence
    return new Promise((resolve, reject) => {
      let timeout = null, remaining = 15000, started = 0
      function pause() { if (timeout !== null) { clearTimeout(timeout); timeout = null; remaining -= performance.now() - started } }
      function resume() { if (timeout !== null) return; started = performance.now(); timeout = setTimeout(() => fail(new Error('Book initialization timed out')), Math.max(0,remaining)) }
      function cancel() { finish(new Error('Book request cancelled')) }
      function finish(error, value) {
        clearTimeout(timeout); signal?.removeEventListener('abort', cancel); pending.delete(id)
        if (error) reject(error); else resolve(value)
      }
      pending.set(id, { finish, pause, resume }); signal?.addEventListener('abort', cancel, { once: true })
      if (!hidden) resume()
      try { worker.postMessage({ id, type, data }, transfer) }
      catch (error) { finish(error) }
    })
  }
  return client
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', () => { for (const client of [...clients]) client.dispose() })
