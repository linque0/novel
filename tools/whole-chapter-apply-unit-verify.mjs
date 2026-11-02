import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {Schema} from '@tiptap/pm/model'
import {normalizeText} from '../src/services/project/text.js'
const source=readFileSync(new URL('../src/services/ai/application.js',import.meta.url),'utf8')
const body=source.slice(source.indexOf('export function locateEditorPatch('),source.indexOf('export async function applyProposal(')).replace('export function','function')
const locate=Function('normalizeText',body+';return locateEditorPatch')(normalizeText)
const schema=new Schema({nodes:{doc:{content:'paragraph+'},paragraph:{content:'text*'},text:{}},marks:{annotation:{}}})
function editor(paragraphs,marked=false){
 const doc=schema.node('doc',null,paragraphs.map(t=>schema.node('paragraph',null,t?schema.text(t,marked?[schema.marks.annotation.create()]:[]):[])))
 return {state:{doc},getHTML:()=>paragraphs.map(t=>'<p>'+t+'</p>').join('')}
}
const ed=editor(['甲段。','乙段。'])
const full=locate(ed,'甲段。\n\n乙段。',{wholeChapter:true})
assert.equal(full.from,0);assert.equal(full.to,ed.state.doc.content.size)
assert.equal(full.protectedMark,false)
assert.throws(()=>locate(ed,'甲段。\n\n已经改变。',{wholeChapter:true}))
assert.throws(()=>locate(ed,'甲段。',{wholeChapter:true}), 'a whole chapter operation cannot degrade into substring replacement')
assert.equal(locate(ed,'乙段。').from,6)
assert.equal(locate(editor(['重复。','重复。']),'重复。\n\n重复。',{wholeChapter:true}).from,0)
assert.throws(()=>locate(editor(['重复。','重复。']),'重复。'))
assert.equal(locate(editor(['甲段。','乙段。'],true),'甲段。\n\n乙段。',{wholeChapter:true}).protectedMark,true)
console.log('whole-chapter apply verification passed: exact normalized body, repeated paragraphs, scope and protected marks')
