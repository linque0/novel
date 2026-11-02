import { createBookRenderer, diagnostics } from './engine'
import { BookInteraction } from './interaction'
import { Quaternion, Euler } from 'three'

let engine = null, currentFont = '', chain = Promise.resolve(), currentPose = null
const loadedFonts = new Map()
const initial = new BookInteraction().rotation
let hidden = false
const waiting = new Set()
function visible() { return hidden ? new Promise(resolve => waiting.add(resolve)) : Promise.resolve() }
async function fonts(options) {
  for (const { family, url } of options.faces || []) {
    const key = family + url
    if (!loadedFonts.has(key)) {
      const promise = new FontFace(family, `url("${url}")`).load().then(face => { self.fonts.add(face) }).catch(error => { loadedFonts.delete(key); throw error })
      loadedFonts.set(key, promise)
    }
    await loadedFonts.get(key)
  }
}
function rotation(pose = 'front', theme = '') {
  if (theme === 'glaze' && pose === 'front') return new Quaternion().setFromEuler(new Euler(-.06,.17,-.015)).toArray()
  const poses = { front: [-.13,.28,-.025], back: [-.1,Math.PI+.25,.02], spine: [-.1,1.2,0], paper: [-.1,-1.15,0], top: [1.08,.1,-.2], lying: [-1.05,.08,-1.64] }
  return new Quaternion().setFromEuler(new Euler(...(poses[pose] || poses.front))).toArray()
}
async function execute(type, data) {
  if (type === 'poster') {
    await fonts(data.options)
    await visible()
    if (engine && (engine.theme !== data.theme || currentFont !== data.options.font)) { engine.dispose(); engine = null }
    if (!engine) { currentFont = data.options.font; engine = createBookRenderer(new OffscreenCanvas(1,1), { poster:true, theme:data.theme, font:currentFont }) }
    const dimensions = data.theme === 'crimson' ? [224,320] : data.size === 'hero' ? [448,640] : data.pose === 'lying' ? [640,320] : [168,240]
    engine.resize(...dimensions)
    engine.setBook(data.book)
    engine.render(data.theme === 'crimson' ? initial : rotation(data.pose, data.theme), data.theme === 'crimson' ? 1.28 : 1)
    return engine.capture()
  }
  if (type === 'init') {
    await fonts(data.options)
    await visible()
    engine = createBookRenderer(data.canvas, { font: data.options.font })
    engine.canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); self.postMessage({ fatal: 'Book WebGL context lost' }) })
    engine.setBook(data.book)
    engine.resize(data.width, data.height, data.pixelRatio)
    currentPose = { rotation: data.rotation, zoom: data.zoom }
    engine.render(data.rotation, data.zoom)
    return true
  }
  if (!engine) throw new Error('Book renderer unavailable')
  if (type === 'setBook') { engine.setBook(data.book); currentPose = { rotation: data.rotation, zoom: data.zoom }; engine.render(data.rotation, data.zoom); return true }
  if (type === 'render') {
    if (data.width) engine.resize(data.width, data.height, data.pixelRatio)
    currentPose = { rotation: data.rotation, zoom: data.zoom }
    engine.render(data.rotation, data.zoom)
    return true
  }
  if (type === 'capture') { engine.render(currentPose.rotation, currentPose.zoom); return engine.capture() }
  throw new Error('Unknown book renderer command')
}
self.onmessage = ({ data: { id, type, data } }) => {
  if (type === 'visibility') {
    hidden = data.hidden
    if (!hidden) { for (const resolve of waiting) resolve(); waiting.clear() }
    return
  }
  chain = chain.then(async () => {
    try { await visible(); const value = await execute(type, data); self.postMessage({ id, value, stats: { ...diagnostics } }) }
    catch (error) { engine?.dispose(); engine = null; self.postMessage({ id, error: String(error?.message || error), stats: { ...diagnostics } }) }
  })
}
