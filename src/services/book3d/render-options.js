import wenkai from '../../assets/fonts/files/lxgw-wenkai-sc-400.woff2?url'
import oldsong from '../../assets/fonts/files/kinghwa-oldsong-400.woff2?url'
import { textureFont } from './drawing'

const bundled = [{ family: 'LXGW WenKai', url: wenkai }, { family: 'KingHwa OldSong', url: oldsong }]
export function renderOptions(theme) {
  const font = textureFont(theme)
  return { font, faces: bundled.filter(face => font.includes(face.family)) }
}
