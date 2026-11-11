// A skin describes supported surfaces; unsupported surfaces retain the user's original theme.
// audience: 'desktop' = 桌面选择器可见。dsh（隐现）按桌面皮肤注册；pluginVisible 只让它
// 继续出现在插件构建的选择器里（插件构建仍由 installDshSkin() 强制为它），不改桌面归属。
/* selector: false = 注册但不出现在皮肤选择器里（皮肤仍可被已有存档选中，
 * normalizeSkin 也照旧认它，不会把老用户的选择打回默认）。 */
export const SKINS = Object.freeze([
  { id: 'dsh', label: '隐现', description: '中性深色、线条克制的桌面界面；覆盖书架、工作台和独立窗口', surfaces: ['shelf', 'work', 'panel'], palette: null, audience: 'desktop', pluginVisible: true },
  { id: 'original', label: '原版工坊', description: '熟悉的书架与工作台', surfaces: ['shelf', 'work', 'panel'], palette: null, audience: 'desktop' },
  { id: 'gravity', label: '引力书舱', description: '深海蓝、铜色轨道与安静的创作舱；覆盖书架、工作台和独立窗口', surfaces: ['shelf', 'work', 'panel'], palette: { background: '#0b131d', accent: '#f29c62', text: '#e3eceb' }, audience: 'desktop', selector: false },
  { id: 'glaze', label: '琉光画境', description: '浅青折射、玻璃叠册与文楷题名；覆盖书架、工作台和独立窗口', surfaces: ['shelf', 'work', 'panel'], palette: { background: '#e7eff1', accent: '#146878', text: '#234752' }, audience: 'desktop', selector: false },
  { id: 'crimson', label: '赤月戏', description: '墨纸旧金、折景舞台与宋体竖题；覆盖书架、工作台和独立窗口', surfaces: ['shelf', 'work', 'panel'], palette: { background: '#171c1b', accent: '#cfb06b', text: '#f0e7d5' }, audience: 'desktop' }
])

/* 新装默认皮肤：隐现。normalizeSkin 的回落值也用它，保证空库首启即隐现。 */
export const DEFAULT_SKIN = 'dsh'

/* 皮肤选择器可选项：在可见皮肤的范围内再剔除 selector:false 的两套。 */
export function selectableSkins(audience = 'desktop') {
  return visibleSkins(audience).filter(skin => skin.selector !== false)
}

/* 按受众取皮肤：省略 audience 时只给桌面皮肤（向后兼容旧调用）。
 * pluginVisible 的皮肤在插件构建里照旧可选，桌面归属不变。 */
export function visibleSkins(audience = 'desktop') {
  return SKINS.filter(skin => (skin.audience || 'desktop') === audience || (audience === 'plugin' && skin.pluginVisible === true))
}

/* 构建期常量在 node/vitest 直接 import 时并不存在，必须 typeof 守卫，不能裸引用。 */
export function isPluginBuild() {
  return typeof __NS_PLUGIN__ !== 'undefined' && __NS_PLUGIN__
}

export function visibleSkinsForBuild() {
  return visibleSkins(isPluginBuild() ? 'plugin' : 'desktop')
}

/* 只认当前构建可见的皮肤：不可见或未知的 skin 一律回落默认皮肤。
 * 回落值用 DEFAULT_SKIN（隐现）而不是 SKINS[0] 的字面量，避免两处口径漂移。 */
export function normalizeSkin(value) {
  return visibleSkinsForBuild().some(skin => skin.id === value) ? value : DEFAULT_SKIN
}

export function isStudioSkin(value) {
  return value === 'gravity' || value === 'glaze' || value === 'crimson'
}

/* 隐现（dsh）是桌面版第五套皮肤；只做身份判断，不并入 isStudioSkin 的旧三套分组。 */
export function isLatentSkin(value) {
  return value === 'dsh'
}

export function resolveSkin(value, surface) {
  const skin = SKINS.find(skin => skin.id === normalizeSkin(value))
  return skin.surfaces.includes(surface) ? skin : SKINS.find(s => s.id === DEFAULT_SKIN)
}
