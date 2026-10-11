/* 数据存储位置迁移验收：npm run dev（开发调试版）运行中执行 node tools/dataDir-verify.mjs。
 * 流程：非法目标拒绝校验（不重启）→ 迁移到 %TEMP% 临时目录 → 应用自动退出 → 脚本重启 →
 * 断言位置=自定义 + 书架数据完整 + novel-studio 库在新位置打开 → 恢复默认 → 重启 → 复断。
 *
 * dev 特性（须由脚本兜底）：迁移完成 app.relaunch 后，concurrently 已随旧 electron 退出而
 * 杀掉 vite，relaunch 出的实例加载不到页面成为僵尸且占用 9222 —— 脚本以「指针文件出现/消失」
 * 为迁移完成信号（主进程写指针在 relaunch 之前），killAll 清理僵尸后整套重新 npm run dev。
 * killAll 与 tools/stop.mjs 同口径（electron.exe + vite/electron-cli 包装进程），会结束本机
 * 全部 electron 实例，运行前请关闭其他 electron 应用。 */
import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connect } from './_cdp-lib.mjs'
import { VERIFY_BOOKS } from './verify-seeds.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
/* 本脚本面向开发调试版（--profile=dev）：默认 userData 与指针文件位置 */
const DEV_USERDATA = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), '小说工坊-dev')
const POINTER = path.join(DEV_USERDATA, 'data-dir.json')

let fails = 0
const ok = (cond, label) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + label)
  if (!cond) fails++
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sameP = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()

function runPS(script) {
  const b64 = Buffer.from(script, 'utf16le').toString('base64')
  return execSync(`powershell -NoProfile -EncodedCommand ${b64}`, { encoding: 'utf8' })
}

/* 清理 electron 实例与 vite / electron-cli 包装进程（同 stop.mjs 口径） */
async function killAll() {
  const MATCH = `($_.Name -eq 'electron.exe') -or ($_.Name -like '*小说工坊*') -or ($_.Name -eq 'node.exe' -and (($_.CommandLine -like '*vite*') -or ($_.CommandLine -like '*electron*cli.js*')))`
  try {
    runPS(`Get-CimInstance Win32_Process | Where-Object { ${MATCH} } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`)
  } catch {}
  await sleep(1000)
}

function startDev() {
  spawn('cmd.exe', ['/d', '/s', '/c', 'npm run dev'], { cwd: REPO, detached: true, stdio: 'ignore' }).unref()
}

/* 等待 CDP 可达且渲染层 native 桥就绪（重启后的新实例） */
async function waitCdp(ms = 90000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    try {
      const list = await (await fetch('http://127.0.0.1:9222/json/list')).json()
      if (list.some((x) => x.type === 'page' && !x.url.includes('panel='))) {
        const c = await connect()
        const t1 = Date.now()
        while (Date.now() - t1 < 20000) {
          if ((await c.evalx('!!window.native')) === true) {
            await c.sleep(2500) // boot：openDb → startAutosave → loadPrefs → refresh
            return c
          }
          await c.sleep(300)
        }
        throw new Error('页面已连接但 window.native 不可用')
      }
    } catch {}
    await sleep(600)
  }
  throw new Error('等待应用启动超时（CDP 9222 不可达）——请手动 npm run dev 后重跑')
}

async function waitPointer(appears, ms = 30000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if (fs.existsSync(POINTER) === appears) return true
    await sleep(400)
  }
  return false
}

async function shelfTitles(c) {
  await c.evalx(`[...document.querySelectorAll('.topbar button')].find(b => b.textContent.includes('书架'))?.click()`)
  for (let i = 0; i < 25; i++) {
    const n = await c.evalx(`document.querySelectorAll('.book-card').length`)
    if (n > 0) break
    await c.sleep(400)
  }
  await c.sleep(600)
  return await c.evalx(`[...document.querySelectorAll('.book-card')].map(x => (x.querySelector('.book-title')?.textContent || x.textContent).trim())`)
}
const shelfKey = (titles) => [...(titles || [])].sort().join('\u0001')

/* 打开一本验证书进工作台再返回（数据可读的 UI 级冒烟） */
async function openWorkAndBack(c, title) {
  const clicked = await c.evalx(`(() => {
    const card = [...document.querySelectorAll('.book-card')].find(x => (x.querySelector('.book-title')?.textContent || '').trim() === ${JSON.stringify(title)})
    if (!card) return false
    card.click()
    return true
  })()`)
  await c.sleep(1500)
  const leftShelf = await c.evalx(`!document.querySelector('.book-card')`)
  await shelfTitles(c)
  return clicked === true && leftShelf === true
}

