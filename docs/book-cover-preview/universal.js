// 通用书封素材层 + 可编辑排版层；预览设置仅写入 URL，不操作作品数据。
const covers = [
  { id: 'cloth-archive', type: 'cloth', name: '布面典藏', material: '深蓝织纹 · 银杏金饰', colors: ['#193347', '#c19b59', '#e8d9b5'], label: '小说工坊 · 典藏' },
  { id: 'mist-paper', type: 'mist', name: '山岚纸本', material: '纤维纸本 · 青黛山岚', colors: ['#ece0c5', '#5b777c', '#bf7850'], label: '小说工坊 · 文库' },
  { id: 'floral-foil', type: 'floral', name: '花影烫金', material: '酒红布面 · 玉兰金线', colors: ['#5d2b32', '#e3cfad', '#b29658'], label: '' },
  { id: 'geometric-print', type: 'geometry', name: '几何诗页', material: '棉纸颗粒 · 拼贴版画', colors: ['#f2e7d3', '#ae4c35', '#293d61'], label: '' }
]
const gallery = document.querySelector('#gallery')
const titleInput = document.querySelector('#book-title')
const authorInput = document.querySelector('#book-author')
const params = new URLSearchParams(location.search)
const defaults = { title: '山海来信', author: '林舟' }
const longTitle = '在世界尽头等一封来信'
const dialog = document.querySelector('#detail-dialog')
let activeCover = null

gallery.innerHTML = covers.map((cover, index) => `
  <article class="cover-card" data-id="${cover.id}">
    <div class="book-stage">
      <div class="book cover--${cover.type}" role="img">
        <img class="cover-art" src="assets/${cover.id}.webp" alt="" width="768" height="1152" decoding="async" fetchpriority="${index === 0 ? 'high' : 'auto'}">
        <div class="cover-lettering"><span class="cover-label" aria-hidden="true">${cover.label}</span><h2 class="cover-title"></h2><span class="cover-rule" aria-hidden="true"></span><p class="cover-author"></p></div>
      </div>
      <button type="button" class="enlarge-button" aria-label="放大查看${cover.name}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4"/></svg></button>
    </div>
    <div class="caption"><div class="caption-line"><span class="style-number">0${index + 1}</span><h2>${cover.name}</h2><span class="palette" aria-hidden="true">${cover.colors.map(color => `<i style="background:${color}"></i>`).join('')}</span></div><p class="material-description">${cover.material}</p><a class="asset-link" href="assets/originals/${cover.id}.png" download>下载无字原图<span aria-hidden="true">↓</span></a></div>
  </article>`).join('')

const books = [...gallery.querySelectorAll('.book')]
titleInput.value = Array.from(params.get('title') ?? defaults.title).slice(0, 64).join('')
authorInput.value = Array.from(params.get('author') ?? defaults.author).slice(0, 24).join('')

function setParam(key, value) {
  const url = new URL(location.href)
  if (value === null) url.searchParams.delete(key)
  else url.searchParams.set(key, value)
  history.replaceState(null, '', url)
}

function updateCoverNames() {
  const material = gallery.dataset.view === 'material'
  const title = titleInput.value.trim() || '未命名作品'
  const author = authorInput.value.trim()
  books.forEach((book, index) => book.setAttribute('aria-label', material
    ? `${covers[index].name}，无字封面素材`
    : `${covers[index].name}：${title}${author ? `，${author} 著` : ''}`))
}

