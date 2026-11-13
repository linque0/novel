import sunrise from '../assets/skins/glaze-gallery/world/impression-sunrise.webp'
import sunriseThumb from '../assets/skins/glaze-gallery/world/thumbs/impression-sunrise.webp'
import poppy from '../assets/skins/glaze-gallery/world/poppy-field.webp'
import poppyThumb from '../assets/skins/glaze-gallery/world/thumbs/poppy-field.webp'
import starry from '../assets/skins/glaze-gallery/world/starry-night.webp'
import starryThumb from '../assets/skins/glaze-gallery/world/thumbs/starry-night.webp'
import wave from '../assets/skins/glaze-gallery/world/great-wave.webp'
import waveThumb from '../assets/skins/glaze-gallery/world/thumbs/great-wave.webp'
import temeraire from '../assets/skins/glaze-gallery/world/fighting-temeraire.webp'
import temeraireThumb from '../assets/skins/glaze-gallery/world/thumbs/fighting-temeraire.webp'
import delft from '../assets/skins/glaze-gallery/world/view-of-delft.webp'
import delftThumb from '../assets/skins/glaze-gallery/world/thumbs/view-of-delft.webp'
import studioNovel from '../assets/skins/glaze-gallery/studio/novel.webp'
import studioNovelThumb from '../assets/skins/glaze-gallery/studio/thumbs/novel.webp'
import studioNote from '../assets/skins/glaze-gallery/studio/note.webp'
import studioNoteThumb from '../assets/skins/glaze-gallery/studio/thumbs/note.webp'
import studioCedar from '../assets/skins/glaze-gallery/studio/cedar.webp'
import studioCedarThumb from '../assets/skins/glaze-gallery/studio/thumbs/cedar.webp'
import studioViolet from '../assets/skins/glaze-gallery/studio/violet.webp'
import studioVioletThumb from '../assets/skins/glaze-gallery/studio/thumbs/violet.webp'
import studioClaret from '../assets/skins/glaze-gallery/studio/claret.webp'
import studioClaretThumb from '../assets/skins/glaze-gallery/studio/thumbs/claret.webp'
import studioInk from '../assets/skins/glaze-gallery/studio/ink.webp'
import studioInkThumb from '../assets/skins/glaze-gallery/studio/thumbs/ink.webp'

// Eager URLs, not eager image requests. Full-resolution originals are preview-only.
const displayAssets = import.meta.glob('../assets/skins/glaze-gallery/display/*/*.webp', { eager:true, query:'?url', import:'default' })

/* 背景画作。世界名画均为公版，来源与处理方式见 assets/skins/glaze-gallery/SOURCES.md。 */
export const WORLD_PAINTINGS = Object.freeze([
  { id: 'sunrise', group: 'world', title: '印象·日出', titleEn: 'Impression, Sunrise', artist: '克劳德·莫奈', artistEn: 'Claude Monet', year: '1872', museum: '马尔莫坦莫奈美术馆', src: sunrise, thumb: sunriseThumb, position: 'center 34%' },
  { id: 'poppy', group: 'world', title: '罂粟花田', titleEn: 'Poppy Field', artist: '克劳德·莫奈', artistEn: 'Claude Monet', year: '1873', museum: '奥赛博物馆', src: poppy, thumb: poppyThumb, position: 'center 52%' },
  { id: 'starry', group: 'world', title: '星月夜', titleEn: 'The Starry Night', artist: '文森特·梵高', artistEn: 'Vincent van Gogh', year: '1889', museum: '纽约现代艺术博物馆', src: starry, thumb: starryThumb, position: 'center 56%' },
  { id: 'wave', group: 'world', title: '神奈川冲浪里', titleEn: 'The Great Wave off Kanagawa', artist: '葛饰北斋', artistEn: 'Katsushika Hokusai', year: '约 1831', museum: '木版画', src: wave, thumb: waveThumb, position: 'center 45%' },
  { id: 'temeraire', group: 'world', title: '被拖去解体的战舰无畏号', titleEn: 'The Fighting Temeraire', artist: 'J. M. W. 透纳', artistEn: 'J. M. W. Turner', year: '1839', museum: '英国国家美术馆', src: temeraire, thumb: temeraireThumb, position: 'center 52%' },
  { id: 'delft', group: 'world', title: '代尔夫特风景', titleEn: 'View of Delft', artist: '约翰内斯·维米尔', artistEn: 'Johannes Vermeer', year: '约 1660–1661', museum: '莫瑞泰斯皇家美术馆', src: delft, thumb: delftThumb, position: 'center 52%' }
])

