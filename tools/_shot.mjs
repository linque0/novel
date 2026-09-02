/* 视觉检查辅助：连接 9222 并对当前页面截图保存 PNG（供主代理 Read 查看） */
import { writeFileSync } from 'node:fs'
import { connect } from './_cdp-lib.mjs'

const out = process.argv[2] || 'tools/_shot.png'
const c = await connect(process.argv[3] || 'app://')
await c.sleep(800)
const shot = await c.send('Page.captureScreenshot', { format: 'png' })
writeFileSync(out, Buffer.from(shot.data, 'base64'))
console.log('saved', out)
process.exit(0)
