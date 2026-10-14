/* OpenPencil 设计令牌写入（设计物料工具）：按 tokens.json 规格在 .fig 中建立变量集合与变量。
   （插件无「增加模式」工具，因此一个主题 = 一个集合；值逐一对位 src/styles/themes.css。）
   用法：node tools/opencil-tokens.mjs <tokens.json>
   幂等：集合/变量已存在则只更新值（set_variable 到默认模式）。 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { connect } from './opencil-mcp.mjs'

const specPath = process.argv[2]
if (!specPath) {
  console.error('用法: node tools/opencil-tokens.mjs <tokens.json>')
  process.exit(1)
}
const spec = JSON.parse(readFileSync(resolve(specPath), 'utf8'))
const client = await connect()

const collections = (await client.call('list_collections', {})).json?.collections || []
const allVars = (await client.call('list_variables', {})).json?.variables || []
const varsByKey = new Map(allVars.map((v) => [v.collectionId + '|' + v.name, v]))

let created = { collections: 0, variables: 0, updated: 0 }
const failures = []
for (const col of spec.collections) {
  try {
    let c = collections.find((x) => x.name === col.name)
    if (!c) {
      c = (await client.call('create_collection', { name: col.name })).json
      created.collections++
      console.log(`+ 集合「${col.name}」 ${c.id}`)
    }
    const modeId = c.defaultModeId || c.modes?.[0]?.modeId
    for (const v of col.variables) {
      /* create/set 的 value 一律以字符串提交（FLOAT/STRING/COLOR 统一按原值字符串化） */
      const val = typeof v.value === 'string' ? v.value : String(v.value)
      const existing = varsByKey.get(c.id + '|' + v.name)
      if (existing) {
        await client.call('set_variable', { id: existing.id, mode: modeId, value: val })
        created.updated++
      } else {
        await client.call('create_variable', { name: v.name, type: v.type, collection_id: c.id, value: val })
        created.variables++
      }
    }
    console.log(`✓ 「${col.name}」 ${col.variables.length} 个变量写入（集合 ${c.id}）`)
  } catch (e) {
    failures.push(col.name + ': ' + e.message)
    console.error(`✗ 「${col.name}」: ${e.message}`)
  }
}
console.log(`[tokens] 新建集合 ${created.collections} / 新建变量 ${created.variables} / 更新 ${created.updated}`)
if (failures.length) process.exit(1)
