/* 琉光书封的布面配色与版式判断。worker 与主线程共用，不依赖 DOM。 */
export const GLAZE_CLOTH = Object.freeze({
  novel: { board: '#223f86', title: '#f2e4c2', rule: '#caa76a', author: '#e9d7b0', seal: '#b84a38' },
  note: { board: '#e9e1ce', title: '#3c3428', rule: '#a9864e', author: '#5c4c38', seal: '#b84a38' },
  cedar: { board: '#3a5848', title: '#efe2c4', rule: '#c5a46b', author: '#e5d6b5', seal: '#b84a38' },
  violet: { board: '#554b6c', title: '#f0e3ca', rule: '#c8a86f', author: '#e7d8ba', seal: '#b84a38' },
  claret: { board: '#663a44', title: '#f2e3c9', rule: '#d0ad73', author: '#ead8b7', seal: '#c05a44' },
  ink: { board: '#252d30', title: '#eadfc6', rule: '#b99b63', author: '#dfd0ae', seal: '#b84a38' }
})

export function clothOf(kind) {
  return GLAZE_CLOTH[kind] || GLAZE_CLOTH.novel
}

/* 短中文书名竖排；含拉丁字母或过长时横排，避免 3D 书脊视角下挤成一团。 */
export function isVerticalTitle(title) {
  const text = String(title || '').trim()
  return !!text && [...text].length <= 7 && !/[A-Za-z0-9]/.test(text)
}

export function sealChar(book) {
  const source = String(book?.author || '').trim() || String(book?.title || '').trim()
  return source ? [...source][0] : '文'
}
