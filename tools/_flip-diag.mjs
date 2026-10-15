/* 临时诊断：书架翻动 —— 位次读数 + 过渡是否真的在推进（在页面内 16ms 采样，避免 CDP 往返误差） */
import { connect } from './_cdp-lib.mjs'

const c = await connect('http://127.0.0.1:5173', '9223')
const ev = async (e) => {
  const r = await c.evalx(e)
  if (r?.PAGE_ERR) throw new Error(r.PAGE_ERR)
  return r
}
await c.sleep(800)

const dump = `[...document.querySelectorAll('.gravity-slot')].map((s) => {
  const pose = s.querySelector('.gravity-pose')
  const t = getComputedStyle(s).transform
  const m = t.match(/matrix\\(([^)]+)\\)/)
  const br = s.querySelector('.gravity-book').getBoundingClientRect()
  return {
    pose: [...s.classList].find((x) => x.startsWith('gravity-slot--')).replace('gravity-slot--', ''),
    title: (s.querySelector('.gravity-cover-title')?.textContent || '').trim(),
    tx: m ? Number(m[1].split(',')[4]).toFixed(1) : t.slice(0, 24),
    op: getComputedStyle(pose).opacity,
    poseKind: getComputedStyle(pose).transform.slice(0, 9),
    book: Math.round(br.width) + 'x' + Math.round(br.height),
    stageW: Math.round(s.parentElement.getBoundingClientRect().width)
  }
})`

console.log('--- 当前位次 ---')
for (const s of await ev(dump)) console.log(`  ${s.pose.padEnd(15)} tx=${String(s.tx).padStart(8)} op=${s.op} pose=${s.poseKind} book=${s.book}  《${s.title}》  (stage ${s.stageW})`)

const target = await ev(`(() => {
  window.__flip = [...document.querySelectorAll('.gravity-slot')].find((s) => s.classList.contains('gravity-slot--left'))
  const r = window.__flip.querySelector('.gravity-book-open').getBoundingClientRect()
  window.__at = { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
  return window.__flip.querySelector('.gravity-cover-title').textContent.trim()
})()`)
console.log('--- 点它翻到中央：《' + target + '》 ---')

await ev(`(() => {
  window.__s = []
  const el = window.__flip
  const pose = el.querySelector('.gravity-pose')
  window.__t0 = performance.now()
  const id = setInterval(() => {
    const m = getComputedStyle(el).transform.match(/matrix\\(([^)]+)\\)/)
    const anims = document.getAnimations().filter((a) => a.effect?.target === el || a.effect?.target === pose)
      .map((a) => (a.transitionProperty || a.animationName) + '@' + Math.round(a.currentTime || 0) + '/' + (a.effect?.getTiming().duration ?? ''))
    window.__s.push(
      Math.round(performance.now() - window.__t0) + 'ms  tx=' + (m ? Number(m[1].split(',')[4]).toFixed(1) : '?') +
      '  op=' + Number(getComputedStyle(pose).opacity).toFixed(2) +
      '  rectLeft=' + Math.round(el.getBoundingClientRect().left) +
      '  anims=[' + anims.join(', ') + ']'
    )
  }, 16)
  setTimeout(() => clearInterval(id), 900)
  return true
})()`)

const at = await ev('window.__at')
await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y })
await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x, y: at.y, button: 'left', clickCount: 1 })
await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', clickCount: 1 })
await c.sleep(1400)

for (const line of (await ev('window.__s')).filter((_, i) => i % 5 === 0)) console.log('  ' + line)
console.log('--- 落位后 ---')
for (const s of await ev(dump)) console.log(`  ${s.pose.padEnd(15)} tx=${String(s.tx).padStart(8)} op=${s.op}  《${s.title}》`)
process.exit(0)
