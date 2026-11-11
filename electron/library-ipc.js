/* 作品库 IPC（Electron 主进程，CJS）。
 * 核心实现复用 packages/novel-core/library.js（ESM，动态 import 加载），
 * 因此桌面版与 DSH 插件共用同一份存储语义，不做第二套实现。
 *
 * 通道：
 *   library:status   → { ready, dir, layout, seq, works }
 *   library:snapshot → 与 exportBackupJson 同形状的 dump
 *   library:submit   → { requestId, ops:[{table,id,kind,baseRevision,row}] }
 *   library:pull     → { after }
 *   library:import   → { dump, force }
 *   library:verify   → 索引与实体文件一致性核对
 *   library:pointer  → 库路径与指针文件位置
 *   library:location → 存储位置摘要（当前/默认/指针/是否自定义）
 *   library:browse   → 逐级点选目录（只列目录）
 *   library:pickDir  → 原生目录选择框
 *   library:relocate → 移动式迁移作品库到新目录
 *   library:reveal   → 在系统文件管理器里打开当前库目录
 */
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const CORE_URL = pathToFileURL(path.join(__dirname, '..', 'packages', 'novel-core', 'library.js')).href;
const LOCATION_URL = pathToFileURL(path.join(__dirname, '..', 'packages', 'novel-core', 'location.js')).href;
let corePromise = null;
const loadCore = () => (corePromise || (corePromise = import(CORE_URL)));
let locationPromise = null;
const loadLocation = () => (locationPromise || (locationPromise = import(LOCATION_URL)));

/* 指针位置与 packages/novel-core/location.js 必须一致：那里是规范源，这里是它在主进程的同步镜像。
 * 两份实现分叉过一次（location.js 认 NOVEL_STUDIO_POINTER_DIR 覆盖、这里不认），
 * 结果任何试图用该变量隔离的调用都打到了真实作品库上——覆盖约定必须两边同时成立。 */
function pointerPath() {
  const override = String(process.env.NOVEL_STUDIO_POINTER_DIR || '').trim();
  if (override) return path.join(path.resolve(override), 'novel-studio', 'library.json');
  const base = process.platform === 'win32'
    ? process.env.LOCALAPPDATA || path.join(require('node:os').homedir(), 'AppData', 'Local')
    : path.join(require('node:os').homedir(), '.local', 'share');
  return path.join(base, 'novel-studio', 'library.json');
}

function readPointer() {
  try {
    const raw = JSON.parse(fs.readFileSync(pointerPath(), 'utf8'));
    return typeof raw?.path === 'string' ? raw.path : '';
  } catch {
    return '';
  }
}

function writePointer(dir) {
  try {
    fs.mkdirSync(path.dirname(pointerPath()), { recursive: true });
    fs.writeFileSync(pointerPath(), JSON.stringify({ path: dir, layout: 1, at: new Date().toISOString() }, null, 2), 'utf8');
  } catch {
    /* 指针写不进去不影响库本身 */
  }
}

/* 每次都重读指针：迁移写指针后，下一次 IPC 立刻在新目录上工作，应用无需重启。 */
function resolveLibraryDir(explicit) {
  const wanted = String(explicit || '').trim();
  if (wanted) return wanted;
  const pointed = readPointer();
  if (pointed) return pointed;
  const fallback = path.join(path.dirname(pointerPath()), 'library');
  writePointer(fallback);
  return fallback;
}

async function createLibraryService(dir) {
  const { openLibrary } = await loadCore();
  const library = openLibrary(resolveLibraryDir(dir));
  await library.init();
  return library;
}

const handlers = {
  'library:pointer': async () => ({ pointer: pointerPath(), dir: resolveLibraryDir() }),

  'library:status': async (payload) => (await createLibraryService(payload?.dir)).status(),

  'library:snapshot': async (payload) => (await createLibraryService(payload?.dir)).snapshot(),

  'library:submit': async (payload) => (await createLibraryService(payload?.dir)).submit(payload?.ops || [], {
    requestId: payload?.requestId,
    actor: payload?.actor || { kind: 'human' },
  }),

  'library:pull': async (payload) => (await createLibraryService(payload?.dir)).pull(Number(payload?.after) || 0),

  'library:import': async (payload) => (await createLibraryService(payload?.dir)).importDump(payload?.dump, { force: payload?.force === true }),

  'library:verify': async (payload) => {
    const library = await createLibraryService(payload?.dir);
    const index = await library.index();
    const problems = [];
    for (const [id, summary] of Object.entries(index.works || {})) {
      const row = await library.readEntity('works', id);
      if (!row) problems.push('索引里的作品找不到实体文件：' + id);
      else if (summary.revision && row.revision !== summary.revision) problems.push('作品 revision 不一致：' + id);
    }
    const dump = await library.snapshot();
    return {
      dir: library.dir,
      layout: index.layout || 1,
      seq: index.seq || 0,
      works: Object.keys(index.works || {}).length,
      tables: Object.fromEntries(Object.entries(dump.data).map(([table, rows]) => [table, rows.length])),
      problems,
      ok: problems.length === 0,
    };
  },

  /* ——— 存储位置（作品库目录，与 DSH 插件共用同一个指针）——— */

  'library:location': async () => {
    const location = await loadLocation();
    return {
      ...location.describeLocation({ current: resolveLibraryDir() }),
      /* 桌面版能直接开系统文件管理器，插件版不行（见 RPC 里的 false） */
      revealAvailable: true,
      /* 桌面版指针每次 IPC 重读，迁移后无需重启 */
      restartHint: null,
    };
  },

  'library:browse': async (payload) => (await loadLocation()).browseDirectory(payload?.dir),

  'library:pickDir': async (_payload, context) => {
    const result = await context.dialog.showOpenDialog({
      title: '选择作品库位置',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result?.canceled || !result?.filePaths?.length) return { canceled: true };
    /* 选中的目录本身就是库目录，不追加子目录名 */
    return { canceled: false, dir: result.filePaths[0] };
  },

  'library:relocate': async (payload) => {
    const location = await loadLocation();
    const result = await location.relocateLibrary(resolveLibraryDir(), payload?.dir);
    return { ...result, restartHint: null };
  },

  'library:reveal': async (_payload, context) => {
    const error = await context.shell.openPath(resolveLibraryDir());
    return { ok: !error, error: error || '' };
  },
};

function registerLibraryIpc({ ipcMain, dialog, shell }) {
  /* dialog/shell 是 Electron 的注入物：缺了就让对应通道报错，而不是启动阶段抛。 */
  const context = { dialog, shell };
  for (const [channel, run] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (_event, payload) => {
      try {
        return { ok: true, value: await run(payload || {}, context) };
      } catch (error) {
        return { ok: false, error: { code: error?.code || 'ERROR', message: String(error?.message || error) } };
      }
    });
  }
  return Object.keys(handlers);
}

module.exports = { registerLibraryIpc, createLibraryService, resolveLibraryDir, pointerPath, channels: Object.keys(handlers) };
