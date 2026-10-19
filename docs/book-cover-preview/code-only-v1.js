/* 独立设计稿：仅更新本页 DOM 和预览 URL，不读写作品数据库。 */
const titleInput = document.querySelector('#book-title')
const authorInput = document.querySelector('#book-author')
const books = [...document.querySelectorAll('.book')]
const params = new URLSearchParams(location.search)
const defaults = { title: '山海来信', author: '林舟' }
const longTitle = '在世界尽头等一封来信'

titleInput.value = (params.get('title') ?? defaults.title).slice(0, 64)
authorInput.value = (params.get('author') ?? defaults.author).slice(0, 24)

function setParam(key, value) {
  const url = new URL(location.href)
  if (value === null) url.searchParams.delete(key)
  else url.searchParams.set(key, value)
  history.replaceState(null, '', url)
}

function renderCovers() {
  const title = titleInput.value.trim() || '未命名作品'
  const author = authorInput.value.trim()
  const chars = Array.from(title)
  const count = chars.length
  const authorChars = Array.from(author)
  for (const book of books) {
    book.classList.toggle('is-medium', count > 4 && count <= 8)
    book.classList.toggle('is-long', count > 8)
    book.classList.toggle('has-long-author', authorChars.length > 6)
    book.style.setProperty('--long-font', `${count > 40 ? 6.1 : count > 28 ? 7.5 : count > 18 ? 9.2 : 11.5}cqw`)
    const heading = book.querySelector('.cover-title')
    heading.replaceChildren()
    if (book.classList.contains('book--space') && count <= 8 && count > 1) {
      const split = Math.ceil(count / 2)
      for (const line of [chars.slice(0, split), chars.slice(split)]) {
        const span = document.createElement('span')
        span.textContent = line.join('')
        heading.append(span)
      }
    } else heading.textContent = title
    heading.title = title
    book.querySelector('.cover-author').textContent = author ? `${author} 著` : ''
    const seal = book.querySelector('[data-seal]')
    if (seal) {
      seal.textContent = authorChars.slice(0, 4).join('')
      seal.hidden = !author
      seal.style.fontSize = authorChars.length > 2 ? '4.5cqw' : ''
    }
    const name = book.closest('.cover-card').querySelector('h3').textContent
    book.setAttribute('aria-label', `${name}：${title}${author ? `，${author} 著` : ''}`)
  }
  setParam('title', titleInput.value === defaults.title ? null : titleInput.value)
  setParam('author', authorInput.value === defaults.author ? null : authorInput.value)
}

function setSize(size) {
  const value = size === 'shelf' ? 'shelf' : 'large'
  document.body.dataset.size = value
  document.querySelectorAll('[data-size]').forEach(button => {
    if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.size === value))
  })
  setParam('size', value === 'large' ? null : value)
}

function setBackdrop(dark) {
  document.body.dataset.backdrop = dark ? 'dark' : 'light'
  const button = document.querySelector('#backdrop')
  button.setAttribute('aria-pressed', String(dark))
  button.querySelector('span').textContent = dark ? '浅色衬底' : '深色衬底'
  setParam('backdrop', dark ? 'dark' : null)
}

titleInput.addEventListener('input', renderCovers)
authorInput.addEventListener('input', renderCovers)
document.querySelector('#long-title').addEventListener('click', () => {
  titleInput.value = titleInput.value === longTitle ? defaults.title : longTitle
  renderCovers()
  document.querySelector('#announcement').textContent = `书名已切换为${titleInput.value}`
})
document.querySelectorAll('button[data-size]').forEach(button => button.addEventListener('click', () => setSize(button.dataset.size)))
document.querySelector('#backdrop').addEventListener('click', () => setBackdrop(document.body.dataset.backdrop !== 'dark'))
document.querySelector('#reset').addEventListener('click', () => {
  titleInput.value = defaults.title
  authorInput.value = defaults.author
  setSize('large')
  setBackdrop(false)
  renderCovers()
  document.querySelector('#announcement').textContent = '已恢复默认书名、作者与展示设置'
})
renderCovers()
setSize(params.get('size'))
setBackdrop(params.get('backdrop') === 'dark')
