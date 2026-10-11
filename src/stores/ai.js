import { defineStore } from 'pinia'
import { db } from '../db/database'
import { chatStream, testConnection, AI_ERROR_CODES, AiProviderError } from '../services/ai/provider'
import { runCardTask, runChat } from '../services/ai/agent'

/**
 * stores/ai.js — AI 助手状态（方案 §二/§五/§六/§七）：
 * - 设置持久化到 db.appconfig（键前缀 ai.）：baseURL / model / temperature / maxContext / privacy。
 *   API 密钥明文只经 window.native.credentialEncrypt（safeStorage/DPAPI）加密后存 ai.credential，
 *   读取时 credentialDecrypt 即时解密、仅在本次调用内存中存在——明文绝不写入任何持久层，
 *   设置面板也不回显明文（只看 hasCredential「已配置」）。
 * - 任务状态机 phase：idle 空闲 | assembling 装配中 | generating 生成中 | ready 待应用 | failed 失败。
 *   四大能力动作产出「提案卡片」（branch / plan / diff 三类）挂在 result.cards，
 *   由卡片组件在用户确认后经 store/work.js 现有动作写入——本 store 自身绝不落库任何作品数据。
 * - 自由问答（send）：独立于状态机的会话流（chat 数组 + chatBusy），写入意图时消息携带 writeHint。
 * - 用量统计 usage：session（本会话）+ total（累计，持久化 appconfig ai.usage），全部调用（主调用、
 *   摘要生成、问答工具轮次、连接测试）统一计入。
 */

const emptyUsage = () => ({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, calls: 0 })

const APPCFG = {
  baseURL: 'ai.baseURL',
  model: 'ai.model',
  temperature: 'ai.temperature',
  maxContext: 'ai.maxContext',
  privacy: 'ai.privacy',
  credential: 'ai.credential',
  usage: 'ai.usage'
}

const clampTemperature = (v) => Math.min(2, Math.max(0, Number.isFinite(Number(v)) ? Number(v) : 0.7))
const clampMaxContext = (v) => Math.min(64000, Math.max(1000, Number.isFinite(Number(v)) ? Math.round(Number(v)) : 8000))

/** AbortController 为非序列化运行时对象，不进 Pinia state（模块级保存） */
let taskAbort = null
let chatAbort = null

