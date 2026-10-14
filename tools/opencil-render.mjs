/* OpenPencil 屏幕渲染器（设计物料工具）：把 .jsx 文件渲染进当前设计稿，支持中文文本图片占位。
   用法：node tools/opencil-render.mjs <file.jsx> [--page <pageId>] [--manifest <manifest.json>] [--place <out.json>] [--dry]

   JSX 中使用 <TextImg id="块id" x={12} y={34} /> 占位中文文本：
   渲染前自动替换为 <Rectangle name="T:<id>" x y w h />（宽高取自 textshot manifest 的 CSS 尺寸），
   并可用 --place 输出图片放置清单（配合 opencil-place.mjs 填图）。 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname, isAbsolute } from 'node:path'
import { connect } from './opencil-mcp.mjs'

const argv = process.argv.slice(2)
const jsxFile = argv.find((a) => !a.startsWith('--'))
const flag = (name) => {
  const i = argv.indexOf(name)
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : null
}
if (!jsxFile) {
  console.error('用法: node tools/opencil-render.mjs <file.jsx> [--page <pageId>] [--manifest <manifest.json>] [--place <out.json>] [--dry]')
  process.exit(1)
}
const pageId = flag('--page') || undefined
const manifestPath = flag('--manifest')
const placePath = flag('--place')
const prefix = typeof flag('--prefix') === 'string' ? flag('--prefix') : ''
const dry = !!flag('--dry')

let jsx = readFileSync(resolve(jsxFile), 'utf8')

/* ---------- TextImg 预处理 ---------- */
let manifest = null
const manifestMap = new Map()
if (manifestPath) {
  const mp = resolve(String(manifestPath))
  manifest = JSON.parse(readFileSync(mp, 'utf8'))
  for (const b of manifest.blocks || []) manifestMap.set(b.id, { ...b, dir: dirname(mp) })
}
const placeItems = []
let missing = []
jsx = jsx.replace(/<TextImg\s+([^>]*?)\/>/g, (m, attrs) => {
  const id = /id="([^"]+)"/.exec(attrs)?.[1]
  const x = /x=\{([-\d.]+)\}/.exec(attrs)?.[1]
  const y = /y=\{([-\d.]+)\}/.exec(attrs)?.[1]
  if (!id || x == null || y == null) throw new Error(`TextImg 需要 id/x/y：${m}`)
  const b = manifestMap.get(id)
  const nm = prefix ? `T:${prefix}:${id}` : `T:${id}`
  if (!b) { missing.push(id); return `<Rectangle name="${nm}" x={${x}} y={${y}} w={120} h={24} />` }
  placeItems.push({ name: nm, file: isAbsolute(b.dir) ? resolve(b.dir, b.file) : resolve(b.dir, b.file) })
  return `<Rectangle name="${nm}" x={${x}} y={${y}} w={${b.cssW}} h={${b.cssH}} />`
})
if (missing.length) {
  console.error('[render] manifest 缺少文本块：', missing.join(', '))
  process.exit(1)
}

if (dry) {
  console.log(jsx)
  console.log(`[render] --dry：TextImg ${placeItems.length} 处已展开`)
  process.exit(0)
}

const client = await connect()
const args = { jsx }
if (pageId) args.page_id = pageId
const r = await client.call('render', args)
console.log('[render] 结果:', JSON.stringify(r.json ?? r.text))
if (placePath && placeItems.length) {
  const out = resolve(String(placePath))
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify({ page: pageId || null, items: placeItems }, null, 2))
  console.log(`[render] 放置清单 ${placeItems.length} 项 → ${placePath}`)
}