/* 工坊画作不再上封面，作为可选背景、空态沙龙和展签淡纹使用。 */
export const STUDIO_PAINTINGS = Object.freeze([
  { id: 'studio-novel', group: 'studio', kind: 'novel', title: '晨光睡莲', artist: '琉光工坊', year: '2026', note: '晨光下宽阔的蓝绿色水面，几朵淡粉睡莲。', src: studioNovel, thumb: studioNovelThumb, position: 'center 45%' },
  { id: 'studio-note', group: 'studio', kind: 'note', title: '晨园', artist: '琉光工坊', year: '2026', note: '晨光里的乡村花园，象牙色与浅金色的花圃。', src: studioNote, thumb: studioNoteThumb, position: 'center 45%' },
  { id: 'studio-cedar', group: 'studio', kind: 'cedar', title: '柳塘', artist: '琉光工坊', year: '2026', note: '垂柳低垂的池塘，灰绿色枝叶映在水面。', src: studioCedar, thumb: studioCedarThumb, position: 'center 45%' },
  { id: 'studio-violet', group: 'studio', kind: 'violet', title: '暮色睡莲', artist: '琉光工坊', year: '2026', note: '暮色中的睡莲池，丁香与长春花色倒影。', src: studioViolet, thumb: studioVioletThumb, position: 'center 45%' },
  { id: 'studio-claret', group: 'studio', kind: 'claret', title: '玫瑰倒影', artist: '琉光工坊', year: '2026', note: '日落时分的玫瑰园倒影，柔和的酒红与杏色。', src: studioClaret, thumb: studioClaretThumb, position: 'center 45%' },
  { id: 'studio-ink', group: 'studio', kind: 'ink', title: '雨后池畔', artist: '琉光工坊', year: '2026', note: '雨后池边的深蓝绿倒影与银灰光线。', src: studioInk, thumb: studioInkThumb, position: 'center 45%' }
])

export const PAINTING_GROUPS = Object.freeze([
  { id: 'world', label: '世界名画', note: 'PUBLIC DOMAIN MASTERWORKS', items: WORLD_PAINTINGS },
  { id: 'studio', label: '工坊印象', note: 'STUDIO IMPRESSIONS', items: STUDIO_PAINTINGS }
])

const ALL_PAINTINGS = [...WORLD_PAINTINGS, ...STUDIO_PAINTINGS]

export function paintingById(id) {
  const painting = ALL_PAINTINGS.find(painting => painting.id === id) || WORLD_PAINTINGS[0]
  const file = painting.group === 'studio' ? painting.kind : {sunrise:'impression-sunrise',poppy:'poppy-field',starry:'starry-night',wave:'great-wave',temeraire:'fighting-temeraire',delft:'view-of-delft'}[painting.id]
  return { ...painting, displaySrc:displayAssets[`../assets/skins/glaze-gallery/display/${painting.group}/${file}.webp`] || painting.src }
}

// Reserve the natural image box before decoding, including portrait studio works.
export function paintingDimensions(id) {
  const sizes = { sunrise:[3200,2482], poppy:[3200,2440], starry:[3200,2534], wave:[3200,2190], temeraire:[3200,2378], delft:[3000,2492] }
  const [width,height] = sizes[id] || [1086,1448]
  return { width,height }
}
