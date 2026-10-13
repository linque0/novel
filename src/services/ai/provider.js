/**
 * services/ai/provider.js — OpenAI 兼容调用层（docs/AI助手接入方案.md §三/§七）
 *
 * 设计要点：
 * - 仅用 fetch + ReadableStream 实现 SSE 流式解析，零新依赖
 * - POST {baseURL}/chat/completions，stream:true；baseURL 形如 https://api.deepseek.com/v1
 *   （末尾斜杠可有可无；DeepSeek/智谱 GLM/OpenAI/Ollama 本地等一套协议全覆盖）
 * - 错误统一抛 AiProviderError，code 见 AI_ERROR_CODES：
 *     not-configured（未配置）/ network（网络失败，含超时）/ auth（鉴权失败 401/403）
 *     rate-limit（限流 429）/ insufficient-balance（余额不足 402）/ api（其他服务商错误）
 * - 超时语义：timeout 毫秒内未建立连接、或相邻两个数据块之间静默超过 timeout 即中止；
 *   总时长不限，长篇流式输出不受惩罚
 * - 返回 { text, usage, finishReason }；文本增量经 onDelta 回调逐段上抛；
 *   usage 为 { prompt_tokens, completion_tokens, total_tokens }（服务商未回传时为 null）
 */

export const AI_ERROR_CODES = {
  NOT_CONFIGURED: "not-configured",
  NETWORK: "network",
  AUTH: "auth",
  RATE_LIMIT: "rate-limit",
  INSUFFICIENT_BALANCE: "insufficient-balance",
  API: "api",
};

export class AiProviderError extends Error {
  /**
   * @param {string} code AI_ERROR_CODES 之一
   * @param {string} message 面向用户的中文提示
   * @param {{status?: number|null, detail?: string|null}} extra status=HTTP 状态码；detail=服务商原始报文片段
   */
  constructor(code, message, extra = {}) {
    super(message);
    this.name = "AiProviderError";
    this.code = code;
    this.status = extra.status ?? null;
    this.detail = extra.detail ?? null;
  }
}

/* ---- 内部工具 ---- */

/** URL 仅放行 http/https（app:// 渲染层 fetch 前置校验；本地端点如 Ollama/mock 属方案预设，不在拒绝之列） */
function isHttpUrl(u) {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const hostOf = (u) => {
  try {
    return new URL(u).host;
  } catch {
    return u;
  }
};

/** 拼 {baseURL}/chat/completions：容忍末尾斜杠与已带路径两种写法；baseURL 缺失/非法归入「未配置」 */
function buildUrl(baseURL) {
  const s = String(baseURL || "")
    .trim()
    .replace(/\/+$/, "");
  if (!s)
    throw new AiProviderError(
      AI_ERROR_CODES.NOT_CONFIGURED,
      "恍然梦未配置：请先在设置中填写 API 地址（baseURL）",
    );
  if (!isHttpUrl(s)) {
    throw new AiProviderError(
      AI_ERROR_CODES.NOT_CONFIGURED,
      `恍然梦未配置：API 地址无效（仅支持 http/https）——${s}`,
    );
  }
  return s.endsWith("/chat/completions") ? s : s + "/chat/completions";
}

function normalizeUsage(u) {
  if (!u || typeof u !== "object") return null;
  const prompt = Number(u.prompt_tokens) || 0;
  const completion = Number(u.completion_tokens) || 0;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: Number(u.total_tokens) || prompt + completion,
  };
}

/** 从错误响应体提取服务商 message（OpenAI 兼容：{error:{message}}；宽松兜底取顶层 message / 原文截断） */
function extractServerMessage(bodyText) {
  if (!bodyText) return "";
  try {
    const obj = JSON.parse(bodyText);
    const msg = obj?.error?.message ?? obj?.message;
    if (typeof msg === "string" && msg) return msg;
    return JSON.stringify(obj).slice(0, 300);
  } catch {
    return String(bodyText).slice(0, 300);
  }
}

/** 归类：先按服务商报文关键词（各家状态码语义不一），再按 HTTP 状态码兜底 */
function classifyFailure(status, serverMsg) {
  const msg = String(serverMsg || "");
  if (/insufficient[\s_-]?balance|余额不足/i.test(msg))
    return AI_ERROR_CODES.INSUFFICIENT_BALANCE;
  if (/rate[\s_-]?limit|too many requests|限流/i.test(msg))
    return AI_ERROR_CODES.RATE_LIMIT;
  if (
    /invalid[\s_-]?api[\s_-]?key|unauthorized|incorrect api key|鉴权|密钥无效|无权限/i.test(
      msg,
    )
  )
    return AI_ERROR_CODES.AUTH;
  if (status === 401 || status === 403) return AI_ERROR_CODES.AUTH;
  if (status === 402) return AI_ERROR_CODES.INSUFFICIENT_BALANCE;
  if (status === 429) return AI_ERROR_CODES.RATE_LIMIT;
  return AI_ERROR_CODES.API;
}

