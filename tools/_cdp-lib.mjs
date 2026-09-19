/* CDP helper: 连接调试端口的应用页面，提供 evalx / send / sleep；端口可用 CDP_PORT 环境变量覆盖（默认 9222） */
export async function connect(match = 'app://', port = process.env.CDP_PORT || '9222') {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const t = list.find((x) => x.type === 'page' && x.url.includes(match)) || list.find((x) => x.type === 'page')
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)))
  let id = 0
  const pending = new Map()
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const { res } = pending.get(m.id)
      pending.delete(m.id)
      res(m.result)
    }
  }
  const send = (method, params = {}) => {
    const i = ++id
    ws.send(JSON.stringify({ id: i, method, params }))
    return new Promise((r) => pending.set(i, { res: r }))
  }
  // 环境预警：窗口最小化 / 被完全遮挡时 Chromium 节流定时器（260ms 实测可到 ~1s）并停止产帧，
  // 时序类断言会假失败、Page.captureScreenshot 会挂起（见 开发流程.md 5.3）——先恢复窗口再跑。
  try {
    const probe = await send('Runtime.evaluate', { expression: 'document.visibilityState', returnByValue: true })
    if (probe?.result?.value === 'hidden') {
      console.warn('[cdp] 警告：页面处于隐藏态（窗口最小化/被遮挡）——定时器被节流、截图会挂起，验收结果可能失真。请先恢复窗口可见再跑。')
    }
  } catch (e) {
    /* 探测失败不阻塞连接 */
  }
  return {
    send,
    evalx: async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      if (r?.exceptionDetails) return { PAGE_ERR: (r.exceptionDetails.exception?.description || r.exceptionDetails.text).slice(0, 500) }
      return r?.result?.value
    },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms))
  }
}
