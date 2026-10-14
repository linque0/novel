/* OpenPencil S0 文本截取（设计物料工具，不参与应用运行）：
   把中文文本按应用内置字体渲染成 PNG，供 .fig 设计稿以图片填充使用。
   背景：OpenPencil v1 渲染器只内置 Inter / Noto Naskh Arabic，CJK 无字体可渲染（README 已知边界），
   因此设计稿中的中文文本一律走「本工具截图 → set_image_fill 放置」管线。

   用法：node tools/opencil-textshot.mjs <spec.json>
   spec：{
     dpr?: 2,                     // devicePixelRatio（导出像素 = CSS 尺寸 × dpr）
     outDir: "docs/…/exports/text",
     transparent?: true,          // 默认 true：透明底
     blocks: [{
       id, text,                  // 支持 \n（pre-wrap）
       font?: "Noto Serif SC",    // 字体族（需在 fonts.css / fonts-user.css / 系统字体中）
       size?: 17, weight?: 400, color?: "#2A2620",
       width?? 320,               // CSS px 定宽（不传则按内容自适应）
       lineHeight?: 1.9, align?: "left|center|right",
       letterSpacing?: 0, italic?: false
     }]
   }
   输出：outDir/<id>.png + outDir/manifest.json（含每块 CSS 宽高，用于 .fig 矩形尺寸）
   双模式单文件：node 下 spawn electron 自身；electron 下执行截取。 */
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const IS_ELECTRON = !!process.versions.electron

