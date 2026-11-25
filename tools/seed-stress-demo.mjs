/**
 * 《压力测试》演示作品幂等灌库与全模块验收脚本。
 *
 * 工程守则：
 * - 仅连接已运行的 dev 实例（127.0.0.1:5173，CDP 9222），严禁触碰正式库或新建 profile；
 * - 严格保持《压力测试》原有 1,009 条 mubu 设定节点一字不动，完全兼容既有压测脚本；
 * - 清理并重建其余演示数据（卷/章/正文双链与批注/大纲画布/人物与关系/设定关联 lorelinks/
 *   灵感拼板/90 天字数日志/回收站样本），分批落盘并等待 autosave + library-sync 一致。
 *
 * 用法：
 *   node tools/seed-stress-demo.mjs --dry-check    # 本地离线校验数据、字数与语义标记（不连 CDP）
 *   node tools/seed-stress-demo.mjs --inspect      # 只读检查 dev《压力测试》当前各表数量
 *   node tools/seed-stress-demo.mjs --verify-only  # 仅验收已写入的数据与五大模块渲染
 *   node tools/seed-stress-demo.mjs                # 幂等写入并执行全套验收
 */
import assert from 'node:assert/strict'
import { connect } from './_cdp-lib.mjs'
import {
  WORK_META,
  LORE_ANCHORS,
  CHARACTERS,
  RELATIONS,
  CHAR_GRAPH_LAYOUT,
  LORELINK_SPECS
} from './stress-demo-data/meta-and-chars.mjs'
import { VOL1_TITLE, VOL1_CHAPTERS } from './stress-demo-data/chapters-vol1.mjs'
import { VOL2_TITLE, VOL2_CHAPTERS } from './stress-demo-data/chapters-vol2.mjs'
import { VOL3_TITLE, VOL3_CHAPTERS } from './stress-demo-data/chapters-vol3.mjs'
import { OUTLINE_CANVAS, SNIPPETS, TRASH_SAMPLES } from './stress-demo-data/outline-and-snippets.mjs'

const TARGET_TITLE = '压力测试'
const EXPECTED_MUBU_COUNT = 1009
const EXPECTED_MUBU_ROOTS = ['现实模版', '虚构国度', '设定']

const ANNOTATION_COLORS = {
  revise: '#c0392b',
  query: '#2980b9',
  foreshadow: '#8e44ad',
  idea: '#27ae60',
  research: '#d35400',
  todo: '#7f8c8d'
}

const VOLUMES = [VOL1_TITLE, VOL2_TITLE, VOL3_TITLE]
const CHAPTERS = [...VOL1_CHAPTERS, ...VOL2_CHAPTERS, ...VOL3_CHAPTERS]

const args = process.argv.slice(2)
const dryCheck = args.includes('--dry-check')
const inspectOnly = args.includes('--inspect')
const verifyOnly = args.includes('--verify-only')

function stripTokens(text) {
  return String(text || '')
    .replace(/\{\{(?:char|lore):([^|}]+)\|([^}]+)\}\}/g, '$2')
    .replace(/\{\{(?:char|lore):([^}]+)\}\}/g, '$1')
    .replace(/\{\{note:[^|]+\|([^}]+)\}\}/g, '$1')
}

function countChars(str) {
  return String(str || '').replace(/\s+/g, '').length
}

