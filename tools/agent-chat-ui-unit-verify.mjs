import assert from 'node:assert/strict'
import {directionMessageId,messageCards,showRecoveredWriting} from '../src/components/ai/assistant-presentation.js'
const task=(id,sessionId='s',workId='w')=>({id,workId,source:{taskRequest:{type:'chapter.directions',writingSessionId:sessionId}}})
const session={id:'s',workId:'w',directions:[{id:'d',draft:{title:'作者方向'}}],candidates:[{id:'c',editText:'作者编辑稿'}]}
let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
test('streaming directions attach only to the latest real turn of their own work/session',()=>{assert.equal(directionMessageId([task('old'),task('new'),task('other','x'),task('foreign','s','foreign')],session),'new')})
test('candidate views reuse canonical author editing without mutating message snapshots',()=>{const msg={workId:'w',cards:[{id:'c',text:'模型原稿'},{id:'other',text:'其他卡'}]};const cards=messageCards(msg,session);assert.equal(cards[0],session.candidates[0]);assert.equal(cards[1],msg.cards[1]);assert.equal(msg.cards[0].text,'模型原稿')})
test('another work can never borrow current candidate state',()=>{const msg={workId:'foreign',cards:[{id:'c',text:'其他作品'}]};assert.equal(messageCards(msg,session)[0],msg.cards[0])})
test('recovered direction panel is only a view fallback and never duplicates its real turn',()=>{assert(showRecoveredWriting([],session));assert(!showRecoveredWriting([{...task('real'),cards:[{id:'c'}]}],session));assert(!showRecoveredWriting([],{...session,directions:[],candidates:[]}))})

test('unrepresented saved candidates remain reachable beside newer real messages',()=>{assert(showRecoveredWriting([{...task('real'),cards:[{id:'new'}]}],session))})
test('handwritten directions remain reachable after their first real draft turn',()=>{const draft={id:'draft',workId:'w',source:{taskRequest:{type:'chapter.continue',writingSessionId:'s'}},cards:[{id:'c'}]};assert(showRecoveredWriting([draft],session))})
console.log(`${passed}/${passed} assistant presentation checks passed`)
