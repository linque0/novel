import { defineStore } from "pinia";
import { db } from "../db/database";
import {
  chatStream,
  testConnection,
  listModels,
  AI_ERROR_CODES,
  AiProviderError,
} from "../services/ai/provider";
import { lookupModelMeta } from "../services/ai/modelmeta";
import { runDialogue, makeDraft } from "../services/ai/dialogue";
import {
  prepareDialogue,
  requestMainPreview,
} from "../services/ai/prepare-dialogue";
import { textViews } from "../services/ai/regex";
import { plainChat } from "../services/ai/chat-text";
import {
  captureCandidate,
  storeCandidate,
  switchCandidate,
} from "../services/ai/candidates";
import { freezeContext } from "../services/ai/novel-context";
import { copy, defaultPreset } from "../services/ai/presets";
import * as presetRepo from "../db/preset-repo";
import { useWorkStore } from "./work";
import { useUiStore } from "./ui";
import { uid } from "../db/database";
import {
  snapshotWork,
  checkAbort,
  plainChapter,
  chapterHash,
  entityHash,
} from "../services/ai/contracts";
import {
  knowledgeSnapshot,
  buildKnowledge,
  replayForeshadows,
} from "../services/ai/knowledge";
import { rebuildVectors } from "../services/ai/retrieval";
import * as aiRepo from "../db/ai-repo";
import { ensureProjection } from '../db/project-repo.js';

/** Preset-driven conversation and independent, fixed-prompt factual memory.
 * Secrets remain encrypted in appconfig. Generated proposals never write works here.
 * Each request freezes work/source/preset and commits macros once before dispatch.
 */

const emptyUsage = () => ({
  estimatedCalls: 0,
  prompt_tokens: 0,
  completion_tokens: 0,
  total_tokens: 0,
  calls: 0,
});

const sessions = new Map();
let kbAbort = null;
const emitSettings = () =>
  window.native?.appBroadcast?.({ kind: "ai-settings-changed" });
const APPCFG = {
  baseURL: "ai.baseURL",
  model: "ai.model",
  models: "ai.models",
  modelCfg: "ai.modelcfg",
  temperature: "ai.temperature",
  maxContext: "ai.maxContext",
  privacy: "ai.privacy",
  credential: "ai.credential",
  usage: "ai.usage",
  options: "ai.options",
};

const clampTemperature = (v) =>
  Math.min(2, Math.max(0, Number.isFinite(Number(v)) ? Number(v) : 0.7));
const clampMaxContext = (v) =>
  Math.min(
    64000,
    Math.max(1000, Number.isFinite(Number(v)) ? Math.round(Number(v)) : 10000),
  );

/** AbortController 为非序列化运行时对象，不进 Pinia state（模块级保存） */
let chatAbort = null;
let evaluationAbort = null;