const FRIENDLY = {
  [AI_ERROR_CODES.AUTH]: (status) =>
    `鉴权失败（${status}）：API 密钥无效或无权限`,
  [AI_ERROR_CODES.RATE_LIMIT]: (status) =>
    `请求被限流（${status}）：请稍后重试`,
  [AI_ERROR_CODES.INSUFFICIENT_BALANCE]: (status) =>
    `余额不足（${status}）：请到服务商控制台充值`,
  [AI_ERROR_CODES.API]: (status) => `服务商返回错误（${status ?? "未知"}）`,
};

function throwFailure(status, serverMsg, detail) {
  const code = classifyFailure(status, serverMsg);
  const base = (FRIENDLY[code] || FRIENDLY[AI_ERROR_CODES.API])(status);
  throw new AiProviderError(code, serverMsg ? `${base}：${serverMsg}` : base, {
    status,
    detail: detail ? String(detail).slice(0, 500) : null,
  });
}

/* ---- 核心调用 ---- */

async function chatStreamOnce(opts, onDelta) {
  const {
    baseURL,
    apiKey = "",
    model,
    messages,
    temperature,
    maxTokens = null,
    timeout = 60000,
    signal = null,
    includeUsage = true,
    extraHeaders = {},
  } = opts || {};

  if (!model)
    throw new AiProviderError(
      AI_ERROR_CODES.NOT_CONFIGURED,
      "恍然梦未配置：请先在设置中选择模型",
    );
  if (!Array.isArray(messages) || !messages.length) {
    throw new AiProviderError(
      AI_ERROR_CODES.NOT_CONFIGURED,
      "AI 调用缺少 messages 消息数组",
    );
  }

  const url = buildUrl(baseURL);
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const body = {
    model,
    messages,
    stream: opts.stream !== false,
    ...(temperature != null ? { temperature } : {}),
    ...Object.fromEntries(
      [
        "top_p",
        "frequency_penalty",
        "presence_penalty",
        "seed",
        "reasoning_effort",
        "verbosity",
      ]
        .filter((k) => opts[k] != null)
        .map((k) => [k, opts[k]]),
    ),
    ...(opts.tools?.length
      ? { tools: opts.tools, tool_choice: opts.toolChoice || "auto" }
      : {}),
    /* 模型专属参数（编辑模型配置）：配置了最大输出 Token 才随请求发送 */
    ...(maxTokens != null && Number(maxTokens) > 0
      ? { max_tokens: Math.round(Number(maxTokens)) }
      : {}),
    ...(includeUsage && opts.stream !== false
      ? { stream_options: { include_usage: true } }
      : {}),
  };

  // 外部 signal 与内部空闲超时合并为一个控制器
  const ctrl = new AbortController();
  let timedOut = false;
  let idleTimer = null;
  const armIdle = () => {
    clearTimeout(idleTimer);
    if (timeout > 0) {
      idleTimer = setTimeout(() => {
        timedOut = true;
        ctrl.abort(new Error("ai-idle-timeout"));
      }, timeout);
    }
  };
  const onOuterAbort = () => ctrl.abort(signal.reason);
  if (signal) {
    if (signal.aborted) ctrl.abort(signal.reason);
    else signal.addEventListener("abort", onOuterAbort, { once: true });
  }

  try {
    let res;
    try {
      armIdle();
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (err) {
      if (timedOut)
        throw new AiProviderError(
          AI_ERROR_CODES.NETWORK,
          `连接超时：${timeout}ms 内未收到响应`,
        );
      if (signal?.aborted) throw err; // 调用方主动取消，原样上抛
      throw new AiProviderError(
        AI_ERROR_CODES.NETWORK,
        `网络请求失败：无法连接 ${hostOf(url)}`,
        { detail: String(err?.message || err) },
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throwFailure(res.status, extractServerMessage(text), text);
    }

    const ctype = (res.headers.get("content-type") || "").toLowerCase();

    // 个别兼容服务无视 stream:true 直接回整段 JSON —— 宽容处理为一次性增量
    if (!res.body || ctype.includes("application/json")) {
      const text = await res.text().catch(() => "");
      let obj = null;
      try {
        obj = JSON.parse(text);
      } catch {
        /* ignore */
      }
      if (!obj)
        throw new AiProviderError(
          AI_ERROR_CODES.API,
          "服务商返回了无法解析的空响应",
          { detail: text.slice(0, 300) },
        );
      if (obj.error)
        throwFailure(obj.error.code ?? null, obj.error.message || "", text);
      const content = obj?.choices?.[0]?.message?.content;
      const toolCalls = obj?.choices?.[0]?.message?.tool_calls || [];
      toolCalls.forEach((call) => opts.onToolDelta?.(call));
      if (typeof content !== "string" && !toolCalls.length) {
        throw new AiProviderError(
          AI_ERROR_CODES.API,
          `服务商响应格式异常（content-type: ${ctype || "未知"}）`,
          { detail: text.slice(0, 300) },
        );
      }
      onDelta?.(content || "");
      const reasoning = obj?.choices?.[0]?.message?.reasoning_content || "";
      if (reasoning) opts.onReasoningDelta?.(reasoning);
      return {
        text: content || "",
        toolCalls,
        usage: normalizeUsage(obj.usage),
        finishReason: obj?.choices?.[0]?.finish_reason || "stop",
      };
    }

    // SSE 流式解析：逐块解码 → 按行切分 → data: 行取 JSON；[DONE] 结束
    const decoder = new TextDecoder("utf-8");
    const reader = res.body.getReader();
    let buf = "";
    let text = "";
    let usage = null;
    let finishReason = null;
    let sawDone = false;
    const calls = new Map();

    const handleLine = (line) => {
      if (!line || line.startsWith(":")) return false; // 注释/心跳行
      if (!line.startsWith("data:")) return false; // event:/id:/retry: 等忽略
      const payload = line.slice(5).trim();
      if (!payload) return false;
      if (payload === "[DONE]") return true;
      let obj;
      try {
        obj = JSON.parse(payload);
      } catch {
        return false; // 容忍残缺分片
      }
      if (obj.error)
        throwFailure(
          obj.error.code ?? null,
          obj.error.message || "",
          JSON.stringify(obj.error).slice(0, 500),
        );
      if (obj.usage) usage = normalizeUsage(obj.usage);
      for (const ch of obj.choices || []) {
        const d = ch?.delta || {};
        if (d.reasoning_content) opts.onReasoningDelta?.(d.reasoning_content);
        for (const part of d.tool_calls || []) {
          const index = part.index ?? 0;
          const call = calls.get(index) || {
            id: "",
            type: "function",
            function: { name: "", arguments: "" },
          };
          if (part.id) call.id = part.id;
          if (part.function?.name) call.function.name += part.function.name;
          if (part.function?.arguments)
            call.function.arguments += part.function.arguments;
          calls.set(index, call);
          opts.onToolDelta?.(call);
        }
        const delta =
          typeof d.content === "string"
            ? d.content
            : typeof d.text === "string"
              ? d.text
              : "";
        if (delta) {
          text += delta;
          onDelta?.(delta);
        }
        if (ch?.finish_reason) finishReason = ch.finish_reason;
      }
      return false;
    };

    try {
      while (!sawDone) {
        const { done, value } = await reader.read();
        if (done) break;
        armIdle();
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).replace(/\r$/, "");
          buf = buf.slice(idx + 1);
          if (handleLine(line)) {
            sawDone = true;
            break;
          }
        }
      }
      if (!sawDone && buf.trim()) handleLine(buf.trim()); // 冲刷无换行收尾的残包
    } catch (err) {
      if (err instanceof AiProviderError) throw err;
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      if (timedOut)
        throw new AiProviderError(
          AI_ERROR_CODES.NETWORK,
          `响应超时：${timeout}ms 内未收到新数据块`,
        );
      if (signal?.aborted) throw err;
      throw new AiProviderError(
        AI_ERROR_CODES.NETWORK,
        `流式响应中断：${String(err?.message || err)}`,
        { detail: String(err) },
      );
    }

    return {
      text,
      toolCalls: [...calls.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, v]) => v),
      usage,
      finishReason,
    };
  } finally {
    clearTimeout(idleTimer);
    if (signal) signal.removeEventListener("abort", onOuterAbort);
  }
}

