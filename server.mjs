/* 小说工坊网页版静态服务器（零依赖） */
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exec } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(here, 'dist')
const PORT = Number(process.env.PORT) || 18688

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
}

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    if (p === '/' || p === '') p = '/index.html'
    if (p.includes('\0') || p.includes('\\')) throw 0
    const target = resolve(ROOT, '.' + p)
    if (target !== ROOT && !target.startsWith(ROOT + sep)) throw 0 // 路径边界校验
    const data = await readFile(target)
    console.log('[200]', p)
    res.writeHead(200, { 'content-type': MIME[extname(target).toLowerCase()] || 'application/octet-stream' })
    res.end(data)
  } catch (err) {
    console.log('[404]', req.url, err && err.code ? '(' + err.code + ')' : '')
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('404 not found')
  }
})

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}`
  console.log(`📚 小说工坊（网页版）已启动: ${url}  （Ctrl+C 停止）`)
  console.log('注意：网页版数据存于浏览器 IndexedDB，与桌面版互相独立；请用「备份/恢复」迁移。')
  if (process.argv.includes('--open')) {
    const cmd =
      process.platform === 'win32'
        ? `start "" "${url}"`
        : process.platform === 'darwin'
          ? `open "${url}"`
          : `xdg-open "${url}"`
    exec(cmd)
  }
})