try {
  /* 清理上次运行残留的临时迁移目录 */
  for (const d of fs.readdirSync(os.tmpdir())) {
    if (d.startsWith('ns-dd-verify-')) {
      try {
        fs.rmSync(path.join(os.tmpdir(), d), { recursive: true, force: true })
      } catch {}
    }
  }

  /* ---------- 阶段 0：连接与前置状态（不在默认位置则先恢复默认并重启） ---------- */
  console.log('— 阶段 0：连接与前置 —')
  let c
  try {
    c = await connect()
  } catch {
    console.error('FAIL 无法连接 CDP 9222：请先 npm run dev（开发调试版）再运行本脚本')
    process.exit(1)
  }
  let loc = await c.evalx('window.native?.getDataLocation?.()')
  ok(!!loc, 'IPC data:location 可用（window.native.getDataLocation）')
  if (loc?.isCustom || loc?.fallback) {
    console.log('当前不在默认存储位置，先恢复默认…')
    const r = await c.evalx('window.native.moveDataDir("")')
    if (!r?.ok) throw new Error('恢复默认失败：' + (r?.error || '未知'))
    if (!(await waitPointer(false))) throw new Error('恢复默认超时（指针未删除）')
    await sleep(2000)
    await killAll()
    startDev()
    c = await waitCdp()
    loc = await c.evalx('window.native.getDataLocation()')
    ok(!loc?.isCustom && !loc?.fallback, '恢复默认后回到默认位置')
  }

  /* ---------- 阶段 1：非法目标拒绝（不重启，应用存活） ---------- */
  console.log('— 阶段 1：非法目标校验 —')
  const r1 = await c.evalx(`window.native.moveDataDir("relative\\\\dir")`)
  ok(r1?.ok === false, '相对路径被拒绝（' + (r1?.error || '') + '）')
  const r2 = await c.evalx(`window.native.moveDataDir(${JSON.stringify(DEV_USERDATA)})`)
  ok(r2?.ok === false, '数据目录自身（嵌套）被拒绝（' + (r2?.error || '') + '）')
  const tmpBad = path.join(os.tmpdir(), 'ns-dd-verify-bad')
  fs.mkdirSync(path.join(tmpBad, '小说工坊', 'IndexedDB'), { recursive: true })
  const r3 = await c.evalx(`window.native.moveDataDir(${JSON.stringify(tmpBad)})`)
  ok(r3?.ok === false, '已含小说工坊数据的目标被拒绝（' + (r3?.error || '') + '）')
  ok((await c.evalx('1+1')) === 2, '拒绝路径不触发重启，应用存活')

  /* ---------- 阶段 2：迁移到临时目录 ---------- */
  console.log('— 阶段 2：迁移到自定义目录 —')
  const pre = await shelfTitles(c)
  ok((pre || []).length >= VERIFY_BOOKS.length, '迁移前书架含全部注册验证书（' + (pre || []).length + ' 本）')
  const tmpCustom = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-dd-verify-'))
  const landing = path.join(tmpCustom, '小说工坊')
  const rm = await c.evalx(`window.native.moveDataDir(${JSON.stringify(tmpCustom)})`)
  ok(rm?.ok === true, '迁移请求被接受（应用将自动保存并重启）')
  if (!(await waitPointer(true))) throw new Error('迁移超时：指针文件未生成')
  const ptr = JSON.parse(fs.readFileSync(POINTER, 'utf-8'))
  ok(sameP(ptr.dir || '', landing), '指针文件指向 ' + landing)
  ok(fs.existsSync(path.join(landing, 'IndexedDB')), 'IndexedDB 已复制到新位置')
  ok(fs.existsSync(DEV_USERDATA), '原位置数据保留作备份')
  await sleep(2500) // 等 relaunch 僵尸实例完全起来
  await killAll()
  startDev()
  c = await waitCdp()

  loc = await c.evalx('window.native.getDataLocation()')
  ok(loc?.isCustom === true, '重启后位置=自定义')
  ok(sameP(loc?.current || '', landing), '数据目录落在所选位置内')
  ok(loc?.fallback === false, '无回退告警')
  const dbs = await c.evalx(`indexedDB.databases().then(l => l.map(d => d.name + ':' + d.version).join(','))`)
  ok(/novel-studio:\d+/.test(dbs || ''), 'novel-studio 库在新位置打开（' + (dbs || '') + '）')
  const post = await shelfTitles(c)
  ok(shelfKey(post) === shelfKey(pre), '书架作品迁移前后一致（' + (post || []).length + ' 本）')
  ok(await openWorkAndBack(c, VERIFY_BOOKS[0].title), '打开验证书《' + VERIFY_BOOKS[0].title + '》进工作台并返回')

  /* ---------- 阶段 3：恢复默认 ---------- */
  console.log('— 阶段 3：恢复默认位置 —')
  const rr = await c.evalx(`window.native.moveDataDir("")`)
  ok(rr?.ok === true, '恢复默认请求被接受')
  if (!(await waitPointer(false))) throw new Error('恢复默认超时：指针未删除')
  ok(!fs.existsSync(POINTER), '指针文件已删除')
  ok(fs.existsSync(path.join(landing, 'IndexedDB')), '自定义目录数据保留（此后可自行清理）')
  await sleep(2500)
  await killAll()
  startDev()
  c = await waitCdp()

  loc = await c.evalx('window.native.getDataLocation()')
  ok(loc?.isCustom === false && loc?.fallback === false, '重启后位置=默认（' + (loc?.current || '') + '）')
  const post2 = await shelfTitles(c)
  ok(shelfKey(post2) === shelfKey(pre), '恢复默认后书架数据一致（' + (post2 || []).length + ' 本）')

  fs.rmSync(tmpCustom, { recursive: true, force: true })
  fs.rmSync(tmpBad, { recursive: true, force: true })
} catch (e) {
  console.error('FAIL 异常中断：' + (e?.message || e))
  fails++
}
console.log(fails === 0 ? '\n数据存储位置迁移验收全部通过 ✓' : `\n${fails} 项未通过`)
process.exit(fails === 0 ? 0 : 1)
