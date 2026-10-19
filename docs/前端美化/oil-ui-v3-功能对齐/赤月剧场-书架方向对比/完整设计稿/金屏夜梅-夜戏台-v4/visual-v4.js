/* 夜戏台 v4 原型增强
   只做展示层：场字/场签、折幕转场、落印反馈、翻页、线描、环境光。
   不读写业务数据，不改变 studio.js / rework.js 的交互语义。 */
(() => {
  'use strict'

  const body = document.body
  const state = body.dataset.state || ''
  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  let reduced = reduceQuery.matches
  const staticView = () => body.classList.contains('static-view') || new URLSearchParams(location.search).has('static')
  const still = () => reduced || staticView()

  const scenes = {
    shelf: { glyph: '书', act: '序', name: '书架', host: '.nouveau-stage', seal: '目' },
    editor: { glyph: '文', act: '第一场', name: '正文', host: '.c-margin', seal: '文' },
    outline: { glyph: '纲', act: '第二场', name: '大纲', host: '.plot-canvas', seal: '纲' },
    'outline-text': { glyph: '纲', act: '第二场', name: '大纲 · 文本', host: '.outline-folio', seal: '纲' },
    world: { glyph: '境', act: '第三场', name: '设定', host: '.world-paper', seal: '境' },
    'world-detail': { glyph: '境', act: '第三场', name: '设定 · 详情', host: '.lore-paper', seal: '境' },
    characters: { glyph: '人', act: '第四场', name: '人物', host: '.portrait-folio', seal: '人' },
    'characters-graph': { glyph: '谱', act: '第五场', name: '关系谱', host: '.character-graph', seal: '谱' },
    inspiration: { glyph: '灵', act: '第六场', name: '灵感', host: '.idea-wall', seal: '灵' },
    settings: { glyph: '设', act: '第七场', name: '设置', host: '.settings-categories', seal: '设' }
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

  /* ── 场字 / 场签 ─────────────────────────────────────────── */
  const cfg = scenes[state]
  if (cfg) {
    const host = document.querySelector(cfg.host)
    if (host) {
      const mark = document.createElement('div')
      mark.className = 'v4-scene-mark'
      mark.setAttribute('aria-hidden', 'true')
      mark.innerHTML = `<span class="v4-glyph">${cfg.glyph}</span><span class="v4-act">${esc(cfg.act)} · ${esc(cfg.name)}<small>赤月夜戏</small></span><span class="v4-seal">${cfg.seal}</span>`
      host.prepend(mark)
    }
  }

  /* ── 极轻的跟随光斑：只在舞台层，正文纸面之上不参与 ───────── */
  if (!still() && window.matchMedia('(pointer:fine)').matches) {
    const stage = document.querySelector('.scene, .c-stage')
    if (stage) {
      const spot = document.createElement('div')
      spot.className = 'v4-spotlight'
      spot.setAttribute('aria-hidden', 'true')
      stage.prepend(spot)
      let raf = 0
      stage.addEventListener('pointermove', (e) => {
        if (raf) return
        raf = requestAnimationFrame(() => {
          const r = stage.getBoundingClientRect()
          stage.style.setProperty('--v4-mx', ((e.clientX - r.left) / r.width) * 100 + '%')
          stage.style.setProperty('--v4-my', ((e.clientY - r.top) / r.height) * 100 + '%')
          raf = 0
        })
      }, { passive: true })
    }
  }

  /* ── 章节月相进度 ───────────────────────────────────────── */
  const rail = document.querySelector('.c-chapter-rail')
  const chapters = rail ? [...rail.querySelectorAll('[data-chapter-list] [data-chapter]')] : []
  const syncProgress = () => {
    if (!rail || !chapters.length) return
    const index = chapters.findIndex((b) => b.classList.contains('current'))
    rail.style.setProperty('--chapter-progress', String((index < 0 ? 0 : index + 1) / chapters.length))
  }
  syncProgress()
  chapters.forEach((b) => b.addEventListener('click', () => requestAnimationFrame(syncProgress)))

  /* ── 落印反馈：按下时在指针处扩一圈墨晕 ───────────────────── */
  const pressSelector = [
    '.header .nav-item', '.chapter', '.cast-tabs > button', '.idea-paper',
    '.settings-categories > button', '.directory-entry', '.plot-node',
    '.portrait-node', '.primary', '.work-row', '.nouveau-chapter', '.graph-index .cast-tabs > button'
  ].join(',')
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || still()) return
    const el = e.target.closest(pressSelector)
    if (!el) return
    el.classList.remove('v4-pressed')
    void el.offsetWidth
    el.classList.add('v4-pressed')
    el.addEventListener('animationend', () => el.classList.remove('v4-pressed'), { once: true })
    const ink = document.createElement('span')
    ink.className = 'v4-ink'
    ink.setAttribute('aria-hidden', 'true')
    ink.style.left = e.clientX + 'px'
    ink.style.top = e.clientY + 'px'
    document.body.append(ink)
    setTimeout(() => ink.remove(), 460)
  }, true)

  /* ── 翻章：纸页遮罩盖住内容替换的瞬间 ─────────────────────── */
  document.addEventListener('click', (e) => {
    const chapter = e.target.closest('[data-chapter]')
    if (!chapter) return
    const book = document.querySelector('.c-book')
    if (!book) return
    if (!book.querySelector('.v4-turn')) {
      const turn = document.createElement('div')
      turn.className = 'v4-turn'
      turn.setAttribute('aria-hidden', 'true')
      book.append(turn)
    }
    if (still()) return
    book.classList.remove('v4-turning')
    void book.offsetWidth
    book.classList.add('v4-turning')
    setTimeout(() => book.classList.remove('v4-turning'), 380)
  }, true)

  /* ── 大纲：散页重排后重算墨线，避免连线停在旧坐标 ─────────── */
  const syncOutlineLines = () => {
    const canvas = document.querySelector('.plot-canvas')
    if (!canvas) return
    const svg = canvas.querySelector('.plot-lines')
    const path = svg?.querySelector('path')
    const events = [...canvas.querySelectorAll('.event')]
    if (!svg || !path || events.length !== 3) return
    const box = (n) => n ? {
      t: n.offsetTop, l: n.offsetLeft, r: n.offsetLeft + n.offsetWidth,
      y: n.offsetTop + n.offsetHeight / 2, b: n.offsetTop + n.offsetHeight,
      x: n.offsetLeft + n.offsetWidth / 2
    } : null
    const [a, b, c] = events.map(box)
    const note = box(canvas.querySelector('.plot-note'))
    const cite = box(canvas.querySelector('.plot-cite'))
    const anchor = box(canvas.querySelector('.plot-anchor'))
    if (!a || !b || !c || !note || !cite || !anchor) return
    svg.setAttribute('viewBox', `0 0 ${canvas.clientWidth} ${canvas.clientHeight}`)
    path.setAttribute('d',
      `M${a.r} ${a.y}C${a.r + 45} ${a.y} ${b.l - 45} ${b.y} ${b.l} ${b.y}` +
      `M${b.r} ${b.y}C${b.r + 30} ${b.y} ${c.l - 30} ${c.y} ${c.l} ${c.y}` +
      `M${a.x} ${a.b}L${note.x} ${note.t}` +
      `M${b.x} ${b.b}L${cite.x} ${cite.t}` +
      `M${c.x} ${c.b}L${anchor.x} ${anchor.t}`
    )
  }
  if (state === 'outline' || state === 'outline-text') {
    setTimeout(syncOutlineLines, 80)
    window.addEventListener('resize', syncOutlineLines)
  }

  /* ── Toast：每次文案变化都重新落一次 ─────────────────────── */
  const toast = document.querySelector('#toast')
  if (toast) {
    new MutationObserver(() => {
      if (!toast.textContent.trim()) return
      toast.classList.remove('v4-toast-in')
      void toast.offsetWidth
      toast.classList.add('v4-toast-in')
    }).observe(toast, { childList: true, characterData: true, subtree: true })
  }

  /* ── 设置切页：旧内容先退，新内容再进 ─────────────────────── */
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-settings-tab]')
    if (!tab || still()) return
    const panel = document.querySelector('[data-settings-panel]')
    if (!panel) return
    panel.classList.remove('v4-swap-out', 'v4-swap-in')
    panel.classList.add('v4-swap-out')
    setTimeout(() => {
      panel.classList.remove('v4-swap-out')
      panel.classList.add('v4-swap-in')
      setTimeout(() => panel.classList.remove('v4-swap-in'), 260)
    }, 90)
  }, true)

  /* ── 人物肖像 / 灵感阅读纸：替换时用墨色显影 ───────────────── */
  const portrait = document.querySelector('[data-main-portrait]')
  if (portrait) {
    new MutationObserver(() => {
      if (still()) return
      const frame = portrait.closest('.portrait-frame')
      if (!frame) return
      frame.classList.remove('v4-portrait-in')
      void frame.offsetWidth
      frame.classList.add('v4-portrait-in')
    }).observe(portrait, { attributes: true, attributeFilter: ['src'] })
  }
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-idea]') || still()) return
    const reader = document.querySelector('.idea-reader')
    if (!reader) return
    reader.classList.remove('v4-reader-in')
    void reader.offsetWidth
    reader.classList.add('v4-reader-in')
  }, true)

  /* ── 折幕转场：模块切换时落下，到达页升起 ─────────────────── */
  const routes = {
    '书架': { href: 'shelf.html', glyph: '书', act: '序', name: '书架' },
    '正文': { href: 'editor.html', glyph: '文', act: '第一场', name: '正文' },
    '大纲': { href: 'outline.html', glyph: '纲', act: '第二场', name: '大纲' },
    '设定': { href: 'world.html', glyph: '境', act: '第三场', name: '设定' },
    '人物': { href: 'characters.html', glyph: '人', act: '第四场', name: '人物' },
    '灵感': { href: 'inspiration.html', glyph: '灵', act: '第六场', name: '灵感' },
    '设置': { href: 'settings.html', glyph: '设', act: '第七场', name: '设置' },
    '章节': { href: 'editor.html', glyph: '文', act: '第一场', name: '正文' }
  }
  const targetOf = (el) => {
    if (el.dataset.module && routes[el.dataset.module]) return routes[el.dataset.module]
    if (el.dataset.intent && routes[el.dataset.intent]) return routes[el.dataset.intent]
    if (el.dataset.book) return routes['正文']
    if (el.tagName === 'A' && el.getAttribute('href')) {
      const href = el.getAttribute('href').split('?')[0]
      if (/^(shelf|editor|outline|world|characters|inspiration|settings)\.html$/.test(href)) {
        const found = Object.values(routes).find((r) => r.href === href)
        if (found) return found
      }
    }
    return null
  }

  const buildCurtain = (mode, route) => {
    const curtain = document.createElement('div')
    curtain.className = 'v4-curtain ' + (mode === 'close' ? 'is-closing' : 'is-opening')
    curtain.setAttribute('aria-hidden', 'true')
    for (let i = 0; i < 4; i++) {
      const pleat = document.createElement('span')
      pleat.className = 'v4-pleat'
      pleat.style.setProperty('--i', i)
      curtain.append(pleat)
    }
    const mark = document.createElement('div')
    mark.className = 'v4-curtain-mark'
    mark.innerHTML = `<span class="v4-curtain-glyph">${route?.glyph || '戏'}</span><span class="v4-curtain-act">${esc(route?.act || '')} · ${esc(route?.name || '')}</span><span class="v4-curtain-seal">场</span>`
    curtain.append(mark)
    document.body.append(curtain)
    return curtain
  }

  const routeKey = 'v4-route'
  const arrive = () => {
    let route = null
    try { route = JSON.parse(sessionStorage.getItem(routeKey) || 'null') } catch (_) { route = null }
    sessionStorage.removeItem(routeKey)
    if (!route || still()) return
    const curtain = buildCurtain('open', route)
    setTimeout(() => curtain.remove(), 620)
  }

  document.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (e.target.closest('[data-dialog], #overlay, [data-close]')) return
    const link = e.target.closest('a.nav-item, [data-module], [data-intent], [data-book]')
    if (!link) return
    const route = targetOf(link)
    if (!route) return
    const here = location.pathname.split('/').pop() || 'shelf.html'
    if (route.href === here) return
    e.preventDefault()
    e.stopImmediatePropagation()
    try { sessionStorage.setItem(routeKey, JSON.stringify(route)) } catch (_) { /* 预览环境可能禁用存储 */ }
    if (still()) {
      location.href = route.href
      return
    }
    buildCurtain('close', route)
    setTimeout(() => { location.href = route.href }, 430)
  }, true)

  arrive()

  /* ── 入场：只加一个 ready 类，CSS 负责节奏 ─────────────────── */
  requestAnimationFrame(() => {
    if (!reduced) body.classList.add('v4-motion')
    body.classList.add('v4-ready')
  })

  reduceQuery.addEventListener?.('change', (e) => {
    reduced = e.matches
    if (reduced) body.classList.remove('v4-motion')
    else body.classList.add('v4-motion')
  })
})()
