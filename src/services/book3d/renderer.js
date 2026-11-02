import { createPosterQueue } from './poster-queue'
import { createWorkerClient, workerDiagnostics } from './worker-client'
import { renderOptions } from './render-options'
import { diagnostics as coreDiagnostics } from './engine'
export { createBookRenderer } from './engine' // Reference rendering for visual verification.
import { Quaternion, Euler } from 'three'

const snapshot = book => Object.fromEntries(['id','kind','title','author','intro'].map(key => [key, book[key] ?? '']))
let posterWorker = null
const posters = createPosterQueue({
  hidden: () => document.hidden,
  render: job => {
    if (!posterWorker) posterWorker = createWorkerClient(() => { posterWorker = null })
    const current = posterWorker
    const cancel = () => { if (posterWorker === current) { current.dispose(); posterWorker = null } }
    job.signal.addEventListener('abort', cancel, { once: true })
    return current.request('poster', { book: job.book, theme: job.theme, size: job.size, pose: job.pose, options: job.options }, { signal: job.signal }).finally(() => job.signal.removeEventListener('abort', cancel))
  },
  dispose: () => { posterWorker?.dispose(); posterWorker = null }
})
export const retainBookPosters = () => posters.retain()
export function getBookPoster(book, { theme = 'crimson', size = 'mini', pose = 'front', signal, priority = size === 'hero' ? 10 : 0 } = {}) {
  if (document.hidden || signal?.aborted) return Promise.resolve(null)
  const options = renderOptions(theme), data = snapshot(book)
  const key = JSON.stringify([theme,size,pose,data,options])
  return posters.get({ key, book:data, theme, size, pose, options, signal, priority })
}
export function getBook3DDiagnostics() {
  const worker = workerDiagnostics()
  return { ...worker, ...Object.fromEntries(['viewers','posterRenderers','models','frames'].map(key => [key, worker[key] + coreDiagnostics[key]])), ...posters.diagnostics() }
}
export function themeRotation(pose = 'front') {
  const poses = { front:[-.13,.28,-.025], back:[-.1,Math.PI+.25,.02], spine:[-.1,1.2,0], paper:[-.1,-1.15,0], top:[1.08,.1,-.2], lying:[-1.05,.08,-1.64] }
  return new Quaternion().setFromEuler(new Euler(...(poses[pose] || poses.front))).toArray()
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) posters.resume() })

export async function createBookViewer(canvas, { book, width, height, pixelRatio, rotation, zoom = 1, signal, onError = () => {} }) {
  const client = createWorkerClient(onError)
  let disposed = false, inFlight = false, latest = null
  const size = { width, height, pixelRatio }
  let pose = { rotation: [...rotation], zoom }
  function dispose() { if (disposed) return; disposed = true; latest = null; signal?.removeEventListener('abort', dispose); client.dispose() }
  signal?.addEventListener('abort', dispose, { once: true })
  try {
    if (signal?.aborted || !canvas.transferControlToOffscreen) throw new Error('Background canvas unavailable')
    const offscreen = canvas.transferControlToOffscreen()
    await client.request('init', { canvas:offscreen, book:snapshot(book), options:renderOptions('crimson'), ...size, ...pose }, { signal, transfer:[offscreen] })
    if (disposed) throw new Error('Book viewer released')
  } catch (error) { dispose(); throw error }
  function flush() {
    if (disposed || inFlight || !latest || document.hidden) return
    const data = latest; latest = null; inFlight = true
    client.request('render', data).catch(error => { if (!disposed) { dispose(); onError(error) } }).finally(() => { inFlight = false; flush() })
  }
  return {
    async setBook(book, next = pose) {
      pose = { rotation:[...next.rotation], zoom:next.zoom }; latest = null
      await client.request('setBook', { book:snapshot(book), ...pose }, { signal })
    },
    resize(width, height, pixelRatio = devicePixelRatio || 1) { Object.assign(size, { width, height, pixelRatio }) },
    render(rotation, zoom = 1) { pose = { rotation:[...rotation], zoom }; latest = { ...size, ...pose }; flush() },
    capture: () => client.request('capture', {}),
    dispose
  }
}
