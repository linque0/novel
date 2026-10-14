import { db } from '../../db/database.js'
import { ensureProjection, readSourceSnapshot } from '../../db/project-repo.js'
import { sourceManifest } from '../project/normalize.js'
import { hashContent, checkAbort, sourceChanged } from '../project/text.js'
import { bookSession, documentView } from './booksource.js'

// Registered material is indexed as registered material, never invented facts.
// No model is needed to copy author records into the semantic read index.
export async function buildBookMemory(workId,{signal,onProgress}={}) {
  const projection=await ensureProjection(workId,{signal})
  const docs=projection.docs.filter((d)=>!['chapter','work','volume','asset','lorecat'].includes(d.sourceType))
  const done=[]
  for(const doc of docs) {
    checkAbort(signal)
    const chunks=projection.chunks.filter((c)=>c.docId===doc.id)
    const cards=chunks.map((c)=>({id:'source:'+c.id,workId,docId:doc.id,kind:doc.semanticClass==='summary'?'writtenOutline':doc.semanticClass==='plan'?'planBeat':doc.semanticClass==='inspiration'?'inspiration':doc.semanticClass==='comment'?'comment':doc.sourceType==='character'?'characterProfile':doc.sourceType==='relation'?'relation':'authorSetting',
      schemaVersion:1,semanticClass:doc.semanticClass,assertionStatus:'authorRecord',title:doc.title,
      body:{text:c.text,sourceType:doc.sourceType,temporalStatus:doc.meta.temporalStatus||'author-record'},
      refType:doc.sourceType,refId:doc.sourceId,sourceHash:doc.sourceHash,contextHash:doc.contextHash,dependencies:doc.deps,
      evidence:{docId:doc.id,sourceType:doc.sourceType,sourceId:doc.sourceId,textHash:doc.textHash,sourceHash:doc.sourceHash,start:c.contextStart,end:c.coreEnd,chunkId:c.id,paragraphId:c.paragraphIds[0],evidenceStatus:'source-record'},updatedAt:Date.now()}))
    const meta={id:'docmeta:'+doc.id,workId,docId:doc.id,sourceType:doc.sourceType,sourceId:doc.sourceId,sourceHash:doc.sourceHash,contextHash:doc.contextHash,status:'success',mode:'source-records',extracted:false,totalChunks:chunks.length,doneChunks:chunks.length,updatedAt:Date.now()}
    await db.transaction('rw',[db.aikb,db.aikbmeta,db.aiindex],async()=>{
      const current=await db.aiindex.get(workId)
      if(current?.sourceRevision!==projection.index.sourceRevision||current.status!=='ready')throw sourceChanged()
      await db.aikb.where('workId').equals(workId).filter((r)=>r.docId===doc.id&&r.assertionStatus==='authorRecord').delete()
      if(cards.length)await db.aikb.bulkPut(cards)
      await db.aikbmeta.put(meta)
    })
    done.push(doc.id);onProgress?.({stage:'source-index',done:done.length,total:docs.length})
  }
  const source=await readSourceSnapshot(workId)
  if(sourceManifest(source).hash!==projection.index.sourceRevision)throw sourceChanged()
  const keep=new Set(docs.map((d)=>d.id))
  await db.transaction('rw',[db.aikb,db.aikbmeta],async()=>{
    await db.aikb.where('workId').equals(workId).filter((r)=>r.assertionStatus==='authorRecord'&&!keep.has(r.docId)).delete()
    await db.aikbmeta.where('workId').equals(workId).filter((r)=>r.mode==='source-records'&&!keep.has(r.docId)).delete()
  })
  return {projection,readDocuments:done.length,mode:'source-records'}
}

export async function sourceKnowledge(work,{asOfChapterId=null,privacy=false}={}) {
  const session=bookSession(work,{asOfChapterId,privacy})
  const docs=new Map(session.docs.map((d)=>[d.id,d]))
  const [rows,decisions]=await Promise.all([db.aikb.where('workId').equals(work.work.id).toArray(),db.aidecisions.where('workId').equals(work.work.id).toArray()])
  return rows.filter((r)=>r.assertionStatus==='authorRecord'&&docs.has(r.docId)&&r.sourceHash===docs.get(r.docId).sourceHash&&r.contextHash===docs.get(r.docId).contextHash&&!documentView(docs.get(r.docId),session).withheld&&!decisions.some((d)=>d.action==='ignore'&&(d.key==='card:'+r.id||d.key===r.decisionKey)))
}

export function ruleCandidates(session) {
  return session.docs.filter((d)=>d.semanticClass==='setting'&&!['character','relation'].includes(d.sourceType)).flatMap((doc)=>
    doc.plainText.split('\n').filter((line)=>/必须|不得|不能|禁止|不可|只有|需要|代价|上限/.test(line)).map((text)=>({
      id:'rule:'+hashContent(doc.id+':'+text),docId:doc.id,sourceId:doc.sourceId,text,semanticClass:'setting',strength:'candidate',status:'needsReview',sourceVersions:doc.deps
    })))
}
