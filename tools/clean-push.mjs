/* 干净提交：soft reset → 全部取消暂存 → 按固定 .gitignore 重新暂存 → 提交推送 */
import { spawnSync } from 'node:child_process'

const git = (args) => {
  const r = spawnSync('git', args, { encoding: 'utf8' })
  return { status: r.status, out: ((r.stdout || '') + (r.stderr || '')).slice(0, 300) }
}

console.log('soft reset:', git(['reset', '--soft', '9901561']).status)
console.log('unstage:', git(['reset']).status)
console.log('add:', git(['add', '.']).status)
const c = git(['commit', '-m', 'v0.3.2：书签系统（侧栏右键快捷栏 + 工具栏书签键 + 顶栏跳转下拉）'])
console.log('commit:', c.status, c.out.slice(0, 150))
const p = git(['push', 'origin', 'v0.2.1-overview'])
console.log('push:', p.status, ((p.stdout || '') + (p.stderr || '')).slice(0, 250))
