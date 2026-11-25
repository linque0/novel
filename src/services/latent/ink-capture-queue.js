/**
 * 仅服务「原版融墨」懒加载模式的截图任务串行队列。
 * 默认「流雾粒子」模式不会加载本模块。
 */
export function createInkCaptureQueue(matches) {
  let current

  return async function capture(key, produce, { signal, timeoutMs, skipBusy = false }) {
    if (signal.aborted) return null
    let expired = false
    let release
    const deadline = new Promise(resolve => { release = () => { expired = true; resolve(null) } })
    const timer = setTimeout(release, timeoutMs)
    signal.addEventListener('abort', release, { once: true })

    const acquire = async () => {
      while (current && !matches(current.key, key)) {
        if (skipBusy) return null
        await current.job.catch(() => {})
        if (expired || signal.aborted) return null
      }
      if (expired || signal.aborted) return null
      if (!current) {
        const slot = { key }
        slot.job = Promise.resolve().then(produce).finally(() => {
          if (current === slot) current = null
        })
        current = slot
      }
      return current.job
    }

    try {
      return await Promise.race([acquire(), deadline])
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', release)
    }
  }
}
