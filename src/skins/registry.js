// 旧皮肤描述供内部兼容，运行时始终启用 dsh。
export const SKINS = Object.freeze([
  { id: 'dsh', label: '幻流', description: '中性深色、线条克制的桌面界面；覆盖书架、工作台和独立窗口', surfaces: ['shelf', 'work', 'panel'], palette: null, audience: 'desktop', pluginVisible: true },
  { id: 'original', label: '原版工坊', description: '熟悉的书架与工作台', surfaces: ['shelf', 'work', 'panel'], palette: null, audience: 'desktop' },
  { id: 'gravity', label: '引力书舱', description: '深海蓝、铜色轨道与安静的创作舱；覆盖书架、工作台和独立窗口', surfaces: ['shelf', 'work', 'panel'], palette: { background: '#0b131d', accent: '#f29c62', text: '#e3eceb' }, audience: 'desktop', selector: false },
  { id: 'glaze', label: '琉光画境', description: '浅青折射、玻璃叠册与文楷题名；覆盖书架、工作台和独立窗口', surfaces: ['shelf', 'work', 'panel'], palette: { background: '#e7eff1', accent: '#146878', text: '#234752' }, audience: 'desktop', selector: false },
  { id: 'crimson', label: '赤月戏', description: '墨纸旧金、折景舞台与宋体竖题；覆盖书架、工作台和独立窗口', surfaces: ['shelf', 'work', 'panel'], palette: { background: '#171c1b', accent: '#cfb06b', text: '#f0e7d5' }, audience: 'desktop' }
])

export const DEFAULT_SKIN = 'dsh'

export function visibleSkins(audience = 'desktop') {
  return SKINS.filter(skin => skin.id === DEFAULT_SKIN && (skin.audience === audience || (audience === 'plugin' && skin.pluginVisible)))
}

/* 构建期常量在 node/vitest 直接 import 时并不存在，必须 typeof 守卫，不能裸引用。 */
export function isPluginBuild() {
  return typeof __NS_PLUGIN__ !== 'undefined' && __NS_PLUGIN__
}

export function visibleSkinsForBuild() {
  return visibleSkins(isPluginBuild() ? 'plugin' : 'desktop')
}

/* 旧版外观偏好读入时统一迁移到幻流，保留已有的浅色和深色设置。 */
export function normalizeSkin() {
  return DEFAULT_SKIN
}

export function isStudioSkin(value) {
  return value === 'gravity' || value === 'glaze' || value === 'crimson'
}

export function isLatentSkin(value) {
  return value === 'dsh'
}

export function resolveSkin(value, surface) {
  const skin = SKINS.find(skin => skin.id === normalizeSkin(value))
  return skin.surfaces.includes(surface) ? skin : SKINS.find(s => s.id === DEFAULT_SKIN)
}
