/* 完全退出所有小说工坊实例：先优雅关闭（数据落盘），残留进程再强杀 */
import { execSync } from 'node:child_process'

function runPS(script) {
  // EncodedCommand 避免 GBK 控制台的中文编码问题
  const b64 = Buffer.from(script, 'utf16le').toString('base64')
  return execSync(`powershell -NoProfile -EncodedCommand ${b64}`, { encoding: 'utf8' })
}
function findPS() {
  return `Get-Process | Where-Object { $_.Name -eq 'electron' -or $_.Name -like '*小说工坊*' } | Select-Object Id, Name`
}

let list = ''
try {
  list = runPS(findPS())
} catch {
  list = ''
}

if (!list.trim()) {
  console.log('没有运行中的小说工坊实例')
  process.exit(0)
}
console.log('发现实例：\n' + list)

// 1) 优雅关闭（WM_CLOSE → 主进程关闭钩子把数据落盘）
try {
  runPS(
    `Get-Process | Where-Object { $_.Name -eq 'electron' -or $_.Name -like '*小说工坊*' } | ForEach-Object { [void]$_.CloseMainWindow() }`
  )
} catch {}
console.log('已发送关闭请求，等待数据落盘…')
await new Promise((r) => setTimeout(r, 3000))

// 2) 兜底强杀残留
try {
  runPS(`Get-Process | Where-Object { $_.Name -eq 'electron' -or $_.Name -like '*小说工坊*' } | Stop-Process -Force`)
} catch {}

// 3) 校验
await new Promise((r) => setTimeout(r, 800))
let left = ''
try {
  left = runPS(findPS())
} catch {
  left = ''
}
if (left.trim()) {
  console.error('仍有实例未退出：\n' + left)
  process.exit(1)
}
console.log('全部实例已完全退出，数据已保存 ✓')
