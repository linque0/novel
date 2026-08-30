import { createApp } from 'vue'
import { createPinia } from 'pinia'
import naive from 'naive-ui'
import App from './App.vue'
import './styles/themes.css'

import { decodeText, splitTxtChapters, splitMarkdown, htmlToMd, parseMubuMd } from './services/importers'
import { countWords } from './services/wordcount'
import { db, uid, now } from './db/database'
import { useWorkStore } from './stores/work'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(naive)

// 供自动化测试 / 控制台调试使用的钩子
window.__ns = {
  decodeText,
  splitTxtChapters,
  splitMarkdown,
  htmlToMd,
  parseMubuMd,
  countWords,
  db,
  uid,
  now,
  getWork: () => useWorkStore(pinia)
}

app.mount('#app')
