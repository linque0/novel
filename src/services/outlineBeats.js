/* 节拍式章纲文本约定（8.8-O3）：以文本行实现清单，不引入富文本
 * 约定：`- [ ] 文本` 未完成 / `- [x] 文本` 已完成（兼容 - * 前缀与大小写 X）
 * 同一约定复用于伏笔标记（8.8-O4）：清单行内含 [[双链]] 即为伏笔引用，勾选状态即"已回收 / 未回收"
 */
export const BEAT_RE = /^\s*[-*]\s+\[([ xX])\]\s*(.*)$/

/** 解析内容中的节拍行 → [{ index, done, text, line }] */
export function parseBeats(content) {
  const out = []
  String(content || '')
    .split('\n')
    .forEach((line, index) => {
      const m = line.match(BEAT_RE)
      if (m) out.push({ index, done: m[1].toLowerCase() === 'x', text: m[2] || '', line })
    })
  return out
}

/** 节拍进度：{ done, total } */
export function beatProgress(content) {
  const beats = parseBeats(content)
  return { done: beats.filter((b) => b.done).length, total: beats.length }
}

/** 翻转指定行序号的勾选状态，返回新文本（非清单行原样返回） */
export function toggleBeatLine(content, index) {
  const lines = String(content || '').split('\n')
  const line = lines[index]
  if (!line || !line.match(BEAT_RE)) return String(content || '')
  lines[index] = line.replace(/\[([ xX])\]/, (m, c) => (c.toLowerCase() === 'x' ? '[ ]' : '[x]'))
  return lines.join('\n')
}

/** 节拍模板（一行一拍：目标 / 冲突 / 转折 / 钩子） */
export const BEAT_TEMPLATE = ['- [ ] 目标：', '- [ ] 冲突：', '- [ ] 转折：', '- [ ] 钩子：'].join('\n')
