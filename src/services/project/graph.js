import { hashContent, rowHash, stableStringify, normalizeText } from './text.js'

export function projectGraph(bundle, docs, decisions = []) {
  const workId = bundle.work.id, entities = [], edges = [], issues = []
  const live = (t) => (bundle[t] || []).filter((r) => !r.deletedAt)
  const docMap=new Map(docs.map((d)=>[d.sourceTable+':'+d.sourceId,d]))
  const docFor = (t, id) => docMap.get(t+':'+id)
  const addEntity = (kind, row, type, title) => {
    const id = `${type}:${row.id}`, doc = docFor(type === 'character' ? 'characters' : 'mubu', row.id)
    entities.push({ id, workId, kind, name: title, aliases: String(row.aliases || '').split(/[、，,\s/]+/).filter(Boolean), refType: type, refId: row.id,
      semanticClass: 'setting', temporalStatus: 'unknown', sourceHash: rowHash(row), docId: doc?.id })
  }
  for (const c of live('characters')) addEntity('character', c, 'character', c.name)
  for (const n of live('mubu')) addEntity(/势力|组织|门派/.test(docFor('mubu',n.id)?.headingPath.join('/') || '') ? 'faction' : 'lore', n, 'lore', (n.text || '').split('\n')[0])
  const edge = (fromId, toId, kind, doc, label = '', semanticClass = doc?.semanticClass || 'setting') => {
    const id = 'edge:' + hashContent(stableStringify([fromId, toId, kind, doc?.id, label]))
    edges.push({ id, workId, fromId, toId, kind, label, semanticClass, docId: doc?.id, chapterId: doc?.meta.chapterId || null,
      dependencies: doc?.deps || [], temporalStatus: semanticClass === 'fact' ? 'chapter' : 'unknown' })
  }
  for(const entity of entities)if(entity.docId)edge(entity.id,entity.docId,'profile',docs.find((d)=>d.id===entity.docId))
  for (const r of live('relations')) {
    const d = docFor('relations',r.id)
    if (d) edge('character:' + r.fromId, 'character:' + r.toId, 'relationship', d, r.label)
  }
  const names = new Map()
  for (const e of entities) for (const name of [e.name, ...e.aliases].filter(Boolean)) {
    if (!names.has(name)) names.set(name, [])
    names.get(name).push(e)
  }
  const targetDocs=(kind,id)=>kind==='outline'?docs.filter((d)=>d.semanticClass==='plan'&&(d.sourceId===id||d.meta.refId===id)):docs.filter((d)=>d.sourceType===kind&&d.sourceId===id)
  for(const link of live('links')) {
    const source=targetDocs(link.entityType,link.entityId)[0],target=docFor('assets',link.assetId)
    if(source&&target)edge(source.id,target.id,'attachment',source)
    else issues.push({type:'missing-attachment-link',sourceId:link.entityId,assetId:link.assetId})
  }
  for (const doc of docs) {
    const source=(bundle[doc.sourceTable]||[]).find((r)=>r.id===doc.sourceId)
    const raw=[source?.content,source?.html,source?.text,...(source?.textboxes||[]).map((b)=>b.text)].filter(Boolean).join('\n')
    for(const match of raw.matchAll(/data-dl-target\s*=\s*["']([^"']+)["']/g)) {
      const sep=match[1].indexOf(':'),kind=match[1].slice(0,sep),id=match[1].slice(sep+1),targets=sep>0?targetDocs(kind,id):[]
      if(targets.length)for(const target of targets)edge(doc.id,target.id,'doublelink',doc)
      else issues.push({type:'missing-doublelink',sourceId:doc.sourceId,ref:match[1]})
    }
    for(const match of raw.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
      const title=normalizeText(match[1],'text').toLowerCase(),targets=docs.filter((d)=>d.title.toLowerCase()===title)
      if(targets.length===1)edge(doc.id,targets[0].id,'doublelink',doc)
      else issues.push({type:targets.length?'ambiguous-doublelink':'missing-doublelink',sourceId:doc.sourceId,title:match[1]})
    }
    if (doc.meta.parentId) {
      const parent = docs.find((d) => d.sourceType === doc.sourceType && d.sourceId === doc.meta.parentId)
      if (parent) edge(doc.id, parent.id, 'parent', doc)
    }
    if (doc.meta.refId) {
      const [type, id] = doc.meta.refId.includes(':') ? doc.meta.refId.split(':') : [null, doc.meta.refId]
      const target = docs.find((d) => d.sourceId === id && (!type || d.sourceType === type || (type === 'lore' && d.sourceType === 'mubu')))
      if (target) edge(doc.id, target.id, doc.semanticClass === 'plan' ? 'plans' : 'reference', doc)
      else issues.push({ type: 'missing-reference', sourceId: doc.sourceId, ref: doc.meta.refId })
    }
    for (const rel of doc.meta.rels || []) {
      const target = docs.find((d) => d.sourceType === 'olnode' && d.sourceId === (rel.to || rel.toId))
      if (target) edge(doc.id, target.id, 'outline-' + (rel.kind || '关联'), doc, rel.kind)
    }
    if (doc.sourceType !== 'chapter') continue
    for (const [name, matched] of names) {
      if (!doc.plainText.includes(name)) continue
      const merge = decisions.find((d) => d.key === 'entity:' + name && d.action === 'merge')
      const matches = merge ? matched.filter((e) => e.refId === merge.refId && e.refType === merge.refType) : matched
      if (matches.length !== 1) { issues.push({ type: 'ambiguous-mention', sourceId: doc.sourceId, name }); continue }
      edge(doc.id, matches[0].id, 'mention', doc, name, 'fact')
    }
  }
  return { entities, edges: [...new Map(edges.map((e) => [e.id,e])).values()], issues }
}
