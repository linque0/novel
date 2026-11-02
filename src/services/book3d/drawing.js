export function textureCanvas(width = 1024, height = 1440) {
  if (typeof document === 'undefined') return new OffscreenCanvas(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  return canvas
}

export function textureFont(theme) {
  if (theme === 'gravity') return '"Microsoft YaHei", sans-serif'
  const fallback = theme === 'glaze' ? "'LXGW WenKai','KaiTi',serif" : "'KingHwa OldSong','OldSong','SimSun',serif"
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.body).getPropertyValue(theme === 'glaze' ? '--glaze-title' : '--crimson-serif').trim() || fallback
}
