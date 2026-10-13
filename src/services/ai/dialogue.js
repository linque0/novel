import { chatStream } from "./provider";
import { TOOL_REGISTRY, executeTool } from "./tools";
import { fitBlocks, estimate, copy } from "./presets";
import {
  checkAbort,
  chapterHash,
  entityHash,
  resolveEvidence,
  namesOf,
} from "./contracts";

const functionTool = (name, description, properties, required = []) => ({
  type: "function",
  function: {
    name,
    description,
    parameters: {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
  },
});
const text = { type: "string" },
  number = { type: "integer", minimum: 0 },
  queryProps = {
    query: text,
    limit: { ...number, maximum: 50 },
    cursor: number,
  };
export function dialogueTools() {
  const schemas = {
    search_book:{...queryProps,sourceType:text},
    read_document:{docId:text,cursor:number},
    get_book_coverage:queryProps,
    get_related_entities:{entityId:text,depth:{...number,maximum:2},...queryProps},
    get_entity_state:{entityId:text,...queryProps},
    search_chapters: queryProps,
    read_chapter: { chapterId: text, cursor: number },
    get_character: { name: text, characterId: text },
    get_outline_subtree: { nodeId: text, title: text, cursor: number },
    get_lore_subtree: { nodeId: text, title: text, cursor: number },
    list_recent_chapters: { limit: number, cursor: number },
    search_kb: { ...queryProps, kind: text, asOfChapterId: text },
    get_foreshadows: { status: text, asOfChapterId: text, cursor: number },
    get_char_timeline: {
      characterId: text,
      asOfChapterId: text,
      cursor: number,
    },
    locate_evidence: { sourceType: text, sourceId: text, quote: text },
  };
  return [
    ...Object.entries(TOOL_REGISTRY).map(([name, t]) =>
      functionTool(name, t.description, schemas[name]),
    ),
    functionTool(
      "submit_draft",
      "提交完整正文草稿，不能写入作品。讨论和说明不要放入 text。",
      { text, title: text, summary: text },
      ["text"],
    ),
    functionTool(
      "submit_proposal",
      '提交折叠建议。type=outline时 data={name,idea,nodes:[{title,points,purpose,edge:"cause|foreshadow|conflict|"}]}；character时 data={fields,bio,aliases,relations:[{name,label,basis}]}；lore时 data={mode:"add|expand",tree:{text,children:[]},revised,note}。可带 evidence:[{sourceType,sourceId,quote}]，证据必须可定位。新增人物或设定单列 originalProposals，不随关系自动创建。',
      {
        type: { type: "string", enum: ["outline", "character", "lore"] },
        targetId: text,
        data: { type: "object", additionalProperties: true },
      },
      ["type", "targetId", "data"],
    ),
  ];
}
export function makeDraft(
  text,
  frozen,
  { runId, messageId, title = "正文草稿", summary = "", complete = true } = {},
) {
  if (typeof text !== "string" || !text.trim() || text.length > 200000)
    throw new Error("草稿为空或超过20万字");
  return {
    id: crypto.randomUUID(),
    kind: "draft",
    task: "plot",
    text,
    opening: text,
    title,
    summary,
    workId: frozen.workId,
    anchorId: frozen.chapterId,
    anchorLabel: frozen.chapterTitle,
    sourceHash: frozen.sourceHash,
    source: copy(frozen),
    original: frozen.selection || "",
    runId,
    messageId,
    complete,
    status: "pending",
    createdAt: Date.now(),
  };
}
export function proposalFromTool(args, work, frozen, runId) {
  const { type, targetId, data } = args;
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("提案 data 必须为对象");
  const rows = {
    outline: work.olnodes,
    character: work.characters,
    lore: work.mubu,
  }[type];
  const target = rows?.find((r) => r.id === targetId && !r.deletedAt);
  if (!target) throw new Error("提案目标不存在，新增实体必须单独确认");
  const evidence = (data.evidence || []).map((ref) => {
    if (
      ref.sourceType === "chapter" &&
      !frozen.allowedIds.includes(ref.sourceId)
    )
      throw new Error("依据越过本轮章节范围");
    const result = resolveEvidence(ref, work);
    if (!result) throw new Error("依据无法定位");
    return result;
  });
  const base = {
    id: crypto.randomUUID(),
    task: type,
    anchorId: targetId,
    anchorLabel: target.name || target.title || target.text?.slice(0, 30),
    sourceHash: entityHash(target),
    workId: frozen.workId,
    source: copy(frozen),
    runId,
    evidence,
    originalProposals: data.originalProposals || [],
    warnings: [],
    status: "pending",
  };
  if (
    !Array.isArray(base.originalProposals) ||
    base.originalProposals.length > 10 ||
    base.originalProposals.some(
      (p) =>
        !p?.name || !["人物", "设定", "character", "lore"].includes(p.type),
    )
  )
    throw new Error("原创实体格式无效");
  if (type === "outline") {
    if (
      !Array.isArray(data.nodes) ||
      !data.nodes.length ||
      data.nodes.length > 30 ||
      data.nodes.some(
        (n) =>
          !n.title ||
          !["", "cause", "foreshadow", "conflict"].includes(n.edge ?? ""),
      )
    )
      throw new Error("大纲节点或连线无效");
    return {
      ...base,
      kind: "plan",
      name: String(data.name || "大纲建议"),
      idea: String(data.idea || ""),
      nodes: data.nodes.map((n) => ({
        ...n,
        edge: n.edge || "",
        points: String(n.points || ""),
      })),
    };
  }
  if (type === "character") {
    const fields = data.fields || {},
      aliases = data.aliases || [],
      relations = data.relations || [];
    if (
      typeof fields !== "object" ||
      Array.isArray(fields) ||
      Object.values(fields).some((v) => typeof v !== "string") ||
      !Array.isArray(aliases) ||
      aliases.some((v) => typeof v !== "string") ||
      aliases.length > 5 ||
      !Array.isArray(relations) ||
      relations.length > 20
    )
      throw new Error("人物字段格式无效");
    if (
      relations.some(
        (r) =>
          !r.label ||
          work.characters.filter(
            (c) => !c.deletedAt && namesOf(c).includes(r.name),
          ).length !== 1,
      )
    )
      throw new Error("关系人物未登记或有歧义，请单独提出新增实体");
    return {
      ...base,
      kind: "diff",
      subject: "character",
      fields,
      aliases,
      relations,
      bio: String(data.bio || ""),
    };
  }
  if (!["add", "expand"].includes(data.mode)) throw new Error("设定 mode 无效");
  let count = 0;
  const tree = (n, depth = 0) => {
    if (
      !n ||
      typeof n.text !== "string" ||
      depth > 8 ||
      ++count > 200 ||
      (n.children && !Array.isArray(n.children))
    )
      throw new Error("设定树无效");
    return {
      text: n.text,
      children: (n.children || []).map((c) => tree(c, depth + 1)),
    };
  };
  if (data.mode === "expand" && !data.revised)
    throw new Error("替换设定文本为空");
  return {
    ...base,
    kind: "diff",
    subject: "lore",
    mode: data.mode,
    tree: data.mode === "add" ? tree(data.tree) : null,
    revised: String(data.revised || ""),
    note: String(data.note || ""),
  };
}
export async function runDialogue({
  compiled,
  work,
  frozen,
  opts,
  onDelta,
  onUsage,
  onNotice,
  onCard,
  runId,
  messageId,
}) {
  const schemas = compiled.tools ? dialogueTools() : [],
    cache = new Map(),
    groups = [],
    cards = [],
    reports = [];
  let tools = schemas,
    answer = "",
    result,
    base = compiled.blocks.map((b) => ({ ...b }));
  const toolCost = estimate(JSON.stringify(schemas));
  if (
    compiled.opts.toolReserve == null &&
    toolCost +
      estimate(
        JSON.stringify(
          base.filter((b) => b.protected || b.blockId === "chapterAnchor"),
        ),
      ) >
      Math.min(
        compiled.opts.inputBudget,
        compiled.opts.contextWindow || Infinity,
      ) -
        compiled.opts.maxTokens -
        128
  ) {
    tools = [];
    onNotice?.("完整请求预算不足以包含工具，使用普通对话；可将回复转为草稿");
  }
  for (let round = 0; round < 6; round++) {
    checkAbort(opts.signal);
    const finalRound = round === 5;
    const toolReserve = tools.length ? toolCost : 0;
    const fitted = fitBlocks([...base, ...groups.flat()], {
      ...compiled.opts,
      toolReserve,
    });
    reports.push({
      round: round + 1,
      ...fitted.tokens,
      toolDefinitionReserve: toolReserve,
      dropped: fitted.dropped,
    });
    try {
      result = await chatStream(
        {
          ...opts,
          ...compiled.opts,
          messages: fitted.messages,
          tools,
          toolChoice: finalRound ? "none" : "auto",
        },
        (d) => {
          checkAbort(opts.signal);
          answer += d;
          onDelta?.(d);
        },
      );
    } catch (e) {
      checkAbort(opts.signal);
      if (
        compiled.continuationPrefill &&
        [400, 422].includes(e.status) &&
        /assistant|prefill|last.*message/i.test(
          String(e.message) + String(e.detail),
        )
      ) {
        compiled.continuationPrefill = false;
        base.push({
          role: "system",
          content: compiled.continueNudge,
          protected: true,
          kind: "prompt",
          blockId: "prefillFallback",
        });
        onNotice?.("服务商不支持 assistant prefill，已降级为续写提示");
        round--;
        continue;
      }
      if (
        tools.length &&
        [400, 422].includes(e.status) &&
        /tool|function/i.test(String(e.message) + String(e.detail))
      ) {
        tools = [];
        onNotice?.(
          "当前服务商不支持工具，使用普通对话；可选择回复转为正文草稿",
        );
        result = await chatStream(
          { ...opts, ...compiled.opts, messages: fitted.messages },
          (d) => {
            checkAbort(opts.signal);
            answer += d;
            onDelta?.(d);
          },
        );
      } else throw e;
    }
    checkAbort(opts.signal);
    onUsage?.(
      result.usage || {
        prompt_tokens: fitted.tokens.used + (tools.length ? toolReserve : 0),
        completion_tokens:
          estimate(result.text) +
          estimate(JSON.stringify(result.toolCalls || [])),
        total_tokens:
          fitted.tokens.used +
          (tools.length ? toolReserve : 0) +
          estimate(result.text) +
          estimate(JSON.stringify(result.toolCalls || [])),
        estimated: true,
      },
    );
    if (result.finishReason === "length") {
      for (const call of result.toolCalls || [])
        if (call.function?.name === "submit_draft") {
          try {
            const args = JSON.parse(call.function.arguments);
            const card = makeDraft(args.text, frozen, {
              runId,
              messageId,
              title: args.title,
              summary: args.summary,
              complete: false,
            });
            cards.push(card);
            onCard?.(card);
          } catch {
            /* incomplete raw arguments remain visible in the conversation */
          }
        }
      break;
    }
    if (!result.toolCalls?.length || finalRound) break;
    if (result.toolCalls.length > 8) throw new Error("单轮工具请求超过8次");
    const group = [
      {
        role: "assistant",
        content: result.text || "",
        tool_calls: result.toolCalls,
        protected: true,
      },
    ];
    for (const call of result.toolCalls) {
      checkAbort(opts.signal);
      let response;
      try {
        const args = JSON.parse(call.function.arguments || "{}"),
          name = call.function.name;
        if (name === "submit_draft") {
          const draft = makeDraft(args.text, frozen, {
            runId,
            messageId,
            title: args.title,
            summary: args.summary,
          });
          cards.push(draft);
          onCard?.(draft);
          response = {
            ok: true,
            draftId: draft.id,
            status: "等待作者确认，尚未保存",
          };
        } else if (name === "submit_proposal") {
          const card = proposalFromTool(args, work, frozen, runId);
          cards.push(card);
          response = { ok: true, proposalId: card.id, status: "待作者确认" };
        } else {
          const key = JSON.stringify([name, args]);
          response = cache.get(key);
          if (!response) {
            response = await executeTool(name, args, {
              work,
              privacy: opts.privacy,
              asOfChapterId: frozen.asOfChapterId,
              sourceRevision: frozen.bookRevision,
              signal:opts.signal,
            });
            cache.set(key, response);
            for (const version of [...(response.items || []), response].flatMap((item)=>item.sourceVersions || []))
              if (!frozen.sourceVersions.some((v)=>v.table===version.table&&v.id===version.id)) frozen.sourceVersions.push(version);
            for (const item of [...(response.items || []), response])
              for (const id of [item.id, item.chapterId, item.sourceId].filter(
                Boolean,
              )) {
                for (const table of [
                  "chapters",
                  "characters",
                  "mubu",
                  "olnodes",
                  "snippets", "annotations", "relations", "outlines", "lore", "lorecats", "volumes",
                ]) {
                  const row = work[table]?.find((r) => r.id === id);
                  if (
                    row &&
                    !frozen.sourceVersions.some(
                      (v) => v.table === table && v.id === id,
                    )
                  )
                    frozen.sourceVersions.push({
                      table,
                      id,
                      hash:
                        table === "chapters"
                          ? chapterHash(row)
                          : entityHash(row),
                    });
                }
              }
          }
        }
      } catch (e) {
        response = { error: e.message };
      }
      group.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(response),
        protected: true,
      });
    }
    groups.push(group);
    // Evict entire old tool turns, keeping call/result pairs intact.
    const cap =
      Math.min(
        compiled.opts.inputBudget,
        compiled.opts.contextWindow || Infinity,
      ) -
      compiled.opts.maxTokens -
      toolCost -
      128;
    const cost = () => estimate(JSON.stringify([...base, ...groups.flat()]));
    while (cost() > cap && groups.length > 1) {
      groups.shift();
      onNotice?.("已裁剪较早的完整工具轮次");
    }
    if (cost() > cap) {
      base = base.filter((b) => b.protected || b.blockId === "chapterAnchor");
      if (cost() > cap) {
        groups.length = 0;
        tools = [];
        onNotice?.("工具结果超过预算，结束检索并使用已装配材料回答");
      }
    }
  }
  checkAbort(opts.signal);
  const complete = result?.finishReason === "stop";
  // Length-limited final answers must never produce applicable partial cards.
  if (!complete)
    cards.forEach((c) => {
      c.complete = false;
      c.status = "incomplete";
    });
  return {
    answer: answer || (cards.length ? "已生成折叠提案，请展开查看。" : ""),
    cards,
    complete,
    finishReason: result?.finishReason,
    reports,
    preset: compiled.presetSnapshot,
  };
}
