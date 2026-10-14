/* OpenPencil 通用 RPC 命令行（设计物料工具）：
   单发：node tools/opencil-rpc.mjs <tool> '<json args>'
   批量：node tools/opencil-rpc.mjs --batch <file.json>    # [{ tool, args, label? }, …]
   结果逐条打印（tool/label → 简要 JSON）；批量模式遇错继续，末尾汇总，任一失败退出码 1。 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { connect } from './opencil-mcp.mjs'

const argv = process.argv.slice(2)
let calls = []
if (argv[0] === '--batch') {
  if (!argv[1]) { console.error('用法: node tools/opencil-rpc.mjs --batch <file.json>'); process.exit(1) }
  calls = JSON.parse(readFileSync(resolve(argv[1]), 'utf8'))
  if (!Array.isArray(calls)) { console.error('batch 文件应为数组'); process.exit(1) }
} else {
  const [tool, argsRaw] = argv
  if (!tool) {
    console.error("用法: node tools/opencil-rpc.mjs <tool> '<json args>' | --batch <file.json>")
    process.exit(1)
  }
  let args = {}
  if (argsRaw) { try { args = JSON.parse(argsRaw) } catch (e) { console.error('args JSON 解析失败:', e.message); process.exit(1) } }
  calls = [{ tool, args }]
}

const client = await connect()
let ok = 0
const failures = []
const brief = (v) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  return s && s.length > 220 ? s.slice(0, 220) + '…' : s
}
for (const c of calls) {
  const label = c.label || c.tool
  try {
    const r = await client.call(c.tool, c.args || {})
    ok++
    console.log(`✓ ${label} → ${brief(r.json ?? r.text ?? '(ok)')}`)
  } catch (e) {
    failures.push(label + ': ' + e.message)
    console.error(`✗ ${label}: ${e.message}`)
  }
}
console.log(`[opencil-rpc] ${ok}/${calls.length} 成功`)
if (failures.length) process.exit(1)
