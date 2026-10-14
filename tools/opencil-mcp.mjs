/* OpenPencil 本机 MCP 客户端（设计物料工具共用）：
   候选 = 插件登记文件（可能被新实例覆盖）∪ 历史记录文件（tmpdir，记录曾成功连过的 端口+令牌）。
   逐个「复用缓存会话或新建会话 → 以 list_collections 验证」；验证成功才写入历史与缓存。
   调用方：opencil-render.mjs / opencil-place.mjs / opencil-rpc.mjs / opencil-tokens.mjs。 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir, tmpdir } from 'node:os'

const SESSION_CACHE = join(tmpdir(), 'opencil-mcp-session.json')
const SERVER_LOG = join(tmpdir(), 'opencil-mcp-servers.json')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function discoverServers() {
  const base = join(homedir(), '.zcode', 'cli', 'plugins', 'data', 'openpencil@zcode-plugins-official')
  const out = []
  if (!existsSync(base)) return out
  for (const dir of readdirSync(base)) {
    const f = join(base, dir, 'openpencil-mcp.json')
    if (!existsSync(f)) continue
    try {
      const j = JSON.parse(readFileSync(f, 'utf8'))
      if (j.httpPort && j.authToken) out.push(j)
    } catch {}
  }
  return out.sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')))
}

const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null } }
const writeJson = (p, v) => { try { writeFileSync(p, JSON.stringify(v)) } catch {} }

const parseAny = (t) => {
  if (t.startsWith('event:') || t.startsWith('data:')) {
    const out = []
    for (const line of t.split(/\r?\n/)) if (line.startsWith('data:')) out.push(line.slice(5).trim())
    return out.map((x) => { try { return JSON.parse(x) } catch { return x } })
  }
  try { return JSON.parse(t) } catch { return t }
}

function makeCaller(url, headers) {
  let seq = 10
  return async (name, args) => {
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method: 'tools/call', params: { name, arguments: args } }) })
    const t = await r.text()
    const parsed = parseAny(t)
    const msg = Array.isArray(parsed) ? parsed.find((x) => x && x.id === seq) || parsed[parsed.length - 1] : parsed
    if (!msg || msg.error) throw new Error(`${name}: ${msg?.error?.message || 'no response'}`)
    const res = msg.result
    if (res?.isError) throw new Error(`${name}: ${res.content?.[0]?.text?.slice(0, 400) || 'tool error'}`)
    const text = res?.content?.find?.((c) => c.type === 'text')?.text
    let json = null
    if (text) { try { json = JSON.parse(text) } catch { json = text } }
    return { res, json, text }
  }
}

async function tryServer(argv) {
  const { httpPort, authToken, pid } = argv
  const url = `http://127.0.0.1:${httpPort}/mcp`
  const H = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', Authorization: 'Bearer ' + authToken }

  /* 1) 复用缓存会话（服务端限制并发会话数，尽量别新建） */
  const cached = readJson(SESSION_CACHE)
  if (cached && cached.httpPort === httpPort && cached.sessionId) {
    const caller = makeCaller(url, { ...H, 'mcp-session-id': cached.sessionId })
    try {
      await caller('list_collections', {})
      return { url, call: caller, httpPort, sessionId: cached.sessionId, reused: true }
    } catch (e) {
      if (!/too many|session|no response|Not Found|Bad Request|not connected|no_app|Invalid/i.test(e.message)) throw e
    }
  }

  /* 2) 新建会话（遇到并发上限 503 按 retry-after 等待重试），成功后必须通过验证调用才采纳 */
  for (let attempt = 0; attempt < 4; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    let init
    try {
      init = await fetch(url, {
        method: 'POST',
        headers: H,
        signal: ctrl.signal,
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'opencil-tool', version: '1' } } })
      })
    } finally {
      clearTimeout(timer)
    }
    if (init.status === 503) {
      const body = await init.text()
      const wait = Math.max(3, Number(init.headers.get('retry-after') || 5)) * 1000
      if (attempt < 3) { await sleep(wait); continue }
      throw new Error(`initialize 503 ${body.slice(0, 120)}`)
    }
    if (!init.ok) throw new Error('initialize HTTP ' + init.status)
    const sid = init.headers.get('mcp-session-id')
    await init.text()
    const H2 = { ...H }
    if (sid) H2['mcp-session-id'] = sid
    await fetch(url, { method: 'POST', headers: H2, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) })
    const caller = makeCaller(url, H2)
    /* 验证：新实例可能没有面板连接（no_app），此时会话无意义，不采纳也不缓存 */
    await caller('list_collections', {})
    if (sid) writeJson(SESSION_CACHE, { httpPort, sessionId: sid, savedAt: Date.now(), pid })
    return { url, call: caller, httpPort, sessionId: sid, reused: false }
  }
  throw new Error('initialize 重试耗尽')
}

/** 连接可用的实例；全部失败抛错。优先最近成功过的实例（登记文件可能落后或被覆盖）。 */
export async function connect({ quiet = false } = {}) {
  const discovered = discoverServers()
  const log = readJson(SERVER_LOG) || []
  const seen = new Set()
  const candidates = []
  for (const s of [...log].sort((a, b) => (b.lastOkAt || 0) - (a.lastOkAt || 0))) {
    if (s.httpPort && s.authToken && !seen.has(s.httpPort)) { seen.add(s.httpPort); candidates.push(s) }
  }
  for (const s of discovered) {
    if (!seen.has(s.httpPort)) { seen.add(s.httpPort); candidates.push(s) }
  }
  if (!candidates.length) throw new Error('未找到 OpenPencil MCP 候选（请先打开设计稿面板）')
  let lastErr = null
  for (const srv of candidates) {
    try {
      const c = await tryServer(srv)
      const merged = [...log.filter((x) => x.httpPort !== srv.httpPort), { httpPort: srv.httpPort, authToken: srv.authToken, pid: srv.pid, lastOkAt: Date.now() }].slice(-6)
      writeJson(SERVER_LOG, merged)
      if (!quiet) console.log(`[opencil] 已连接 MCP :${srv.httpPort}${c.reused ? '（复用会话）' : ''}`)
      return c
    } catch (e) {
      lastErr = e
      if (!quiet) console.warn(`[opencil] :${srv.httpPort} 不可用（${e.message}）`)
    }
  }
  throw new Error('所有 OpenPencil 候选端口均不可用：' + (lastErr?.message || ''))
}
