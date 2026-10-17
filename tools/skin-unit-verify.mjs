// Contract: registered surfaces share the skin; unknown preferences/surfaces fall back safely.
import assert from 'node:assert/strict'
import { normalizeSkin, resolveSkin, SKINS, isStudioSkin } from '../src/skins/registry.js'
import { characterGeometry, projectCharacterPoint } from '../src/skins/graph-presentation.js'

for (const value of [undefined, null, '', 'future-skin', '__proto__', 'constructor']) {
  assert.equal(normalizeSkin(value), 'original', `invalid preference ${String(value)}`)
}
assert.equal(normalizeSkin('gravity'), 'gravity')
assert.equal(normalizeSkin('glaze'), 'glaze')
for (const surface of ['shelf', 'work', 'panel']) assert.equal(resolveSkin('glaze', surface).id, 'glaze')
for (const value of ['gravity', 'glaze']) assert.equal(isStudioSkin(value), true)
for (const value of ['original', 'future', null]) assert.equal(isStudioSkin(value), false)
assert.equal(resolveSkin('gravity', 'shelf').id, 'gravity')
for (const surface of ['work', 'panel']) {
  assert.equal(resolveSkin('gravity', surface).id, 'gravity', `gravity supports ${surface}`)
}
for (const surface of ['unknown', undefined]) {
  assert.equal(resolveSkin('gravity', surface).id, 'original', `unknown surface ${surface}`)
}
assert.equal(resolveSkin('missing', 'shelf').id, 'original')
assert.equal(resolveSkin('original', 'shelf').id, 'original')
assert.equal(new Set(SKINS.map(s => s.id)).size, SKINS.length)
console.log('PASS skin fallback, supported surfaces, registry identifiers')
for (const skin of ['original', 'gravity', 'glaze']) {
  const geometry = characterGeometry(skin)
  for (const point of [{x:0,y:0},{x:-203,y:79},{x:31.25,y:-0.5}]) {
    const before = {...point}
    const projected = projectCharacterPoint(point, geometry)
    const restored = projectCharacterPoint(projected, geometry, true)
    assert.ok(Math.abs(point.x-restored.x)<1e-10 && Math.abs(point.y-restored.y)<1e-10)
    assert.deepEqual(point, before, 'projection does not mutate stored positions')
    if (skin === 'original') assert.deepEqual(projected, point, 'existing skins keep original coordinates')
  }
  assert.equal(projectCharacterPoint(null, geometry), null)
  assert.ok(116*geometry.scaleY>geometry.height, 'original grid spacing remains non-overlapping')
}
console.log('PASS portrait projection, inverse drag coordinates and unchanged original geometry')
