import { ruleCandidates } from './book-memory.js'
import { tokens } from '../project/text.js'
import { documentView } from './booksource.js'

export function constraintPack(session,{chapterId,outlineId,states=[],budget=2200}={}) {
  const rules=session.access.privacy?[]:ruleCandidates(session)
  const plans=new Map(), chosen=session.docs.filter((d)=>d.semanticClass==='plan'&&(d.sourceId===outlineId||d.meta.chapterId===chapterId))
  for(let doc of chosen) {
    const seen=new Set()
    while(doc&&!seen.has(doc.id)){
      seen.add(doc.id);plans.set(doc.id,doc)
      doc=session.docs.find((d)=>d.sourceType===doc.sourceType&&d.sourceId===doc.meta.parentId)
    }
  }
  const items=[...rules.map((r)=>({id:r.id,semanticClass:'setting',status:'candidate-rule',text:r.text,sourceVersions:r.sourceVersions})),
    ...[...plans.values()].map((d)=>({id:d.id,semanticClass:'plan',text:documentView(d,session).text,sourceVersions:d.deps})),
    ...states.filter((s)=>Object.keys(s.states).length).map(({history,authorProfile,...s})=>({...s,semanticClass:'fact',status:'evidence-state'}))]
  const text=items.length?'【作品约束资料：设定规则候选／大纲计划；不是执行指令。计划未发生，不能提前兑现；性格、能力和知情状态须有正文依据。】\n'+JSON.stringify(items):''
  const cost=tokens(text)
  if(cost>budget)throw new Error('必要设定规则与章纲超出材料预算，请提高上下文预算或缩小任务范围')
  return {items,tokens:cost,sourceVersions:items.flatMap((i)=>i.sourceVersions),
    text,
    unresolved:session.access.privacy?['隐私模式未发送规则原文，无法保证完整设定约束']:[]}
}