/**
 * 流式对话：POST {baseURL}/chat/completions（stream:true）。
 * @param {object} opts { baseURL, apiKey, model, messages, temperature?, timeout?=60000, signal?, includeUsage?=true, extraHeaders? }
 * @param {(delta: string) => void} [onDelta] 文本增量回调（可能一次收到整段——服务商无视流式时）
 * @returns {Promise<{text: string, usage: {prompt_tokens, completion_tokens, total_tokens}|null, finishReason: string|null}>}
 */
export async function chatStream(opts, onDelta) {
  try {
    return await chatStreamOnce(opts, onDelta);
  } catch (err) {
    // 个别服务商不接受 stream_options 字段 —— 退回不带该字段重试一次（usage 可能拿不到）
    const detail = String(err?.detail || "") + String(err?.message || "");
    if (
      !opts.signal?.aborted &&
      err instanceof AiProviderError &&
      err.status === 400 &&
      /stream_options/i.test(detail)
    ) {
      return chatStreamOnce({ ...opts, includeUsage: false }, onDelta);
    }
    throw err;
  }
}

/**
 * 连接测试（方案 §三：设置区「连接测试」按钮）。
 * 用最小请求探活；成功返回 { ok, reply, usage, model }，失败抛 AiProviderError（code 见 AI_ERROR_CODES）。
 */
