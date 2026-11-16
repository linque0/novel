const search = document.querySelector('#find-guide')
const results = document.querySelector('#search-results')
const status = document.querySelector('#search-status')
const resultList = results.querySelector('ul')
const sections = [...document.querySelectorAll('.guide-section')]
const contents = [...document.querySelectorAll('.guide-nav a')]
const normalize = text => text.normalize('NFKC').toLocaleLowerCase('zh-CN').trim()

const entries = sections.flatMap(section => {
  const parent = section.querySelector('h2').textContent
  return [...section.querySelectorAll('h3')].map(heading => ({
    href: '#' + heading.id,
    title: heading.textContent,
    parent,
    keywords: normalize(section.dataset.keywords),
    text: normalize(heading.nextElementSibling.textContent)
  }))
})

function searchGuide() {
  const terms = normalize(search.value).split(/\s+/).filter(Boolean)
  results.hidden = !terms.length
  resultList.replaceChildren()
  if (!terms.length) return

  const matches = entries.map(entry => {
    const heading = normalize(entry.title + ' ' + entry.parent)
    let score = 0
    for (const term of terms) {
      if (heading.includes(term)) score += 5
      else if (entry.text.includes(term)) score += 3
      else if (entry.keywords.includes(term)) score += 1
      else return null
    }
    return { entry, score }
  }).filter(Boolean).sort((first, second) => second.score - first.score)
  status.textContent = matches.length ? `找到 ${matches.length} 项操作` : '未找到操作。可以试试「正文」「搜索」或「备份」。'

  for (const { entry } of matches.slice(0, 12)) {
    const li = document.createElement('li')
    const link = document.createElement('a')
    link.href = entry.href
    link.textContent = entry.title + ' · ' + entry.parent
    li.append(link)
    resultList.append(li)
  }
}

function focusResult(hash) {
  const target = document.getElementById(hash.slice(1))
  if (!target) return
  target.tabIndex = -1
  target.focus({ preventScroll: true })
}

function updateContents() {
  const current = sections.findLast(section => section.getBoundingClientRect().top <= 180)
  for (const link of contents) {
    if (link.hash === '#' + current?.id) link.setAttribute('aria-current', 'location')
    else link.removeAttribute('aria-current')
  }
}

for (const button of document.querySelectorAll('.hotspot')) {
  const hint = document.getElementById(button.getAttribute('aria-controls'))
  hint.hidden = true
  button.addEventListener('click', () => {
    hint.hidden = !hint.hidden
    button.setAttribute('aria-expanded', String(!hint.hidden))
  })
}

search.addEventListener('input', searchGuide)
search.addEventListener('keydown', event => {
  if (event.key !== 'ArrowDown' && event.key !== 'Enter') return
  const first = resultList.querySelector('a')
  if (!first) return
  event.preventDefault()
  if (event.key === 'Enter') first.click()
  else first.focus()
})
resultList.addEventListener('click', event => {
  const link = event.target.closest('a')
  if (!link) return
  results.hidden = true
  focusResult(link.hash)
})
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    search.focus()
    search.select()
  } else if (event.key === 'Escape' && !results.hidden) {
    results.hidden = true
    search.focus()
  }
})
let pending = false
window.addEventListener('scroll', () => {
  if (pending) return
  pending = true
  requestAnimationFrame(() => { pending = false; updateContents() })
}, { passive: true })
window.addEventListener('hashchange', updateContents)
updateContents()
