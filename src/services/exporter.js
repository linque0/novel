import { exportBackupJson, importBackupJson, buildBookText, collectExportChapters } from '../db/repo'
import { saveTextFile } from './fileio'
import { decodeText } from './importers'
import JSZip from 'jszip'

const stamp = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

export async function backupAll() {
  const json = await exportBackupJson()
  return saveTextFile(`novel-studio-备份-${stamp()}.json`, json)
}

export async function restoreBackup(arrayBuffer) {
  const { text } = decodeText(arrayBuffer)
  await importBackupJson(text)
}

export async function exportBook(work, volumes, chapters, asMarkdown) {
  const text = await buildBookText(work, volumes, chapters, asMarkdown)
  return saveTextFile(`${work.title || '未命名作品'}.${asMarkdown ? 'md' : 'txt'}`, text)
}

/* ---------- v1.0.4：按章节勾选导出 + docx ---------- */

export async function exportBookWithFilter(work, volumes, chapters, fmt, onlyIds) {
  const name = work.title || '未命名作品'
  if (fmt === 'txt') {
    const text = await buildBookText(work, volumes, chapters, false, onlyIds)
    return saveTextFile(`${name}.txt`, text)
  }
  if (fmt === 'md') {
    const text = await buildBookText(work, volumes, chapters, true, onlyIds)
    return saveTextFile(`${name}.md`, text)
  }
  const zip = await buildBookDocx(work, volumes, chapters, onlyIds)
  return saveTextFile(`${name}.docx`, zip, { isBase64: true })
}

/* OOXML 转义 */
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 内联富文本 html → w:r 序列（保留加粗/斜体/下划线/删除线与颜色） */
function htmlToRuns(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html')
  const runs = []
  const walk = (node, style) => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) {
        const t = n.textContent.replace(/\s+/g, ' ')
        if (t.trim()) runs.push({ t, ...style })
        continue
      }
      if (n.nodeType !== 1) continue
      const tag = n.tagName.toLowerCase()
      const st = { ...style }
      if (tag === 'b' || tag === 'strong') st.b = true
      if (tag === 'i' || tag === 'em') st.i = true
      if (tag === 'u') st.u = true
      if (tag === 's' || tag === 'del' || tag === 'strike') st.s = true
      if (tag === 'br') {
        runs.push({ br: true })
        continue
      }
      const color = (n.getAttribute && n.getAttribute('color')) || (n.style && n.style.color)
      if (color && /^#[0-9a-f]{6}$/i.test(color)) st.color = color.slice(1)
      walk(n, st)
    }
  }
  walk(doc.body, {})
  return runs
}