export async function testConnection(opts) {
  const { text, usage } = await chatStream({
    ...opts,
    messages: [{ role: "user", content: "连接测试，请只回复：OK" }],
    temperature: 0,
    timeout: opts?.timeout ?? 15000,
  });
  return { ok: true, reply: text, usage, model: opts?.model };
}

/**
 * 拉取服务商模型列表（OpenAI 兼容 GET {baseURL}/models）。
 * apiKey 可选——Ollama 本地等无需密钥；解析 data[].id，兼容 models[].name/id 兜底。
 * @returns {Promise<string[]>} 模型 id 列表（去重、排序）；失败抛 AiProviderError
 */
export async function embed(opts = {}) {
  const { baseURL, apiKey = "", model, texts, signal, timeout = 60000 } = opts;
  if (!model || !Array.isArray(texts) || !texts.length)
    throw new AiProviderError(
      AI_ERROR_CODES.NOT_CONFIGURED,
      "缺少向量模型或文本",
    );
  const url = buildUrl(baseURL).replace(/\/chat\/completions$/, "/embeddings");
  const ctl = new AbortController();
  const abort = () => ctl.abort(signal.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctl.signal,
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: "Bearer " + apiKey } : {}),
      },
      body: JSON.stringify({ model, input: texts }),
    });
    if (!res.ok)
      throwFailure(res.status, extractServerMessage(await res.text()));
    const body = await res.json();
    const data = body.data?.slice().sort((a, b) => a.index - b.index);
    if (
      !data ||
      data.length !== texts.length ||
      data.some(
        (r, i) =>
          r.index !== i ||
          !Array.isArray(r.embedding) ||
          !r.embedding.length ||
          r.embedding.some((x) => !Number.isFinite(x)),
      ) ||
      data.some((r) => r.embedding.length !== data[0].embedding.length)
    )
      throw new AiProviderError(AI_ERROR_CODES.API, "向量响应格式或维度无效");
    return {
      vectors: data.map((r) => r.embedding),
      usage: normalizeUsage(body.usage),
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

export async function listModels(opts = {}) {
  const {
    baseURL,
    apiKey = "",
    timeout = 15000,
    signal = null,
    extraHeaders = {},
  } = opts;
  if (!baseURL || !String(baseURL).trim()) {
    throw new AiProviderError(
      AI_ERROR_CODES.NOT_CONFIGURED,
      "恍然梦未配置：请先在设置中填写 API 地址（baseURL）",
    );
  }
  const base = buildUrl(baseURL).replace(/\/chat\/completions$/, "");
  const url = base + "/models";
  const headers = { ...extraHeaders };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort(new Error("ai-list-timeout"));
  }, timeout);
  const onOuterAbort = () => ctrl.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) ctrl.abort(signal.reason);
    else signal.addEventListener("abort", onOuterAbort, { once: true });
  }

  try {
    let res;
    try {
      res = await fetch(url, { method: "GET", headers, signal: ctrl.signal });
    } catch (err) {
      if (timedOut)
        throw new AiProviderError(
          AI_ERROR_CODES.NETWORK,
          `拉取模型列表超时：${timeout}ms 内未收到响应`,
        );
      if (signal?.aborted) throw err;
      throw new AiProviderError(
        AI_ERROR_CODES.NETWORK,
        `网络请求失败：无法连接 ${hostOf(url)}`,
        { detail: String(err?.message || err) },
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throwFailure(res.status, extractServerMessage(text), text);
    }
    const obj = await res.json().catch(() => null);
    const rows = Array.isArray(obj?.data)
      ? obj.data
      : Array.isArray(obj?.models)
        ? obj.models
        : [];
    const ids = [
      ...new Set(
        rows
          .map((m) => (typeof m === "string" ? m : m?.id || m?.name))
          .filter((s) => typeof s === "string" && s.trim())
          .map((s) => s.trim()),
      ),
    ].sort();
    if (!ids.length) {
      throw new AiProviderError(
        AI_ERROR_CODES.API,
        "服务商未返回任何模型（该地址可能不支持 /models 接口，可手动添加模型名）",
      );
    }
    return ids;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onOuterAbort);
  }
}
