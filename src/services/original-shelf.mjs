export function groupBooks(works) {
  const groups = [{ title: '正在连载', books: [] }, { title: '已经写完', books: [] }, { title: '构思与暂存', books: [] }]
  for (const work of works) groups[work.status === '连载' ? 0 : work.status === '完结' ? 1 : 2].books.push(work)
  return groups
}
export function bookDimensions(work) {
  const words = Math.max(0, Number(work.totalWords) || 0)
  const hash = [...String(work.id)].reduce((a,c)=>(a * 31 + c.charCodeAt(0)) >>> 0, 0)
  return { thickness: Math.round(22 + 32 * Math.min(1, Math.log1p(words) / Math.log1p(1000000))), height: 158 + hash % 13, tilt: ((hash % 5) - 2) * .35 }
}
