// Actual store actions, deterministic persistence only. No application profile or model.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../src/stores/creative-workflow.js',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,'').replace('export const useCreativeWorkflowStore','const useCreativeWorkflowStore')
let save,stored
const options=new Function('defineStore','saveCreativeWorkflow','loadCreativeWorkflows','db','useWorkStore',source+'\nreturn useCreativeWorkflowStore')(
  (_id,options)=>options,run=>save(run),async()=>[structuredClone(stored)],{airuns:{get:async()=>null}},()=>({work:{id:'book'}}))
function context(run){const ctx={byWork:{book:run},error:''};Object.defineProperty(ctx,'active',{get:()=>ctx.byWork.book});for(const [name,fn]of Object.entries(options.actions))ctx[name]=fn.bind(ctx);return ctx}
const run={id:'save-race',workId:'book',version:1,status:'ready',owner:null,stages:[],text:'old'}
stored=structuredClone(run)
const ctx=context(run)
save=async()=>{throw Error('disk failure')}
run.text='author input'
await assert.rejects(ctx.persist(),/disk failure/)
await ctx.load('book')
assert.equal(ctx.active.text,'author input','failed persistence must survive remote reload')
const snapshots=[]
save=async value=>{
  snapshots.push(structuredClone(value))
  if(snapshots.length===1){await Promise.resolve();value.text='last input before closing';ctx.changed(value)}
  stored=snapshots.at(-1)
}
await ctx.prepareForClose()
assert.equal(snapshots.at(-1).text,'last input before closing','close must drain changes arriving during a pending save')
assert.equal(snapshots.length,2)
console.log('workflow save verification passed: failed-load preservation and close-save race')
