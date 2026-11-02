/* Isolated native regression: a settings window must never render the default
 * appearance before the persisted skin. Run with Vite on 5173, or --production
 * after npm run build. Only the generated test profile is modified. */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { _electron } = require(require.resolve('playwright', {
  paths: [join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node')]
}))
const production = process.argv.includes('--production')
const profile = 'settings-startup-' + Date.now().toString(36)
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
delete env.NOVEL_STUDIO_DEV
const app = await _electron.launch({
  executablePath: require('electron'),
  args: ['.', '--profile=' + profile, '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding', ...(production ? [] : ['--dev'])],
  env, cwd: process.cwd(), timeout: 30000
})
const errors = []
app.on('window', page => page.on('pageerror', error => errors.push(error.message)))

try {
  const main = await app.firstWindow()
  await main.waitForFunction(() => window.__ns && document.querySelector('.app-root'))
  await main.waitForLoadState('networkidle')
  const loc = await main.evaluate(() => window.native.getDataLocation())
  assert.ok(loc.defaultDir.endsWith('小说工坊-' + profile))
  assert.equal(loc.current, loc.defaultDir)

  // Install before the panel's first script: capture DOM commits as well as
  // painted frames, so even a brief original-skin intermediate is observable.
  await app.context().addInitScript(() => {
    if (!new URLSearchParams(location.search).has('panel')) return
    if (new URLSearchParams(location.search).get('panel') === 'settings:startup-failure:') {
      IDBFactory.prototype.open = () => { throw new DOMException('Test database unavailable', 'UnknownError') }
    }
    window.__settingsFrames = []
    const sample = () => {
      const root = document.querySelector('.sw-root')
      if (!root) return
      const skin = document.body.dataset.skin
      const previous = window.__settingsFrames.at(-1)
      if (previous?.skin === skin) return
      window.__settingsFrames.push({ skin, at: performance.now(),
        background: getComputedStyle(root).backgroundColor,
        crimson: root.classList.contains('is-crimson') })
    }
    new MutationObserver(sample).observe(document, { subtree: true, childList: true, attributes: true })
  })
  await app.evaluate(({ app: electronApp }) => {
    global.__settingsCreated = []
    electronApp.on('browser-window-created', (_event, win) => {
      const record = { id: win.id, visible: win.isVisible() }
      global.__settingsCreated.push(record)
      win.on('show', () => {
        win.webContents.executeJavaScript(`({ skin: document.body.dataset.skin, content: !!document.querySelector('.sw-root, .empty-shelf') })`)
          .then(state => { record.shown = state }).catch(() => {})
      })
    })
  })

  for (const skin of ['gravity', 'glaze', 'crimson', 'original', 'gravity']) {
    await main.evaluate(async skin => {
      const ui = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui')
      await ui.setSkin(skin)
      await ui.setPref('theme', skin === 'original' ? 'night' : 'xuan')
    }, skin)
    const opened = app.waitForEvent('window')
    const start = Date.now()
    await main.evaluate(() => window.native.panelOpen({ type: 'settings', workId: 'app' }))
    const pending = await main.evaluate(() => window.native.panelOpen({ type: 'settings', workId: 'app' }))
    assert.equal(pending.pending, true, 'rapid repeat click must not expose the loading window')
    const settings = await opened
    await settings.waitForSelector('.sw-root')
    await settings.waitForFunction(() => window.__settingsFrames?.length > 0)
    const frames = await settings.evaluate(() => window.__settingsFrames)
    assert.ok(frames.every(frame => frame.skin === skin), `${skin} first settings frame: ${JSON.stringify(frames)}`)
    assert.equal(frames[0].crimson, skin === 'crimson')
    const visibleAtCreation = await app.evaluate(() => global.__settingsCreated.at(-1).visible)
    assert.equal(visibleAtCreation, false, 'settings window stays hidden until the themed content is ready')
    await settings.waitForFunction(() => document.visibilityState === 'visible')
    const shown = await app.evaluate(() => global.__settingsCreated.at(-1).shown)
    assert.deepEqual(shown, { skin, content: true }, 'themed content exists when the native window shows')
    assert.equal(await settings.evaluate(() => document.body.classList.contains('theme-night')), skin === 'original')
    console.log(`PASS ${skin}: correct first frame, native window shown after preparation (${Date.now() - start} ms)`)

    const duplicate = await main.evaluate(() => window.native.panelOpen({ type: 'settings', workId: 'app' }))
    assert.equal(duplicate.focused, true, 'repeat click reuses the existing settings window')
    assert.equal(await settings.locator('.sw-nav-item').count(), 5)
    await settings.getByRole('button', { name: '模型设置', exact: false }).click()
    await settings.waitForSelector('.ai-settings')
    await settings.getByRole('button', { name: '外观', exact: false }).click()
    await settings.waitForSelector('.skin-picker')
    if (skin === 'crimson') await settings.screenshot({ path: 'tools/_settings-startup-crimson.png' })
    await settings.evaluate(async () => {
      const ui = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui')
      await ui.setPref('fontSize', 18)
      await ui.setSkin('glaze')
    })
    await main.waitForFunction(() => {
      const ui = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('ui')
      return ui.fontSize === 18 && ui.skin === 'glaze' && document.body.dataset.skin === 'glaze'
    })
    await settings.waitForFunction(() => document.body.dataset.skin === 'glaze')
    const closed = settings.waitForEvent('close')
    await settings.evaluate(() => window.native.panelCloseSelf())
    await closed
  }
  const failureOpened = app.waitForEvent('window')
  await main.evaluate(() => window.native.panelOpen({ type: 'settings', workId: 'startup-failure' }))
  const failed = await failureOpened
  await failed.getByRole('button', { name: '重试', exact: true }).waitFor({ timeout: 20000 })
  await failed.waitForFunction(() => document.visibilityState === 'visible')
  assert.equal(await failed.locator('.sw-root').count(), 0, 'database failure reveals a retry screen instead of uninitialized settings')
  await failed.screenshot({ path: 'tools/_settings-startup-db-error.png' })
  console.log('PASS database failure shows a visible retry screen')
  assert.deepEqual(errors, [], 'no renderer errors')
  console.log('PASS settings startup, reopen, navigation and isolated native lifecycle')
} finally {
  await app.close()
}
