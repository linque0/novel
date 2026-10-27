import novel from '../../assets/skins/glaze-art/novel.png'
import note from '../../assets/skins/glaze-art/note.png'
import cedar from '../../assets/skins/glaze-art/cedar.png'
import violet from '../../assets/skins/glaze-art/violet.png'
import claret from '../../assets/skins/glaze-art/claret.png'
import ink from '../../assets/skins/glaze-art/ink.png'

export const PAINTINGS = { novel, note, cedar, violet, claret, ink }
const decoded = new Map()
export function prepareThemeArt(theme, kind) {
  if (theme !== 'glaze') return Promise.resolve()
  const key = PAINTINGS[kind] ? kind : 'novel'
  if (!decoded.has(key)) {
    const image = new Image()
    image.src = PAINTINGS[key]
    const promise = image.decode().then(() => image).catch(error => { decoded.delete(key); throw error })
    decoded.set(key, promise)
  }
  return decoded.get(key)
}