/** 离线静态校验：检查所有引用键、批注键、无嵌套标记及章节字数统计 */
function runLocalChecks() {
  const charNames = new Set(CHARACTERS.map((c) => c.name))
  const loreKeys = new Set(Object.keys(LORE_ANCHORS))
  const volSet = new Set(VOLUMES)
  const chTitles = new Set(CHAPTERS.map((c) => c.title))

  let totalWords = 0
  let totalDl = 0
  let totalNotes = 0
  const usedNoteKinds = new Set()
  const perChapter = []

  for (const ch of CHAPTERS) {
    assert.ok(volSet.has(ch.volume), `未知卷名：${ch.volume}`)
    const annMap = new Map((ch.annotations || []).map((a) => [a.key, a]))
    const seenAnn = new Set()
    let chWords = 0

    for (const p of ch.paragraphs) {
      // 检查禁止嵌套标记
      assert.ok(!/\{\{note:[^}]*\{\{/.test(p), `章节「${ch.title}」存在嵌套标记：${p.slice(0, 60)}`)
      for (const m of p.matchAll(/\{\{char:([^|}]+)(?:\|([^}]+))?\}\}/g)) {
        assert.ok(charNames.has(m[1]), `章节「${ch.title}」引用了未知人物：${m[1]}`)
        totalDl++
      }
      for (const m of p.matchAll(/\{\{lore:([^|}]+)(?:\|([^}]+))?\}\}/g)) {
        assert.ok(loreKeys.has(m[1]), `章节「${ch.title}」引用了未知设定锚点：${m[1]}`)
        totalDl++
      }
      for (const m of p.matchAll(/\{\{note:([^|]+)\|([^}]+)\}\}/g)) {
        const ann = annMap.get(m[1])
        assert.ok(ann, `章节「${ch.title}」引用了未定义批注键：${m[1]}`)
        assert.ok(ANNOTATION_COLORS[ann.kind], `未知批注类型：${ann.kind}`)
        seenAnn.add(m[1])
        usedNoteKinds.add(ann.kind)
        totalNotes++
      }
      chWords += countChars(stripTokens(p))
    }
    for (const k of annMap.keys()) {
      assert.ok(seenAnn.has(k), `章节「${ch.title}」定义了未使用的批注键：${k}`)
    }
    totalWords += chWords
    perChapter.push({ title: ch.title, words: chWords })
  }

  for (const [from, to] of RELATIONS) {
    assert.ok(charNames.has(from) && charNames.has(to), `关系引用未知人物：${from} -> ${to}`)
  }
  for (const name of charNames) {
    assert.ok(CHAR_GRAPH_LAYOUT[name], `人物关系图缺少坐标：${name}`)
  }
  for (const lk of LORELINK_SPECS) {
    for (const end of [lk.from, lk.to]) {
      if (end[0] === 'character') assert.ok(charNames.has(end[1]), `lorelink 引用未知人物：${end[1]}`)
      if (end[0] === 'mubu') assert.ok(loreKeys.has(end[1]), `lorelink 引用未知设定锚点：${end[1]}`)
    }
  }
  for (const cite of OUTLINE_CANVAS.cites) {
    assert.ok(loreKeys.has(cite.anchor), `大纲引用卡引用未知设定锚点：${cite.anchor}`)
  }
  for (const chA of OUTLINE_CANVAS.chapters) {
    assert.ok(chTitles.has(chA.title), `大纲章锚点引用未知章节：${chA.title}`)
  }
  for (const sn of SNIPPETS) {
    for (const ln of sn.links || []) {
      if (ln.kind === 'chapter') assert.ok(chTitles.has(ln.ref), `灵感引用未知章节：${ln.ref}`)
      if (ln.kind === 'character') assert.ok(charNames.has(ln.ref), `灵感引用未知人物：${ln.ref}`)
      if (ln.kind === 'mubu') assert.ok(loreKeys.has(ln.ref), `灵感引用未知设定锚点：${ln.ref}`)
    }
  }

  const outlineNodeCount =
    OUTLINE_CANVAS.volumes.length +
    OUTLINE_CANVAS.chapters.length +
    OUTLINE_CANVAS.events.length +
    OUTLINE_CANVAS.cites.length +
    OUTLINE_CANVAS.notes.length +
    1 + // textbox
    OUTLINE_CANVAS.containers.length +
    OUTLINE_CANVAS.containers.reduce((s, g) => s + g.children.length, 0)

  return {
    volumes: VOLUMES.length,
    chapters: CHAPTERS.length,
    totalWords,
    perChapter,
    totalDl,
    totalNotes,
    usedNoteKinds: [...usedNoteKinds],
    characters: CHARACTERS.length,
    relations: RELATIONS.length,
    lorelinks: LORELINK_SPECS.length,
    outlineNodeCount,
    outlineEdges: OUTLINE_CANVAS.edges.length,
    snippets: SNIPPETS.length
  }
}

const localStats = runLocalChecks()
console.log('本地静态校验通过:', JSON.stringify({
  volumes: localStats.volumes,
  chapters: localStats.chapters,
  totalWords: localStats.totalWords,
  totalDl: localStats.totalDl,
  totalNotes: localStats.totalNotes,
  usedNoteKinds: localStats.usedNoteKinds,
  characters: localStats.characters,
  relations: localStats.relations,
  lorelinks: localStats.lorelinks,
  outlineNodes: localStats.outlineNodeCount,
  outlineEdges: localStats.outlineEdges,
  snippets: localStats.snippets
}, null, 2))

if (dryCheck) {
  console.log('逐章字数明细:')
  for (const c of localStats.perChapter) console.log(`  - ${c.title}: ${c.words} 字`)
  process.exit(0)
}

// ---------------- 连接 dev 实例 ----------------
const c = await connect('127.0.0.1:5173')
await c.sleep(400)

const envInfo = await c.evalx(`(() => ({
  href: location.href,
  dev: typeof window.__ns === 'object',
  visibility: document.visibilityState
}))()`)
assert.ok(envInfo?.href?.includes('127.0.0.1:5173'), '当前页面不是 dev 实例（127.0.0.1:5173）：' + JSON.stringify(envInfo))
assert.ok(envInfo.dev, '缺少 window.__ns 调试钩子')
console.log('已连接 dev 实例:', envInfo.href, 'visibility:', envInfo.visibility)

