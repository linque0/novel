/**
 * 作品文件导入与格式解析管线：
 * 支持 TXT（自动探测 UTF-16/UTF-8/GB18030 与智能分章）、Markdown、DOCX（经主进程 mammoth）、
 * EPUB（JSZip 解包 OPF/Spine 与封面）及 PDF（文本提取与扫描件分页栅格化）。
 */
import JSZip from 'jszip'

/* ================= 文本解码（中文编码兼容） ================= */

export function decodeText(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  if (u8[0] === 0xff && u8[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(u8.subarray(2)), encoding: 'utf-16le' }
  if (u8[0] === 0xfe && u8[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(u8.subarray(2)), encoding: 'utf-16be' }
  if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) return { text: new TextDecoder('utf-8').decode(u8.subarray(3)), encoding: 'utf-8' }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(u8), encoding: 'utf-8' }
  } catch {
    return { text: new TextDecoder('gb18030').decode(u8), encoding: 'gb18030' }
  }
}

/* ================= 智能分章 ================= */

const TXT_TITLE_RE =
  /^\s*((?:第\s*[0-9零一二三四五六七八九十百千万两]+\s*[章回节卷部集幕场])|(?:Chapter\s+\d+)|(?:CHAPTER\s+\d+)|(?:楔子)|(?:序章)|(?:序言)|(?:序)|(?:引子)|(?:序幕)|(?:尾声)|(?:后记)|(?:终章)|(?:番外\S{0,12}))(?:[\s：:|·、]*(\S.{0,40}))?\s*$/

export function splitTxtChapters(text, fallbackTitle = '导入章节') {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const sections = []
  let cur = null
  for (const line of lines) {
    const m = line.match(TXT_TITLE_RE)
    if (m) {
      const suffix = (m[2] || '').trim()
      cur = { title: (suffix ? `${m[1]} ${suffix}` : m[1]).slice(0, 60), text: [], fromHeading: true }
      sections.push(cur)
    } else {
      if (!cur) {
        cur = { title: fallbackTitle.slice(0, 60), text: [], fromHeading: false }
        sections.push(cur)
      }
      cur.text.push(line)
    }
  }
  const out = sections.map((s) => ({ title: s.title, text: s.text.join('\n').trim(), fromHeading: s.fromHeading })).filter((s) => s.text.length > 0)
  if (out.length < 2) {
    const firstLine = text.trim().split('\n')[0]?.trim() || fallbackTitle
    return [{ title: firstLine.slice(0, 40), text: text.trim() }]
  }
  // 开头无章节标题的短前言（书名/作者行）并入第一章，避免产生孤章。
  // 仅限「文件开头本就没有章节标题」的段——真正的短首章（如短楔子）标题不丢（v1.0.22 修复）
  if (out.length >= 2 && !out[0].fromHeading && out[0].text.length < 120) {
    out[1].text = (out[0].text + '\n\n' + out[1].text).trim()
    out.shift()
  }
  return out
}

