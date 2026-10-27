import assert from 'node:assert/strict'
import { Schema } from '@tiptap/pm/model'
import { captureWritingAnchor, validateWritingAnchor } from '../src/services/ai/writing-anchor.js'
import { normalizeDirectionRows, completedDirectionRows, mergeDirectionRows, editDirection, selectedDirectionSnapshot } from '../src/services/ai/writing-directions.js'
import { normalizeTaskRequest, taskApplyActions } from '../src/services/ai/task-profiles.js'
let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
const schema=new Schema({nodes:{doc:{content:'paragraph+'},paragraph:{content:'text*'},text:{}}})
const doc=schema.node('doc',null,[schema.node('paragraph',null,schema.text('相同句子。相同句子。')),schema.node('paragraph',null,schema.text('后文秘密。'))])
const editor={state:{doc,selection:{from:6,to:11}},isDestroyed:false,isEditable:true}
const chapter={id:'c',workId:'w',title:'正文',fmt:'text',content:'相同句子。相同句子。\n\n后文秘密。'}
const capture=(mode)=>captureWritingAnchor(editor,{workId:'w',chapterId:'c',chapter,mode})
test('repeated selections bind the actual editor coordinates',()=>{const a=capture('replace');assert.equal(a.from,6);assert.equal(a.to,11);assert.equal(a.selection,'相同句子。');assert.equal(a.cutoff,5);assert(validateWritingAnchor(editor,a))})
test('insert, after selection and append have distinct frozen positions',()=>{assert.equal(capture('insert').from,6);assert.equal(capture('afterSelection').from,11);assert.equal(capture('append').from,doc.content.size-1)})
test('changed editor content invalidates anchors without text search relocation',()=>{const a=capture('replace');const other={...editor,state:{...editor.state,doc:schema.node('doc',null,[schema.node('paragraph',null,schema.text('改动'))])}};assert.throws(()=>validateWritingAnchor(other,a))})
test('readonly editors and nonexistent/empty replacement ranges cannot launch writing',()=>{assert.throws(()=>captureWritingAnchor({...editor,isEditable:false},{workId:'w',chapterId:'c',chapter}));assert.throws(()=>captureWritingAnchor({...editor,state:{doc,selection:{from:1,to:1}}},{workId:'w',chapterId:'c',chapter,mode:'replace'}))})
const rows=n=>Array.from({length:n},(_,i)=>({id:'m'+i,title:'方向'+i,development:'不同演变'+i}))
test('4, 5, 6 directions and single replacement validate exact expected quantities',()=>{for(const n of [1,4,5,6])assert.equal(normalizeDirectionRows(rows(n),n).length,n);for(const n of [0,7])assert.throws(()=>normalizeDirectionRows(rows(n),n));assert.throws(()=>normalizeDirectionRows(rows(4),5))})
test('empty, duplicate and malformed directions are refused',()=>{assert.throws(()=>normalizeDirectionRows([{id:'a',title:'',development:'正文'}],1));assert.throws(()=>normalizeDirectionRows([rows(1)[0],rows(1)[0]],2));assert.throws(()=>normalizeDirectionRows([{id:'a',title:'x',development:4}],1))})
test('stream parser exposes complete cards only and understands quoted braces',()=>{const data={data:{directions:[{id:'a',title:'带"引号',development:'文本}与['},...rows(2)]}};const raw=JSON.stringify(data),cut=raw.indexOf(',{"id":"m0"');assert.equal(completedDirectionRows(raw.slice(0,cut+1)).length,1);assert.equal(completedDirectionRows(raw).length,3)})
const set=()=>({id:'s',directions:[],selectedId:null,generation:{token:'t',slots:[],revisions:{}}})
test('completed cards can be edited while later cards arrive without losing edits',()=>{const s=set();mergeDirectionRows(s,rows(1),'t');const id=s.directions[0].id;editDirection(s,id,{development:'我决定拒绝交易'});mergeDirectionRows(s,rows(5),'t');assert.equal(s.directions.length,5);assert.equal(s.directions[0].draft.development,'我决定拒绝交易');assert(s.directions[0].kept)})
test('stale generation callbacks cannot mutate a new direction batch',()=>{const s=set();assert.equal(mergeDirectionRows(s,rows(4),'old'),false);assert.equal(s.directions.length,0)})
test('deleted streaming direction slots never resurrect on later callbacks',()=>{const s=set();mergeDirectionRows(s,rows(1),'t');const id=s.directions[0].id;s.directions=[];s.generation.removed=[id];mergeDirectionRows(s,rows(5),'t');assert.equal(s.directions.length,4);assert(!s.directions.some(d=>d.id===id))})
test('whole document selection is a valid rewrite target',()=>{const all={...editor,state:{doc,selection:{from:0,to:doc.content.size}}};const a=captureWritingAnchor(all,{workId:'w',chapterId:'c',chapter,mode:'replace'});assert(validateWritingAnchor(all,a));assert(normalizeTaskRequest({type:'chapter.rewrite',chapterId:'c',writingAnchor:a}, {work:{id:'w'},chapters:[chapter],volumes:[]}))})
test('selected direction snapshots use current visible editing and stay immutable',()=>{const s=set();mergeDirectionRows(s,rows(4),'t');s.selectedId=s.directions[2].id;editDirection(s,s.selectedId,{title:'作者方向',development:'先行调查'});const snap=selectedDirectionSnapshot(s);editDirection(s,s.selectedId,{development:'再次修改'});assert.equal(snap.development,'先行调查');assert.equal(snap.title,'作者方向');assert.notEqual(snap.revision,s.directions[2].revision)})
test('clearing an option cannot silently fall back to original AI text',()=>{const s=set();mergeDirectionRows(s,rows(4),'t');s.selectedId=s.directions[0].id;editDirection(s,s.selectedId,{development:''});assert.throws(()=>selectedDirectionSnapshot(s))})
test('direction generation has no chapter writeback actions',()=>assert.deepEqual(taskApplyActions('chapter.directions'),[]))
test('task normalization preserves and validates frozen writing anchors',()=>{const work={work:{id:'w'},chapters:[chapter],volumes:[]};const a=capture('replace');const task=normalizeTaskRequest({type:'chapter.rewrite',chapterId:'c',writingAnchor:a,selection:a.selection},work);assert.deepEqual(task.writingAnchor,a);assert.throws(()=>normalizeTaskRequest({...task,writingAnchor:{...a,workId:'another'}},work))})
console.log(`${passed}/${passed} writing workflow unit checks passed`)
