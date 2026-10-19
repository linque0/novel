/* 重排设计稿的轻交互：章节目录收起 / 搜索 / 收起后的上一章下一章。只服务原型，不改数据。 */
(() => {
  const rail = document.querySelector('.c-chapter-rail')
  if (!rail) return
  const chapters = [...rail.querySelectorAll('[data-chapter-list] [data-chapter]')]
  const miniCurrent = rail.querySelector('[data-rail-current]')
  const toggle = rail.querySelector('[data-rail-toggle]')

  const syncMini = () => {
    const current = chapters.find((b) => b.classList.contains('current'))
    const num = current?.querySelector('.num')?.textContent?.trim()
    if (miniCurrent && num && miniCurrent.firstChild) miniCurrent.firstChild.nodeValue = num
  }

  toggle?.addEventListener('click', () => {
    document.body.classList.toggle('rail-collapsed')
    toggle.textContent = document.body.classList.contains('rail-collapsed') ? '›' : '‹'
    toggle.setAttribute('aria-label', document.body.classList.contains('rail-collapsed') ? '展开章节目录' : '收起章节目录')
  })

  const search = rail.querySelector('[data-chapter-search]')
  search?.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase()
    chapters.forEach((b) => {
      b.hidden = !!q && !b.textContent.toLowerCase().includes(q)
    })
  })

  const step = (dir) => {
    const visible = chapters.filter((b) => !b.hidden)
    const current = chapters.find((b) => b.classList.contains('current'))
    let index = visible.indexOf(current)
    if (index < 0) index = dir > 0 ? -1 : visible.length
    const target = visible[index + dir]
    if (!target) return
    target.click()
    target.scrollIntoView({ block: 'nearest' })
    syncMini()
  }

  rail.querySelector('[data-rail-prev]')?.addEventListener('click', () => step(-1))
  rail.querySelector('[data-rail-next]')?.addEventListener('click', () => step(1))
  rail.querySelector('[data-chapter-list]')?.addEventListener('click', (e) => {
    if (e.target.closest('[data-chapter]')) syncMini()
  })
  syncMini()
})()