await c.evalx(`(() => {
  window.__demoSeedErrors = [];
  window.addEventListener('error', (e) => window.__demoSeedErrors.push('error: ' + (e.message || e.error)));
  window.addEventListener('unhandledrejection', (e) => window.__demoSeedErrors.push('rejection: ' + (e.reason?.message || e.reason)));
  return true;
})()`)

async function probeWork() {
  return c.evalx(`(async () => {
    const { db } = window.__ns;
    const target = (await db.works.toArray()).find((w) => !w.deletedAt && w.title === ${JSON.stringify(TARGET_TITLE)});
    if (!target) return { found: false };
    const wid = target.id;
    const live = async (tbl) => (await db[tbl].where('workId').equals(wid).toArray().catch(() => [])).filter((r) => !r.deletedAt);
    const trash = async (tbl) => (await db[tbl].where('workId').equals(wid).toArray().catch(() => [])).filter((r) => !!r.deletedAt);
    const mubu = await live('mubu');
    const roots = mubu.filter((n) => !n.parentId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map((n) => n.text);
    const chapters = await live('chapters');
    const totalWords = chapters.reduce((s, ch) => s + (ch.wordCount || 0), 0);
    return {
      found: true,
      workId: wid,
      meta: { title: target.title, author: target.author, genre: target.genre, status: target.status, introLen: (target.intro || '').length },
      mubuCount: mubu.length,
      mubuRoots: roots,
      counts: {
        volumes: (await live('volumes')).length,
        chapters: chapters.length,
        totalWords,
        olnodes: (await live('olnodes')).length,
        characters: (await live('characters')).length,
        relations: (await db.relations.where('workId').equals(wid).toArray()).length,
        lorelinks: (await db.lorelinks.where('workId').equals(wid).toArray()).length,
        snippets: (await live('snippets')).length,
        annotations: (await live('annotations')).length,
        wordlog: (await db.wordlog.where('workId').equals(wid).toArray()).length,
        trashChapters: (await trash('chapters')).length,
        trashCharacters: (await trash('characters')).length,
        trashSnippets: (await trash('snippets')).length
      }
    };
  })()`)
}

const before = await probeWork()
assert.ok(before?.found, `dev 库中找不到作品《${TARGET_TITLE}》`)
console.log('当前《压力测试》状态:', JSON.stringify(before, null, 2))
if (inspectOnly) process.exit(0)

// 硬约束：导入前必须已有完整 1,009 条《浮世地域集》设定
assert.equal(before.mubuCount, EXPECTED_MUBU_COUNT, `原设定节点数应为 ${EXPECTED_MUBU_COUNT}，实际 ${before.mubuCount}`)
assert.deepEqual(before.mubuRoots, EXPECTED_MUBU_ROOTS, `原设定顶层节点应为 ${JSON.stringify(EXPECTED_MUBU_ROOTS)}`)

