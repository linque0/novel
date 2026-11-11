/* 作品库位置模块单测：指针文件、目录浏览、移动式迁移与全部反例。
 * 指针基目录用 NOVEL_STUDIO_POINTER_DIR 临时覆盖，绝不碰真实 LOCALAPPDATA。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { openLibrary } from '../packages/novel-core/library.js';

const ROOT = await mkdtemp(join(tmpdir(), 'ns-location-'));
process.env.NOVEL_STUDIO_POINTER_DIR = join(ROOT, 'pointer');
await mkdir(join(ROOT, 'pointer'), { recursive: true });
/* 必须让环境变量先落定再加载模块：pointerPath() 每次调用读 env，但 import 时点保持清晰 */
const { pointerPath, defaultLibraryDir, readPointer, writePointer, describeLocation, browseDirectory, relocateLibrary } =
  await import('../packages/novel-core/location.js');

/** 递归快照：相对路径 + 字节数 + 内容，用来证明"一个字节都不动"。 */
async function snapshot(dir, base = dir, out = []) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    const rel = full.slice(base.length + 1);
    if (entry.isDirectory()) {
      out.push(rel + '/');
      await snapshot(full, base, out);
    } else {
      out.push(rel + ':' + (await readFile(full)).toString('base64'));
    }
  }
  return out;
}

/** 造一个最小可用作品库：init + 一条 submit（含索引、实体、日志、幂等记录）。 */
async function makeLibrary(dir) {
  const library = openLibrary(dir);
  await library.init();
  await library.submit([{ table: 'works', id: 'w1', baseRevision: 0, row: { id: 'w1', title: '迁移测试' } }], { requestId: 'req-' + dir });
  return library;
}

async function assertRejectsCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error?.code, code, '期望错误码 ' + code + '，实际 ' + error?.code + '：' + error?.message);
    assert.equal(error?.name, 'StoreError');
    return true;
  });
}

test.after(async () => {
  delete process.env.NOVEL_STUDIO_POINTER_DIR;
  await rm(ROOT, { recursive: true, force: true });
});

test('pointer path, read, write and describeLocation work under an overridden base dir', async () => {
  const expected = join(ROOT, 'pointer', 'novel-studio', 'library.json');
  assert.equal(pointerPath(), expected);
  assert.equal(defaultLibraryDir(), join(ROOT, 'pointer', 'novel-studio', 'library'));

  /* 读不到指针 → ''（表示"用默认"） */
  assert.equal(readPointer(), '');

  const custom = join(ROOT, '我的库');
  await mkdir(custom, { recursive: true });
  writePointer(custom);
  assert.equal(readPointer(), resolve(custom));

  const summary = describeLocation({ current: custom });
  assert.equal(summary.current, resolve(custom));
  assert.equal(summary.default, defaultLibraryDir());
  assert.equal(summary.pointer, expected);
  assert.equal(summary.isCustom, true);
  assert.equal(summary.fallback, false);
  assert.equal(describeLocation({ current: custom, fallback: true }).fallback, true);

  /* 没有 current 时按指针推断 */
  assert.equal(describeLocation().current, resolve(custom));

  /* 写默认目录 → 不再算自定义 */
  writePointer(defaultLibraryDir());
  assert.equal(readPointer(), defaultLibraryDir());
  assert.equal(describeLocation().isCustom, false);

  /* 指针内容损坏 → '' 而不是抛错 */
  await writeFile(expected, '{ 不是 JSON', 'utf8');
  assert.equal(readPointer(), '');
  await writeFile(expected, JSON.stringify({ path: 'relative/dir' }), 'utf8');
  assert.equal(readPointer(), '');
});

test('browseDirectory lists directories only, sorted, and judges a target', async () => {
  const parent = join(ROOT, 'browse');
  await mkdir(join(parent, 'b-dir'), { recursive: true });
  await mkdir(join(parent, 'a-dir'), { recursive: true });
  await writeFile(join(parent, 'note.txt'), 'x', 'utf8');

  const listed = await browseDirectory(parent);
  assert.equal(listed.dir, resolve(parent));
  assert.deepEqual(listed.entries.map((e) => e.name), ['a-dir', 'b-dir']);
  assert.deepEqual(listed.entries.map((e) => e.path), [join(resolve(parent), 'a-dir'), join(resolve(parent), 'b-dir')]);
  assert.equal(listed.parent, dirnameOf(resolve(parent)));
  assert.equal(listed.isLibrary, false);
  assert.equal(listed.isValidTarget, false);
  assert.equal(listed.reason, 'TARGET_NOT_EMPTY');

  const empty = join(ROOT, 'browse-empty');
  await mkdir(empty, { recursive: true });
  const emptyListed = await browseDirectory(empty);
  assert.equal(emptyListed.isValidTarget, true);
  assert.equal(emptyListed.reason, '');

  const libraryDir = join(ROOT, 'browse-lib');
  await makeLibrary(libraryDir);
  const asLibrary = await browseDirectory(libraryDir);
  assert.equal(asLibrary.isLibrary, true);
  assert.equal(asLibrary.isValidTarget, false);
  assert.equal(asLibrary.reason, 'TARGET_IS_LIBRARY');

  /* 空 / 非法入参必须回绝对路径，不能是 '' */
  for (const bad of ['', '   ', 'relative/path', join(ROOT, 'nope', '..', 'nope2')]) {
    const result = await browseDirectory(bad);
    assert.ok(result.dir && typeof result.dir === 'string');
    assert.ok(resolve(result.dir) === result.dir, '必须是绝对路径：' + result.dir);
  }
});

