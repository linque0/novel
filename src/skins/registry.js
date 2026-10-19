// A skin describes supported surfaces; unsupported surfaces retain the user's original theme.
export const SKINS = Object.freeze([
  { id: 'original', label: '原版工坊', description: '熟悉的书架与工作台', surfaces: ['shelf', 'work', 'panel'], palette: null },
  { id: 'gravity', label: '引力书舱', description: '深海蓝、铜色轨道与安静的创作舱；覆盖书架、工作台和独立窗口', surfaces: ['shelf', 'work', 'panel'], palette: { background: '#0b131d', accent: '#f29c62', text: '#e3eceb' } },
  { id: 'glaze', label: '琉光画境', description: '浅青折射、玻璃叠册与文楷题名；覆盖书架、工作台和独立窗口', surfaces: ['shelf', 'work', 'panel'], palette: { background: '#e7eff1', accent: '#146878', text: '#234752' } },
  { id: 'crimson', label: '赤月戏', description: '墨纸旧金、折景舞台与宋体竖题；覆盖书架、工作台和独立窗口', surfaces: ['shelf', 'work', 'panel'], palette: { background: '#171c1b', accent: '#cfb06b', text: '#f0e7d5' } }
])

export function normalizeSkin(value) {
  return SKINS.some(skin => skin.id === value) ? value : 'original'
}

export function isStudioSkin(value) {
  return value === 'gravity' || value === 'glaze' || value === 'crimson'
}

export function resolveSkin(value, surface) {
  const skin = SKINS.find(skin => skin.id === normalizeSkin(value))
  return skin.surfaces.includes(surface) ? skin : SKINS[0]
}