if (!IS_ELECTRON) {
  const specArg = process.argv[2]
  if (!specArg) {
    console.error('用法: node tools/opencil-textshot.mjs <spec.json>')
    process.exit(1)
  }
  const specPath = resolve(specArg)
  const electronPath = (await import('electron')).default
  console.log('[textshot] electron:', electronPath)
  const child = spawn(electronPath, [__filename, specPath], { stdio: 'inherit', windowsHide: false })
  child.on('exit', (code) => process.exit(code ?? 0))
} else {
  process.on('unhandledRejection', (e) => console.error('[textshot] unhandledRejection:', e))
  process.on('uncaughtException', (e) => console.error('[textshot] uncaughtException:', e?.stack || e))
  run().catch((e) => {
    console.error('[textshot] 失败:', e?.stack || e?.message || (e && JSON.stringify(e)) || String(e), e)
    process.exit(1)
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function run() {
  const step = (s) => console.log('[textshot] step:', s)
  step('import electron')
  const { app, BrowserWindow } = await import('electron')
  step('resolve spec')
  const specPath = resolve(process.argv[process.argv.length - 1])
  step('read spec ' + specPath)
  const spec = JSON.parse(readFileSync(specPath, 'utf8'))
  const outDir = resolve(spec.outDir)
  mkdirSync(outDir, { recursive: true })
  const dpr = Math.max(1, Math.min(4, Number(spec.dpr) || 2))
  const transparent = spec.transparent !== false
  const blocks = spec.blocks || []
  if (!blocks.length) throw new Error('spec.blocks 为空')

  const repoRoot = resolve(dirname(__filename), '..')
  const fontsCss = pathToFileURL(join(repoRoot, 'src/assets/fonts/fonts.css')).href
  const fontsUserCss = pathToFileURL(join(repoRoot, 'src/assets/fonts/fonts-user.css')).href

  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const stack = (font) => `'${font}', 'Microsoft YaHei', 'PingFang SC', sans-serif`
  const blockHtml = blocks
    .map((b) => {
      const st = [
        `width:${b.width ? b.width + 'px' : 'max-content'}`,
        `font-family:${stack(b.font || 'Noto Serif SC')}`,
        `font-size:${b.size || 17}px`,
        `font-weight:${b.weight || 400}`,
        `color:${b.color || '#2A2620'}`,
        `line-height:${b.lineHeight || 1.9}`,
        `text-align:${b.align || 'left'}`,
        `letter-spacing:${b.letterSpacing || 0}px`,
        b.italic ? 'font-style:italic' : ''
      ]
        .filter(Boolean)
        .join(';')
      return `<div class="blk" id="b${blocks.indexOf(b)}" data-id="${esc(b.id)}" style="${st}">${esc(b.text)}</div>`
    })
    .join('\n<div class="gap"></div>\n')

  const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${fontsCss}">
<link rel="stylesheet" href="${fontsUserCss}">
<style>
  html,body{margin:0;padding:0;background:${transparent ? 'transparent' : '#FFFFFF'}}
  .root{position:absolute;left:0;top:0;display:flex;flex-direction:column}
  .blk{white-space:pre-wrap;word-break:break-word;padding:0;margin:0}
  .gap{height:24px;flex:0 0 auto}
</style></head><body>
<div class="root">
${blockHtml}
</div>
<script>
  window.__ready = (async () => {
    const blocks = Array.from(document.querySelectorAll('.blk'))
    const fonts = new Set()
    for (const b of blocks) {
      const cs = getComputedStyle(b)
      fonts.add(JSON.stringify([cs.fontWeight, cs.fontSize, cs.fontStyle, cs.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '')]))
    }
    await Promise.all(Array.from(fonts, (f) => { const [w, s, st, fam] = JSON.parse(f); return document.fonts.load(st + ' ' + w + ' ' + s + ' "' + fam + '"') }))
    await document.fonts.ready
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    return document.fonts.status
  })()
</script>
</body></html>`

  const htmlPath = join(outDir, '__textshot.html')
  writeFileSync(htmlPath, html, 'utf8')
  step('html written ' + htmlPath)

  /* 固定渲染倍率：不干预时取系统 DPI（实测 125%），截图分辨率不可控 */
  app.commandLine.appendSwitch('force-device-scale-factor', String(dpr))
  app.commandLine.appendSwitch('high-dpi-support', '1')
  await app.whenReady()
  step('app ready (dpr=' + dpr + ')')
  const maxW = Math.max(...blocks.map((b) => Number(b.width) || 360))
  const winW = Math.min(2400, Math.max(720, maxW + 64))
  const win = new BrowserWindow({
    width: winW,
    height: 900,
    x: 40,
    y: 40,
    show: false,
    frame: false,
    transparent,
    backgroundColor: transparent ? '#00000000' : '#FFFFFF',
    webPreferences: { backgroundThrottling: false, sandbox: true, contextIsolation: true }
  })
  win.webContents.setBackgroundThrottling(false)
  step('load html')
  await win.loadFile(htmlPath)
  step('evaluate ready')
  const status = await win.webContents.executeJavaScript(
    `(async () => { try { return await window.__ready } catch (e) { return 'ERR: ' + (e && (e.stack || e.message || JSON.stringify(e) || String(e))) } })()`
  )
  console.log('[textshot] fonts:', status)

  // 显示窗口（不抢焦点）并临时置顶：被遮挡时 Chromium 不重绘，capturePage 会取到过期帧
  win.showInactive()
  win.setAlwaysOnTop(true, 'screen-saver')
  await sleep(350)

  const manifest = []
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    await win.webContents.executeJavaScript(`document.getElementById('b${i}').scrollIntoView({block:'center'})`)
    await sleep(60)
    const r = await win.webContents.executeJavaScript(
      `(() => { const e = document.getElementById('b${i}'); const x = e.getBoundingClientRect(); return { x: x.x, y: x.y, w: x.width, h: x.height } })()`
    )
    const rect = {
      x: Math.max(0, Math.floor(r.x)),
      y: Math.max(0, Math.floor(r.y)),
      width: Math.max(1, Math.ceil(r.w)),
      height: Math.max(1, Math.ceil(r.h))
    }
    const img = await win.webContents.capturePage(rect)
    const png = img.toPNG()
    const sz = img.getSize()
    const file = join(outDir, `${b.id}.png`)
    writeFileSync(file, png)
    manifest.push({ id: b.id, file: `${b.id}.png`, cssW: Math.ceil(r.w), cssH: Math.ceil(r.h), pxW: sz.width, pxH: sz.height, text: b.text })
    console.log(`[textshot] ${b.id} ${Math.ceil(r.w)}×${Math.ceil(r.h)} -> ${b.id}.png (${png.length}B)`)
  }
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ dpr, blocks: manifest }, null, 2))
  console.log('[textshot] manifest:', join(outDir, 'manifest.json'))
  win.setAlwaysOnTop(false)
  win.destroy()
  app.quit()
}
