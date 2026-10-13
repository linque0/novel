import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import seedrandom from 'seedrandom'
import {
  defaultPreset,
  importPreset,
  exportPreset,
  compilePreset,
  expandMacros,
  stringHash,
  copy,
  orderOf,
  mergePromptManager,
  samplingFor,
} from '../src/services/ai/presets.js'
import {runStage,regexFromString,escapeRegexMacro} from '../src/services/ai/regex-core.js'
let passed = 0
const test = (name, fn) => {
  fn()
  passed++
  console.log('PASS ' + name)
}
test('default source slots and role boundary', () => {
  const r = compilePreset({
    row: defaultPreset(),
    slots: { chapterAnchor: 'anchor', writingReference: '正文 {{incvar::n}}' },
    question: '创作',
  })
  assert(r.messages.some((m) => m.role === 'user' && m.content.includes('{{incvar::n}}')))
  assert.equal(r.macroState.local.n, undefined)
})
test('preview variable copies; legacy family order', () => {
  const vars = { local: { n: 9 }, global: {} }
  const row = defaultPreset()
  row.payload.prompts[0].content = '{{getvar::n}} {{incvar::n}} {{setvar::n::2}}'
  const r = compilePreset({ row, state: vars, question: '测试' })
  assert(r.messages.some((m) => m.content === '3 3 '))
  assert.equal(vars.local.n, 9)
  assert.equal(r.macroState.local.n, 3)
})
test('roles, disabled entries and generation triggers', () => {
  const row = defaultPreset()
  row.payload.prompts.push({ identifier: 'reply', name: 'reply', role: 'assistant', content: 'A', injection_trigger: ['continue'] })
  orderOf(row.payload).push({ identifier: 'reply', enabled: true })
  assert(!compilePreset({ row, question: 'Q' }).messages.some((m) => m.content === 'A'))
  assert(
    compilePreset({ row, generationType: 'continue', question: 'Q' }).messages.some((m) => m.role === 'assistant' && m.content === 'A'),
  )
})
test('depth and same-depth priority against local ST baseline', () => {
  const row = defaultPreset()
  for (const [id, order, role] of [
    ['lo', 50, 'system'],
    ['hi', 100, 'system'],
    ['a', 100, 'assistant'],
  ]) {
    row.payload.prompts.push({
      identifier: id,
      name: id,
      content: id,
      role,
      injection_position: 1,
      injection_depth: 1,
      injection_order: order,
    })
    orderOf(row.payload).push({ identifier: id, enabled: true })
  }
  const r = compilePreset({
    row,
    history: [
      { role: 'user', content: 'H0' },
      { role: 'assistant', content: 'H1' },
    ],
    question: 'Q',
  })
  const content = r.messages.map((m) => m.content)
  assert.deepEqual(content.slice(content.indexOf('H1') + 1, content.indexOf('Q')), ['lo', 'a', 'hi'])
})
test('macro pick/hash/date match local SillyTavern core', () => {
  const root = 'E:/SillyTavern/SillyTavern-1.15.0/SillyTavern-1.15.0/public/scripts/'
  const source = fs.readFileSync(root + 'utils.js', 'utf8')
  const start = source.indexOf('export function getStringHash('),
    end = source.indexOf('\n}', start) + 2
  const hash = vm.runInNewContext('(' + source.slice(start, end).replace('export ', '') + ')')
  for (const str of ['abc', '恍然梦', '😀']) assert.equal(hash(str), stringHash(str))
  const raw = '{{pick::甲::乙::丙}}',
    seed = hash(`${hash('work')}-${hash(raw)}-0`),
    expected = ['甲', '乙', '丙'][Math.floor(seedrandom(seed)() * 3)]
  assert.equal(expandMacros(raw, { chatId: 'work' }), expected)
  assert.equal(expandMacros('{{datetimeformat YYYY-MM-DD}}', {}, undefined, { now: new Date(2026, 9, 12) }), '2026-10-12')
})
test('full preset and Prompt Manager imports preserve extension fields', () => {
  const raw = {
    name: 'Imported',
    prompts: [{ identifier: 'main', name: 'main', role: 'system', content: '原文规则' }],
    prompt_order: [
      {
        character_id: 100001,
        order: [
          { identifier: 'main', enabled: true },
          { identifier: 'chatHistory', enabled: true },
        ],
      },
    ],
    extensions: { regex_scripts: [{ findRegex: 'x' }] },
    temperature: 0.2,
  }
  const { row } = importPreset({ version: 1, type: 'full', data: raw })
  assert(row.payload.prompts.some((p) => p.identifier === 'chatHistory'))
  row.adaptation.historyChapters = 7
  const round = importPreset(exportPreset(row)).row
  assert.deepEqual(round.adaptation, row.adaptation)
  assert.deepEqual(round.payload.extensions, raw.extensions)
  assert.equal(round.payload.prompts[0].content, '原文规则')
})
test('complete request budget and whole-block removal', () => {
  const r = compilePreset({
    row: defaultPreset(),
    question: 'Q',
    slots: { chapterAnchor: 'anchor', worldInfoAfter: '甲'.repeat(4000) },
    opts: { inputBudget: 4000, contextWindow:4000, maxTokens: 2048 },
  })
  assert(r.tokens.used + r.tokens.outputReserve + 128 <= 4000)
  assert(r.dropped.length > 0)
  assert(r.messages.some((m) => m.content.includes('anchor')))
})
test('privacy disables marked source literals', () => {
  const row = defaultPreset()
  row.payload.prompts[0].novel_verbatim = true
  row.payload.prompts[0].content = '秘密范文'
  const r = compilePreset({ row, question: 'Q', opts: { inputBudget: 10000, maxTokens: 2048, privacy: true } })
  assert(!JSON.stringify(r.messages).includes('秘密范文'))
})
test('core duplicate identifiers, deep injection and wrapping preserve original records', () => {
  const row = defaultPreset()
  row.payload.prompts.push({ ...row.payload.prompts[0], content: 'SHADOWED' })
  row.payload.wi_format = '前言 {0} 后记'
  const r = compilePreset({ row, slots: { worldInfoBefore: '{{incvar::n}}' }, question: 'Q' })
  assert(!r.messages.some((m) => m.content === 'SHADOWED'))
  assert(r.messages.some((m) => m.content.includes('前言 {{incvar::n}} 后记')))
  assert.equal(r.macroState.local.n, undefined)
  row.payload.prompts.push({
    identifier: 'deep',
    name: 'deep',
    role: 'system',
    content: 'DEEP',
    injection_position: 1,
    injection_depth: 9999,
  })
  orderOf(row.payload).push({ identifier: 'deep', enabled: true })
  assert(
    compilePreset({ row, question: 'Q' }).messages.findIndex((m) => m.content === 'DEEP') <
      compilePreset({ row, question: 'Q' }).messages.findIndex((m) => m.content === 'Q'),
  )
})
test('local complete Chat Completion presets all import without text rewriting', () => {
  const dir = 'E:/SillyTavern/SillyTavern-1.15.0/SillyTavern-1.15.0/data/default-user/OpenAI Settings'
  if (!fs.existsSync(dir)) return
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    const raw = JSON.parse(fs.readFileSync(dir + '/' + name, 'utf8')),
      result = importPreset(raw, name)
    assert.deepEqual(exportPreset(result.row).prompts, raw.prompts)
  }
})
test('real Prompt Manager export restores missing core and merges without overwriting local main',()=>{
 const current=defaultPreset();current.payload.prompts[0].content='LOCAL MAIN';
 const result=importPreset({version:1,type:'full',data:{prompts:[{identifier:'custom',role:'system',name:'Custom',content:'CUSTOM',system_prompt:false,marker:false}],prompt_order:[{identifier:'main',enabled:true},{identifier:'custom',enabled:true},{identifier:'jailbreak',enabled:true},{identifier:'chatHistory',enabled:true}]}});
 assert.deepEqual(result.row.reconstructedIds,['main','jailbreak','chatHistory']);
 const merged=mergePromptManager(current,result.row).row;assert.equal(merged.payload.prompts.find(p=>p.identifier==='main').content,'LOCAL MAIN');
 const round=exportPreset(merged,'prompt-manager');assert.equal(round.data.prompts.length,1);assert.equal(round.data.prompt_order[1].identifier,'custom');
})
test('text first, explicit parameters and model cap without half-context limit',()=>{
 const row=defaultPreset();Object.assign(row.payload,{openai_max_context:12000,openai_max_tokens:6500,seed:42,reasoning_effort:'high',verbosity:'low',stream_openai:false});
 const c=compilePreset({row,question:'Q',opts:{inputBudget:3000,contextWindow:10000,maxOutputTokens:7000,maxTokens:2048,temperature:.1}});
 assert.equal(c.tools,false);assert.equal(c.opts.inputBudget,10000);assert.equal(c.opts.maxTokens,6500);assert.equal(c.opts.seed,42);assert.equal(c.opts.temperature,.7);assert.equal(c.opts.stream,false);assert(c.warnings.some(w=>w.includes('上限')));
 Object.assign(row.payload,{seed:-1,reasoning_effort:'auto',verbosity:'auto'});const p=samplingFor(row,{contextWindow:12000}).opts;assert(!('seed' in p));assert(!('reasoning_effort' in p));
})
test('material roles, author note position and disabled diagnostics',()=>{
 const row=defaultPreset();row.payload.prompts.find(p=>p.identifier==='worldInfoBefore').role='system';row.adaptation.authorNote='NOTE {{user}}';
 const order=orderOf(row.payload);const note=order.splice(order.findIndex(o=>o.identifier==='authorNote'),1)[0];order.unshift(note);
 row.payload.prompts.push({identifier:'bad',name:'disabled',content:'{{pluginUnknown}}',role:'system'});order.push({identifier:'bad',enabled:false});
 const c=compilePreset({row,slots:{worldInfoBefore:'FACT {{incvar::n}}'},question:'Q'});
 assert.equal(c.messages[1].content,'NOTE 作者');assert(c.messages.some(m=>m.role==='system'&&m.content.includes('FACT {{incvar::n}}')));assert(!c.warnings.some(w=>w.includes('pluginUnknown')));assert.equal(c.macroState.local.n,undefined);
})
test('continue prefix, nudge, examples, name modes and system merging',()=>{
 const row=defaultPreset();Object.assign(row.payload,{continue_prefill:true,continue_postfix:' ',continue_nudge_prompt:'NUDGE {{lastChatMessage}}',names_behavior:2,new_chat_prompt:'NEW {{user}}'});
 const c=compilePreset({row,history:[{role:'user',content:'Q'},{role:'assistant',content:'OLD'}],generationType:'continue',env:{continuationText:'OLD'}});
 assert.equal(c.messages.at(-1).role,'assistant');assert.equal(c.messages.at(-1).content,'OLD ');assert.equal(c.messages.filter(m=>m.content==='作者: Q').length,1);assert.equal(c.continueNudge,'NUDGE OLD');
 row.payload.continue_prefill=false;const n=compilePreset({row,history:[{role:'user',content:'Q'},{role:'assistant',content:'OLD'}],generationType:'continue'});assert.equal(n.messages.at(-1).content,'NUDGE OLD');assert(!n.messages.some(m=>m.role==='user'&&m.content===''));
 const exampleOrder=orderOf(row.payload),example=exampleOrder.splice(exampleOrder.findIndex(o=>o.identifier==='dialogueExamples'),1)[0];exampleOrder.unshift(example);
 const e=compilePreset({row,slots:{dialogueExamples:'<START>作者: 示例输入\n恍然梦: 示例输出'},question:'Q'});assert(e.messages.some(m=>m.content==='恍然梦: 示例输出'&&m.role==='assistant'));
 row.payload.squash_system_messages=true;row.payload.prompts.push({identifier:'sys',role:'system',content:'EXTRA'});orderOf(row.payload).splice(1,0,{identifier:'sys',enabled:true});const m=compilePreset({row,question:'Q'});assert(m.blocks.some(b=>b.blockIds?.includes('main')&&b.blockIds?.includes('sys')));
})
test('disabled history does not silently inject prior dialogue',()=>{const row=defaultPreset();orderOf(row.payload).find(o=>o.identifier==='chatHistory').enabled=false;const r=compilePreset({row,history:[{role:'user',content:'OLD'}],question:'Q'});assert(!r.messages.some(m=>m.content==='OLD'));assert.equal(r.messages.at(-1).content,'Q')})
test('common regex execution compared with actual local ST functions',()=>{
 const root='E:/SillyTavern/SillyTavern-1.15.0/SillyTavern-1.15.0/public/scripts/';
 const engine=fs.readFileSync(root+'extensions/regex/engine.js','utf8'),utils=fs.readFileSync(root+'utils.js','utf8');
 const fn=(source,name)=>{const start=source.indexOf('function '+name+'(');return source.slice(start,source.indexOf('\n}',start)+2)};
 let scripts=[];const env={user:'Author',char:'Assistant'};
 const sub=text=>String(text).replace(/\{\{(user|char)\}\}/g,(_,k)=>env[k]);
 const ctx={console,extension_settings:{disabledExtensions:[]},getRegexScripts:()=>scripts,substituteParams:sub,substituteParamsExtended:(text,unused={},sanitize=x=>x)=>String(text).replace(/\{\{(user|char)\}\}/g,(_,k)=>sanitize(env[k])),substitute_find_regex:{NONE:0,RAW:1,ESCAPED:2},RegexProvider:{instance:{get:regexFromString}}};
 vm.createContext(ctx);vm.runInContext([fn(engine,'sanitizeRegexMacro'),fn(engine,'filterString'),fn(engine,'runRegexScript'),fn(engine,'getRegexedString')].join('\n'),ctx);
 for(const rule of [{findRegex:'/(?<who>林昭)(.+)/g',replaceString:'$<who>:$2:{{match}}:{{user}}',trimStrings:['铜符'],placement:[2]},{findRegex:'/{{user}}/g',replaceString:'A',trimStrings:[],substituteRegex:2,placement:[2]},{findRegex:'/铜符/g',replaceString:'[符]',trimStrings:[],placement:[2],markdownOnly:true,minDepth:0,maxDepth:1},{findRegex:'/林昭/g',replaceString:'PERSON',trimStrings:[],placement:[2],promptOnly:true,runOnEdit:false}]){
  scripts=[rule];for(const phase of ['regular','prompt','display'])for(const depth of [0,2]){
   const text='林昭握住铜符 Author';const expected=ctx.getRegexedString(text,2,{isMarkdown:phase==='display',isPrompt:phase==='prompt',depth});const actual=runStage({text,rules:scripts,env,context:{placement:2,phase,depth}}).text;assert.equal(actual,expected);
  }
 }
 assert.equal(escapeRegexMacro('a/b\n(c)'),ctx.sanitizeRegexMacro('a/b\n(c)'));
})
console.log(`${passed}/${passed} preset core checks passed`)
