/* 同步层纯逻辑自测：不改 Dexie、不起 Electron。 */
import {
  MAX_PENDING, applyRevisions, boundQueue, buildOps, groupByTable,
  isSecretRow, isSyncable, remoteLibraryOps, revKey, revisionsFromJSON, revisionsToJSON, shouldSkipEcho,
} from '../src/services/library-ops.js';
import { librarySubmit } from '../src/services/library.js';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || !detail ? '' : '  —— ' + detail));
};

check('同步集合覆盖源表', isSyncable('chapters') && isSyncable('works') && isSyncable('appconfig'));
check('非源表不同步', isSyncable('aikb') === false && isSyncable('airuns') === false);
check('密钥行识别', isSecretRow('appconfig', { key: 'ai.cred.deepseek' }) === true);
check('普通配置不算密钥', isSecretRow('appconfig', { key: 'theme' }) === false);

const revisions = new Map([[revKey('chapters', 'c1'), 3]]);
const changes = [
  { table: 'chapters', row: { id: 'c1', workId: 'w1', title: '一' }, kind: 'put' },
  { table: 'chapters', row: { id: 'c2', workId: 'w1', title: '二' }, kind: 'delete' },
  { table: 'aikb', row: { id: 'x', workId: 'w1' }, kind: 'put' },
  { table: 'appconfig', row: { id: 'k', key: 'ai.cred.x' }, kind: 'put' },
];
const ops = buildOps(changes, revisions);
check('丢弃非同步表与密钥行', ops.length === 2, JSON.stringify(ops));
check('已知实体带上 baseRevision', ops[0].baseRevision === 3, String(ops[0].baseRevision));
check('新实体从 0 起', ops[1].baseRevision === 0 && ops[1].kind === 'delete');

check('回声判定命中', shouldSkipEcho({ table: 'chapters', id: 'c1', revision: 3 }, revisions) === true);
check('回声判定不误伤', shouldSkipEcho({ table: 'chapters', id: 'c1', revision: 4 }, revisions) === false);

const localLoreRevision = new Map([[revKey('mubu', 'lore-image'), 4]]);
const loreBefore = { table: 'mubu', id: 'lore-image', kind: 'put', revision: 3, row: { html: null } };
const loreSaved = { ...loreBefore, revision: 4, row: { html: '<img class="lore-image">' } };
check('作品库拉取包含连续写入时，旧版不覆盖已保存的设定图片',
  remoteLibraryOps([loreBefore, loreSaved], localLoreRevision).length === 0);
check('未见过的连续写入只应用设定条目最新版',
  remoteLibraryOps([loreBefore, loreSaved], new Map())[0] === loreSaved);

applyRevisions(revisions, [{ table: 'chapters', id: 'c2', revision: 1 }]);
check('版本表更新', revisions.get(revKey('chapters', 'c2')) === 1);

const grouped = groupByTable([
  { table: 'chapters', id: 'c1', kind: 'put', row: { id: 'c1' } },
  { table: 'chapters', id: 'c2', kind: 'delete' },
  { table: 'works', id: 'w1', kind: 'put', row: { id: 'w1' } },
]);
check('按表分组：put', grouped.puts.get('chapters').length === 1 && grouped.puts.get('works').length === 1);
check('按表分组：delete', grouped.dels.get('chapters')[0] === 'c2');

const big = Array.from({ length: MAX_PENDING + 50 }, (_, index) => index);
const trimmed = boundQueue(big);
check('队列有界且保留最新', trimmed.length === MAX_PENDING && trimmed[trimmed.length - 1] === big[big.length - 1]);

const roundtrip = revisionsFromJSON(revisionsToJSON(revisions));
check('版本表可持久化', roundtrip.get(revKey('chapters', 'c1')) === 3);
check('损坏输入退化为空表', revisionsFromJSON('{not json').size === 0);

const saved = { ok: true, seq: 2, revisions: [{ table: 'mubu', id: 'lore-image', revision: 4 }] };
const conflict = { ok: false, conflict: { table: 'mubu', id: 'lore-image', currentRevision: 4 } };
for (const [host, envelope] of [
  ['桌面', value => ({ ok: true, value })],
  ['插件桥', value => value],
]) {
  try {
    globalThis.window = { native: { librarySubmit: async () => envelope(saved) } };
    check(host + '保留成功写入的版本号', (await librarySubmit({}))?.revisions?.[0]?.revision === 4);
    globalThis.window.native.librarySubmit = async () => envelope(conflict);
    const code = await librarySubmit({}).then(() => null, error => error.code);
    check(host + '版本冲突进入重试分支', code === 'CONFLICT');
  } finally {
    delete globalThis.window;
  }
}

const failed = results.filter((item) => !item.ok);
console.log('');
console.log('==== ' + (results.length - failed.length) + '/' + results.length + ' 通过 ====');
if (failed.length) process.exit(1);
