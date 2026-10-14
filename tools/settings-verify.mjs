/* 设置页验收（v1.0.25）：「恍然梦」更名「模型设置」+ 移除上下文预算/每日上限设置项 + 自动记忆保存通路。
 * 运行前提：npm run dev（自带 CDP 9222，验证书已自动种入）
 * 用法：node tools/settings-verify.mjs
 * 截图存档：tools/_settings-verify.png
 */
import { connect } from './_cdp-lib.mjs'
import { writeFileSync } from 'node:fs'

const main = await connect('5173')
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  —— ' + String(detail).slice(0, 400) : ''))
}

/* 打开设置窗口（已开则聚焦复用） */
await main.evalx(`window.native.panelOpen({ type: 'settings', workId: 'app', entityId: '', title: '设置' })`)
await main.sleep(1800)
const s = await connect('panel=settings')

/* 1) 导航四项与改名 */
const nav = await s.evalx(`[...document.querySelectorAll('.sw-nav-item')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim())`)
check(
  '设置导航为 外观/模型设置/数据/关于 四项，第二项改名为「模型设置」',
  nav.length === 4 && nav[0].includes('外观') && nav[1].includes('模型设置') && nav[1].includes('供应商预设 / 模型 / 参数') && nav[2].includes('数据') && nav[3].includes('关于'),
  JSON.stringify(nav)
)

/* 2) 切页：标题与行清单 */
await s.evalx(`(() => { const it = [...document.querySelectorAll('.sw-nav-item')].find((e) => e.innerText.includes('模型设置')); it?.click(); return !!it })()`)
await s.sleep(400)
const page = await s.evalx(`({ h: document.querySelector('.sw-h')?.innerText, rows: [...document.querySelectorAll('.ai-set-row .lb')].map((e) => e.innerText) })`)
check('模型设置页标题 = 「模型设置」', page.h === '模型设置', JSON.stringify(page.h))
const wanted = ['Base URL', 'API 格式', 'API Key', '温度', '隐私模式', '自动记忆', '语义检索', '向量模型']
check('设置行保留连接（地址/格式/密钥）与生成参数各行', wanted.every((w) => page.rows.includes(w)), JSON.stringify(page.rows))

/* 3) 两项移除 */
const removed = await s.evalx(`(() => { const t = document.body.innerText; return { ctx: t.includes('上下文预算'), cap: t.includes('每日上限'), tok: t.includes('启用自动记忆时必填') } })()`)
check('「上下文预算」「每日上限」（含必填提示）均已移除', !removed.ctx && !removed.cap && !removed.tok, JSON.stringify(removed))

/* 4) 自动记忆开启 → 参数随预设落库（现行版为预设参数模型；原「必须设置每日上限」校验已随设置项移除） */
const swState = `(() => { const row = [...document.querySelectorAll('.ai-set-row')].find((e) => e.innerText.startsWith('自动记忆')); const sw = row?.querySelector('.n-switch'); return sw ? sw.className : 'none' })()`
const before = await s.evalx(swState)
await s.evalx(`(() => { const row = [...document.querySelectorAll('.ai-set-row')].find((e) => e.innerText.startsWith('自动记忆')); row?.querySelector('.n-switch')?.click(); return true })()`)
await s.sleep(900)
const after = await s.evalx(swState)
const persisted = await s.evalx(`(async () => {
  const { useAiStore } = await import('/src/stores/ai.js')
  const a = useAiStore()
  return !!a.activeProvider?.params?.kb?.auto
})()`)
const errs = await s.evalx(`[...document.querySelectorAll('.n-message, .n-notification')].map((e) => e.innerText).join(' | ')`)
check('自动记忆开关可开启并随预设生效（无每日上限校验报错）', !String(before).includes('--active') && String(after).includes('--active') && persisted === true && !/必须设置每日上限/.test(errs), JSON.stringify({ before, after, persisted, errs }))

/* 截图存档（供人工目检） */
const shot = await s.send('Page.captureScreenshot', { format: 'png' })
writeFileSync('tools/_settings-verify.png', Buffer.from(shot.data, 'base64'))

/* 5) 复原：自动记忆恢复关闭 */
await s.evalx(`(() => { const row = [...document.querySelectorAll('.ai-set-row')].find((e) => e.innerText.startsWith('自动记忆')); const sw = row?.querySelector('.n-switch'); if (sw && sw.className.includes('--active')) sw.click(); return true })()`)
await s.sleep(900)
const restored = await s.evalx(swState)
const restoredP = await s.evalx(`(async () => {
  const { useAiStore } = await import('/src/stores/ai.js')
  return !!useAiStore().activeProvider?.params?.kb?.auto
})()`)
check('复原：自动记忆关闭并随预设生效', !String(restored).includes('--active') && restoredP === false, JSON.stringify({ restored, restoredP }))

const pass = results.filter(Boolean).length
console.log(`\n${pass}/${results.length} 通过`)
process.exit(pass === results.length ? 0 : 1)
