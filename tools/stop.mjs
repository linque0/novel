/* 完全退出所有小说工坊实例与开发服务：先优雅关闭（数据落盘），残留进程再强杀。
 * v0.4.18 起 同时清理 vite 开发服务（5173 端口占用元凶）与 electron 的 node 包装进程。 */
import { execSync } from 'node:child_process'

function runPS(script) {
  // EncodedCommand 避免 GBK 控制台的中文编码问题
  const b64 = Buffer.from(script, 'utf16le').toString('base64')
  return execSync(`powershell -NoProfile -EncodedCommand ${b64}`, { encoding: 'utf8' })
}

// 目标进程：electron 应用 / 打包版应用 / vite 开发服务 / electron cli 的 node 包装
const MATCH = `($_.Name -eq 'electron.exe') -or ($_.Name -like '*小说工坊*') -or ($_.Name -eq 'node.exe' -and (($_.CommandLine -like '*vite*') -or ($_.CommandLine -like '*electron*cli.js*')))`
const findPS = () => `Get-CimInstance Win32_Process | Where-Object { ${MATCH} } | Select-Object ProcessId, Name`

let list = ''
try {
  list = runPS(findPS())
} catch {
  list = ''
}
if (!list.trim() || !/\d/.test(list)) {
  console.log('没有运行中的小说工坊实例或开发服务')
  process.exit(0)
}
console.log('发现实例：\n' + list)

// 1) 优雅关闭 GUI 实例（WM_CLOSE → 主进程关闭钩子把数据落盘）
try {
  runPS(`Get-Process | Where-Object { $_.Name -eq 'electron' -or $_.Name -like '*小说工坊*' } | ForEach-Object { [void]$_.CloseMainWindow() }`)
} catch {}
console.log('已发送关闭请求，等待数据落盘…')
await new Promise((r) => setTimeout(r, 3000))

// 2) 兜底强杀全部匹配残留（含 vite / node 包装）
try {
  runPS(`Get-CimInstance Win32_Process | Where-Object { ${MATCH} } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`)
} catch {}

// 3) 校验：进程清零 + 5173 端口释放
await new Promise((r) => setTimeout(r, 800))
let left = ''
try {
  left = runPS(findPS())
} catch {
  left = ''
}
if (left.trim() && /\d/.test(left)) {
  console.error('仍有实例未退出：\n' + left)
  process.exit(1)
}
let portBusy = false
try {
  const conn = runPS(`Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 OwningProcess`)
  portBusy = /\d/.test(conn)
} catch {}
if (portBusy) {
  console.error('5173 端口仍被占用')
  process.exit(1)
}
console.log('全部实例与开发服务已退出，数据已保存，5173 已释放 ✓')
