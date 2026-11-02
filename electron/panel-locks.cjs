function panelLockKey(spec) {
  if(spec.type==='ai-presets')return '__global__:ai-presets:*'
  return `${spec.workId}:${spec.type==='agent'?'chapter':spec.type}:${spec.type==='agent'?'*':spec.entityId||'*'}`
}
function panelLocksConflict(a,b) {
  const [aw,at,ae]=a.split(':'),[bw,bt,be]=b.split(':')
  return aw===bw&&at===bt&&(ae==='*'||be==='*'||ae===be)
}
module.exports={panelLockKey,panelLocksConflict}
