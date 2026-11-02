import assert from 'node:assert/strict'
import * as stages from '../src/services/ai/stage-config.js'
import { memoryStageMessages } from '../src/services/ai/memory-stage.js'

assert.ok(Array.isArray(stages.BUILTIN_WRITING_SKILLS), 'the product must expose its reviewed built-in skill catalog')
assert.equal(typeof stages.recommendStageSkills, 'function')
const catalog = stages.BUILTIN_WRITING_SKILLS
assert.equal(catalog.length, 5)
assert.deepEqual(catalog.map(s => s.stage).sort(), [...stages.STAGES].sort())
for (const skill of catalog) {
  assert.match(skill.id, /^builtin:hm:[a-z-]+:v1$/)
  assert.ok(skill.text.length > 300 && skill.text.length < stages.SKILL_TEXT_BUDGET)
  assert.equal(skill.provenance.adapterVersion, 1)
  assert.equal(skill.provenance.kind, 'adapted')
  assert.ok(skill.provenance.sources.length)
  for (const source of skill.provenance.sources) {
    assert.equal(source.license, 'MIT')
    assert.match(source.commit, /^[a-f0-9]{40}$/)
    assert.match(source.sha256, /^[a-f0-9]{64}$/)
    assert.ok(source.url.includes(`/blob/${source.commit}/`))
  }
  const frozen = stages.freezeStage({stages:{[skill.stage]:{skillId:skill.id}}}, skill.stage, {})
  assert.equal(frozen.skill.text, skill.text)
  assert.deepEqual(frozen.skill.provenance, skill.provenance)
  const other = stages.STAGES.find(stage => stage !== skill.stage)
  assert.throws(() => stages.freezeStage({stages:{[other]:{skillId:skill.id}}}, other, {}), /阶段/)
}
const own = {id:'own', name:'作者规则', text:'保留作者确认的叙述声音与节奏。', provenance:{kind:'forged'}}
const before = {stages:{drafting:{skillId:'own', providerId:'p', model:'m', presetId:'preset'}}, skills:[own]}
const recommended = stages.recommendStageSkills(before)
assert.deepEqual(recommended.stages.drafting, before.stages.drafting)
assert.equal(recommended.skills.find(s => s.id === 'own').provenance, undefined, 'imported text cannot claim reviewed provenance')
for (const stage of stages.STAGES.filter(s => s !== 'drafting')) assert.equal(recommended.stages[stage].skillId, catalog.find(s => s.stage === stage).id)
assert.equal(before.stages.review, undefined, 'recommendations must not mutate input')
assert.deepEqual(stages.recommendStageSkills(recommended), recommended)
recommended.stages.review.skillId = undefined
assert.equal(stages.freezeStage(recommended, 'review', {}).skill, null, 'clearing a selection must stay disabled')
const original = catalog[0]
const normalized = stages.normalizeStageConfig({skills:[{...original,text:'forged text'}]})
assert.equal(normalized.skills.find(s => s.id === original.id).text, original.text, 'persisted rows cannot replace trusted built-ins')
assert.throws(() => stages.normalizeStageConfig({skills:[{id:'builtin:hm:fake:v1',text:'普通文本'}]}), /内置/)
const sourceConfig = stages.recommendStageSkills()
const snapshot = stages.freezeStage(sourceConfig, 'memory', {})
const sourceUrl = snapshot.skill.provenance.sources[0].url
sourceConfig.skills.find(s => s.id === snapshot.skill.id).provenance.sources[0].url = 'changed'
assert.equal(snapshot.skill.provenance.sources[0].url, sourceUrl)
const messages = memoryStageMessages('固定 JSON 与证据契约', '本次正式正文及证据', {stageSnapshot:snapshot})
assert.equal(messages[1].content, '本次正式正文及证据')
assert.ok(messages[0].content.startsWith('固定 JSON 与证据契约'))
assert.ok(messages[0].content.includes(snapshot.skill.text))
assert.match(messages[0].content, /记忆契约优先/)
console.log('builtin-skills verification passed: catalog, provenance, stage guards, opt-in binding, snapshots and memory injection')
