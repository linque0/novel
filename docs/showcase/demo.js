const panels = [...document.querySelectorAll('.scenario')]
const links = [...document.querySelectorAll('.scenario-nav a')]
const get = id => document.getElementById(id)
const action = name => document.querySelector(`[data-action="${name}"]`)
const draft = get('draft')
const status = get('demo-status')
const board = get('outline-board')
const card = get('first-node')
const edge = get('event-edge')
const originalDraft = '雾钟没有按时响。林澜把航海日志摊在灯下，发现最后一个灯号被墨划去。\n\n码头的风越过窗缝，她把那一页轻轻折了角。'
const originalReview = get('review-original').textContent.trim()
const candidate = get('review-candidate').textContent.trim()
const sources = {
  fog: { name: '雾钟', note: '旧港每入夜敲钟三次，码头依末响辨认返航时刻。' },
  lin: { name: '林澜', note: '雾港的航路记录员。她能从航灯的缺口推断船只经过的方向。' }
}
const messages = {
  open: '从左侧打开「第一章 · 雾钟」开始。',
  outline: '先移动事件卡，再尝试连接和进入容器。',
  links: '先从侧栏选择一份设定或人物资料。',
  review: '对照原文和候选稿，选择接受或舍弃。'
}
let current
let x = 32
let y = 31
let dragging = null
let textOutline = false
let connected = false
let insideContainer = false
let currentSource = null
const placed = new Set()
const announce = message => { status.textContent = message }

function updateBoard() {
  card.style.left = x + '%'
  card.style.top = y + '%'
  edge.setAttribute('x1', x)
  edge.setAttribute('y1', y)
  edge.setAttribute('visibility', connected ? 'visible' : 'hidden')
}
function updateOutlineControls() {
  action('connect-nodes').setAttribute('aria-pressed', connected)
  action('connect-nodes').textContent = connected ? '断开两张事件卡' : '连接两张事件卡'
  action('toggle-outline').setAttribute('aria-pressed', textOutline)
  action('toggle-outline').textContent = textOutline ? '切换到画布大纲' : '切换到文本大纲'
  action('toggle-container').setAttribute('aria-pressed', insideContainer)
  action('toggle-container').textContent = insideContainer ? '返回第一卷' : '进入「第二卷」容器'
  board.hidden = textOutline
  get('outline-list').hidden = !textOutline
  get('outline-container').hidden = !insideContainer
  action('move-node').disabled = textOutline
  get('outline-steps').replaceChildren(...[
    '第一卷 · 雾钟失声',
    connected ? '翻阅航海日志（接续：雾钟失声）' : '翻阅航海日志',
    '第二卷 · 航灯旧事'
  ].map(text => {
    const item = document.createElement('li')
    item.textContent = text
    return item
  }))
  updateBoard()
}
function moveCard(nextX, nextY) {
  x = Math.min(79, Math.max(21, nextX))
  y = Math.min(81, Math.max(19, nextY))
  updateBoard()
}
function selectSource(id, focus = false) {
  currentSource = id
  const source = sources[id]
  get('source-detail').hidden = false
  get('source-title').textContent = source.name
  get('source-note').textContent = source.note
  action('add-reference').disabled = placed.has(id)
  if (focus) get('source-title').focus()
}
function renderReferences() {
  get('references').replaceChildren(...[...placed].flatMap(id => {
    const link = document.createElement('button')
    link.type = 'button'
    link.className = 'reference'
    link.dataset.action = 'jump-source'
    link.dataset.id = id
    link.textContent = sources[id].name
    return [document.createTextNode(' 查阅：'), link]
  }))
}

function reset(id) {
  if (id === 'open') {
    draft.value = originalDraft
    get('history-draft').textContent = originalDraft
    get('chapter-empty').hidden = false
    get('chapter-work').hidden = true
    get('history').hidden = true
    action('show-history').setAttribute('aria-expanded', 'false')
    get('draft-state').textContent = '演示稿已打开'
  } else if (id === 'outline') {
    x = 32
    y = 31
    connected = false
    textOutline = false
    insideContainer = false
    updateOutlineControls()
  } else if (id === 'links') {
    placed.clear()
    currentSource = null
    get('source-detail').hidden = true
    renderReferences()
  } else {
    get('review-result').textContent = originalReview
    action('accept').disabled = false
    action('discard').disabled = false
  }
}

