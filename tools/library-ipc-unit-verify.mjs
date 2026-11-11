/* 作品库 IPC 单元验证：不启动 Electron，直接测 createLibraryService 背后的语义。 */
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { createLibraryService, channels } = require('../electron/library-ipc.js');

let passed = 0;
const failures = [];
const ok = (name, condition, detail) => {
  if (condition) {
    passed += 1;
    console.log('PASS ' + name);
  } else {
    failures.push(name + (detail ? ' -> ' + detail : ''));
    console.log('FAIL ' + name + (detail ? ' -> ' + detail : ''));
  }
};

/* 按名字断言而不是数个数：写死数量会让"新增通道"等同于"回归"，
 * 而真正该守的是原有通道一个都不许消失。 */
const REQUIRED_CHANNELS = ['library:pointer', 'library:status', 'library:snapshot', 'library:submit', 'library:pull', 'library:import', 'library:verify'];
const missing = REQUIRED_CHANNELS.filter((name) => !channels.includes(name));
ok('保留全部 7 个既有 IPC 通道', missing.length === 0, missing.length ? '缺少 ' + missing.join(',') : channels.join(','));

const dir = await mkdtemp(join(tmpdir(), 'ns-ipc-'));
const lib = await createLibraryService(dir);
const status0 = await lib.status();
ok('服务初始化建立索引', status0.ready === true && status0.seq === 0);

const work = { id: 'w1', title: 'IPC 测试作品', updatedAt: '2026-02-02T00:00:00.000Z' };
const created = await lib.submit([{ table: 'works', id: 'w1', kind: 'put', baseRevision: 0, row: work }], { requestId: 'ipc-1' });
ok('提交作品', created.ok === true && created.seq === 1);

const replay = await lib.submit([{ table: 'works', id: 'w1', kind: 'put', baseRevision: 0, row: work }], { requestId: 'ipc-1' });
ok('幂等重放', replay.replayed === true);

const conflict = await lib.submit([{ table: 'works', id: 'w1', kind: 'put', baseRevision: 0, row: work }], { requestId: 'ipc-2' });
ok('陈旧版本冲突', conflict.ok === false && conflict.conflict.currentRevision === 1);

const pulled = await lib.pull(0);
ok('拉取增量', pulled.seq === 1 && pulled.ops.length === 1);

const snapshot = await lib.snapshot();
ok('快照形状与备份一致', Array.isArray(snapshot.data.works) && snapshot.data.works.length === 1);

const verify = await lib.index();
ok('索引可读', verify.works.w1 && verify.works.w1.title === 'IPC 测试作品');

const dir2 = await mkdtemp(join(tmpdir(), 'ns-ipc2-'));
const lib2 = await createLibraryService(dir2);
const imported = await lib2.importDump(snapshot);
ok('导入到另一库', imported.ok === true && imported.imported === 1);
const again = await lib2.importDump(snapshot).catch((error) => ({ ok: false, code: error.code }));
ok('重复导入需要 force', again.ok === false && again.code === 'NOT_EMPTY');

await rm(dir, { recursive: true, force: true });
await rm(dir2, { recursive: true, force: true });

console.log('');
console.log('通过 ' + passed + ' 项，失败 ' + failures.length + ' 项');
if (failures.length) {
  failures.forEach((item) => console.log('  - ' + item));
  process.exit(1);
}