export const useAiStore = defineStore('ai', {
  state: () => ({
    loaded: false,
    /* ---------- 设置（appconfig ai.* 持久化） ---------- */
    baseURL: '',
    model: '',
    temperature: 0.7,
    maxContext: 8000,
    privacy: false,
    credential: '', // safeStorage 密文（base64）；明文只存在于调用瞬时内存
    hasCredential: false, // 设置面板「已配置」标识（不回显明文）
    /* ---------- 任务状态机：idle | assembling | generating | ready | failed ---------- */
    phase: 'idle',
    task: null, // 当前/最近任务类型 plot|outline|lore|character
    anchorId: null,
    result: null, // { task, anchorId, anchor, cards, text, degraded, parseError, context, createdAt }
    streamText: '', // 生成中的流式增量预览（成功后被卡片替代，仅透出给界面）
    retryNotice: '', // 解析失败回喂重试时的提示
    error: null, // { code, message }（能力任务与问答共用的统一提示条）
    /* ---------- 自由问答 ---------- */
    chat: [], // [{ role:'user'|'assistant', content, streaming?, degraded?, writeHint?, writeTask?, error?, ts }]
    chatBusy: false,
    /* ---------- 用量（响应 usage 累计：本会话 + 累计，方案 §六.5） ---------- */
    usage: { session: emptyUsage(), total: emptyUsage() }
  }),

  getters: {
    /** 未配置 baseURL / model / 密钥任一项时为 false——全部 AI 入口据此置灰（方案 §三） */
    ready: (s) => !!(s.baseURL.trim() && s.model.trim() && s.hasCredential),
    busy: (s) => s.phase === 'assembling' || s.phase === 'generating' || s.chatBusy
  },

  actions: {
    /* ---------- 设置装载 / 保存 ---------- */
    async loadSettings() {
      try {
        const rows = await db.appconfig.where('key').startsWith('ai.').toArray()
        const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
        if (map[APPCFG.baseURL]) this.baseURL = String(map[APPCFG.baseURL])
        if (map[APPCFG.model]) this.model = String(map[APPCFG.model])
        if (map[APPCFG.temperature] != null) this.temperature = clampTemperature(map[APPCFG.temperature])
        if (map[APPCFG.maxContext] != null) this.maxContext = clampMaxContext(map[APPCFG.maxContext])
        if (map[APPCFG.privacy] != null) this.privacy = !!map[APPCFG.privacy]
        if (map[APPCFG.credential]) {
          this.credential = String(map[APPCFG.credential])
          this.hasCredential = true
        }
        if (map[APPCFG.usage] && typeof map[APPCFG.usage] === 'object') {
          this.usage.total = { ...emptyUsage(), ...map[APPCFG.usage] }
        }
      } catch {
        /* 首次启动无配置，保持默认 */
      }
      this.loaded = true
    },

    /**
     * 保存设置（仅传入的键生效）。apiKey 为明文入参：经 safeStorage 加密后落 ai.credential，
     * 传空串清除；本函数自身不持有明文状态、不把明文写进任何持久层。
     */
    async saveSettings(patch = {}) {
      if ('baseURL' in patch) {
        this.baseURL = String(patch.baseURL || '').trim()
        await db.appconfig.put({ key: APPCFG.baseURL, value: this.baseURL })
      }
      if ('model' in patch) {
        this.model = String(patch.model || '').trim()
        await db.appconfig.put({ key: APPCFG.model, value: this.model })
      }
      if ('temperature' in patch) {
        this.temperature = clampTemperature(patch.temperature)
        await db.appconfig.put({ key: APPCFG.temperature, value: this.temperature })
      }
      if ('maxContext' in patch) {
        this.maxContext = clampMaxContext(patch.maxContext)
        await db.appconfig.put({ key: APPCFG.maxContext, value: this.maxContext })
      }
      if ('privacy' in patch) {
        this.privacy = !!patch.privacy
        await db.appconfig.put({ key: APPCFG.privacy, value: this.privacy })
      }
      if ('apiKey' in patch) {
        const plain = String(patch.apiKey || '')
        if (!plain) {
          this.credential = ''
          this.hasCredential = false
          await db.appconfig.delete(APPCFG.credential)
        } else {
          const cipher = await window.native?.credentialEncrypt?.(plain)
          if (!cipher) throw new Error('本机凭据加密不可用（safeStorage），无法保存 API 密钥')
          this.credential = cipher
          this.hasCredential = true
          await db.appconfig.put({ key: APPCFG.credential, value: cipher })
        }
      }
    },

    /** 密钥即时解密（仅本次调用内存使用；密文无效/解密失败 → 提示重新配置） */
    async decryptCredential() {
      if (!this.credential) return ''
      const plain = await window.native?.credentialDecrypt?.(this.credential)
      if (typeof plain !== 'string') throw new Error('API 密钥解密失败（密文无效或系统凭据已变化），请到设置中重新保存密钥')
      return plain
    },

    /** 组装 provider 调用参数（agent.js/provider.js 消费形态）；未配置或网页版在此拦截 */
    async buildOpts() {
      if (!window.native?.credentialDecrypt) {
        throw new AiProviderError(AI_ERROR_CODES.NOT_CONFIGURED, 'AI 助手仅桌面版可用（网页版无凭据加密通道）')
      }
      if (!this.baseURL.trim() || !this.model.trim()) {
        throw new AiProviderError(AI_ERROR_CODES.NOT_CONFIGURED, 'AI 未配置：请先在设置中填写 API 地址与模型')
      }
      const apiKey = await this.decryptCredential()
      if (!apiKey) {
        throw new AiProviderError(AI_ERROR_CODES.NOT_CONFIGURED, 'AI 未配置：请先在设置中保存 API 密钥')
      }
      return { baseURL: this.baseURL.trim(), apiKey, model: this.model.trim(), temperature: this.temperature }
    },

    /* ---------- 用量统计（session + total，total 持久化） ---------- */
    addUsage(u) {
      if (!u) return
      const add = (t) => {
        t.prompt_tokens += Number(u?.prompt_tokens) || 0
        t.completion_tokens += Number(u?.completion_tokens) || 0
        t.total_tokens += Number(u?.total_tokens) || 0
        t.calls++
      }
      add(this.usage.session)
      add(this.usage.total)
      db.appconfig.put({ key: APPCFG.usage, value: JSON.parse(JSON.stringify(this.usage.total)) }).catch(() => {})
    },

    /* ---------- 错误归一 ---------- */
    errorFrom(err) {
      if (err instanceof AiProviderError) return { code: err.code, message: err.message }
      if (err?.name === 'AbortError') return { code: 'aborted', message: '已取消' }
      return { code: 'api', message: String(err?.message || err) }
    },

    /* ---------- 四大能力（正文发展 / 大纲规划 / 设定扩展 / 人物丰富） ---------- */

    /** 通用任务执行：装配 → 流式生成 → 卡片（提案，不落库）。失败置 phase=failed 并返回 null */
    async runTask(task, anchorId, instruction = '') {
      if (this.phase === 'assembling' || this.phase === 'generating') return null // 防重入
      this.phase = 'assembling'
      this.task = task
      this.anchorId = anchorId
      this.result = null
      this.streamText = ''
      this.retryNotice = ''
      this.error = null
      let opts
      try {
        opts = await this.buildOpts()
      } catch (e) {
        this.error = this.errorFrom(e)
        this.phase = 'failed'
        return null
      }
      const ctl = new AbortController()
      taskAbort = ctl
      try {
        const r = await runCardTask({
          task,
          anchorId,
          instruction,
          budget: this.maxContext,
          privacy: this.privacy,
          opts: { ...opts, signal: ctl.signal },
          onPhase: (p, info) => {
            if (p === 'generating') this.phase = 'generating'
            if (p === 'retry') {
              this.streamText = ''
              this.retryNotice = info?.parseError ? `输出解析失败，已回喂错误自动重试（${info.parseError}）` : '输出解析失败，已自动重试'
            }
          },
          onDelta: (d) => {
            this.streamText += d
          },
          onUsage: (u) => this.addUsage(u)
        })
        this.result = {
          task,
          anchorId,
          anchor: r.anchor,
          cards: r.cards, // branch / plan / diff 三类卡片提案
          text: r.text, // 解析失败降级时的纯文本
          degraded: r.degraded,
          parseError: r.parseError,
          context: r.context, // { report 发送范围报告, dropped 裁剪项, tokens, privacy }
          createdAt: Date.now()
        }
        this.phase = 'ready'
        return r
      } catch (err) {
        if (taskAbort !== ctl) return null // 已被 cancel() 取代：不回写状态，避免覆盖新任务的 phase
        if (ctl.signal.aborted || err?.name === 'AbortError') {
          this.streamText = ''
          this.phase = 'idle'
        } else {
          this.error = this.errorFrom(err)
          this.phase = 'failed'
        }
        return null
      } finally {
        if (taskAbort === ctl) taskAbort = null
      }
    },

    /** 正文发展：在章节锚点给出 2–4 条剧情线路（branch 卡） */
    startPlotBranch(chapterId, instruction = '') {
      return this.runTask('plot', chapterId, instruction)
    },

    /** 大纲规划：对大纲节点给出 2–3 套分支方案树（plan 卡） */
    startOutlinePlan(nodeId, instruction = '') {
      return this.runTask('outline', nodeId, instruction)
    },

    /** 设定扩展：对幕布节点给出新增子树草案或扩写草案（diff 卡） */
    startLoreExpand(nodeId, instruction = '') {
      return this.runTask('lore', nodeId, instruction)
    },

    /** 人物丰富：字段补全 / 小传扩写 / 别名 / 关系建议（diff 卡） */
    startCharacterEnrich(characterId, instruction = '') {
      return this.runTask('character', characterId, instruction)
    },

    /** 放弃当前提案（不写入任何数据） */
    resetResult() {
      if (this.phase === 'assembling' || this.phase === 'generating') this.cancel()
      this.result = null
      this.phase = 'idle'
      this.retryNotice = ''
    },

    /** 中断进行中的任务/问答（流式调用即时中止；装配阶段的摘要调用同样走 signal 可中止） */
    cancel() {
      taskAbort?.abort()
      chatAbort?.abort()
      taskAbort = null
      chatAbort = null
      if (this.phase === 'assembling' || this.phase === 'generating') this.phase = 'idle'
      this.streamText = ''
      this.chatBusy = false
    },

    /* ---------- 自由问答（独立会话流，带只读工具循环） ---------- */

    /** 带入模型的历史（已完成的消息，取最近若干条） */
    historyForModel() {
      return this.chat.filter((m) => !m.streaming && m.content).map((m) => ({ role: m.role, content: m.content }))
    },

    async send(question) {
      const q = String(question || '').trim()
      if (!q || this.chatBusy) return false
      this.error = null
      let opts
      try {
        opts = await this.buildOpts()
      } catch (e) {
        this.error = this.errorFrom(e)
        return false
      }
      const history = this.historyForModel() // 先取历史再入列，避免把当前这条问题重复带入
      this.chat.push({ role: 'user', content: q, ts: Date.now() })
      const msg = { role: 'assistant', content: '', streaming: true, degraded: false, writeHint: '', writeTask: null, error: null, ts: Date.now() }
      this.chat.push(msg)
      this.chatBusy = true
      const ctl = new AbortController()
      chatAbort = ctl
      try {
        const r = await runChat({
          question: q,
          history,
          budget: this.maxContext,
          privacy: this.privacy,
          opts: { ...opts, signal: ctl.signal },
          onDelta: (d) => {
            msg.content += d // 工具轮次的中间 JSON 也会流过，最终被下面的干净回答替换
          },
          onUsage: (u) => this.addUsage(u)
        })
        msg.content = r.answer
        msg.degraded = r.degraded
        msg.writeHint = r.writeHint
        msg.writeTask = r.writeTask
      } catch (err) {
        if (chatAbort === ctl) {
          if (ctl.signal.aborted || err?.name === 'AbortError') {
            msg.content = msg.content || '（已取消）'
            msg.aborted = true
          } else {
            this.error = this.errorFrom(err)
            msg.error = this.errorFrom(err)
          }
        }
      } finally {
        msg.streaming = false
        this.chatBusy = false
        if (chatAbort === ctl) chatAbort = null
      }
      return true
    },

    clearChat() {
      if (this.chatBusy) this.cancel()
      this.chat = []
    },

    /* ---------- 连接测试（设置区按钮，方案 §三；验收走 tools/mock-ai.mjs） ---------- */
    async testConnection() {
      let opts
      try {
        opts = await this.buildOpts()
      } catch (e) {
        return { ok: false, error: this.errorFrom(e) }
      }
      try {
        const r = await testConnection({ ...opts, timeout: 15000 })
        this.addUsage(r.usage)
        return { ok: true, reply: r.reply, model: r.model }
      } catch (err) {
        return { ok: false, error: this.errorFrom(err) }
      }
    }
  }
})