if (!verifyOnly) {
  const payload = {
    workId: before.workId,
    meta: WORK_META,
    anchors: LORE_ANCHORS,
    volumes: VOLUMES,
    chapters: CHAPTERS,
    characters: CHARACTERS,
    relations: RELATIONS,
    charGraphLayout: CHAR_GRAPH_LAYOUT,
    lorelinks: LORELINK_SPECS,
    outlineCanvas: OUTLINE_CANVAS,
    snippets: SNIPPETS,
    trashSamples: TRASH_SAMPLES,
    annotationColors: ANNOTATION_COLORS
  }

  const seedRes = await c.evalx(`(async () => {
    const P = ${JSON.stringify(payload)};
    const { db, uid, now, countWords } = window.__ns;
    const app = document.querySelector('#app').__vue_app__;
    const pinia = app.config.globalProperties.$pinia;
    const work = pinia._s.get('work');
    const shelf = pinia._s.get('shelf');
    const ui = pinia._s.get('ui');
    const lib = window.__ns.library;
    const hasLib = lib && typeof lib.libraryAvailable === 'function' && lib.libraryAvailable();
    const wid = P.workId;
    const t = now();

    const pace = async (ms = 240) => {
      if (hasLib) await new Promise((r) => setTimeout(r, ms));
    };

    const bulkPutPaced = async (table, rows, batch = 35) => {
      for (let i = 0; i < rows.length; i += batch) {
        await db[table].bulkPut(rows.slice(i, i + batch));
        await pace(220);
      }
    };

    const clearTableForWork = async (table) => {
      const old = await db[table].where('workId').equals(wid).toArray().catch(() => []);
      if (!old.length) return;
      const ids = old.map((r) => r.id);
      for (let i = 0; i < ids.length; i += 35) {
        await db[table].bulkDelete(ids.slice(i, i + 35));
        await pace(220);
      }
    };

    // 1. 解析并锁定全部既有 mubu 锚点（只读，绝不改动 mubu 表）
    const mubuRows = (await db.mubu.where('workId').equals(wid).toArray()).filter((n) => !n.deletedAt);
    const mubuById = new Map(mubuRows.map((n) => [n.id, n]));
    const pathOf = (n) => {
      const parts = [];
      let cur = n, g = 0;
      while (cur && g++ < 25) {
        parts.unshift(String(cur.text || '').trim());
        cur = cur.parentId ? mubuById.get(cur.parentId) : null;
      }
      return parts.join(' > ');
    };
    const indexedMubu = mubuRows.map((n) => ({
      id: n.id,
      text: String(n.text || '').trim(),
      path: pathOf(n),
      depth: pathOf(n).split(' > ').length
    }));

    const loreIds = {};
    const loreTitles = {};
    const missingAnchors = [];
    for (const [key, rule] of Object.entries(P.anchors)) {
      const hits = indexedMubu.filter((n) => {
        if (rule.exactText && n.text !== rule.exactText) return false;
        if (rule.textIncludes && !n.text.includes(rule.textIncludes)) return false;
        if (rule.pathIncludes && !rule.pathIncludes.every((seg) => n.path.includes(seg))) return false;
        return true;
      });
      if (!hits.length) {
        missingAnchors.push(key);
        continue;
      }
      // 优先选择层级最浅、标题最紧凑的规范定义节点
      hits.sort((a, b) => a.depth - b.depth || a.text.length - b.text.length);
      loreIds[key] = hits[0].id;
      loreTitles[key] = hits[0].text;
    }
    if (missingAnchors.length) {
      return { ok: false, err: '未能匹配以下设定锚点：' + JSON.stringify(missingAnchors) };
    }

    // 2. 幂等清理旧非 mubu 数据（绝不清理 mubu 与 assets）
    const tablesToClear = ['volumes', 'chapters', 'outlines', 'olnodes', 'characters', 'relations', 'lorelinks', 'snippets', 'annotations', 'wordlog', 'bookmarks'];
    for (const tbl of tablesToClear) {
      await clearTableForWork(tbl);
    }

    // 3. 更新作品元信息（严格保留书名「压力测试」）
    const existingWork = await db.works.get(wid);
    await db.works.put({
      ...existingWork,
      title: P.meta.title,
      author: P.meta.author,
      genre: P.meta.genre,
      status: P.meta.status,
      intro: P.meta.intro,
      kind: P.meta.kind || 'novel',
      lastOpenedAt: t,
      updatedAt: t
    });
    await pace(180);

    // 保留空主大纲，禁止触发旧版 outlines -> olnodes 迁移
    await db.outlines.add({ id: uid(), workId: wid, level: 'master', refId: wid, content: '', updatedAt: t });

    // 4. 写入人物（15 活 + 1 回收站）
    const charIds = {};
    const charRows = [];
    for (let i = 0; i < P.characters.length; i++) {
      const cSpec = P.characters[i];
      const cid = uid();
      charIds[cSpec.name] = cid;
      charRows.push({
        id: cid,
        workId: wid,
        name: cSpec.name,
        aliases: cSpec.aliases || '',
        role: cSpec.role,
        tags: cSpec.tags || [],
        fields: cSpec.fields || {},
        avatarAssetId: null,
        content: cSpec.content || '',
        createdAt: t - (P.characters.length - i) * 3600000,
        updatedAt: t - (P.characters.length - i) * 1800000,
        deletedAt: null,
        __defaultsSeeded: true
      });
    }
    const trashT = t - 3 * 86400000;
    const trChar = P.trashSamples.character;
    charRows.push({
      id: uid(),
      workId: wid,
      name: trChar.name,
      aliases: trChar.aliases || '',
      role: trChar.role || '龙套',
      tags: trChar.tags || [],
      fields: trChar.fields || {},
      avatarAssetId: null,
      content: trChar.content || '',
      createdAt: trashT,
      updatedAt: trashT,
      deletedAt: trashT,
      __defaultsSeeded: true
    });
    await bulkPutPaced('characters', charRows);

    // 5. 写入人物关系（24 条）
    const relRows = P.relations.map(([from, to, label, fromSide, toSide, color, style]) => ({
      id: uid(),
      workId: wid,
      fromId: charIds[from],
      toId: charIds[to],
      label,
      notes: '',
      fromSide: fromSide || 'right',
      toSide: toSide || 'left',
      color: color || '',
      style: style || '',
      updatedAt: t
    }));
    await bulkPutPaced('relations', relRows);

    // 6. 写入设定关联 lorelinks（32 条）
    const resolveLinkEnd = ([kind, key]) => {
      if (kind === 'character') return { kind: 'character', id: charIds[key] };
      return { kind: 'mubu', id: loreIds[key] };
    };
    const lorelinkRows = P.lorelinks.map((lk, idx) => {
      const a = resolveLinkEnd(lk.from);
      const b = resolveLinkEnd(lk.to);
      return {
        id: uid(),
        workId: wid,
        fromKind: a.kind,
        fromId: a.id,
        toKind: b.kind,
        toId: b.id,
        label: lk.label,
        reverseLabel: lk.reverseLabel || '',
        description: lk.description || '',
        color: lk.color || '',
        createdAt: t - (P.lorelinks.length - idx) * 60000,
        updatedAt: t - (P.lorelinks.length - idx) * 60000
      };
    });
    await bulkPutPaced('lorelinks', lorelinkRows);

    // 7. 写入卷与章节（3 卷 12 活章 + 1 回收站废稿章）+ 同步编译双链与批注
    const volIds = {};
    const volRows = P.volumes.map((title, i) => {
      const vid = uid();
      volIds[title] = vid;
      return { id: vid, workId: wid, title, sortOrder: i, createdAt: t - (3 - i) * 86400000, updatedAt: t, deletedAt: null };
    });
    await bulkPutPaced('volumes', volRows);

    const escAttr = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const dlHtml = (kind, id, title, label) =>
      '<span class="dl-link" data-dl-target="' + kind + ':' + id + '" data-dl-title="' + escAttr(title) + '">' + label + '</span>';
    const noteHtml = (noteId, color, text) =>
      '<span class="note-mark" data-note-id="' + noteId + '" data-note-color="' + color + '" style="--note-color:' + color + '">' + text + '</span>';

    const chIds = {};
    const chOrder = {};
    const chRows = [];
    const annRows = [];
    let compiledDlCount = 0;

    for (let i = 0; i < P.chapters.length; i++) {
      const ch = P.chapters[i];
      const cid = uid();
      chIds[ch.title] = cid;
      chOrder[ch.volume] = chOrder[ch.volume] || 0;
      const annByKey = new Map((ch.annotations || []).map((a) => [a.key, a]));
      const at = t - (P.chapters.length - i) * 86400000;

      const htmlParts = ch.paragraphs.map((raw) => {
        let s = raw;
        s = s.replace(/\\{\\{char:([^|}]+)(?:\\|([^}]+))?\\}\\}/g, (_, name, label) => {
          compiledDlCount++;
          return dlHtml('character', charIds[name], name, label || name);
        });
        s = s.replace(/\\{\\{lore:([^|}]+)(?:\\|([^}]+))?\\}\\}/g, (_, key, label) => {
          compiledDlCount++;
          return dlHtml('mubu', loreIds[key], loreTitles[key], label || key);
        });
        s = s.replace(/\\{\\{note:([^|]+)\\|([^}]+)\\}\\}/g, (_, key, excerpt) => {
          const spec = annByKey.get(key);
          const noteId = uid();
          const color = P.annotationColors[spec.kind] || '#c0392b';
          annRows.push({
            id: uid(),
            workId: wid,
            chapterId: cid,
            noteId,
            text: excerpt,
            note: spec.note,
            color,
            kind: spec.kind,
            createdAt: at + 3600000,
            updatedAt: at + 3600000,
            deletedAt: null
          });
          return noteHtml(noteId, color, excerpt);
        });
        return '<p>' + s + '</p>';
      });

      const html = htmlParts.join('');
      const plain = html.replace(/<[^>]+>/g, '');
      chRows.push({
        id: cid,
        workId: wid,
        volumeId: volIds[ch.volume],
        title: ch.title,
        fmt: 'html',
        content: html,
        wordCount: countWords(plain),
        status: ch.status || 'draft',
        sortOrder: chOrder[ch.volume]++,
        createdAt: at,
        updatedAt: at,
        deletedAt: null
      });
    }

    // 回收站废稿章节
    const trCh = P.trashSamples.chapter;
    chRows.push({
      id: uid(),
      workId: wid,
      volumeId: volIds[trCh.volumeTitle],
      title: trCh.title,
      fmt: 'html',
      content: trCh.html,
      wordCount: countWords(trCh.html.replace(/<[^>]+>/g, '')),
      status: trCh.status || 'draft',
      sortOrder: 99,
      createdAt: trashT,
      updatedAt: trashT,
      deletedAt: trashT
    });
    await bulkPutPaced('chapters', chRows, 6);
    await bulkPutPaced('annotations', annRows);

    // 8. 写入大纲自由画布（36 节点 + 3 容器 + 语义连线）
    const olNodes = [];
    const keyToNodeId = {};
    const pushNode = (key, spec) => {
      const id = uid();
      if (key) keyToNodeId[key] = id;
      olNodes.push({
        id,
        workId: wid,
        parentId: null,
        refId: null,
        kind: 'event',
        title: '',
        text: '',
        html: null,
        fold: false,
        sortOrder: olNodes.length * 1000,
        canvasX: 0,
        canvasY: 0,
        w: null,
        h: null,
        shape: 'process',
        pin: false,
        status: 'planned',
        rels: [],
        deletedAt: null,
        createdAt: t,
        updatedAt: t,
        ...spec
      });
      return id;
    };

    const cv = P.outlineCanvas;
    for (const v of cv.volumes) {
      pushNode(v.key, { kind: 'volume', refId: volIds[v.title], title: v.title, canvasX: v.x, canvasY: v.y, w: v.w, h: v.h });
    }
    for (const ca of cv.chapters) {
      pushNode(ca.key, { kind: 'anchor', refId: chIds[ca.title], title: ca.title, canvasX: ca.x, canvasY: ca.y, w: ca.w, h: ca.h });
    }
    for (const ev of cv.events) {
      pushNode(ev.key, { kind: 'event', title: ev.title, shape: ev.shape, text: ev.text, status: ev.status, canvasX: ev.x, canvasY: ev.y, w: ev.w, h: ev.h });
    }
    for (const ci of cv.cites) {
      pushNode(ci.key, { kind: 'cite', refId: 'mubu:' + loreIds[ci.anchor], title: ci.title, canvasX: ci.x, canvasY: ci.y, w: ci.w, h: ci.h });
    }
    for (const nt of cv.notes) {
      pushNode(nt.key, { kind: 'note', title: nt.title, text: nt.text, canvasX: nt.x, canvasY: nt.y, w: nt.w, h: nt.h });
    }
    pushNode(cv.textbox.key, { kind: 'textbox', title: '', text: cv.textbox.text, canvasX: cv.textbox.x, canvasY: cv.textbox.y, w: cv.textbox.w, h: cv.textbox.h });
    for (const g of cv.containers) {
      const gid = pushNode(g.key, { kind: 'container', title: g.title, canvasX: g.x, canvasY: g.y, w: g.w, h: g.h });
      g.children.forEach((child, idx) => {
        pushNode(null, {
          kind: 'note',
          parentId: gid,
          title: child.title,
          text: child.text,
          canvasX: g.x + child.dx,
          canvasY: g.y + child.dy,
          w: child.w,
          h: child.h,
          sortOrder: idx
        });
      });
    }
    for (const [fromKey, toKey, relOpts] of cv.edges) {
      const fn = olNodes.find((n) => n.id === keyToNodeId[fromKey]);
      const toId = keyToNodeId[toKey];
      if (!fn || !toId) continue;
      fn.rels.push({
        id: uid(),
        toId,
        label: '',
        kind: '关联',
        arrows: '->',
        style: '',
        fromSide: 'right',
        toSide: 'left',
        ...relOpts
      });
    }
    await bulkPutPaced('olnodes', olNodes);

    // 9. 写入灵感拼板（22 活 + 2 回收站）
    const snipRows = [];
    const resolveSnipLink = (ln) => {
      if (ln.kind === 'chapter') return { kind: 'chapter', id: chIds[ln.ref] };
      if (ln.kind === 'character') return { kind: 'character', id: charIds[ln.ref] };
      return { kind: 'mubu', id: loreIds[ln.ref] };
    };
    for (let i = 0; i < P.snippets.length; i++) {
      const sn = P.snippets[i];
      const at = t - i * 5400000;
      snipRows.push({
        id: uid(),
        workId: wid,
        content: sn.title + '\\n\\n' + sn.body,
        tags: sn.tags || [],
        cardColor: sn.cardColor || 'default',
        links: (sn.links || []).map(resolveSnipLink),
        createdAt: at,
        updatedAt: at,
        deletedAt: null
      });
    }
    for (let i = 0; i < P.trashSamples.snippets.length; i++) {
      const ts = P.trashSamples.snippets[i];
      snipRows.push({
        id: uid(),
        workId: wid,
        content: ts.title + '\\n\\n' + ts.body,
        tags: ts.tags || [],
        cardColor: ts.cardColor || 'default',
        links: [],
        createdAt: trashT - i * 3600000,
        updatedAt: trashT - i * 3600000,
        deletedAt: trashT
      });
    }
    await bulkPutPaced('snippets', snipRows);

    // 10. 写入近 90 天写作分析日志（wordlog）
    const liveChIds = P.chapters.map((ch) => chIds[ch.title]);
    const localDateOffset = (daysAgo) => {
      const d = new Date(t - daysAgo * 86400000);
      const p = (n) => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    };
    const wordlogRows = [];
    for (let d = 89; d >= 0; d--) {
      // 模拟真实作者节奏：约 18% 休整日，其余每日 1~3 次写作会话
      if (d > 5 && ((d * 17 + 3) % 11 === 0 || (d * 13 + 7) % 19 === 0)) continue;
      const sessions = d < 14 ? (1 + (d % 3)) : (1 + ((d * 7) % 2));
      const date = localDateOffset(d);
      for (let k = 0; k < sessions; k++) {
        const delta = 260 + ((d * 193 + k * 541) % 1180);
        const chIdx = Math.min(liveChIds.length - 1, Math.floor(((89 - d) / 90) * liveChIds.length + k) % liveChIds.length);
        wordlogRows.push({
          id: uid(),
          workId: wid,
          chapterId: liveChIds[chIdx],
          date,
          delta,
          createdAt: t - d * 86400000 - (sessions - k) * 7200000
        });
      }
    }
    await bulkPutPaced('wordlog', wordlogRows);

    // 11. 写入画布/关系图持久化配置（保护便签不被迁移、关系图坐标整齐落位）
    const charGraph = {};
    for (const [name, pos] of Object.entries(P.charGraphLayout)) {
      if (charIds[name]) charGraph[charIds[name]] = pos;
    }
    await db.appconfig.bulkPut([
      { key: 'olnodes-mig:' + wid, value: 1 },
      { key: 'olnodes-mig2:' + wid, value: 1 },
      { key: 'olcanvas:' + wid, value: { snap: true, density: 'detail', edgeStyle: 'ortho', edgeWidth: 1.8, arrowSize: 1 } },
      { key: 'charGraph:' + wid, value: charGraph }
    ]);
    await db.appconfig.delete('charCamera:' + wid).catch(() => {});

    // 12. 刷新书架、重新打开作品并等待落盘与作品库同步一致
    await window.__flushNow?.();
    let guard = 0;
    while ((ui.autosave.saving || ui.autosave.pending > 0) && guard++ < 120) {
      await new Promise((r) => setTimeout(r, 150));
    }

    let libSyncOk = true;
    let libCounts = null;
    if (hasLib) {
      let lg = 0;
      while (lg++ < 60) {
        const snap = await lib.librarySnapshot();
        const data = snap?.data || {};
        const countLive = (arr) => (arr || []).filter((r) => r && r.workId === wid && !r.deletedAt).length;
        const countAll = (arr) => (arr || []).filter((r) => r && r.workId === wid).length;
        libCounts = {
          mubu: countLive(data.mubu),
          chapters: countLive(data.chapters),
          characters: countLive(data.characters),
          olnodes: countLive(data.olnodes),
          lorelinks: countAll(data.lorelinks),
          snippets: countLive(data.snippets),
          annotations: countLive(data.annotations)
        };
        if (
          libCounts.mubu === 1009 &&
          libCounts.chapters === P.chapters.length &&
          libCounts.characters === P.characters.length &&
          libCounts.olnodes === olNodes.length &&
          libCounts.lorelinks === lorelinkRows.length &&
          libCounts.snippets === P.snippets.length &&
          libCounts.annotations === annRows.length
        ) {
          break;
        }
        await new Promise((r) => setTimeout(r, 350));
      }
    }

    await shelf.refresh();
    await work.open(wid);
    ui.view = 'work';
    work.tab = 'chapters';

    return {
      ok: true,
      compiledDlCount,
      wordlogCount: wordlogRows.length,
      libCounts,
      autosavePending: ui.autosave.pending,
      autosaveError: ui.autosave.error
    };
  })()`)

  assert.ok(seedRes && !seedRes.PAGE_ERR && seedRes.ok, '写入失败：' + JSON.stringify(seedRes))
  console.log('写入完成:', JSON.stringify(seedRes, null, 2))
  assert.equal(seedRes.autosavePending, 0, 'autosave 应已全部落盘')
  assert.equal(seedRes.autosaveError, null, 'autosave 不应报错')
}