/** 一个块级段落（html 的 p、h1-h6、li、blockquote 或纯文本行）→ <w:p> */
function paraXml(runs, opts = {}) {
  const pPr = []
  if (opts.heading) pPr.push(`<w:pStyle w:val="Heading${opts.heading}"/>`)
  if (opts.quote) pPr.push('<w:ind w:left="480"/>')
  if (opts.align) pPr.push(`<w:jc w:val="${opts.align}"/>`)
  if (opts.center) pPr.push('<w:jc w:val="center"/>')
  const body = runs.length
    ? runs
        .map((r) => {
          if (r.br) return '<w:r><w:br/></w:r>'
          const rPr = []
          if (r.b) rPr.push('<w:b/>')
          if (r.i) rPr.push('<w:i/>')
          if (r.u) rPr.push('<w:u w:val="single"/>')
          if (r.s) rPr.push('<w:strike/>')
          if (r.color) rPr.push(`<w:color w:val="${r.color}"/>`)
          return `<w:r>${rPr.length ? `<w:rPr>${rPr.join('')}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(r.t)}</w:t></w:r>`
        })
        .join('')
    : ''
  return `<w:p>${pPr.length ? `<w:pPr>${pPr.join('')}</w:pPr>` : ''}${body}</w:p>`
}

/** 章节正文 html → 段落序列：p → 正文、h1-h6 → Heading 样式、ul/ol li → 列表缩进、blockquote → 引用 */
function htmlToParas(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html')
  const out = []
  const H = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 }
  const ALIGN = { left: 'left', center: 'center', right: 'right', justify: 'both' }
  for (const el of doc.body.children) {
    const tag = el.tagName.toLowerCase()
    if (tag === 'p' || tag === 'div') {
      const style = el.getAttribute('style') || ''
      const m = style.match(/text-align:\s*(\w+)/)
      out.push(paraXml(htmlToRuns(el.innerHTML), { align: m && ALIGN[m[1]] }))
    } else if (H[tag]) out.push(paraXml(htmlToRuns(el.innerHTML), { heading: H[tag] }))
    else if (tag === 'blockquote') for (const p of el.querySelectorAll('p')) out.push(paraXml(htmlToRuns(p.innerHTML), { quote: true }))
    else if (tag === 'ul' || tag === 'ol') for (const li of el.children) out.push(paraXml(htmlToRuns(li.innerHTML), { quote: true }))
    else if (el.textContent.trim()) out.push(paraXml(htmlToRuns(el.innerHTML)))
  }
  if (!out.length && doc.body.textContent.trim()) out.push(paraXml(htmlToRuns(doc.body.innerHTML)))
  return out.join('')
}

const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`

const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:eastAsia="Microsoft YaHei" w:hAnsi="Microsoft YaHei"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
${[1, 2, 3, 4, 5, 6]
  .map(
    (l) => `<w:style w:type="paragraph" w:styleId="Heading${l}"><w:name w:val="heading ${l}"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="${Math.max(24, 56 - l * 6)}"/></w:rPr></w:style>`
  )
  .join('')}
</w:styles>`

/** 生成 docx（WordprocessingML，JSZip 手组 OOXML——零新依赖） */
export async function buildBookDocx(work, volumes, chapters, onlyIds) {
  const rows = collectExportChapters(volumes, chapters, onlyIds)
  const paras = []
  paras.push(paraXml(htmlToRuns(esc(work.title || '未命名作品')), { heading: 1, center: true }))
  if (work.author) paras.push(paraXml(htmlToRuns(`作者：${esc(work.author)}`), { center: true }))
  paras.push(paraXml([]))
  let lastVol = undefined
  for (const { vol, ch } of rows) {
    if (vol && vol !== lastVol) {
      paras.push(paraXml(htmlToRuns(esc(vol.title)), { heading: 2 }))
      lastVol = vol
    }
    paras.push(paraXml(htmlToRuns(esc(ch.title || '未命名章节')), { heading: 3 }))
    /* fmt=html 走富文本解析；纯文本但内容含标签（历史数据 fmt 缺失）也按 html 识别 */
    if (ch.fmt === 'html' || (ch.fmt !== 'text' && /<[a-z][\s\S]*>/i.test(ch.content || ''))) paras.push(htmlToParas(ch.content))
    else for (const line of String(ch.content || '').split('\n')) paras.push(paraXml(line.trim() ? htmlToRuns(esc(line)) : []))
    paras.push(paraXml([]))
  }
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="851" w:footer="992" w:gutter="0"/></w:sectPr></w:body></w:document>`
  const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(work.title)}</dc:title>${work.author ? `<dc:creator>${esc(work.author)}</dc:creator>` : ''}<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`
  const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Novel Studio</Application></Properties>`
  const zip = new JSZip()
  zip.file('[Content_Types].xml', contentTypesXml)
  zip.folder('_rels').file('.rels', relsXml)
  zip.folder('docProps').file('core.xml', coreXml)
  zip.folder('docProps').file('app.xml', appXml)
  zip.folder('word').file('document.xml', docXml)
  zip.folder('word').file('styles.xml', stylesXml)
  return zip.generateAsync({ type: 'base64', compression: 'DEFLATE' })
}
