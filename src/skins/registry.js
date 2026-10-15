// A skin describes supported surfaces; unsupported surfaces retain the user's original theme.
export const SKINS = Object.freeze([
  { id: 'original', label: '原版工坊', description: '熟悉的书架与工作台', surfaces: ['shelf', 'work', 'panel'], palette: null },
  { id: 'gravity', label: '引力书舱 · 书架试用', description: '轨道舞台与悬浮书籍；其他页面沿用原版', surfaces: ['shelf'], palette: { background: '#0b131d', accent: '#f29c62', text: '#e3eceb' } }
])

export function normalizeSkin(value) {
  return SKINS.some(skin => skin.id === value) ? value : 'original'
}

export function resolveSkin(value, surface) {
  const skin = SKINS.find(skin => skin.id === normalizeSkin(value))
  return skin.surfaces.includes(surface) ? skin : SKINS[0]
}