function dirnameOf(path) {
  const parts = resolve(path).split(sep);
  return parts.length > 1 ? parts.slice(0, -1).join(sep) || sep : '';
}

test('relocateLibrary moves the library: original gone, copy verifies, pointer rewritten', async () => {
  const from = join(ROOT, 'relocate-src');
  const to = join(ROOT, 'relocate-dst');
  await makeLibrary(from);
  await mkdir(to, { recursive: true });

  const before = await snapshot(from);
  /* 库必须真的带了索引、实体、日志三类文件，否则"文件数一致"没有意义 */
  assert.ok(before.some((line) => line.startsWith('library.json:')));
  assert.ok(before.some((line) => line.startsWith('entities' + sep)));

  const result = await relocateLibrary(from, to);
  assert.equal(result.ok, true);
  assert.equal(result.from, resolve(from));
  assert.equal(result.to, resolve(to));
  assert.ok(result.files > 0);
  assert.ok(result.bytes > 0);

  /* 原目录不存在 */
  await assert.rejects(stat(from));
  /* 新目录 library.json 可解析，且结构照旧 */
  const index = JSON.parse(await readFile(join(to, 'library.json'), 'utf8'));
  assert.equal(index.layout, 1);
  assert.ok(index.works && index.works.w1);
  /* 指针指向新目录 */
  assert.equal(readPointer(), resolve(to));
  /* 文件数与字节数一致，且短锁没被带过去 */
  const after = await snapshot(to);
  assert.equal(after.length, before.length);
  assert.deepEqual(after, before);
  assert.equal(after.some((line) => line.startsWith('.lock')), false);
});

test('relocateLibrary rejects SAME_DIR and NESTED without touching either side', async () => {
  const from = join(ROOT, 'guard-src');
  await makeLibrary(from);
  const before = await snapshot(from);
  const pointerBefore = readPointer();

  await assertRejectsCode(relocateLibrary(from, from), 'SAME_DIR');
  if (process.platform === 'win32') await assertRejectsCode(relocateLibrary(from, from.toUpperCase()), 'SAME_DIR');
  await assertRejectsCode(relocateLibrary(from, join(from, 'inner')), 'NESTED');

  /* 反向嵌套：目标是原库的上级 */
  const outer = join(ROOT, 'guard-outer');
  const inner = join(outer, 'inner');
  await makeLibrary(inner);
  const innerBefore = await snapshot(inner);
  const outerBefore = await snapshot(outer);
  await assertRejectsCode(relocateLibrary(inner, outer), 'NESTED');

  assert.deepEqual(await snapshot(from), before);
  assert.deepEqual(await snapshot(inner), innerBefore);
  assert.deepEqual(await snapshot(outer), outerBefore);
  assert.equal(readPointer(), pointerBefore);
});

test('relocateLibrary rejects TARGET_IS_LIBRARY / TARGET_NOT_EMPTY / BAD_PATH leaving both sides intact', async () => {
  const from = join(ROOT, 'reject-src');
  await makeLibrary(from);
  const before = await snapshot(from);
  const pointerBefore = readPointer();

  const otherLibrary = join(ROOT, 'reject-other-lib');
  await makeLibrary(otherLibrary);
  const otherBefore = await snapshot(otherLibrary);

  const busy = join(ROOT, 'reject-busy');
  await mkdir(busy, { recursive: true });
  await writeFile(join(busy, 'keep.txt'), 'keep', 'utf8');
  const busyBefore = await snapshot(busy);

  const missing = join(ROOT, 'reject-missing');

  await assertRejectsCode(relocateLibrary(from, otherLibrary), 'TARGET_IS_LIBRARY');
  await assertRejectsCode(relocateLibrary(from, busy), 'TARGET_NOT_EMPTY');
  await assertRejectsCode(relocateLibrary(from, 'relative/target'), 'BAD_PATH');
  await assertRejectsCode(relocateLibrary(from, from + sep + '..' + sep + 'escape'), 'BAD_PATH');
  await assertRejectsCode(relocateLibrary('relative/from', from), 'BAD_PATH');
  await assertRejectsCode(relocateLibrary(from, join(ROOT, 'nul\0dir')), 'BAD_PATH');

  assert.deepEqual(await snapshot(from), before);
  assert.deepEqual(await snapshot(otherLibrary), otherBefore);
  assert.deepEqual(await snapshot(busy), busyBefore);
  /* 目标不存在的一侧也不能被凭空创建 */
  await assert.rejects(stat(missing));
  /* 指针一次都没被写 */
  assert.equal(readPointer(), pointerBefore);
});
