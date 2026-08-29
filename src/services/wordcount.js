export const countWords = (s = '') => s.replace(/\s/g, '').length

/** 去除 HTML 标签并解码常见实体，用于字数统计 / 检索 / 出场人物匹配 */
export const stripTags = (html = '') =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
