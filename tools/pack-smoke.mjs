/* 打包产物冒烟测试：启动 + 界面渲染 + mammoth (docx) 可用性 */
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'
const here = dirname(fileURLToPath(import.meta.url))
const PORT = 9223

class CDP {
  static async connect(retries = 10) {
    for (let i = 0; i < retries; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
        const target = list.find((t) => t.type === 'page')
        if (target) {
          const ws = new WebSocket(target.webSocketDebuggerUrl)
          await new Promise((res, rej) => ((ws.onopen = res), (ws.onerror = rej)))
          const cdp = new CDP(ws)
          ws.onmessage = (ev) => {
            const msg = JSON.parse(ev.data)
            if (msg.id && cdp.pending.has(msg.id)) {
              const { res, rej } = cdp.pending.get(msg.id)
              cdp.pending.delete(msg.id)
              msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result)
            }
          }
          return cdp
        }
      } catch {
        /* 未就绪，重试 */
      }
      await new Promise((r) => setTimeout(r, 1000))
    }
    throw new Error('CDP connect failed')
  }
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
  }
  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((res, rej) => this.pending.set(id, { res, rej }))
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) return { PAGE_ERR: r.exceptionDetails.exception?.description || r.exceptionDetails.text }
    return r.result?.value
  }
}

const cdp = await CDP.connect()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await sleep(1500)

/* 1. 界面渲染 */
let v = await cdp.eval(`({ ready: document.readyState, brand: !!document.querySelector('.brand'), shelf: !!document.querySelector('.shelf-body') || !!document.querySelector('.empty-shelf') })`)
console.log(`${v.brand && v.shelf ? 'PASS' : 'FAIL'}  打包应用启动并渲染界面  —— ${JSON.stringify(v)}`)

/* 2. mammoth (docx) 可用性：构造最小 docx → 主进程解析 */
const zip = new JSZip()
zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`)
zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`)
zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>打包冒烟测试段落</w:t></w:r></w:p></w:body></w:document>`)
const buf = await zip.generateAsync({ type: 'base64' })

v = await cdp.eval(`(async () => {
  const b64 = ${JSON.stringify(buf)}
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  try {
    const r = await window.native.docxToHtml(bytes.buffer)
    return { ok: r.html.includes('打包冒烟测试段落'), html: r.html.slice(0, 60) }
  } catch (e) {
    return { ok: false, err: String(e).slice(0, 120) }
  }
})()`)
console.log(`${v.ok ? 'PASS' : 'FAIL'}  mammoth (Word 解析) 打包可用  —— ${JSON.stringify(v)}`)

/* 3. Dexie 打开正常（packtest 独立 profile） */
v = await cdp.eval(`(async () => {
  try { await window.__ns.db.open(); return { db: 'ok', works: (await window.__ns.db.works.toArray()).length } } catch (e) { return { db: String(e).slice(0, 80) } }
})()`)
console.log(`${v.db === 'ok' ? 'PASS' : 'FAIL'}  数据库打开（packtest 独立数据目录）  —— ${JSON.stringify(v)}`)

process.exit(0)
