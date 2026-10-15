// Contract: unknown skins fall back safely; shelf-only skins never leak into work/panel surfaces.
import assert from 'node:assert/strict'
import { normalizeSkin, resolveSkin, SKINS } from '../src/skins/registry.js'

for (const value of [undefined, null, '', 'future-skin', '__proto__', 'constructor']) {
  assert.equal(normalizeSkin(value), 'original', `invalid preference ${String(value)}`)
}
assert.equal(normalizeSkin('gravity'), 'gravity')
assert.equal(resolveSkin('gravity', 'shelf').id, 'gravity')
for (const surface of ['work', 'settings', 'panel', undefined]) {
  assert.equal(resolveSkin('gravity', surface).id, 'original', `gravity must not affect ${surface}`)
}
assert.equal(resolveSkin('missing', 'shelf').id, 'original')
assert.equal(resolveSkin('original', 'shelf').id, 'original')
assert.equal(new Set(SKINS.map(s => s.id)).size, SKINS.length)
console.log('PASS skin fallback, supported surfaces, registry identifiers')