function showScenario() {
  const requested = location.hash.slice(1)
  current = panels.some(panel => panel.id === requested) ? requested : 'open'
  for (const panel of panels) panel.hidden = panel.id !== current
  for (const link of links) {
    if (link.hash === '#' + current) link.setAttribute('aria-current', 'location')
    else link.removeAttribute('aria-current')
  }
  announce(messages[current])
}

const operations = {
  'open-chapter': () => {
    get('chapter-empty').hidden = true
    get('chapter-work').hidden = false
    draft.focus()
    announce('已打开章节。编辑正文后，可以从历史找回原稿。')
  },
  'show-history': button => {
    const pane = get('history')
    pane.hidden = !pane.hidden
    button.setAttribute('aria-expanded', String(!pane.hidden))
    if (!pane.hidden) announce('正在查看原始样稿。')
  },
  'restore-draft': () => {
    draft.value = originalDraft
    get('draft-state').textContent = '已恢复原始样稿'
    announce('已恢复原始样稿。')
  },
  'toggle-outline': () => {
    textOutline = !textOutline
    updateOutlineControls()
    announce(textOutline ? '已切换到文本大纲。' : '已切换到画布大纲。')
  },
  'connect-nodes': () => {
    connected = !connected
    updateOutlineControls()
    announce(connected ? '雾钟失声 → 翻阅航海日志，已建立接续关系。' : '已断开事件关联。')
  },
  'move-node': () => {
    moveCard(x >= 73 ? 32 : x + 8, y)
    announce('「雾钟失声」已移动。')
  },
  'toggle-container': () => {
    insideContainer = !insideContainer
    updateOutlineControls()
    announce(insideContainer ? '已进入第二卷，查看这一层的两个事件。' : '已返回第一卷。')
  },
  source: button => {
    selectSource(button.dataset.id)
    announce('已打开' + sources[currentSource].name + '。')
  },
  'add-reference': () => {
    if (!currentSource) return
    placed.add(currentSource)
    renderReferences()
    selectSource(currentSource)
    announce('已插入引用，点击正文中的条目可跳回来源。')
  },
  'jump-source': button => {
    selectSource(button.dataset.id, true)
    announce('已从正文跳回来源。')
  },
  accept: () => finishReview(true),
  discard: () => finishReview(false)
}
function finishReview(accepted) {
  get('review-result').textContent = accepted ? candidate : originalReview
  action('accept').disabled = true
  action('discard').disabled = true
  announce(accepted ? '已接受候选稿，当前稿面已更新。' : '已舍弃候选稿，当前稿面保留原文。')
}

draft.addEventListener('input', () => { get('draft-state').textContent = '修改已保留在演示中' })
card.addEventListener('pointerdown', event => {
  if (event.button !== 0) return
  dragging = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, x, y }
  card.setPointerCapture(event.pointerId)
})
card.addEventListener('pointermove', event => {
  if (event.pointerId !== dragging?.id) return
  const size = board.getBoundingClientRect()
  moveCard(dragging.x + (event.clientX - dragging.clientX) / size.width * 100,
    dragging.y + (event.clientY - dragging.clientY) / size.height * 100)
})
card.addEventListener('lostpointercapture', () => { dragging = null; announce('事件卡位置已更新。') })
card.addEventListener('keydown', event => {
  const delta = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[event.key]
  if (!delta) return
  event.preventDefault()
  moveCard(x + delta[0], y + delta[1])
  announce('事件卡已移动。')
})
get('reset-scenario').addEventListener('click', () => { reset(current); announce('当前演示已重置。' + messages[current]) })
document.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]')
  if (button && !button.disabled) operations[button.dataset.action]?.(button)
})
window.addEventListener('hashchange', showScenario)
for (const panel of panels) reset(panel.id)
showScenario()
