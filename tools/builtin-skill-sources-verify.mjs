import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { SKILL_SOURCES, SKILL_SOURCE_NOTICES } from '../src/services/ai/skill-sources.js'
import { BUILTIN_WRITING_SKILLS } from '../src/services/ai/builtin-writing-skills.js'
import { readWritingSkillFiles } from '../src/services/ai/stage-config.js'

const read = file => readFileSync(new URL('../' + file, import.meta.url))
const sha = value => createHash('sha256').update(value).digest('hex')
const root = 'docs/恍然梦AI工作台/skill-sources-20261027/'
const manifest = JSON.parse(read(root + 'manifest.json'))
const adapters = JSON.parse(read(root + 'adaptations.json')).adaptations
assert.equal(manifest.sources.length, SKILL_SOURCES.length)
for (const { snapshotPath, ...source } of manifest.sources) {
  assert.equal(sha(read(snapshotPath)), source.sha256, source.path)
  assert.deepEqual(SKILL_SOURCES.find(s => s.id === source.id), source)
}
for (const license of manifest.licenses) {
  const text = read(license.path)
  assert.equal(sha(text), license.sha256)
  assert.equal(SKILL_SOURCE_NOTICES[license.repository], text.toString('utf8'))
  assert.match(text.toString('utf8'), /Permission is hereby granted/)
}
assert.equal(adapters.length, BUILTIN_WRITING_SKILLS.length)
for (const row of adapters) {
  const skill = BUILTIN_WRITING_SKILLS.find(s => s.id === row.id)
  assert.equal(sha(skill.text), row.textSha256, row.name)
  assert.equal(sha(read(row.snapshotPath)), row.snapshotSha256)
  assert.deepEqual(skill.provenance.sources.map(s => s.id), row.sourceIds)
  const imported = await readWritingSkillFiles([{name:'SKILL.md',text:async()=>read(row.snapshotPath).toString('utf8')}])
  assert.ok(imported.text.includes(skill.text), 'adapted SKILL.md must remain importable as text')
}
console.log(`skill source verification passed: ${manifest.sources.length} pinned originals, ${manifest.licenses.length} licenses, ${adapters.length} adapters and importable snapshots`)
