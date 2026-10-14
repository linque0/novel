/* OpenPencil S0 图片放置（设计物料工具）：把 textshot 生成的中文文本 PNG 批量填入 .fig 矩形节点。
   与 openpencil-textshot.mjs 配套，解决插件 v1 无 CJK 字体的问题（README 已知边界）。

   用法：node tools/opencil-place.mjs <place.json>
   place.json：{
     items: [
       { name: "T:书名-长夜将明", file: "docs/…/exports/text/p-title.png", scaleMode?: "FILL" },
       { id: "0:42", file: "…" }        // 也可直接给节点 id（跳过 find_nodes）
     ]
   }
   退出码：全部成功 0；任一项失败 1（失败项汇总打印）。 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { connect } from './opencil-mcp.mjs'

const itemPath = process.argv[2]
if (!itemPath) {
  console.error('用法: node tools/opencil-place.mjs <place.json>')
  process.exit(1)
}
const spec = JSON.parse(readFileSync(resolve(itemPath), 'utf8'))
const items = spec.items || []
if (!items.length) {
  console.error('place.json items 为空')
  process.exit(1)
}

const client = await connect()
const results = []
const visit = new Map() // 同名占位框（同一文本块多处复用）：按出现次序逐个填充
for (const item of items) {
  const label = item.name || item.id
  try {
    let id = item.id
    if (!id && item.name) {
      const args = { name: item.name }
      if (spec.page) args.page_id = spec.page
      const found = await client.call('find_nodes', args)
      /* find_nodes 为子串匹配（如 "btn-save" 会命中 "btn-savekey"），必须过滤为精确同名 */
      const list = (found.json?.nodes || []).filter((n) => n.name === item.name)
      const k = visit.get(item.name) || 0
      visit.set(item.name, k + 1)
      const node = list[k]
      if (!node) throw new Error(`find_nodes 未精确命中「${item.name}」第 ${k + 1} 个（共 ${list.length}）`)
      id = node.id
    }
    if (!id) throw new Error('缺少 name 或 id')
    const fileAbs = resolve(item.file)
    const b64 = readFileSync(fileAbs).toString('base64')
    const r = await client.call('set_image_fill', { id, image_data: b64, scale_mode: item.scaleMode || 'FILL' })
    results.push({ label, id, ok: true, hash: r.json?.imageHash?.slice(0, 12) })
    console.log(`[place] ✓ ${label} -> ${id} (${(b64.length / 1024).toFixed(1)}KB)`)
  } catch (e) {
    results.push({ label, ok: false, error: e.message })
    console.error(`[place] ✗ ${label}: ${e.message}`)
  }
}
const failed = results.filter((r) => !r.ok)
console.log(`[place] 完成：${results.length - failed.length}/${results.length} 成功`)
if (failed.length) process.exit(1)
