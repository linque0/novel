import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { _electron } = require(require.resolve('playwright', { paths: [join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node')] }))
const mode = process.argv.includes('--production') ? 'production' : 'dev'
const glazeIntegration = process.argv.includes('--glaze-integration')
const profile = 'book-worker-' + mode + '-' + Date.now().toString(36)
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.NOVEL_STUDIO_DEV
const args = ['.', '--profile=' + profile, '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--remote-debugging-port=9223']
if (mode === 'dev') args.push('--dev')
const app = await _electron.launch({ executablePath: require('electron'), args, env, cwd: process.cwd(), timeout: 30000 })
try {
  const page = await app.firstWindow(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if(message.type()==='error') console.error('RENDERER:',message.text()) })
  await page.waitForFunction(() => window.__ns && document.querySelector('#app').__vue_app__?.config.globalProperties.$pinia._s.has('shelf'))
  await page.waitForLoadState('networkidle')
  if(mode==='dev') await page.waitForFunction(()=>{const shelf=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('shelf');return shelf.works.length>0&&!shelf.loading})
  const location = await page.evaluate(() => window.native.getDataLocation())
  assert.ok(location.defaultDir.endsWith('小说工坊-' + profile))
  assert.equal(location.current, location.defaultDir)
  await page.evaluate(async () => {
    const stores = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s
    window.__bookElectron = { ui: stores.get('ui'), shelf: stores.get('shelf') }
    __bookElectron.shelf.works = ['novel','note','cedar','violet','claret','ink'].map((kind,i) => ({id:'virtual-electron-'+i,kind,title:'星尘旅人'+i,author:'林间',intro:'临时虚拟书架',genre:'奇幻',status:'连载'}))
    // This phase supplies virtual view data, never test books in production DB.
    // A late boot refresh must not replace it with the empty fresh profile.
    const fixtures=__bookElectron.shelf.works
    __bookElectron.unpin=__bookElectron.shelf.$subscribe((_mutation,state)=>{
      if(state.works.length!==fixtures.length||state.works.some((book,i)=>book.id!==fixtures[i].id))__bookElectron.shelf.works=fixtures
    },{flush:'sync'})
    __bookElectron.shelf.loading = false
    await __bookElectron.ui.setSkin('gravity')
  })
  for (const skin of ['gravity','glaze','crimson']) {
    await page.evaluate(skin => __bookElectron.ui.setSkin(skin), skin)
    await page.waitForSelector('.'+skin+'-shelf')
    await page.evaluate(async()=>{
      window.__bookVisibility?.disconnect()
      const elements=[...document.querySelectorAll('.theme-book,.crimson-book-thumbnail')]
      if(!elements.length)return
      await new Promise(resolve=>{
        __bookVisibility=new IntersectionObserver(entries=>{for(const entry of entries)entry.target.dataset.testVisible=entry.isIntersecting?'1':'0';resolve()})
        elements.forEach(element=>__bookVisibility.observe(element))
      })
    })
    if(skin==='glaze') {
      await page.waitForFunction(()=>{const img=document.querySelector('.glaze-artwork-image');return img&&img.complete&&img.naturalWidth>0})
      assert.equal(await page.locator('.glaze-shelf .theme-book').count(),0,'museum uses complete paintings without WebGL book covers')
    } else { try {
      await page.waitForFunction(() => document.querySelectorAll('.theme-book,.crimson-book-thumbnail,.crimson-book-display').length>0 && [...document.querySelectorAll('.theme-book,.crimson-book-thumbnail')].filter(e=>e.dataset.testVisible==='1').every(e=>e.dataset.poster==='ready') && (!document.querySelector('.crimson-book-display') || document.querySelector('.crimson-book-display').dataset.state==='ready'), null, {timeout:30000})
    } catch(error) {
      console.error('STATE',await page.evaluate(()=>({hidden:document.hidden,skin:document.body.dataset.skin,viewer:document.querySelector('.crimson-book-display')?.dataset.state,posters:[...document.querySelectorAll('.theme-book,.crimson-book-thumbnail')].map(e=>e.dataset.poster),errors:performance.getEntriesByType('resource').filter(r=>/render.worker|woff2/.test(r.name)).map(r=>r.name)})))
      throw error
    }
    const count = await page.locator(skin === 'crimson' ? '.crimson-book-display[data-state="ready"]' : '.theme-book[data-poster="ready"]').count()
    assert.ok(count > 0, skin + ' worker renders under ' + mode)
    }
    await page.screenshot({ path: 'tools/_book-electron-' + mode + '-' + skin + '.png' })
    if(skin==='glaze'){
      await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>!window.isDestroyed()).webContents.setZoomFactor(2))
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'native 200% zoom does not overflow')
      await page.locator('.gg-actions').scrollIntoViewIfNeeded()
      assert.ok(await page.locator('.gg-actions .n-button--primary-type').isVisible(),'native 200% zoom keeps writing action accessible')
      await page.screenshot({path:'tools/_book-electron-'+mode+'-glaze-zoom-200.png'})
      console.log('PASS Electron '+mode+' actual 200% zoom: '+JSON.stringify(await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}))))
      await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>!window.isDestroyed()).webContents.setZoomFactor(1))
    }
    console.log('PASS Electron ' + mode + ' ' + skin + ': background renderer, bundled artwork and fonts')
  }
  assert.deepEqual(errors, [])
  if (mode === 'dev') {
    await page.evaluate(()=>__bookElectron.unpin()) // Native integration reloads and uses actual DB rows.
    const result = await new Promise(resolve => {
      const child = spawn(process.execPath, [glazeIntegration?'tools/glaze-shelf-verify.mjs':'tools/skin-verify.mjs'], { env: {...env, SKIN_PROFILE:profile,CDP_PORT:'9223'}, stdio:['ignore','pipe','pipe'] })
      let output = ''; child.stdout.on('data', b => { output += b }); child.stderr.on('data', b => { output += b })
      child.on('exit', code => resolve({ code, output }))
    })
    writeFileSync(glazeIntegration?'tools/_glaze-gallery-native-integration.log':'tools/_book-electron-skin-verify.log', result.output)
    assert.equal(result.code,0,result.output.slice(-2000))
    console.log('PASS isolated Electron skin verification including persistence failure and native settings synchronization')
  }
} finally { await app.close() }