// ---------------- 全模块落盘与界面切换验收 ----------------
const after = await probeWork()
console.log('写入后《压力测试》复核:', JSON.stringify(after, null, 2))

assert.equal(after.mubuCount, EXPECTED_MUBU_COUNT, '原有 1,009 条设定节点必须完整无损')
assert.deepEqual(after.mubuRoots, EXPECTED_MUBU_ROOTS, '原有 3 个顶层设定集必须完整无损')
assert.equal(after.counts.volumes, 3, '应有 3 卷')
assert.equal(after.counts.chapters, 12, '应有 12 活章')
assert.ok(after.counts.totalWords >= 20000, `正文总字数应 >= 20000 字，实际 ${after.counts.totalWords}`)
assert.equal(after.counts.characters, 15, '应有 15 位活人物')
assert.equal(after.counts.relations, 24, '应有 24 条人物关系')
assert.equal(after.counts.lorelinks, 32, '应有 32 条设定关联')
assert.equal(after.counts.olnodes, localStats.outlineNodeCount, `应有 ${localStats.outlineNodeCount} 个大纲画布节点`)
assert.equal(after.counts.snippets, 22, '应有 22 张活灵感卡片')
assert.equal(after.counts.annotations, localStats.totalNotes, `应有 ${localStats.totalNotes} 条批注`)
assert.ok(after.counts.wordlog >= 80, `近 90 天写作日志应 >= 80 条，实际 ${after.counts.wordlog}`)
assert.equal(after.counts.trashChapters, 1, '回收站应有 1 篇废稿章节')
assert.equal(after.counts.trashCharacters, 1, '回收站应有 1 位弃用人物')
assert.equal(after.counts.trashSnippets, 2, '回收站应有 2 条弃用灵感')

