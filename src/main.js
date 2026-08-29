import { createApp } from 'vue'
import { createPinia } from 'pinia'
import naive from 'naive-ui'
import App from './App.vue'
import './styles/themes.css'

import { decodeText, splitTxtChapters, splitMarkdown, htmlToMd } from './services/importers'
import { countWords } from './services/wordcount'
import { db, uid, now } from './db/database'

// 供自动化测试 / 控制台调试使用的钩子
window.__ns = { decodeText, splitTxtChapters, splitMarkdown, htmlToMd, countWords, db, uid, now }

const app = createApp(App)
app.use(createPinia())
app.use(naive)
app.mount('#app')
