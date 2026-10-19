/* 折屏戏本 v3 原型增强：只同步当前态与月相进度，不读写业务数据。 */
(() => {
  const rail = document.querySelector('.c-chapter-rail')
  const chapters = rail ? [...rail.querySelectorAll('[data-chapter-list] [data-chapter]')] : []

  const markCurrent = () => {
    const groups = [
      ['.c-chapter-rail', '[data-chapter]'],
      ['.module-directory', '.directory-entry'],
      ['.characters-layout .cast-tabs', 'button'],
      ['.graph-index .cast-tabs', 'button'],
      ['.settings-categories', 'button'],
      ['.idea-papers', '.idea-paper'],
      ['.idea-categories', 'button']
    ]
    for (const [rootSelector, itemSelector] of groups) {
      const root = document.querySelector(rootSelector)
      if (!root) continue
      root.querySelectorAll(itemSelector).forEach((el) => {
        if (el.classList.contains('current')) el.setAttribute('aria-current', 'true')
        else el.removeAttribute('aria-current')
      })
    }
  }

  const syncProgress = () => {
    if (!rail || !chapters.length) return
    const index = chapters.findIndex((b) => b.classList.contains('current'))
    const progress = index < 0 ? 0 : (index + 1) / chapters.length
    rail.style.setProperty('--chapter-progress', progress.toFixed(4))
  }

  const update = () => {
    markCurrent()
    syncProgress()
  }

  update()
  document.addEventListener('click', () => setTimeout(update, 0), true)
  if (rail) {
    new MutationObserver(update).observe(rail.querySelector('[data-chapter-list]') || rail, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    })
  }
})()