function renderCovers() {
  const title = titleInput.value.trim() || '未命名作品'
  const author = authorInput.value.trim()
  const chars = Array.from(title)
  const count = chars.length
  const font = count > 40 ? 5.4 : count > 28 ? 6.6 : count > 18 ? 8.2 : 10.5
  for (const book of books) {
    book.classList.toggle('is-medium', count > 4 && count <= 8)
    book.classList.toggle('is-long', count > 8)
    book.classList.toggle('has-long-author', Array.from(author).length > 6)
    book.style.setProperty('--long-font', `${font}cqw`)
    book.style.setProperty('--geometry-font', `${font * .92}cqw`)
    const heading = book.querySelector('.cover-title')
    heading.replaceChildren()
    if (count > 1 && count <= 8 && (book.classList.contains('cover--cloth') || (count > 4 && book.classList.contains('cover--geometry')))) {
      const split = Math.ceil(count / 2)
      for (const line of [chars.slice(0, split), chars.slice(split)]) {
        const span = document.createElement('span')
        span.textContent = line.join('')
        heading.append(span)
      }
    } else heading.textContent = title
    heading.title = title
    book.querySelector('.cover-author').textContent = author ? `${author} 著` : ''
  }
  updateCoverNames()
  setParam('title', titleInput.value === defaults.title ? null : titleInput.value)
  setParam('author', authorInput.value === defaults.author ? null : authorInput.value)
  if (dialog.open && activeCover !== null) populateDetail(activeCover)
}

function setView(view) {
  const value = view === 'material' ? 'material' : 'cover'
  gallery.dataset.view = value
  document.querySelectorAll('button[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === value)))
  updateCoverNames()
  setParam('view', value === 'cover' ? null : value)
}

function setSize(shelf) {
  document.body.dataset.size = shelf ? 'shelf' : 'large'
  const button = document.querySelector('#size-toggle')
  button.setAttribute('aria-pressed', String(shelf))
  button.textContent = shelf ? '封面大图' : '书架尺寸'
  setParam('size', shelf ? 'shelf' : null)
}

function setBackdrop(dark) {
  document.body.dataset.backdrop = dark ? 'dark' : 'light'
  const button = document.querySelector('#backdrop')
  button.setAttribute('aria-pressed', String(dark))
  button.setAttribute('aria-label', dark ? '切换为浅色衬底' : '切换为深色衬底')
  setParam('backdrop', dark ? 'dark' : null)
}

function populateDetail(index) {
  const book = books[index].cloneNode(true)
  const image = book.querySelector('.cover-art')
  image.src = `assets/originals/${covers[index].id}.png`
  image.removeAttribute('fetchpriority')
  book.querySelector('.cover-lettering').hidden = gallery.dataset.view === 'material'
  document.querySelector('#detail-book').replaceChildren(book)
  document.querySelector('#detail-title').textContent = covers[index].name
  document.querySelector('#detail-original').href = `assets/originals/${covers[index].id}.png`
}

titleInput.addEventListener('input', renderCovers)
authorInput.addEventListener('input', renderCovers)
document.querySelector('#long-title').addEventListener('click', () => {
  titleInput.value = titleInput.value === longTitle ? defaults.title : longTitle
  renderCovers()
  document.querySelector('#announcement').textContent = `书名已切换为${titleInput.value}`
})
document.querySelectorAll('button[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)))
document.querySelector('#size-toggle').addEventListener('click', () => setSize(document.body.dataset.size !== 'shelf'))
document.querySelector('#backdrop').addEventListener('click', () => setBackdrop(document.body.dataset.backdrop !== 'dark'))
gallery.querySelectorAll('.enlarge-button').forEach((button, index) => button.addEventListener('click', () => {
  activeCover = index
  populateDetail(index)
  dialog.showModal()
}))
document.querySelector('#close-detail').addEventListener('click', () => dialog.close())
dialog.addEventListener('close', () => { activeCover = null })
document.querySelector('#reset').addEventListener('click', () => {
  titleInput.value = defaults.title
  authorInput.value = defaults.author
  setView('cover')
  setSize(false)
  setBackdrop(false)
  renderCovers()
  document.querySelector('#announcement').textContent = '已恢复默认封面与展示设置'
})
renderCovers()
setView(params.get('view'))
setSize(params.get('size') === 'shelf')
setBackdrop(params.get('backdrop') === 'dark')
