/* AI 助手验收（docs/AI助手接入方案.md §八 1–4）：设置区 / 装配器 / 四能力端到端 / 拆窗锁门禁
 * 运行前提：npm run dev（自带 CDP 9222）；mock 服务器 tools/mock-ai.mjs 本脚本自动拉起
 * （18700 已有实例则复用，结束时只关自己拉起的进程）。
 * 用法：node tools/ai-verify.mjs
 */
import { connect } from './_cdp-lib.mjs'
import { buildSeedExpr } from './verify-seeds.mjs'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const MOCK_PORT = 18700
const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}/v1`
const PLAIN_KEY = 'sk-mock-verify-9721'
const CDP_PORT = process.env.CDP_PORT || '9222'

/* ---------- mock 服务器：探活 → 不在则拉起 ---------- */
async function mockAlive() {
  try {
    const r = await fetch(`${MOCK_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'probe', messages: [{ role: 'user', content: 'ping' }], mock_nonstream: true })
    })
    return r.ok
  } catch {
    return false
  }
}
let mockChild = null
if (!(await mockAlive())) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  mockChild = spawn(process.execPath, [path.join(root, 'tools', 'mock-ai.mjs'), '--port', String(MOCK_PORT)], {
    cwd: root,
    stdio: 'ignore'
  })
  const end = Date.now() + 8000
  while (!(await mockAlive())) {
    if (Date.now() > end) {
      console.error('FAIL mock 服务器拉起失败（tools/mock-ai.mjs :18700）')
      process.exit(1)
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  console.log('[ai-verify] mock 服务器已拉起：' + MOCK_URL)
}
process.on('exit', () => mockChild?.kill())

const c = await connect('app://')
await c.send('Page.bringToFront')
/* 窗口可见性预备（开发流程 5.3）：最小化/遮挡会节流定时器并卡 Vue 过渡（NSelect 菜单等）。
   尽力恢复 Electron 主窗口（SW_RESTORE + 置顶；锁屏态则无解，由下方 VISIBLE 门控降级） */
try {
  spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class W32V { [DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr h, int n); [DllImport(\"user32.dll\")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f); }'; Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | ForEach-Object { [W32V]::ShowWindow($_.MainWindowHandle, 9) | Out-Null; [W32V]::SetWindowPos($_.MainWindowHandle, [IntPtr](-1), 60, 60, 1200, 800, 0x0040) | Out-Null }"
    ],
    { timeout: 15000 }
  )
} catch {
  /* 恢复失败不阻塞：后续按 VISIBLE 门控降级 */
}
await c.sleep(1200)
const VISIBLE = (await c.evalx(`document.visibilityState`)) === 'visible'
if (!VISIBLE) console.log('[ai-verify] 页面处于隐藏态（锁屏/遮挡，恢复未生效）——依赖渲染帧的检查将降级为 store 层并标注 SKIP')
await c.sleep(1300)
/* 清掉历次拆窗验收遗留的面板窗口（面板持有旧 store 会把过期状态写回、干扰种子与锁） */
{
  const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()
  for (const t of list.filter((x) => x.type === 'page' && x.url.includes('panel='))) {
    try {
      const ws2 = new WebSocket(t.webSocketDebuggerUrl)
      await new Promise((r, j) => ((ws2.onopen = r), (ws2.onerror = j)))
      ws2.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: 'window.close()' } }))
      await c.sleep(250)
      ws2.close()
    } catch {
      /* 已关闭则忽略 */
    }
  }
  await c.sleep(600)
}
const results = []
let skipped = 0
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  —— ' + String(detail).slice(0, 360) : ''))
}
/** 环境性跳过（不计入 PASS/FAIL，但显式报告）：如锁屏/遮挡导致的窗口隐藏态（开发流程 5.3） */
const skip = (name, note = '') => {
  skipped++
  console.log(`SKIP ${name}  —— ${note}`)
}
/** 轮询页面表达式直到 {ok:true}（终态即停：失败也置 ok 并带 failed 字段）或超时 */
const until = async (expr, ms = 20000, step = 300) => {
  const end = Date.now() + ms
  let last = null
  while (Date.now() < end) {
    last = await c.evalx(expr)
    if (last && last.ok) return last
    await c.sleep(step)
  }
  return last || { ok: false, err: 'timeout' }
}
const STORE = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s`
const J = JSON.stringify
/* NSelect/option 对 press 序列敏感：完整派发 pointer/mouse 事件（真实点击同款） */
const fireClick = `(el) => {
  for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }))
  }
}`

/* ---------- 0) 种子并打开 AI 验证书 ---------- */
{
  const seed = await c.evalx(buildSeedExpr('AI 验证书', { reset: true }))
  check('AI 验证书种子写入', seed?.ok === true, JSON.stringify(seed))
  await c.evalx(`location.reload()`)
  await c.sleep(2600)
  await c.evalx(`[...document.querySelectorAll('.book-card')].find(x => x.textContent.includes('AI 验证书'))?.click()`)
  await c.sleep(1800)
  const opened = await c.evalx(`(() => {
    const w = ${STORE}.get('work')
    return { open: !!w.work, title: w.work?.title || '', chapter: w.selChapterId || '' }
  })()`)
  check('打开 AI 验证书（默认进入正文）', opened.open === true && opened.title.includes('AI 验证书') && !!opened.chapter, JSON.stringify(opened))
}

/* 锚点 id（种子 id 每次重置都变，从 store 现取） */
const ids = await c.evalx(`(() => {
  const w = ${STORE}.get('work')
  const chs = w.chapters.filter(x => !x.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder)
  const mubuRoot = w.liveMubu().find(n => n.parentId === null && (n.text || '') === '界脊设定')
  const charA = w.liveCharacters.find(x => x.name === '林昭')
  const charB = w.liveCharacters.find(x => x.name === '沈青梧')
  const olRoot = w.liveOlnodes().find(n => (n.title || '') === '主线')
  const olChild = olRoot ? w.olnodeChildren(olRoot.id).find(n => (n.title || '').includes('第一站')) : null
  return { workId: w.work.id, ch1: chs[0]?.id, ch2: chs[1]?.id, ch3: chs[2]?.id, mubuRoot: mubuRoot?.id, charA: charA?.id, charB: charB?.id, olRoot: olRoot?.id, olChild: olChild?.id }
})()`)
check('四能力锚点齐备（章节×3 / 幕布根 / 人物×2 / 大纲父子）', !!ids.ch3 && !!ids.mubuRoot && !!ids.charA && !!ids.charB && !!ids.olChild, JSON.stringify(ids))

/* ---------- 1) 设置区：多供应商预设（独立设置窗口）/ 启停 / 密钥 safeStorage / 备份过滤 / 连接测试（方案 §八.1） ---------- */
/* 设置按钮打开独立设置窗口（SettingsWindow）；面板窗口内执行 DOM 断言与交互 */
const openSettings = `(() => { const b = document.querySelector('button[title^="设置："]'); (${fireClick})(b); return 1 })()`
await c.evalx(openSettings)
await c.sleep(1600)
const s = await connect('panel=settings', CDP_PORT)
/** 面板窗口版 until（设置窗口渲染帧同样需要轮询等待） */
const untilS = async (expr, ms = 20000, step = 300) => {
  const end = Date.now() + ms
  let last = null
  while (Date.now() < end) {
    last = await s.evalx(expr)
    if (last && last.ok) return last
    await c.sleep(step)
  }
  return last || { ok: false, err: 'timeout' }
}
const SA = `(await import('/src/stores/ai.js')).useAiStore()`
/* 设置窗口默认停在外观页：切到「模型设置」页签再断言（面板左侧导航） */
await s.evalx(`(() => {
  const fire = ${fireClick}
  const nav = [...document.querySelectorAll('.sw-nav-item')].find((x) => x.textContent.includes('模型设置'))
  if (nav) fire(nav)
  return 1
})()`)
await untilS(`(() => ({ ok: !!document.querySelector('.ai-settings.ai-prov') }))()`, 8000)
check('设置窗口含 AI 模型设置区（多供应商预设）', (await s.evalx(`!!document.querySelector('.ai-settings.ai-prov')`)) === true)

/* 预设新建：走「添加供应商」模板菜单（DOM：按钮 → 菜单项），断言即时生效（新预设即当前使用） */
const addProbe = await s.evalx(`(async () => {
  const a = ${SA}
  if (!a.loaded) await a.loadSettings()
  const before = a.providers.length
  const fire = ${fireClick}
  const btn = document.querySelector('.ai-settings .ai-prov-add')
  if (!btn) return { err: 'no add button' }
  fire(btn)
  let item = null
  for (let i = 0; i < 24 && !item; i++) {
    await new Promise((r) => setTimeout(r, 250))
    item = [...document.querySelectorAll('.ai-tpl-item')].find((x) => x.textContent.includes('Ollama 本地'))
  }
  if (!item) return { err: 'no template item' }
  fire(item)
  await new Promise((r) => setTimeout(r, 600))
  return { before, count: a.providers.length, baseURL: a.baseURL, model: a.model, activeName: a.activeProvider?.name }
})()`)
check('「添加供应商」模板菜单新建预设：立即设为当前使用', addProbe.count === addProbe.before + 1 && addProbe.baseURL === 'http://127.0.0.1:11434/v1' && addProbe.model === 'qwen2.5' && addProbe.activeName === 'Ollama 本地', JSON.stringify(addProbe))

const provDom = await s.evalx(`(() => ({
  items: [...document.querySelectorAll('.ai-settings .ai-prov-item')].map((x) => x.textContent.trim()),
  hasAdd: !!document.querySelector('.ai-settings .ai-prov-add'),
  detailName: document.querySelector('.ai-settings .ai-name-input input')?.value || '',
  hasKeyInput: !!document.querySelector('.ai-settings input[type="password"]'),
  hasFormatSelect: !!document.querySelector('.ai-settings .ai-prov-detail .n-base-selection'),
  modelRows: document.querySelectorAll('.ai-settings .ai-model-row').length
}))()`)
check('预设列表渲染（含新增项）+ 详情头部 / 密钥输入 / 格式下拉就位', provDom.items.includes('Ollama 本地') && provDom.hasAdd === true && provDom.detailName === 'Ollama 本地' && provDom.hasKeyInput === true && provDom.hasFormatSelect === true && provDom.modelRows >= 1, JSON.stringify(provDom))

/* 供应商启停（总开关语义）：停用 → 自动切换到其他启用预设；重新启用恢复；无可切换时未就绪 */
const toggleChk = await s.evalx(`(async () => {
  const a = ${SA}
  const target = a.providers.find((p) => p.name === 'Ollama 本地') || a.activeProvider
  await a.setProviderEnabled(target.id, false)
  const off = { self: a.providers.find((p) => p.id === target.id)?.enabled, switched: a.activeProviderId !== target.id, ready: a.ready }
  await a.setProviderEnabled(target.id, true)
  return { off, self: a.providers.find((p) => p.id === target.id)?.enabled }
})()`)
check('供应商启停：停用后自动切换（无可切换则未就绪），重新启用恢复', toggleChk.off.self === false && toggleChk.self === true && (toggleChk.off.switched === true || toggleChk.off.ready === false), JSON.stringify(toggleChk))

/* 删除探针预设：数量回落、当前预设切换有效（级联删除该预设密钥） */
const removeChk = await s.evalx(`(async () => {
  const a = ${SA}
  const target = a.providers.find((p) => p.name === 'Ollama 本地')
  const before = a.providers.length
  await a.removeProvider(target.id)
  const after = a.providers.length
  return { before, after, activeValid: after === 0 ? a.activeProviderId === '' : !!a.activeProvider }
})()`)
check('删除预设：数量回落且当前预设切换有效', removeChk.after === removeChk.before - 1 && removeChk.activeValid === true, JSON.stringify(removeChk))

/* 确保存在当前预设（若上一步删空则新建），供后续密钥 / 连接测试步骤使用 */
await s.evalx(`(async () => { const a = ${SA}; if (!a.providers.length) await a.addProvider({ name: 'Mock 供应商' }); return 1 })()`)
await c.sleep(300)

/* 改填 mock 服务商（失焦即存）+ 添加并选用 mock-model（面板 DOM 交互，走真实 safeStorage/DPAPI 通道） */
await s.evalx(`(() => {
  const setVal = (el, v) => { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
  const url = document.querySelector('.ai-settings input[placeholder="https://api.deepseek.com/v1"]')
  setVal(url, ${J(MOCK_URL)})
  url.dispatchEvent(new Event('blur', { bubbles: true }))
  return 1
})()`)
await c.sleep(400)
/* 「＋ 添加模型」内联输入 → 回车提交 */
await s.evalx(`(() => { [...document.querySelectorAll('.ai-settings button')].find((b) => b.textContent.includes('添加模型'))?.click(); return 1 })()`)
await c.sleep(400)
await s.evalx(`(() => {
  const setVal = (el, v) => { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
  const inp = document.querySelector('.ai-settings input[placeholder*="手动输入模型名"]')
  if (!inp) return 0
  setVal(inp, 'mock-model')
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  return 1
})()`)
await c.sleep(500)
/* 点模型行选用（点行即选用，立即生效） */
const pickModel = await s.evalx(`(() => {
  const row = [...document.querySelectorAll('.ai-settings .ai-model-row')].find((x) => x.textContent.includes('mock-model'))
  if (!row) return { err: 'row absent' }
  row.click()
  return { clicked: true }
})()`)
await c.sleep(400)
const picked = await s.evalx(`(async () => { const a = ${SA}; return { model: a.model, models: a.models.join(','), baseURL: a.baseURL } })()`)
check('即时保存：Base URL 失焦落库、mock-model 添加并点行选用', picked.models.includes('mock-model') && picked.model === 'mock-model' && picked.baseURL === MOCK_URL && pickModel.clicked === true, JSON.stringify({ pickModel, picked }))
/* 密钥：输入后失焦自动加密保存（面板无「保存密钥」按钮；密码框是唯一 password 输入） */
await s.evalx(`(() => {
  const setVal = (el, v) => { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
  const el = document.querySelector('.ai-settings input[type="password"]')
  if (!el) return 0
  setVal(el, ${J(PLAIN_KEY)})
  el.dispatchEvent(new Event('blur', { bubbles: true }))
  return 1
})()`)
await c.sleep(900)
const keyChk = await s.evalx(`(async () => {
  const a = ${SA}
  const { db } = await import('/src/db/database.js')
  const rows = await db.appconfig.toArray()
  const cipher = rows.find((r) => r.key === 'ai.cred.' + a.activeProviderId)?.value || ''
  const plain = ${J(PLAIN_KEY)}
  let roundtrip = ''
  try { roundtrip = await a.decryptCredential() } catch (e) { roundtrip = 'ERR:' + String(e).slice(0, 80) }
  return {
    hasCredential: a.hasCredential,
    cipherLen: cipher.length,
    isPlain: cipher === plain,
    containsPlain: cipher.includes(plain),
    roundtrip,
    anyPlainInAppconfig: rows.some((r) => JSON.stringify(r).includes(plain))
  }
})()`)
check(
  '密钥经 safeStorage 加密落 ai.cred.<预设id>（密文 ≠ 明文）且解密回读一致',
  keyChk.hasCredential === true && keyChk.cipherLen > 0 && keyChk.isPlain === false && keyChk.containsPlain === false && keyChk.roundtrip === PLAIN_KEY,
  JSON.stringify(keyChk)
)
check('appconfig 全表无明文密钥', keyChk.anyPlainInAppconfig === false, JSON.stringify(keyChk))

const backup = await s.evalx(`(async () => {
  const { exportBackupJson } = await import('/src/db/repo.js')
  const { db } = await import('/src/db/database.js')
  const rows = await db.appconfig.toArray()
  const cipher = rows.find((r) => r.key.startsWith('ai.cred.'))?.value || ''
  const dump = await exportBackupJson()
  return { hasPlain: dump.includes(${J(PLAIN_KEY)}), hasCipher: dump.includes(cipher), cipherLen: cipher.length }
})()`)
check('备份 JSON 不含密钥（明文与密文都过滤）', backup.hasPlain === false && backup.hasCipher === false && backup.cipherLen > 0, JSON.stringify(backup))

await s.evalx(`(() => { [...document.querySelectorAll('.ai-settings button')].find((b) => b.textContent.trim() === '连接测试')?.click(); return 1 })()`)
const testRes = await untilS(`(() => {
  const el = document.querySelector('.ai-settings .ai-test-result')
  return el ? { ok: true, isOk: el.classList.contains('ok'), text: el.textContent.trim() } : { ok: false }
})()`, 25000)
const afterTest = await s.evalx(`(async () => { const a = ${SA}; return { baseURL: a.baseURL, ready: a.ready, usageCalls: a.usage.total.calls } })()`)
check('连接测试通过（mock 回环，预设已就绪）', testRes.isOk === true && String(testRes.text).startsWith('连接成功') && afterTest.baseURL === MOCK_URL && afterTest.ready === true, JSON.stringify(testRes) + ' | ' + JSON.stringify(afterTest))

/* 关闭设置窗口（独立窗口），主窗口工具条 AI 入口随广播解禁 */
await s.evalx(`window.native.panelCloseSelf()`)
await c.sleep(900)
check('工具条 AI 入口已解禁（ai.ready 置灰解除）', (await c.evalx(`(() => { const b = [...document.querySelectorAll('.tb')].find(x => (x.title || '').includes('发送给恍然梦')); return b ? b.disabled === false : 'no-btn' })()`)) === true)

/* ---------- 2) 装配器：四任务发送清单 + 预算裁剪 + 隐私模式（方案 §八.2） ---------- */
/* 以下 2–5 段落依赖旧版四能力 API（assembleContext / startPlotBranch / startOutlinPlan / runTask / startWorkflow /
   addStyle 等），这些 API 已在 v1.0.24「preset 驱动对话引擎」重构中退出运行；对应能力验收由
   tools/preset-verify.mjs / tools/preset-unit-verify.mjs / tools/ai-v2-verify.mjs 覆盖。
   缺失时显式跳过并结束，不再以中途崩溃的方式中断整个脚本（设置区等前置段落已独立完成）。 */
const legacyApiMissing = (await c.evalx(`(async () => {
  const a = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ai')
  const mod = await import('/src/services/ai/context.js').catch(() => ({}))
  return !(typeof a.startPlotBranch === 'function' && typeof a.runTask === 'function' && typeof mod.assembleContext === 'function')
})()`)) === true
if (legacyApiMissing) {
  skip('装配器 / 自由问答 / 四能力 / 拆窗锁门禁（旧版四能力 API）', '相关 API 已在 preset 驱动对话引擎重构中退出运行——专项验收见 preset-verify / preset-unit-verify / ai-v2-verify')
  const passLegacy = results.filter(Boolean).length
  console.log(`\n${passLegacy}/${results.length} 通过` + (skipped ? `，${skipped} 项跳过（含旧版四能力段落）` : ''))
  process.exit(results.includes(false) ? 1 : 0)
}
const asm = await c.evalx(`(async () => {
  const { assembleContext, estimateTokens } = await import('/src/services/ai/context.js')
  const rep = (r) => r.report.join('｜')
  const plot = await assembleContext({ task: 'plot', anchorId: ${J(ids.ch3)}, budget: 8000, provider: null })
  const ol = await assembleContext({ task: 'outline', anchorId: ${J(ids.olChild)}, budget: 8000, provider: null })
  const lore = await assembleContext({ task: 'lore', anchorId: ${J(ids.mubuRoot)}, budget: 8000, provider: null })
  const ch = await assembleContext({ task: 'character', anchorId: ${J(ids.charA)}, budget: 8000, provider: null })
  const trim = await assembleContext({ task: 'plot', anchorId: ${J(ids.ch3)}, budget: 200, provider: null })
  const priv = await assembleContext({ task: 'plot', anchorId: ${J(ids.ch3)}, budget: 8000, provider: null, privacy: true })
  return {
    plot: rep(plot), ol: rep(ol), lore: rep(lore), ch: rep(ch),
    trim: { used: estimateTokens(trim.text), dropped: trim.dropped.length },
    priv: { report: rep(priv), droppedReasons: priv.dropped.map((d) => d.reason).join('｜') }
  }
})()`)
check('plot 装配：当前章正文 + 前情摘要 ×2 + L2 出场片段', asm.plot.includes('当前章《第三章 · 灯下铜符》正文') && asm.plot.includes('前后章摘要 ×2') && asm.plot.includes('出场片段'), asm.plot)
check('outline 装配：祖先链 + 同级节点 + 选中子树', asm.ol.includes('大纲祖先链 ×1') && asm.ol.includes('同级节点标题 ×1') && asm.ol.includes('选中节点子树「第一站：雾都」'), asm.ol)
check('lore 装配：选中子树（2 节点）+ 同层 ×1', asm.lore.includes('选中设定节点子树（2 节点）') && asm.lore.includes('同层节点标题 ×1'), asm.lore)
check('character 装配：全字段 + 关系 ×1 + 出场章节 ×3', asm.ch.includes('人物「林昭」全字段') && asm.ch.includes('人物关系 ×1') && asm.ch.includes('出场章节清单 ×3'), asm.ch)
check('预算裁剪：200 tokens 下整块放弃且装配文本不超预算', asm.trim.dropped > 0 && asm.trim.used <= 200, JSON.stringify(asm.trim))
check('隐私模式：报告标注、L2 检索片段放弃、不发送正文原文', asm.priv.report.includes('隐私模式') && asm.priv.droppedReasons.includes('隐私模式') && !asm.priv.report.includes('正文（'), JSON.stringify(asm.priv))

/* ---------- 3) 自由问答（方案 §五.5，附带覆盖） ---------- */
await c.evalx(`(() => { ${STORE}.get('ai').send('全书的主角是谁？'); return 1 })()`)
const chat = await until(`(() => {
  const a = ${STORE}.get('ai')
  const m = a.chat[a.chat.length - 1]
  if (a.chatBusy || !m || m.streaming) return { ok: false }
  return { ok: true, role: m.role, content: m.content, degraded: m.degraded, writeHint: m.writeHint, calls: a.usage.total.calls }
})()`, 25000)
check('自由问答：结构化回答解析（非降级）、无写入意图', chat.ok === true && chat.role === 'assistant' && chat.degraded === false && String(chat.content).includes('主角是林昭') && chat.writeHint === '', JSON.stringify(chat))
const usageRow = await c.evalx(`(async () => { const { db } = window.__ns; const r = await db.appconfig.get('ai.usage'); return { persisted: !!r?.value, calls: (r?.value || {}).calls || 0 } })()`)
check('用量累计持久化（total 行落库且 ≥ 1 次调用）', usageRow.persisted === true && usageRow.calls >= 1 && (chat.calls || 0) >= 1, JSON.stringify(usageRow))

/* ---------- 4) 四能力端到端：mock 固定 JSON → 卡片 → 应用 → 落库 + 快照（方案 §八.3） ---------- */
/* 4.1 正文发展：线路卡 → 落到大纲 + 以示例起笔（强制快照） */
{
  await c.evalx(`(() => { const w = ${STORE}.get('work'); w.tab = 'chapters'; w.selChapterId = ${J(ids.ch3)}; return 1 })()`)
  await until(`(() => { const ed = window.__ns.editor; return ed && !ed.isDestroyed && ${STORE}.get('work').selChapterId === ${J(ids.ch3)} ? { ok: true } : { ok: false } })()`, 8000)
  await c.evalx(`window.__flushNow && window.__flushNow()`)
  await c.sleep(700)
  const revBefore = await c.evalx(`(async () => (await window.__ns.db.revisions.where('[entityType+entityId]').equals(['chapter', ${J(ids.ch3)}]).count()))()`)

  await c.evalx(`(() => { ${STORE}.get('ai').startPlotBranch(${J(ids.ch3)}); return 1 })()`)
  const plot = await until(`(() => {
    const a = ${STORE}.get('ai')
    if (a.phase === 'ready') return { ok: true, cards: a.result.cards.map((x) => ({ kind: x.kind, title: x.title })), report: a.result.context.report.join('｜'), degraded: a.result.degraded }
    if (a.phase === 'failed') return { ok: true, failed: a.error?.message || '' }
    return { ok: false, phase: a.phase }
  })()`, 40000)
  check('plot 任务：2 张线路卡 + 发送范围报告含当前章（非降级）', plot.ok === true && !plot.failed && plot.cards?.length === 2 && plot.cards.every((x) => x.kind === 'branch') && plot.report.includes('当前章《第三章') && plot.degraded === false, JSON.stringify(plot))

  const aisum = await c.evalx(`(async () => {
    const { db } = window.__ns
    const s1 = await db.aisum.where('[entityType+entityId]').equals(['chapter', ${J(ids.ch1)}]).first()
    const s2 = await db.aisum.where('[entityType+entityId]').equals(['chapter', ${J(ids.ch2)}]).first()
    return { s1: (s1?.summary || '').length, s2: (s2?.summary || '').length }
  })()`)
  check('章节摘要缓存生成（前两章 aisum 行非空）', aisum.s1 > 0 && aisum.s2 > 0, JSON.stringify(aisum))

  const cardsDom = await until(`(() => {
    const card = [...document.querySelectorAll('.ai-card')].find((x) => x.textContent.includes('铜符之约'))
    return card && [...card.querySelectorAll('button')].some((b) => b.textContent.includes('落到大纲')) ? { ok: true } : { ok: false }
  })()`, 8000)
  check('线路卡在助手栏渲染（BranchCard + 落到大纲按钮）', cardsDom.ok === true, JSON.stringify(cardsDom))

  await c.evalx(`(() => {
    const card = [...document.querySelectorAll('.ai-card')].find((x) => x.textContent.includes('铜符之约'))
    ;[...card.querySelectorAll('button')].find((b) => b.textContent.includes('落到大纲'))?.click()
    return 1
  })()`)
  await c.sleep(500)
  const olApplied = await c.evalx(`(() => {
    const w = ${STORE}.get('work')
    const anchor = w.olnodes.find((n) => n.kind === 'anchor' && n.refId === ${J(ids.ch3)} && !n.deletedAt)
    const hit = anchor && w.olnodeChildren(anchor.id).some((n) => n.title === '铜符之约')
    return { anchor: !!anchor, hit: !!hit }
  })()`)
  await c.evalx(`window.__flushNow && window.__flushNow()`)
  await c.sleep(600)
  const olInDb = await c.evalx(`(async () => (await window.__ns.db.olnodes.where('workId').equals(${J(ids.workId)}).toArray()).some((n) => n.title === '铜符之约' && !n.deletedAt))()`)
  check('「落到大纲」：章纲锚点子节点写入（store + 落库）', olApplied.anchor === true && olApplied.hit === true && olInDb === true, JSON.stringify(olApplied) + ' db=' + olInDb)

  await c.evalx(`(() => {
    const card = [...document.querySelectorAll('.ai-card')].find((x) => x.textContent.includes('铜符之约'))
    ;[...card.querySelectorAll('button')].find((b) => b.textContent.includes('以示例起笔续写'))?.click()
    return 1
  })()`)
  await c.sleep(600)
  await c.evalx(`window.__flushNow && window.__flushNow()`)
  await c.sleep(700)
  const draft = await c.evalx(`(async () => {
    const { db } = window.__ns
    const ch = await db.chapters.get(${J(ids.ch3)})
    const revs = await db.revisions.where('[entityType+entityId]').equals(['chapter', ${J(ids.ch3)}]).count()
    return { hasOpening: (ch?.content || '').includes('山雨初歇'), revs, revBefore: ${revBefore} }
  })()`)
  check('「以示例起笔续写」：正文追加落库 + 强制版本快照 +1', draft.hasOpening === true && draft.revs === draft.revBefore + 1, JSON.stringify(draft))
}

/* 4.2 大纲规划：方案卡 → 子节点 + 语义连线 */
{
  await c.evalx(`(() => { ${STORE}.get('ai').startOutlinePlan(${J(ids.olChild)}); return 1 })()`)
  const plan = await until(`(() => {
    const a = ${STORE}.get('ai')
    if (a.phase === 'ready') return { ok: true, cards: a.result.cards.map((x) => ({ kind: x.kind, name: x.name, nodes: (x.nodes || []).length })) }
    if (a.phase === 'failed') return { ok: true, failed: a.error?.message || '' }
    return { ok: false, phase: a.phase }
  })()`, 40000)
  check('outline 任务：2 套方案卡（含子节点草案）', plan.ok === true && !plan.failed && plan.cards?.length === 2 && plan.cards.every((x) => x.kind === 'plan') && plan.cards[0].nodes === 3, JSON.stringify(plan))

  await c.evalx(`(() => {
    const w = ${STORE}.get('work')
    w.selOlnodeId = ${J(ids.olChild)}
    const card = [...document.querySelectorAll('.ai-card')].find((x) => x.textContent.includes('界脊之心'))
    ;[...card.querySelectorAll('button')].find((b) => b.textContent.includes('应用到选中节点'))?.click()
    return 1
  })()`)
  await c.sleep(600)
  await c.evalx(`window.__flushNow && window.__flushNow()`)
  await c.sleep(600)
  const planApplied = await c.evalx(`(() => {
    const w = ${STORE}.get('work')
    const kids = w.olnodeChildren(${J(ids.olChild)}).filter((n) => ['驿站夜谈', '暗渠入口', '星图归位'].includes(n.title))
    const byTitle = (t) => kids.find((n) => n.title === t)
    /* PlanCard 连线语义取后一节点的 edge（PlanCard.vue:46 edgeLabel(nodes[i].edge)） */
    const rel1 = byTitle('驿站夜谈')?.rels?.some((r) => r.toId === byTitle('暗渠入口')?.id && r.kind === '伏笔')
    const rel2 = byTitle('暗渠入口')?.rels?.some((r) => r.toId === byTitle('星图归位')?.id && r.kind === '冲突')
    return { count: kids.length, rel1: !!rel1, rel2: !!rel2 }
  })()`)
  const planInDb = await c.evalx(`(async () => (await window.__ns.db.olnodes.where('workId').equals(${J(ids.workId)}).toArray()).some((n) => n.title === '驿站夜谈' && !n.deletedAt))()`)
  check('方案应用：3 个子节点挂载 + 伏笔/冲突语义连线 + 落库', planApplied.count === 3 && planApplied.rel1 && planApplied.rel2 && planInDb === true, JSON.stringify(planApplied) + ' db=' + planInDb)
}

/* 4.3 设定扩展：add 草案卡 → 幕布子树 */
{
  await c.evalx(`(() => { ${STORE}.get('ai').startLoreExpand(${J(ids.mubuRoot)}); return 1 })()`)
  const lore = await until(`(() => {
    const a = ${STORE}.get('ai')
    if (a.phase === 'ready') { const card = a.result.cards[0]; return { ok: true, kind: card?.kind, subject: card?.subject, mode: card?.mode, treeText: card?.tree?.text } }
    if (a.phase === 'failed') return { ok: true, failed: a.error?.message || '' }
    return { ok: false, phase: a.phase }
  })()`, 40000)
  check('lore 任务：add 形态草案卡（铜符谱系子树）', lore.ok === true && !lore.failed && lore.kind === 'diff' && lore.subject === 'lore' && lore.mode === 'add' && lore.treeText === '铜符谱系', JSON.stringify(lore))

  const loreBtn = await until(`(() => {
    const card = [...document.querySelectorAll('.ai-card')].find((x) => x.textContent.includes('铜符谱系'))
    const btn = card && [...card.querySelectorAll('button')].find((b) => b.textContent.includes('确认应用'))
    return btn ? { ok: true, disabled: btn.disabled } : { ok: false }
  })()`, 8000)
  const loreClick = await c.evalx(`(() => {
    const card = [...document.querySelectorAll('.ai-card')].find((x) => x.textContent.includes('铜符谱系'))
    if (!card) return { err: 'card gone' }
    const btn = [...card.querySelectorAll('button')].find((b) => b.textContent.includes('确认应用'))
    if (!btn) return { err: 'no btn', btns: [...card.querySelectorAll('button')].map((b) => b.textContent.trim()) }
    btn.click()
    return { clicked: true, disabled: btn.disabled }
  })()`)
  await c.sleep(500)
  const loreApplied = await c.evalx(`(() => {
    const w = ${STORE}.get('work')
    const added = w.mubuChildren(${J(ids.mubuRoot)}).find((n) => n.text === '铜符谱系')
    const grand = added ? w.mubuChildren(added.id).some((n) => n.text === '铜符成对，合拢可见星图。') : false
    return { added: !!added, grand }
  })()`)
  await c.evalx(`window.__flushNow && window.__flushNow()`)
  await c.sleep(500)
  const loreInDb = await c.evalx(`(async () => (await window.__ns.db.mubu.where('workId').equals(${J(ids.workId)}).toArray()).some((n) => n.text === '铸于前朝界脊工坊。' && !n.deletedAt))()`)
  check('设定草案应用：幕布子树挂载（store + 落库）', loreBtn.ok === true && loreBtn.disabled === false && loreClick.clicked === true && loreApplied.added === true && loreApplied.grand === true && loreInDb === true, JSON.stringify({ btn: loreBtn, click: loreClick, applied: loreApplied, db: loreInDb }))
}

/* 4.4 人物丰富：diff 卡 → 字段/小传/别名/关系 + 新建对端 */
{
  await c.evalx(`(() => { ${STORE}.get('ai').startCharacterEnrich(${J(ids.charA)}); return 1 })()`)
  const char = await until(`(() => {
    const a = ${STORE}.get('ai')
    if (a.phase === 'ready') {
      const card = a.result.cards[0]
      return { ok: true, subject: card?.subject, fields: Object.keys(card?.fields || {}).join(','), aliases: (card?.aliases || []).join(','), rels: (card?.relations || []).map((r) => r.name).join(',') }
    }
    if (a.phase === 'failed') return { ok: true, failed: a.error?.message || '' }
    return { ok: false, phase: a.phase }
  })()`, 40000)
  check('character 任务：diff 卡（字段/别名/关系建议）', char.ok === true && !char.failed && char.subject === 'character' && char.fields === '师承' && char.aliases === '小昭' && char.rels === '老更夫,巡夜人', JSON.stringify(char))

  const charBtn = await until(`(() => {
    const card = [...document.querySelectorAll('.ai-card')].find((x) => x.textContent.includes('人物丰富建议'))
    const btn = card && [...card.querySelectorAll('button')].find((b) => b.textContent.includes('确认应用'))
    return btn ? { ok: true, disabled: btn.disabled } : { ok: false }
  })()`, 8000)
  await c.evalx(`(() => {
    const card = [...document.querySelectorAll('.ai-card')].find((x) => x.textContent.includes('人物丰富建议'))
    ;[...card.querySelectorAll('button')].find((b) => b.textContent.includes('确认应用'))?.click()
    return 1
  })()`)
  await c.sleep(700)
  const charApplied = await c.evalx(`(() => {
    const w = ${STORE}.get('work')
    const a = w.characters.find((x) => x.id === ${J(ids.charA)})
    const newer = w.liveCharacters.find((x) => x.name === '老更夫')
    const newer2 = w.liveCharacters.find((x) => x.name === '巡夜人')
    const rels = w.relations.filter((r) => r.fromId === ${J(ids.charA)})
    return {
      fieldAdded: a?.fields?.师承 === '雾都星匠遗脉',
      fieldKept: a?.fields?.境界 === '凝气三层',
      bio: (a?.content || '').startsWith('林昭，雾都少年'),
      alias: (a?.aliases || '').includes('小昭'),
      newChar1: !!newer,
      newChar2: !!newer2,
      rel1: rels.some((r) => newer && r.toId === newer.id && r.label === '引路人'),
      rel2: rels.some((r) => newer2 && r.toId === newer2.id && r.label === '旧识')
    }
  })()`)
  await c.evalx(`window.__flushNow && window.__flushNow()`)
  await c.sleep(600)
  const charInDb = await c.evalx(`(async () => {
    const { db } = window.__ns
    const a = await db.characters.get(${J(ids.charA)})
    const rels = (await db.relations.where('workId').equals(${J(ids.workId)}).toArray()).filter((r) => r.fromId === ${J(ids.charA)})
    const all = await db.characters.where('workId').equals(${J(ids.workId)}).toArray()
    return { bio: (a?.content || '').includes('佩半枚铜符'), relCount: rels.length, newChars: ['老更夫', '巡夜人'].filter((n) => all.some((x) => x.name === n)).length }
  })()`)
  check(
    '人物丰富应用：字段合并/小传扩写/别名 + 关系新建（对端人物 ×2 落库）',
    charBtn.ok === true && charBtn.disabled === false && charApplied.fieldAdded && charApplied.fieldKept && charApplied.bio && charApplied.alias && charApplied.newChar1 && charApplied.newChar2 && charApplied.rel1 && charApplied.rel2 && charInDb.relCount === 3 && charInDb.newChars === 2,
    JSON.stringify({ store: charApplied, db: charInDb })
  )
}

/* ---------- 5) 拆窗锁门禁：章节拆出面板后主窗口 AI 写入被拒（方案 §八.4 / §六.2） ---------- */
{
  const contentBefore = await c.evalx(`(async () => (await window.__ns.db.chapters.get(${J(ids.ch3)}))?.content || '')()`)
  const revBefore = await c.evalx(`(async () => (await window.__ns.db.revisions.where('[entityType+entityId]').equals(['chapter', ${J(ids.ch3)}]).count()))()`)

  const popped = await c.evalx(`(async () => {
    const { popOut } = await import('/src/services/panelwindows.js')
    const w = ${STORE}.get('work')
    w.tab = 'chapters' // 只读占位随当前模块显示：章节被拆出时须停在正文模块才能看到 .pop-lock-pane
    await new Promise((r) => setTimeout(r, 400))
    return { ok: await popOut(w, 'chapter', ${J(ids.ch3)}, 'AI 门禁面板') }
  })()`)
  const lockOn = await until(`(async () => {
    const { isPopped } = await import('/src/services/panelwindows.js')
    const w = ${STORE}.get('work')
    const locked = isPopped(w, 'chapter', ${J(ids.ch3)})
    /* 章节锁不上 .pop-lock-pane（那是模块锁的占位，Workbench.vue:131 对 chapters tab 恒 false）：
       正文模块的锁形态是编辑器转只读 + panel-lock-note（EditorPane.vue:32/125/219）。
       TipTap 的 isEditable 是布尔属性（setEditable 维护），非方法 */
    const readonly = window.__ns.editor && !window.__ns.editor.isDestroyed && window.__ns.editor.isEditable === false
    const lockNote = !!document.querySelector('.panel-lock-note')
    return { ok: locked && readonly && lockNote, locked, readonly, lockNote }
  })()`, 12000)
  check('章节拆出面板：isPopped 锁定 + 编辑器转只读（panel-lock-note）', popped.ok === true && lockOn.locked === true && lockOn.readonly === true && lockOn.lockNote === true, JSON.stringify({ popped, lockOn }))

  /* 主窗口中心区已被只读占位替代（编辑器卸载）——切到大纲模块保持助手栏可见，再重跑任务拿新卡 */
  await c.evalx(`(() => { const w = ${STORE}.get('work'); w.tab = 'outline'; ${STORE}.get('ai').startPlotBranch(${J(ids.ch3)}); return 1 })()`)
  await until(`(() => {
    const a = ${STORE}.get('ai')
    if (a.phase === 'ready' || a.phase === 'failed') return { ok: true, failed: a.phase === 'failed' ? a.error?.message || '' : '' }
    return { ok: false, phase: a.phase }
  })()`, 40000)
  const cardReady = await until(`(() => {
    const card = [...document.querySelectorAll('.ai-card')].find((x) => x.textContent.includes('铜符之约'))
    return card && [...card.querySelectorAll('button')].some((b) => b.textContent.includes('以示例起笔续写')) ? { ok: true } : { ok: false }
  })()`, 8000)

  await c.evalx(`(() => {
    window.__aiSpy = { warn: [] }
    window.__aiMsgOrig = window.$msg
    if (window.$msg) window.$msg = Object.assign({}, window.$msg, { warning: (m) => { window.__aiSpy.warn.push(String(m)); window.__aiMsgOrig.warning(m) } })
    const card = [...document.querySelectorAll('.ai-card')].find((x) => x.textContent.includes('铜符之约'))
    ;[...card.querySelectorAll('button')].find((b) => b.textContent.includes('以示例起笔续写'))?.click()
    return 1
  })()`)
  await c.sleep(700)
  await c.evalx(`window.$msg = window.__aiMsgOrig; window.__flushNow && window.__flushNow()`)
  await c.sleep(700)
  const refused = await c.evalx(`(async () => {
    const { db } = window.__ns
    const ch = await db.chapters.get(${J(ids.ch3)})
    const revs = await db.revisions.where('[entityType+entityId]').equals(['chapter', ${J(ids.ch3)}]).count()
    return {
      warn: (window.__aiSpy?.warn || []).join('｜'),
      contentSame: (ch?.content || '') === ${J(contentBefore)},
      revsSame: revs === ${revBefore}
    }
  })()`)
  check('锁门禁：锁定章节上「以示例起笔续写」被拒（提示拆出、正文与快照均未变）', String(refused.warn).includes('拆出') && refused.contentSame === true && refused.revsSame === true, JSON.stringify(refused))

  /* 关闭面板 → 锁释放 */
  const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()
  for (const t of list.filter((x) => x.type === 'page' && x.url.includes('panel='))) {
    try {
      const ws2 = new WebSocket(t.webSocketDebuggerUrl)
      await new Promise((r, j) => ((ws2.onopen = r), (ws2.onerror = j)))
      ws2.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: 'window.close()' } }))
      await c.sleep(300)
      ws2.close()
    } catch {
      /* 已关闭则忽略 */
    }
  }
  const released = await until(`(async () => {
    const { isPopped } = await import('/src/services/panelwindows.js')
    const w = ${STORE}.get('work')
    return { ok: !isPopped(w, 'chapter', ${J(ids.ch3)}), placeholder: !!document.querySelector('.pop-lock-pane') }
  })()`, 12000)
  check('关闭面板：锁释放、只读占位消失', released.ok === true && released.placeholder === false, JSON.stringify(released))
  await c.evalx(`(() => { const w = ${STORE}.get('work'); w.tab = 'chapters'; w.selChapterId = ${J(ids.ch3)}; return 1 })()`)
}

const pass = results.filter(Boolean).length
console.log(`\n${pass}/${results.length} 通过` + (skipped ? `，${skipped} 项环境跳过（窗口隐藏态降级）` : ''))
process.exit(results.includes(false) ? 1 : 0)