// 切换五大核心工作台模块，Node 侧分段驱动（避免后台窗口节流页内定时器）
await c.evalx(`(async () => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
  const work = pinia._s.get('work');
  const ui = pinia._s.get('ui');
  await work.open(${JSON.stringify(after.workId)});
  ui.view = 'work';
  work.tab = 'chapters';
  if (work.liveChapters[0]) work.selChapterId = work.liveChapters[0].id;
  return true;
})()`)
await c.sleep(500)
const chSmoke = await c.evalx(`(() => ({
  chDlDom: document.querySelectorAll('.tiptap .dl-link').length,
  chNoteDom: document.querySelectorAll('.tiptap .note-mark').length
}))()`)

await c.evalx(`(() => { document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work').tab = 'outline'; return true; })()`)
await c.sleep(400)
const olSmoke = await c.evalx(`(() => {
  const work = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work');
  return { olNodesLoaded: work.olnodes.filter((n) => !n.deletedAt).length };
})()`)

await c.evalx(`(() => { document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work').tab = 'characters'; return true; })()`)
await c.sleep(400)
const charSmoke = await c.evalx(`(() => {
  const work = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work');
  return { charsLoaded: work.liveCharacters.length, relsLoaded: work.relations.length };
})()`)

await c.evalx(`(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
  pinia._s.get('work').tab = 'lore';
  pinia._s.get('ui').setLoreMapMode('relations');
  pinia._s.get('ui').setLoreView('map', { scroll: 0 });
  return true;
})()`)
await c.sleep(500)
const loreSmoke = await c.evalx(`(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
  const work = pinia._s.get('work');
  const res = {
    loreLoaded: work.liveMubu().length,
    lorelinksLoaded: (work.lorelinks || []).length,
    galaxyCanvas: document.querySelectorAll('.lpn-stage canvas').length
  };
  pinia._s.get('ui').setLoreView('write', { scroll: 0 });
  return res;
})()`)