export const useAiStore = defineStore("ai", {
  state: () => ({
    loaded: false,
    workId: null,
    runId: null,
    options: {
      kb: { auto: false, usageCap: 0 },
      embeddings: { enabled: false, model: "" },
    },
    kb: {
      sourceCoverage:null,
      cards: [],
      rows: [],
      hooks: [],
      metas: [],
      stale: 0,
      missing: 0,
      ready: 0,
      total: 0,
      progress: null,
      error: "",
      paused: false,
    },
    presets: [],
    selectedPresetId: "novel-default",
    pendingPrompt: "",
    pendingRefs: {},
    /* ---------- 设置（appconfig ai.* 持久化） ---------- */
    baseURL: "",
    model: "",
    models: [], // 已保存模型名列表（ai.models 持久化）；点选其一作为使用中的 model
    fetchingModels: false, // 拉取服务商模型列表中（设置区按钮 loading）
    modelCfg: {}, // 每模型专属参数 { [模型名]: { enabled, contextWindow, maxTokens, temperature, note } }（ai.modelcfg 持久化）
    temperature: 0.7,
    maxContext: 10000,
    privacy: false,
    credential: "", // safeStorage 密文（base64）；明文只存在于调用瞬时内存
    hasCredential: false, // 设置面板「已配置」标识（不回显明文）
    /* ---------- 对话：idle | assembling | generating ---------- */
    phase: "idle",
    error: null, // { code, message }（能力任务与问答共用的统一提示条）
    /* ---------- 自由问答 ---------- */
    chat: [], // [{ role:'user'|'assistant', content, streaming?, degraded?, writeHint?, writeTask?, error?, ts }]
    chatBusy: false,
    evaluation: { running: false, results: [], error: null },
    /* ---------- 用量（响应 usage 累计：本会话 + 累计，方案 §六.5） ---------- */
    usage: { session: emptyUsage(), total: emptyUsage() },
  }),

  getters: {
    /** 未配置 baseURL / model / 密钥任一项时为 false——全部 AI 入口据此置灰（方案 §三） */
    ready: (s) => !!(s.baseURL.trim() && s.model.trim() && s.hasCredential),
    busy: (s) =>
      s.phase === "assembling" ||
      s.phase === "generating" ||
      s.chatBusy ||
      s.evaluation.running,
    /** 当前模型且「启用专属参数」打开时的配置；否则 null（完全跟随全局设置） */
    activeModelCfg: (s) => {
      const cfg = s.modelCfg[s.model];
      return cfg && cfg.enabled ? cfg : null;
    },
    /** 生效的上下文预算：模型配置了上下文窗口（>0）时与全局预算取更小值 */
    effectiveBudget: (s) => {
      const cfg = s.modelCfg[s.model];
      const cw = cfg && cfg.enabled ? Number(cfg.contextWindow) : 0;
      return cw > 0 ? Math.min(s.maxContext, Math.round(cw)) : s.maxContext;
    },
  },

  actions: {
    /* ---------- 设置装载 / 保存 ---------- */
    async loadSettings() {
      try {
        const rows = await db.appconfig
          .where("key")
          .startsWith("ai.")
          .toArray();
        const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
        if (map[APPCFG.options]) {
          const { roles, ...liveOptions } = map[APPCFG.options];
          this.options = { ...this.options, ...liveOptions };
        }
        if (map[APPCFG.baseURL] != null)
          this.baseURL = String(map[APPCFG.baseURL]);
        if (map[APPCFG.model] != null) this.model = String(map[APPCFG.model]);
        if (Array.isArray(map[APPCFG.models])) {
          this.models = [
            ...new Set(
              map[APPCFG.models]
                .filter((s) => typeof s === "string" && s.trim())
                .map((s) => s.trim()),
            ),
          ];
        }
        if (map[APPCFG.modelCfg] && typeof map[APPCFG.modelCfg] === "object") {
          this.modelCfg = map[APPCFG.modelCfg];
        }
        /* 旧用户迁移：列表为空但已有使用中模型 → 播种进列表（下次增删时落库） */
        if (!this.models.length && this.model) this.models = [this.model];
        if (map[APPCFG.temperature] != null)
          this.temperature = clampTemperature(map[APPCFG.temperature]);
        if (map[APPCFG.maxContext] != null)
          this.maxContext = clampMaxContext(map[APPCFG.maxContext]);
        if (map[APPCFG.privacy] != null) this.privacy = !!map[APPCFG.privacy];
        this.credential = "";
        this.hasCredential = false;
        if (map[APPCFG.credential]) {
          this.credential = String(map[APPCFG.credential]);
          this.hasCredential = true;
        }
        if (map[APPCFG.usage] && typeof map[APPCFG.usage] === "object") {
          this.usage.total = { ...emptyUsage(), ...map[APPCFG.usage] };
        }
      } catch {
        /* 首次启动无配置，保持默认 */
      }
      this.loaded = true;
    },

    /**
     * 保存设置（仅传入的键生效）。apiKey 为明文入参：经 safeStorage 加密后落 ai.credential，
     * 传空串清除；本函数自身不持有明文状态、不把明文写进任何持久层。
     */
    async saveSettings(patch = {}) {
      if ("options" in patch) {
        const { roles, ...liveOptions } = patch.options;
        const next = { ...this.options, ...liveOptions };
        if (next.kb.auto && !(next.kb.usageCap > 0))
          throw new Error("启用自动记忆前必须设置每日上限");
        this.options = next;
        await db.appconfig.put({
          key: APPCFG.options,
          value: JSON.parse(JSON.stringify(next)),
        });
      }
      if (patch.privacy === true && !this.privacy) this.cancel();
      if ("baseURL" in patch) {
        this.baseURL = String(patch.baseURL || "").trim();
        await db.appconfig.put({ key: APPCFG.baseURL, value: this.baseURL });
      }
      if ("model" in patch) {
        this.model = String(patch.model || "").trim();
        await db.appconfig.put({ key: APPCFG.model, value: this.model });
      }
      if ("temperature" in patch) {
        this.temperature = clampTemperature(patch.temperature);
        await db.appconfig.put({
          key: APPCFG.temperature,
          value: this.temperature,
        });
      }
      if ("maxContext" in patch) {
        this.maxContext = clampMaxContext(patch.maxContext);
        await db.appconfig.put({
          key: APPCFG.maxContext,
          value: this.maxContext,
        });
      }
      if ("privacy" in patch) {
        this.privacy = !!patch.privacy;
        await db.appconfig.put({ key: APPCFG.privacy, value: this.privacy });
      }
      if ("apiKey" in patch) {
        const plain = String(patch.apiKey || "");
        if (!plain) {
          this.credential = "";
          this.hasCredential = false;
          await db.appconfig.delete(APPCFG.credential);
        } else {
          const cipher = await window.native?.credentialEncrypt?.(plain);
          if (!cipher)
            throw new Error(
              "本机凭据加密不可用（safeStorage），无法保存 API 密钥",
            );
          this.credential = cipher;
          this.hasCredential = true;
          await db.appconfig.put({ key: APPCFG.credential, value: cipher });
        }
      }
      emitSettings();
    },

    /* ---------- 模型列表（拉取 / 手动添加 / 点选使用） ---------- */

    async persistModels() {
      await db.appconfig.put({ key: APPCFG.models, value: [...this.models] });
      emitSettings();
    },

    /** 加入列表（手动输入或从拉取结果点加）；去重；使用中模型为空时自动选用它 */
    async addModel(name) {
      const m = String(name || "").trim();
      if (!m) return;
      if (!this.models.includes(m)) {
        this.models.push(m);
        await this.persistModels();
        if (!this.model) {
          this.model = m;
          await db.appconfig.put({ key: APPCFG.model, value: this.model });
        }
      }
      await this.autoFillModelCfg(m);
    },

    /** 从列表移除；删的是使用中模型则自动切到列表第一个（列表空则清空使用中）；专属参数级联清理 */
    async removeModel(name) {
      const m = String(name || "").trim();
      if (!this.models.includes(m)) return;
      this.models = this.models.filter((x) => x !== m);
      await this.persistModels();
      if (this.model === m) {
        this.model = this.models[0] || "";
        await db.appconfig.put({ key: APPCFG.model, value: this.model });
      }
      if (this.modelCfg[m]) {
        const next = { ...this.modelCfg };
        delete next[m];
        this.modelCfg = next;
        await db.appconfig.put({ key: APPCFG.modelCfg, value: next });
      }
    },

    /**
     * 自动填入模型参数（与 ZCode 模型编辑一致）：模型名命中参数表且尚无已保存配置时，
     * 自动创建专属参数（上下文窗口 / 最大输出 / 备注取自官方口径）并持久化——
     * 生效预算与 max_tokens 随之生效。已保存配置的模型不覆盖（用户手改值优先）。
     */
    async autoFillModelCfg(name) {
      const m = String(name || "").trim();
      if (!m || this.modelCfg[m]) return;
      const meta = lookupModelMeta(m);
      if (!meta || (!meta.contextWindow && !meta.maxTokens)) return;
      const next = { ...this.modelCfg };
      next[m] = {
        enabled: true,
        contextWindow: meta.contextWindow ?? null,
        maxTokens: meta.maxTokens ?? null,
        temperature: null,
        note: meta.note || "",
      };
      this.modelCfg = next;
      await db.appconfig.put({ key: APPCFG.modelCfg, value: next });
      emitSettings();
    },

    /** 保存某模型的专属参数（编辑弹窗）；enabled=false 时运行时完全跟随全局设置 */
    async saveModelCfg(name, patch = {}) {
      const m = String(name || "").trim();
      if (!m) return;
      const next = { ...this.modelCfg };
      next[m] = {
        enabled: patch.enabled !== false,
        contextWindow:
          Number(patch.contextWindow) > 0
            ? Math.round(Number(patch.contextWindow))
            : null,
        maxTokens:
          Number(patch.maxTokens) > 0
            ? Math.round(Number(patch.maxTokens))
            : null,
        temperature:
          patch.temperature != null && Number(patch.temperature) >= 0
            ? clampTemperature(patch.temperature)
            : null,
        note: String(patch.note || "").slice(0, 100),
      };
      this.modelCfg = next;
      await db.appconfig.put({ key: APPCFG.modelCfg, value: next });
      emitSettings();
    },

    /** 点选使用中模型（立即持久化，无需再点保存）；命中参数表时自动填入专属参数 */
    async selectModel(name) {
      const m = String(name || "").trim();
      if (!m) return;
      await this.autoFillModelCfg(m);
      if (m === this.model) return;
      this.model = m;
      await db.appconfig.put({ key: APPCFG.model, value: this.model });
      emitSettings();
    },

    /** 拉取服务商模型列表：密钥可选（Ollama 本地无需）；错误经 errorFrom 归一为统一文案 */
    async fetchModelList() {
      if (!this.baseURL.trim()) {
        throw new AiProviderError(
          AI_ERROR_CODES.NOT_CONFIGURED,
          "恍然梦未配置：请先填写并保存 API 地址",
        );
      }
      this.fetchingModels = true;
      try {
        const apiKey = this.hasCredential ? await this.decryptCredential() : "";
        return await listModels({ baseURL: this.baseURL.trim(), apiKey });
      } catch (e) {
        throw this.errorFrom(e);
      } finally {
        this.fetchingModels = false;
      }
    },

    /** 密钥即时解密（仅本次调用内存使用；密文无效/解密失败 → 提示重新配置） */
    async decryptCredential() {
      if (!this.credential) return "";
      const plain = await window.native?.credentialDecrypt?.(this.credential);
      if (typeof plain !== "string")
        throw new Error(
          "API 密钥解密失败（密文无效或系统凭据已变化），请到设置中重新保存密钥",
        );
      return plain;
    },

    /** 组装 provider 调用参数（agent.js/provider.js 消费形态）；未配置或网页版在此拦截 */
    async buildOpts() {
      if (!window.native?.credentialDecrypt) {
        throw new AiProviderError(
          AI_ERROR_CODES.NOT_CONFIGURED,
          "恍然梦仅桌面版可用（网页版无凭据加密通道）",
        );
      }
      if (!this.baseURL.trim() || !this.model.trim()) {
        throw new AiProviderError(
          AI_ERROR_CODES.NOT_CONFIGURED,
          "恍然梦未配置：请先在设置中填写 API 地址与模型",
        );
      }
      const apiKey = await this.decryptCredential();
      if (!apiKey) {
        throw new AiProviderError(
          AI_ERROR_CODES.NOT_CONFIGURED,
          "恍然梦未配置：请先在设置中保存 API 密钥",
        );
      }
      return { baseURL: this.baseURL.trim(), apiKey, ...this.generationOpts() };
    },
    generationOpts() {
      const model = this.model.trim();
      const cfg = this.modelCfg[model]?.enabled ? this.modelCfg[model] : null;
      const known = lookupModelMeta(model);
      const limit = (a, b) => {
        const n = Math.min(
          Number(a) > 0 ? Number(a) : Infinity,
          Number(b) > 0 ? Number(b) : Infinity,
        );
        return Number.isFinite(n) ? n : 0;
      };
      return {
        model,
        inputBudget: this.maxContext,
        contextWindow: limit(cfg?.contextWindow, known?.contextWindow),
        maxOutputTokens: limit(cfg?.maxTokens, known?.maxTokens),
        temperature:
          cfg?.temperature != null
            ? clampTemperature(cfg.temperature)
            : this.temperature,
        maxTokens:
          Number(cfg?.maxTokens) > 0 ? Math.round(Number(cfg.maxTokens)) : 2048,
      };
    },

    /* ---------- 用量统计（session + total，total 持久化） ---------- */
    addUsage(u) {
      if (!u) return;
      const add = (t) => {
        t.prompt_tokens += Number(u?.prompt_tokens) || 0;
        t.completion_tokens += Number(u?.completion_tokens) || 0;
        t.total_tokens += Number(u?.total_tokens) || 0;
        t.calls++;
        if (u.estimated) t.estimatedCalls = (t.estimatedCalls || 0) + 1;
      };
      add(this.usage.session);
      add(this.usage.total);
      db.appconfig
        .put({
          key: APPCFG.usage,
          value: JSON.parse(JSON.stringify(this.usage.total)),
        })
        .catch(() => {});
    },

    /* ---------- 错误归一 ---------- */
    errorFrom(err) {
      if (err instanceof AiProviderError)
        return { code: err.code, message: err.message };
      if (err?.name === "AbortError")
        return { code: "aborted", message: "已取消" };
      return { code: "api", message: String(err?.message || err) };
    },

    /* ---------- 作品隔离、预设与统一对话 ---------- */

    /** 通用任务执行：装配 → 流式生成 → 卡片（提案，不落库）。失败置 phase=failed 并返回 null */
    switchWork(workId) {
      if (this.workId === workId) return;
      if (this.workId)
        sessions.set(this.workId, {
          chat: this.chat.filter((m) => !m.streaming),
        });
      this.cancel();
      this.workId = workId;
      this.chat = sessions.get(workId)?.chat || [];
      this.pendingPrompt = "";
      this.pendingRefs = {};
      this.selectedPresetId = "novel-default";
      this.loadPresets().catch((e) => {
        this.error = this.errorFrom(e);
      });
      this.kb = {
        cards: [],
        rows: [],
        hooks: [],
        metas: [],
        stale: 0,
        missing: 0,
        ready: 0,
        total: 0,
        progress: null,
        error: "",
        paused: false,
      };
    },
    async loadPresets() {
      const workId = this.workId;
      this.presets = await presetRepo.listPresets();
      if (workId) {
        const state = await presetRepo.presetState(workId);
        if (this.workId === workId)
          this.selectedPresetId = this.presets.some(
            (p) => p.id === state.presetId,
          )
            ? state.presetId
            : "novel-default";
      }
    },
    async selectPreset(id) {
      if (!this.presets.some((p) => p.id === id)) throw new Error("预设不存在");
      const workId = this.workId,
        state = await presetRepo.presetState(workId);
      await presetRepo.commitState({ ...state, presetId: id }, null);
      if (this.workId === workId) this.selectedPresetId = id;
      window.native?.appBroadcast?.({ kind: "ai-presets-changed" });
    },
    async savePreset(row, { activateWorkId = null } = {}) {
      const saved = await presetRepo.savePreset(row, activateWorkId);
      await this.loadPresets();
      window.native?.appBroadcast?.({ kind: "ai-presets-changed" });
      return saved;
    },
    async deletePreset(id) {
      await presetRepo.deletePreset(id);
      await this.loadPresets();
      window.native?.appBroadcast?.({ kind: "ai-presets-changed" });
    },
    prepare(text, contextRefs = {}) {
      this.pendingPrompt = text;
      this.pendingRefs = contextRefs;
      useUiStore().aiDrawerOpen = true;
    },
    cancel() {
      evaluationAbort?.abort();
      chatAbort?.abort();
      chatAbort = null;
      this.runId = null;
      this.chatBusy = false;
      this.phase = "idle";
      for (const m of this.chat.filter((m) => m.streaming)) {
        m.streaming = false;
        m.complete = false;
        m.error = { code: "aborted", message: "已停止，保留已生成内容" };
        m.cards?.forEach((c) => {
          c.complete = false;
          c.status = "incomplete";
        });
      }
    },
    async previewPreset(row, question = "本次发送预览", request = {}) {
      const live = useWorkStore();
      if (
        new URLSearchParams(location.search).has("panel") &&
        !request.localPreview
      )
        return requestMainPreview(row, question, {
          ...request,
          workId: live.work?.id,
        });
      if (!live.work) throw new Error("请在主窗口打开关联作品后预览");
      const work = snapshotWork(live);
      work.selectedChapterId = live.selChapterId;
      const frozen = freezeContext(work, request, question);
      const [local, global] = await Promise.all([
        presetRepo.presetState(work.work.id),
        presetRepo.globalState(),
      ]);
      const type =
        request.generationType === "regenerate"
          ? "swipe"
          : request.generationType || "normal";
      let messages = this.chat,
        continuationText = "",
        candidateIndex = 0;
      if (type === "continue" || type === "swipe") {
        const index = request.messageId
          ? messages.findIndex((m) => m.id === request.messageId)
          : messages.findLastIndex((m) => m.role === "assistant");
        if (index < 0)
          throw new Error("当前会话没有可继续或重新生成的助手回复");
        const target = messages[index];
        candidateIndex = target.candidates?.length || 1;
        continuationText =
          target.cards?.find((c) => c.kind === "draft")?.text ||
          target.rawContent ||
          target.content;
        messages = messages.slice(0, type === "continue" ? index + 1 : index);
      }
      const prepared = await prepareDialogue({
        work,
        frozen,
        row,
        messages,
        question,
        generationType: type,
        continuationText,
        candidateIndex,
        state: this.privacy
          ? { local: {}, global: {} }
          : { local: local.local, global: global.global },
        opts: { ...this.generationOpts(), privacy: this.privacy },
      });
      return {
        ...prepared.compiled,
        source: frozen,
        sourceReport: prepared.material.report,
      };
    },
    async send(question, request = {}) {
      const privacy = this.privacy;
      const q = String(question || "").trim(),
        live = useWorkStore();
      const variantId =
        request.regenerateMessageId || request.continueMessageId;
      if ((!q && !variantId) || this.busy || !live.work) return false;
      this.switchWork(live.work.id);
      const work = snapshotWork(live);
      work.selectedChapterId = live.selChapterId;
      const workId = work.work.id,
        runId = uid(),
        ctl = new AbortController();
      chatAbort = ctl;
      this.runId = runId;
      this.chatBusy = true;
      this.phase = "assembling";
      this.error = null;
      const current = () =>
        chatAbort === ctl &&
        this.runId === runId &&
        this.workId === workId &&
        !ctl.signal.aborted;
      let msg,
        viewTimer,
        compiled,
        row,
        viewVersion = 0;
      const notice = (t) => {
        if (current() && msg?.context && !msg.context.warnings.includes(t))
          msg.context.warnings.push(t);
      };
      const refreshViews = async () => {
        if (!compiled || !row || !msg) return;
        const version = ++viewVersion,
          raw = msg.rawContent || "";
        const views = await textViews(
          raw,
          row,
          2,
          compiled.macroEnv,
          compiled.macroState,
        );
        if (!current() || version !== viewVersion) return;
        Object.assign(msg, {
          content: views.text,
          displayText: views.displayText,
          promptText: views.promptText,
          plainText: plainChat(views.text),
        });
        views.warnings.forEach(notice);
        if (msg.reasoning?.rawText) {
          const r = await textViews(
            msg.reasoning.rawText,
            row,
            6,
            compiled.macroEnv,
            compiled.macroState,
          );
          if (current() && version === viewVersion) msg.reasoning = r;
          r.warnings.forEach(notice);
        }
      };
      try {
        const frozen = freezeContext(work, request, q),
          generationType = variantId
            ? request.continueMessageId
              ? "continue"
              : "swipe"
            : request.generationType === "regenerate"
              ? "swipe"
              : request.generationType || "normal";
        const index = variantId
          ? this.chat.findIndex((m) => m.id === variantId)
          : -1;
        const original = index >= 0 ? this.chat[index] : null,
          old = original ? captureCandidate(original) : null;
        if (variantId && (!original || original.workId !== workId))
          throw new Error("原候选不属于当前作品会话");
        if (
          request.continueMessageId &&
          (privacy ||
            old.source.sourceHash !== frozen.sourceHash ||
            old.source.layoutHash !== frozen.layoutHash ||
            (old.source.sourceVersions || []).some((v) => {
              const source = work[v.table]?.find((r) => r.id === v.id);
              return (
                !source ||
                (v.table === "chapters"
                  ? chapterHash(source)
                  : entityHash(source)) !== v.hash
              );
            }))
        )
          throw new Error(
            privacy
              ? "隐私模式不发送已有输出，请在本轮输入续写要求"
              : "继续生成的来源已变化，请重新生成候选",
          );
        const priorMessages = copy(
          index >= 0
            ? this.chat.slice(0, request.continueMessageId ? index + 1 : index)
            : this.chat,
        );
        const previousDraft = old?.cards?.find((c) => c.kind === "draft");
        if (original) {
          storeCandidate(original);
          original.activeCandidate = original.candidates.length;
          original.candidates.push({ content: "", cards: [], complete: false });
          msg = original;
          for (const key of [
            "error",
            "context",
            "preset",
            "finishReason",
            "rounds",
            "toolOutput",
            "reasoning",
          ])
            delete msg[key];
          Object.assign(msg, {
            content: "",
            rawContent: "",
            displayText: "",
            promptText: "",
            plainText: "",
            cards: [],
            source: frozen,
            runId,
            streaming: true,
            complete: false,
          });
        } else {
          const user = {
            id: uid(),
            workId,
            role: "user",
            content: q,
            rawContent: q,
            source: frozen,
            ts: Date.now(),
          };
          this.chat.push(user, {
            id: uid(),
            workId,
            runId,
            role: "assistant",
            content: "",
            rawContent: "",
            cards: [],
            source: frozen,
            streaming: true,
            complete: false,
            ts: Date.now(),
            candidates: [],
            activeCandidate: 0,
          });
          msg = this.chat.at(-1);
        }
        const [opts, rows, local, global] = await Promise.all([
          this.buildOpts(),
          presetRepo.listPresets(),
          presetRepo.presetState(workId),
          presetRepo.globalState(),
        ]);
        if (!current()) return false;
        row = copy(
          rows.find(
            (p) =>
              p.id ===
              (request.presetId || local.presetId || this.selectedPresetId),
          ) || defaultPreset(),
        );
        const prepared = await prepareDialogue({
          work,
          frozen,
          row,
          messages: priorMessages,
          question: q,
          generationType,
          state: privacy
            ? { local: {}, global: {} }
            : { local: local.local, global: global.global },
          opts: { ...opts, privacy: privacy },
          continuationText:
            previousDraft?.text || old?.rawContent || old?.content || "",
          candidateIndex: msg.activeCandidate,
        });
        compiled = prepared.compiled;
        if (!current()) return false;
        if (!original) {
          const user = this.chat.at(-2);
          Object.assign(user, {
            content: prepared.userViews.text,
            displayText: prepared.userViews.displayText,
            promptText: prepared.userViews.promptText,
          });
        }
        await presetRepo.commitState(
          {
            ...local,
            presetId: row.id,
            local: privacy ? local.local : compiled.macroState.local,
          },
          privacy ? null : { ...global, global: compiled.macroState.global },
        );
        if (!current()) return false;
        msg.context = {
          report: prepared.material.report,
          blocks: compiled.report,
          trace: compiled.trace,
          warnings: compiled.warnings,
          dropped: compiled.dropped,
          tokens: compiled.tokens,
        };
        msg.preset = compiled.presetSnapshot;
        this.phase = "generating";
        const response = await runDialogue({
          compiled,
          work,
          frozen,
          runId,
          messageId: msg.id,
          opts: {
            ...opts,
            signal: ctl.signal,
            privacy: privacy,
            onToolDelta: (call) => {
              if (current()) msg.toolOutput = call.function?.arguments || "";
            },
            onReasoningDelta: (d) => {
              if (current()) {
                msg.reasoning ||= { rawText: "" };
                msg.reasoning.rawText += d;
              }
            },
          },
          onCard: (card) => {
            if (current())
              msg.cards.push({
                ...card,
                complete: false,
                status: "incomplete",
              });
          },
          onDelta: (d) => {
            if (current()) {
              msg.rawContent += d;
              msg.content = msg.rawContent;
              if (!viewTimer)
                viewTimer = setTimeout(() => {
                  viewTimer = null;
                  refreshViews().catch((e) => notice(e.message));
                }, 120);
            }
          },
          onUsage: (u) => this.addUsage(u),
          onNotice: notice,
        });
        if (!current()) return false;
        clearTimeout(viewTimer);
        Object.assign(msg, {
          rawContent: response.answer,
          cards: response.cards,
          complete: response.complete,
          finishReason: response.finishReason,
          rounds: response.reports,
        });
        if (request.continueMessageId) {
          const next = msg.cards.find((c) => c.kind === "draft");
          if (previousDraft && next)
            msg.cards = [
              makeDraft(previousDraft.text + next.text, frozen, {
                runId,
                messageId: msg.id,
                title: previousDraft.title,
                complete: msg.complete,
              }),
            ];
          else if (previousDraft && response.answer)
            msg.cards = [
              makeDraft(
                previousDraft.text +
                  (row.payload.continue_postfix ?? "") +
                  response.answer,
                frozen,
                {
                  runId,
                  messageId: msg.id,
                  title: previousDraft.title,
                  complete: msg.complete,
                },
              ),
            ];
          msg.rawContent =
            (old.rawContent ?? old.content) +
            (row.payload.continue_postfix ?? "") +
            response.answer;
        }
        await refreshViews();
        return true;
      } catch (e) {
        if (current()) {
          this.error = this.errorFrom(e);
          if (msg) {
            msg.error = this.error;
            msg.complete = false;
            msg.cards?.forEach((c) => {
              c.complete = false;
              c.status = "incomplete";
            });
          }
        }
        return false;
      } finally {
        clearTimeout(viewTimer);
        if (msg) {
          msg.streaming = false;
          storeCandidate(msg);
        }
        if (chatAbort === ctl) {
          chatAbort = null;
          this.chatBusy = false;
          this.phase = "idle";
        }
      }
    },
    async evaluatePresets(ids, question, requirements = {}) {
      const live = useWorkStore();
      if (this.busy || !live.work || !this.ready)
        throw new Error("打开作品并配置模型后，等待当前生成结束再开始");
      if (ids.length !== 2 || ids[0] === ids[1] || !question.trim())
        throw new Error("请选择不同的两套预设并填写同一创作要求");
      const work = snapshotWork(live);
      work.selectedChapterId = live.selChapterId;
      const frozen = freezeContext(work, {}, question),
        workId = work.work.id,
        ctl = new AbortController();
      evaluationAbort = ctl;
      this.evaluation = { running: true, results: [], error: null };
      try {
        const [opts, rows, local, global] = await Promise.all([
          this.buildOpts(),
          presetRepo.listPresets(),
          presetRepo.presetState(workId),
          presetRepo.globalState(),
        ]);
        // Both arms share a fixed source and history. Evaluation never commits macro variables or proposals.
        const messages = copy(this.chat),
          state = this.privacy
            ? { local: {}, global: {} }
            : { local: local.local, global: global.global };
        for (const id of ids) {
          const row = copy(rows.find((p) => p.id === id));
          if (!row) throw new Error("评测预设不存在");
          const prepared = await prepareDialogue({
            work,
            frozen: copy(frozen),
            row,
            messages,
            question,
            state,
            opts: { ...opts, privacy: this.privacy },
          });
          for (let trial = 1; trial <= 3; trial++) {
            checkAbort(ctl.signal);
            if (live.work?.id !== workId)
              throw new Error("作品已切换，评测已停止");
            const r = await chatStream({
              ...opts,
              ...prepared.compiled.opts,
              signal: ctl.signal,
              messages: prepared.compiled.messages,
            });
            checkAbort(ctl.signal);
            this.addUsage(
              r.usage || {
                prompt_tokens: prepared.compiled.tokens.used,
                completion_tokens: Math.ceil(r.text.length / 2),
                estimated: true,
              },
            );
            const views = await textViews(
              r.text,
              row,
              2,
              prepared.compiled.macroEnv,
              prepared.compiled.macroState,
            );
            const checks = {
              language:
                requirements.language === "英文"
                  ? !/[\u4e00-\u9fff]/.test(views.text)
                  : /[\u4e00-\u9fff]/.test(views.text),
              firstPerson:
                requirements.person === "第一人称"
                  ? /我/.test(views.text)
                  : null,
              format:
                requirements.format === "JSON"
                  ? (() => {
                      try {
                        JSON.parse(views.text);
                        return true;
                      } catch {
                        return false;
                      }
                    })()
                  : requirements.format === "代码块"
                    ? /```/.test(views.text)
                    : null,
              explanation: /以下是|作为AI|创作说明|修改说明/i.test(views.text),
            };
            this.evaluation.results.push({
              preset: prepared.compiled.presetSnapshot,
              source: prepared.material.report,
              trial,
              rawText: r.text,
              text: views.text,
              checks,
              finishReason: r.finishReason,
              usage: r.usage || { estimated: true },
              rating: null,
              notes: "",
              warnings: views.warnings,
            });
          }
        }
      } catch (e) {
        this.evaluation.error = this.errorFrom(e);
      } finally {
        if (evaluationAbort === ctl) evaluationAbort = null;
        this.evaluation.running = false;
      }
      return this.evaluation.results;
    },
    selectCandidate(msg, index) {
      if (this.busy) throw new Error("生成结束后可切换候选");
      switchCandidate(msg, index);
    },
    continueMessage(msg) {
      return this.send("", {
        generationType: "continue",
        scope: msg.source.scope,
        contextRefs: {
          ...msg.source.refs,
          chapterId: msg.source.chapterId,
          selection: msg.source.selection,
        },
        continueMessageId: msg.id,
      });
    },
    regenerateMessage(msg) {
      const index = this.chat.indexOf(msg),
        question = this.chat
          .slice(0, index)
          .reverse()
          .find((m) => m.role === "user");
      return this.send(
        question?.rawContent || question?.content || "重新生成上一条回复",
        {
          generationType: "swipe",
          scope: msg.source.scope,
          contextRefs: {
            ...msg.source.refs,
            chapterId: msg.source.chapterId,
            selection: msg.source.selection,
          },
          regenerateMessageId: msg.id,
        },
      );
    },
    draftFromMessage(msg, text, { visibleSelection = false } = {}) {
      if (msg.streaming || msg.error || !msg.complete)
        throw new Error("回复尚未完整结束，请继续或复制文本人工整理");
      const selected = String(text || "");
      if (
        !selected.trim() ||
        (!visibleSelection &&
          ![
            msg.content,
            msg.rawContent,
            msg.plainText,
            plainChat(msg.displayText || msg.content),
          ].some((s) => s?.includes(selected)))
      )
        throw new Error("所选文本不属于此候选");
      const card = makeDraft(selected, msg.source, {
        runId: msg.runId,
        messageId: msg.id,
        complete: msg.complete,
      });
      card.candidateIndex = msg.activeCandidate || 0;
      msg.cards.push(card);
      storeCandidate(msg);
      return card;
    },
    async clearChat() {
      this.cancel();
      this.chat = [];
      const state = await presetRepo.presetState(this.workId);
      await presetRepo.commitState({ ...state, local: {} }, null);
    },
    async refreshKnowledge() {
      const work = useWorkStore();
      if (!work.work || this.workId !== work.work.id) return;
      const workId = this.workId;
      const snap = await knowledgeSnapshot(snapshotWork(work));
      try{
        const projection=await ensureProjection(workId);
        if(this.workId===workId)this.kb.sourceCoverage={counts:projection.index.counts,issues:projection.index.issues||[],docs:projection.index.docs,chunks:projection.index.chunks,sourceMetas:snap.sourceMetas};
      }catch(e){if(this.workId===workId)this.kb.sourceCoverage={error:e.message};}
      if (this.workId !== workId) return;
      this.kb.cards = snap.cards;
      this.kb.rows = snap.rows.filter(
        (r) =>
          !snap.decisions.some(
            (d) =>
              d.action === "ignore" &&
              [
                r.decisionKey,
                "card:" + r.id,
                r.kind === "entity" ? "entity:" + r.body.name : null,
              ].includes(d.key),
          ),
      );
      this.kb.hooks = replayForeshadows(snap.cards);
      this.kb.metas = snap.metas;
      this.kb.ready = snap.valid.size;
      this.kb.total = snap.chapters.length;
      this.kb.stale = snap.stale.length;
      this.kb.missing = snap.missing.length;
      const job = await aiRepo.jobById("knowledge:" + workId);
      if (job && !kbAbort)
        this.kb.progress =
          job.status === "running" && job.leaseUntil < Date.now()
            ? { ...job, status: "paused" }
            : job;
    },
    async buildKnowledge(request = {}) {
      const workId = request.workId || this.workId;
      if (!workId || kbAbort) return;
      if (new URLSearchParams(location.search).has("panel")) {
        window.native?.appBroadcast?.({
          kind: "ai-kb-request",
          data: { ...request, workId },
        });
        this.kb.error = "构建已交给主窗口，可关闭此面板";
        return;
      }
      if (this.privacy && !request.allowRaw)
        throw new Error("提取必须发送正文，请确认本次范围");
      if (request.auto && (this.privacy || !this.options.kb.auto)) return;
      const ctl = new AbortController();
      kbAbort = ctl;
      this.kb.paused = false;
      this.kb.error = "";
      try {
        const opts = await this.buildOpts();
        checkAbort(ctl.signal);
        const r = await buildKnowledge({
          workId,
          opts: { ...opts, signal: ctl.signal },
          owner: uid(),
          onlyIds: request.onlyIds,
          force: request.rebuild,
          auto: request.auto,
          usageCap: this.options.kb.usageCap,
          shouldPause: () => this.kb.paused,
          onUsage: (u) => this.addUsage(u),
          onProgress: (p) => {
            if (this.workId === workId) this.kb.progress = p;
            window.native?.appBroadcast?.({
              kind: "kb-changed",
              data: { workId },
            });
          },
        });
        if (this.workId === workId) this.kb.progress = r;
      } catch (e) {
        if (this.workId === workId) this.kb.error = e.message;
      } finally {
        kbAbort = null;
        await this.refreshKnowledge();
        window.native?.appBroadcast?.({ kind: "kb-changed", data: { workId } });
      }
    },
    pauseKnowledge() {
      this.kb.paused = true;
      kbAbort?.abort();
      if (new URLSearchParams(location.search).has("panel"))
        window.native?.appBroadcast?.({
          kind: "ai-kb-request",
          data: { workId: this.workId, action: "pause" },
        });
    },
    async clearKnowledge() {
      if (kbAbort) throw new Error("请先暂停构建");
      await aiRepo.clearKnowledge(this.workId);
      await this.refreshKnowledge();
    },
    async decideKnowledge(key, action, extra = {}) {
      await aiRepo.putAiRow("aidecisions", {
        id: this.workId + ":" + key,
        workId: this.workId,
        key,
        action,
        ...extra,
      });
      if (action === "override") {
        for (const row of this.kb.rows.filter(
          (r) => r.decisionKey === key || key === "card:" + r.id,
        ))
          await aiRepo.putAiRow("aikb", {
            ...row,
            body: extra.body,
            corrected: true,
          });
      }
      if (key.startsWith("entity:") && action === "merge") {
        for (const row of this.kb.rows.filter(
          (r) => r.body.name === key.slice(7),
        ))
          await aiRepo.putAiRow("aikb", {
            ...row,
            refType: extra.refType,
            refId: extra.refId,
          });
      }
      await this.refreshKnowledge();
      window.native?.appBroadcast?.({
        kind: "kb-changed",
        data: { workId: this.workId },
      });
    },
    async embedKnowledge() {
      if (kbAbort) throw new Error("已有记忆任务，请先暂停");
      if (new URLSearchParams(location.search).has("panel")) {
        window.native?.appBroadcast?.({
          kind: "ai-kb-request",
          data: { workId: this.workId, action: "vectors" },
        });
        return;
      }
      if (this.privacy)
        throw new Error("语义索引需发送知识卡，隐私模式下不自动执行");
      if (!this.options.embeddings.model) throw new Error("请先设置向量模型");
      const ctl = new AbortController();
      kbAbort = ctl;
      this.kb.paused = false;
      try {
        const opts = await this.buildOpts();
        await rebuildVectors({
          work: snapshotWork(useWorkStore()),
          opts: { ...opts, signal: ctl.signal },
          model: this.options.embeddings.model,
          shouldPause: () => this.kb.paused,
          onUsage: (u) => this.addUsage(u),
          onProgress: (p) => {
            this.kb.progress = { ...p, status: "running" };
          },
        });
      } catch (e) {
        this.kb.error = e.message;
      } finally {
        kbAbort = null;
        this.kb.progress = {
          ...this.kb.progress,
          status: this.kb.paused ? "paused" : "completed",
        };
      }
    },
    /* ---------- 连接测试（设置区按钮，方案 §三；验收走 tools/mock-ai.mjs） ---------- */
    async testConnection() {
      let opts;
      try {
        opts = await this.buildOpts();
      } catch (e) {
        return { ok: false, error: this.errorFrom(e) };
      }
      try {
        const r = await testConnection({ ...opts, timeout: 15000 });
        this.addUsage(r.usage);
        return { ok: true, reply: r.reply, model: r.model };
      } catch (err) {
        return { ok: false, error: this.errorFrom(err) };
      }
    },
  },
});