export function splitMarkdown(text, fallbackTitle = '导入章节') {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const used = lines.find((l) => /^#{1,2}\s+\S/.test(l))?.match(/^(#+)/)?.[1]
  if (!used) {
    const firstLine = text.trim().split('\n')[0]?.trim() || fallbackTitle
    return [{ title: firstLine.replace(/^#+\s*/, '').slice(0, 40), text: text.trim() }]
  }
  const re = new RegExp(`^${used}\\s+(.+)`)
  const sections = []
  let cur = null
  for (const line of lines) {
    const m = line.match(re)
    if (m) {
      cur = { title: m[1].trim().slice(0, 60), text: [] }
      sections.push(cur)
    } else if (cur) {
      cur.text.push(line)
    }
  }
  const out = sections.map((s) => ({ title: s.title, text: s.text.join('\n').trim() })).filter((s) => s.text)
  return out.length ? out : [{ title: fallbackTitle, text: text.trim() }]
}

/* ================= HTML → Markdown ================= */

export function htmlToMd(html) {  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out = []
  const walk = (node) => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) {
        out.push(n.textContent)
        continue
      }
      if (n.nodeType !== 1) continue
      const tag = n.tagName.toLowerCase()
      if (/^h[1-6]$/.test(tag)) {
        out.push('\n\n' + '#'.repeat(+tag[1]) + ' ' + n.textContent.trim() + '\n\n')
      } else if (tag === 'br') {
        out.push('\n')
      } else if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article') {
        walk(n)
        out.push('\n\n')
      } else if (tag === 'li') {
        out.push('\n- ')
        walk(n)
      } else if (tag === 'blockquote') {
        out.push('\n> ')
        walk(n)
        out.push('\n')
      } else if (tag === 'hr') {
        out.push('\n\n---\n\n')
      } else if (tag === 'img') {
        out.push(`![](${n.getAttribute('src') || ''})`)
      } else if (tag === 'strong' || tag === 'b') {
        out.push('**')
        walk(n)
        out.push('**')
      } else if (tag === 'em' || tag === 'i') {
        out.push('*')
        walk(n)
        out.push('*')
      } else {
        walk(n)
      }
    }
  }
  walk(doc.body)
  return out.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** HTML → 纯文本（块级元素转换行），用于 TXT 导出 */
export function htmlToPlain(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html')
  doc.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li,blockquote,tr').forEach((el) => el.append('\n'))
  return (doc.body.textContent || '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function splitHtmlByHeadings(html, fallbackTitle = '导入章节') {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const children = [...doc.body.children]
  const firstHeading = children.find((el) => /^H[12]$/.test(el.tagName))
  if (!firstHeading) return [{ title: (doc.title || fallbackTitle).slice(0, 60), text: htmlToMd(html) }]
  const level = firstHeading.tagName
  const sections = []
  let cur = null
  for (const el of children) {
    if (el.tagName === level) {
      cur = { title: el.textContent.trim().slice(0, 60) || `章节 ${sections.length + 1}`, parts: [] }
      sections.push(cur)
    } else if (cur) {
      cur.parts.push(el.outerHTML)
    } else {
      cur = { title: fallbackTitle, parts: [el.outerHTML] }
      sections.push(cur)
    }
  }
  return sections.map((s) => ({ title: s.title, text: htmlToMd(s.parts.join('\n')) })).filter((s) => s.text.trim())
}

/* ================= PDF ================= */

export async function parsePdf(data, onProgress = () => {}) {
  const pdfjsLib = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const n = pdf.numPages
  const pages = []
  for (let i = 1; i <= n; i++) {
    const page = await pdf.getPage(i)
    const tc = await page.getTextContent()
    pages.push(
      tc.items
        .map((it) => it.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    onProgress(i, n)
  }
  const totalChars = pages.join('').length
  const scanned = totalChars < n * 20

  let sections = null
  if (!scanned) {
    try {
      const outline = await pdf.getOutline()
      if (outline?.length) {
        const items = []
        const resolvePage = async (dest) => {
          try {
            const d = typeof dest === 'string' ? await pdf.getDestination(dest) : dest
            if (!d?.length) return null
            const ref = d[0]
            if (ref && typeof ref === 'object') return await pdf.getPageIndex(ref)
            return null
          } catch {
            return null
          }
        }
        for (const it of outline) {
          const pi = await resolvePage(it.dest)
          if (pi != null) items.push({ title: (it.title || '').trim().slice(0, 60), page: pi })
        }
        if (items.length >= 2) {
          items.sort((a, b) => a.page - b.page)
          sections = items.map((it, idx) => ({
            title: it.title || `第${idx + 1}节`,
            text: pages.slice(it.page, items[idx + 1]?.page ?? n).join('\n')
          })).filter((s) => s.text.trim())
        }
      }
    } catch {
      /* 无书签或解析失败，回退单章 */
    }
  }
  return { numPages: n, pages, scanned, sections }
}

/** 扫描版 PDF：把页面渲染为图片以便存为素材 */
export async function pdfPagesToImages(data, maxPages = 30, onProgress = () => {}) {
  const pdfjsLib = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const out = []
  const count = Math.min(pdf.numPages, maxPages)
  for (let i = 1; i <= count; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.82))
    if (blob) out.push({ name: `page-${String(i).padStart(3, '0')}.jpg`, blob })
    onProgress(i, count)
  }
  return out
}

/* ================= EPUB ================= */

export async function parseEpub(data) {
  const zip = await JSZip.loadAsync(data)
  const containerFile = zip.file('META-INF/container.xml')
  if (!containerFile) throw new Error('不是有效的 EPUB 文件')
  const containerXml = await containerFile.async('string')
  const opfPath = new DOMParser().parseFromString(containerXml, 'text/xml').querySelector('rootfile')?.getAttribute('full-path')
  if (!opfPath) throw new Error('EPUB 缺少 OPF 描述文件')
  const opfName = opfPath.split('/').pop()
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''
  const opfXml = await zip.file(opfPath).async('string')
  const opf = new DOMParser().parseFromString(opfXml, 'text/xml')
  const manifest = {}
  opf.querySelectorAll('manifest > item').forEach((it) => {
    manifest[it.getAttribute('id')] = {
      href: it.getAttribute('href'),
      type: it.getAttribute('media-type') || '',
      props: it.getAttribute('properties') || ''
    }
  })
  const resolveHref = (href) => zip.file(opfDir + href) || zip.file(opfDir + decodeURIComponent(href)) || zip.file(decodeURIComponent(href))
  const spine = [...opf.querySelectorAll('spine > itemref')]
    .map((r) => manifest[r.getAttribute('idref')])
    .filter((m) => m && /html|xml/.test(m.type))

  const chapters = []
  for (const item of spine) {
    const f = resolveHref(item.href)
    if (!f) continue
    const html = await f.async('string')
    const md = htmlToMd(html)
    if (!md.trim()) continue
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const title =
      [...doc.querySelectorAll('h1,h2,h3')].map((h) => h.textContent.trim()).find(Boolean) ||
      (doc.title || '').trim() ||
      `章节 ${chapters.length + 1}`
    chapters.push({ title: title.slice(0, 60), text: md })
  }

  let coverBlob = null
  const coverItem = Object.values(manifest).find((m) => /cover-image/.test(m.props))
  const coverMeta = opf.querySelector('meta[name="cover"]')
  const cover = coverItem || (coverMeta ? manifest[coverMeta.getAttribute('content')] : null)
  if (cover) {
    const f = resolveHref(cover.href)
    if (f) coverBlob = await f.async('blob')
  }
  return { chapters: chapters.length ? chapters : [{ title: opfName || '导入章节', text: '' }], coverBlob }
}

/* ================= 设定库 MD 导入解析 ================= */

function escHtml(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escAttr(s) {
  return escHtml(s).replaceAll('"', '&quot;')
}

function isSafeMediaUrl(url) {
  return /^(?:https?:\/\/|data:image\/)/i.test(String(url || '').trim())
}

function isSafeLinkUrl(url) {
  return /^https?:\/\//i.test(String(url || '').trim())
}

function formatMubuInline(raw) {
  let s = String(raw || '').trim()
  let heading = 0
  const hm = s.match(/^(#{1,6})\s+(.*)$/)
  if (hm) {
    heading = Math.min(3, hm[1].length)
    s = hm[2].trim()
  }

  // 兼容幕布导出中偶现的 <span class="bold">...</span> / <span>...</span>
  s = s
    .replace(/<span\b[^>]*class=["'][^"']*\bbold\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi, (_, inner) => `**${inner}**`)
    .replace(/<\/?span\b[^>]*>/gi, '')

  const tokens = []
  const putToken = (tok) => {
    const idx = tokens.length
    tokens.push(tok)
    return `\u0000MUBU_TOK_${idx}\u0000`
  }

  // 1. 提取行内图片 ![alt](url)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (full, alt, url) => {
    if (!isSafeMediaUrl(url)) return full
    return putToken({
      text: '',
      html: `<img class="lore-image" src="${escAttr(url)}" alt="${escAttr(alt)}">`,
      rich: true
    })
  })

  // 2. 提取行内链接 [label](http(s)://...)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (full, label, url) => {
    if (!isSafeLinkUrl(url)) return full
    const display = /^\d+$/.test(label.trim()) ? `[${label.trim()}]` : label
    return putToken({
      text: display,
      html: `<a href="${escAttr(url)}" target="_blank" rel="noopener noreferrer">${escHtml(display)}</a>`,
      rich: true
    })
  })

  let rich = tokens.some((t) => t.rich)
  let plain = s
  let html = escHtml(s)

  // 3. 加粗+斜体 / 加粗 / 斜体（跳过孤立的 "* " 列表标记）
  const applyStyle = (re, openTag, closeTag) => {
    html = html.replace(re, (_, inner) => {
      rich = true
      return openTag + inner + closeTag
    })
    plain = plain.replace(re, '$1')
  }
  applyStyle(/\*\*\*([^*\n](?:[^\n]*?[^*\n])?)\*\*\*/g, '<b><i>', '</i></b>')
  applyStyle(/\*\*([^*\n](?:[^\n]*?[^*\n])?)\*\*/g, '<b>', '</b>')
  applyStyle(/\*([^*\s\n](?:[^*\n]*?[^*\s\n])?)\*/g, '<i>', '</i>')

  // 4. 还原占位符
  const restore = (str, field) => str.replace(/\u0000MUBU_TOK_(\d+)\u0000/g, (_, idx) => tokens[Number(idx)]?.[field] ?? '')
  plain = restore(plain, 'text').trim()
  html = restore(html, 'html').trim()

  return {
    text: plain,
    html: rich ? html : null,
    heading
  }
}

function appendNodeImage(target, url, alt) {
  const imgTag = `<img class="lore-image" src="${escAttr(url)}" alt="${escAttr(alt)}">`
  const base = target.html != null ? target.html : escHtml(target.text).replace(/\n/g, '<br>')
  target.html = base ? `${base}<br>${imgTag}` : imgTag
}

/**
 * 幕布节点导入：
 * - 支持传统 H1–H6 标题层级；
 * - 支持幕布导出的多级缩进列表（- / * / +）、无短横线顶层分区、孤立首行 H1 拆壳；
 * - 支持行内加粗/斜体/链接/### 标题级别、缩进引用块（> 连续合并）与外链图片（img.lore-image）。
 * 返回 [{ text, html, heading, children }]
 */
export function parseMubuMd(text) {
  const lines = String(text || '').split(/\r?\n/)
  const expandIndent = (ws) => String(ws || '').replace(/\t/g, '  ').length

  let standaloneHeadings = 0
  let hasLists = false
  let firstNonEmpty = ''
  for (const raw of lines) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    if (!firstNonEmpty) firstNonEmpty = raw
    if (/^#{1,6}\s+\S/.test(raw)) standaloneHeadings++
    else if (/^[ \t]*[-*+](?:[ \t]+|$)/.test(raw)) hasLists = true
  }
  const unwrapLoneH1 = hasLists && standaloneHeadings === 1 && /^#\s+\S/.test(firstNonEmpty)

  const root = { children: [] }
  const stack = [{ kind: 'root', rank: -1, indent: -1, node: root }]
  let loneH1Skipped = false
  let lastQuote = null

  const popTo = (rank) => {
    while (stack.length > 1 && stack[stack.length - 1].rank >= rank) stack.pop()
  }

  for (const raw of lines) {
    if (!raw.trim()) {
      lastQuote = null
      continue
    }

    // 1. 独立 Markdown 标题
    const hm = raw.match(/^(#{1,6})\s+(.*)$/)
    if (hm) {
      lastQuote = null
      if (unwrapLoneH1 && !loneH1Skipped && hm[1].length === 1) {
        loneH1Skipped = true
        continue
      }
      const level = hm[1].length
      const parsed = formatMubuInline(hm[2])
      if (!parsed.text && !parsed.html) continue
      popTo(level)
      const n = { text: parsed.text, html: parsed.html, heading: Math.min(3, level), children: [] }
      stack[stack.length - 1].node.children.push(n)
      stack.push({ kind: 'heading', rank: level, indent: -1, node: n })
      continue
    }

    // 2. 列表项（幕布缩进大纲）
    const bm = raw.match(/^([ \t]*)[-*+](?:[ \t]+(.*)|[ \t]*$)$/)
    if (bm) {
      lastQuote = null
      const indent = expandIndent(bm[1])
      const body = (bm[2] || '').trim()
      if (!body) continue // 过滤幕布导出的末尾空 "-"
      const parsed = formatMubuInline(body)
      if (!parsed.text && !parsed.html) continue
      const rank = 1000 + indent
      popTo(rank)
      const n = { text: parsed.text, html: parsed.html, heading: parsed.heading, children: [] }
      stack[stack.length - 1].node.children.push(n)
      stack.push({ kind: 'bullet', rank, indent, node: n })
      continue
    }

    // 3. 独立外链图片行（按缩进挂入所属父节点的 html）
    const im = raw.match(/^([ \t]*)!\[([^\]]*)\]\(([^)\s]+)\)[ \t]*$/)
    if (im && isSafeMediaUrl(im[3])) {
      lastQuote = null
      const indent = expandIndent(im[1])
      const rank = 1000 + indent
      let target = root
      for (let i = stack.length - 1; i >= 1; i--) {
        if (stack[i].rank < rank) {
          target = stack[i].node
          break
        }
      }
      if (target !== root) {
        appendNodeImage(target, im[3], im[2])
      } else {
        const imgTag = `<img class="lore-image" src="${escAttr(im[3])}" alt="${escAttr(im[2])}">`
        root.children.push({ text: im[2] || '图片', html: imgTag, heading: 0, children: [] })
      }
      continue
    }

    // 4. 引用行（> ...，同缩进连续行合并为同一节点）
    const qm = raw.match(/^([ \t]*)>[ \t]?(.*)$/)
    if (qm) {
      const indent = expandIndent(qm[1])
      const body = qm[2].trim()
      if (!body) continue
      const parsed = formatMubuInline(body)
      if (!parsed.text && !parsed.html) continue
      if (lastQuote && lastQuote.indent === indent) {
        const qn = lastQuote.node
        const prevHtml = qn.html != null ? qn.html : escHtml(qn.text).replace(/\n/g, '<br>')
        const nextHtml = parsed.html != null ? parsed.html : escHtml(parsed.text)
        qn.text = qn.text ? `${qn.text}\n${parsed.text}` : parsed.text
        if (qn.html != null || parsed.html != null) {
          qn.html = prevHtml ? `${prevHtml}<br>${nextHtml}` : nextHtml
        }
      } else {
        const rank = 1000 + indent
        popTo(rank)
        const n = { text: parsed.text, html: parsed.html, heading: parsed.heading, children: [] }
        stack[stack.length - 1].node.children.push(n)
        stack.push({ kind: 'quote', rank, indent, node: n })
        lastQuote = { indent, node: n }
      }
      continue
    }

    // 5. 其他非空行：列表模式下的零缩进分区标题（如「现实模版」「虚构国度」「设定」），或传统正文行
    lastQuote = null
    const lm = raw.match(/^([ \t]*)(.+)$/)
    const indent = expandIndent(lm[1])
    const parsed = formatMubuInline(lm[2])
    if (!parsed.text && !parsed.html) continue
    if (hasLists && indent === 0) {
      const rank = 100
      popTo(rank)
      const n = { text: parsed.text, html: parsed.html, heading: parsed.heading, children: [] }
      stack[stack.length - 1].node.children.push(n)
      stack.push({ kind: 'section', rank, indent: 0, node: n })
    } else {
      stack[stack.length - 1].node.children.push({
        text: parsed.text,
        html: parsed.html,
        heading: parsed.heading,
        children: []
      })
    }
  }
  return root.children
}

/* ================= 汇总入口 ================= */

export const DOC_EXTS = ['txt', 'md', 'markdown', 'docx', 'pdf', 'epub']
export const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'avif']
const baseName = (n) => n.replace(/\.[^.]+$/, '')

export async function parseImportFiles(files, onProgress = () => {}) {
  const docs = []
  const images = []
  for (const f of files) {
    if (IMAGE_EXTS.includes(f.ext)) {
      images.push(f)
      continue
    }
    if (!DOC_EXTS.includes(f.ext)) continue
    if (f.ext === 'txt') {
      const { text, encoding } = decodeText(f.data)
      docs.push({ file: f.name, encoding, sections: splitTxtChapters(text, baseName(f.name)) })
    } else if (f.ext === 'md' || f.ext === 'markdown') {
      const { text } = decodeText(f.data)
      docs.push({ file: f.name, encoding: 'utf-8', sections: splitMarkdown(text, baseName(f.name)) })
    } else if (f.ext === 'docx') {
      if (!window.native?.docxToHtml) throw new Error('网页版暂不支持 Word(.docx) 导入，请使用桌面版')
      const r = await window.native.docxToHtml(f.data)
      docs.push({ file: f.name, encoding: 'docx', sections: splitHtmlByHeadings(r.html, baseName(f.name)) })
    } else if (f.ext === 'epub') {
      const r = await parseEpub(f.data)
      docs.push({ file: f.name, encoding: 'epub', sections: r.chapters, coverBlob: r.coverBlob })
    } else if (f.ext === 'pdf') {
      const r = await parsePdf(f.data, onProgress)
      docs.push({ file: f.name, encoding: 'pdf', sections: r.sections, scanned: r.scanned, numPages: r.numPages, raw: f.data, pages: r.pages })
    }
  }
  return { docs, images }
}