await c.evalx(`(() => { document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work').tab = 'snippets'; return true; })()`)
await c.sleep(400)
const snipSmoke = await c.evalx(`(() => {
  const work = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('work');
  const res = {
    snippetsLoaded: work.liveSnippets.length,
    errors: window.__demoSeedErrors || []
  };
  work.tab = 'chapters';
  if (work.liveChapters[0]) work.selChapterId = work.liveChapters[0].id;
  return res;
})()`)

const uiSmoke = { ...chSmoke, ...olSmoke, ...charSmoke, ...loreSmoke, ...snipSmoke }

console.log('五大工作台模块验收结果:', JSON.stringify(uiSmoke, null, 2))
assert.ok(uiSmoke.chDlDom >= 4, `第一章正文应渲染多处双链，实际 ${uiSmoke.chDlDom}`)
assert.ok(uiSmoke.chNoteDom >= 2, `第一章正文应渲染批注高亮，实际 ${uiSmoke.chNoteDom}`)
assert.equal(uiSmoke.olNodesLoaded, localStats.outlineNodeCount)
assert.equal(uiSmoke.charsLoaded, 15)
assert.equal(uiSmoke.relsLoaded, 24)
assert.equal(uiSmoke.loreLoaded, EXPECTED_MUBU_COUNT)
assert.equal(uiSmoke.lorelinksLoaded, 32)
assert.ok(uiSmoke.galaxyCanvas >= 1, '关系星系画布应正常挂载')
assert.equal(uiSmoke.snippetsLoaded, 22)
assert.equal(uiSmoke.errors.length, 0, '运行期间不应出现未捕获异常：' + JSON.stringify(uiSmoke.errors))

console.log('\nPASS：《压力测试》演示作品全模块扩写落盘与自检全部通过！')
process.exit(0)
