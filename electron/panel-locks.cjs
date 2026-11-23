/**
 * 跨窗口面板实体锁键计算与冲突判定（纯逻辑模块，供主进程 panels.js 与测试共用）。
 * 键格式固定为 `<workId>:<type>:<entityId|'*'>`：
 * - 创作台（agent）视为对整部作品正文的独占编辑，映射到 `chapter:*` 与单章拆窗互斥；
 * - 预设窗与写作分析窗分别为全局单例和全应用单例。
 */
function panelLockKey(spec) {
  if(spec.type==='ai-presets')return '__global__:ai-presets:*'
  if(spec.type==='writing-analysis')return 'app:writing-analysis:*'
  return `${spec.workId}:${spec.type==='agent'?'chapter':spec.type}:${spec.type==='agent'?'*':spec.entityId||'*'}`
}
/** 判定两个锁键是否冲突：同作品同模块下，任一方为整模块通配锁（*）或实体 ID 相同即冲突。 */
function panelLocksConflict(a,b) {
  const [aw,at,ae]=a.split(':'),[bw,bt,be]=b.split(':')
  return aw===bw&&at===bt&&(ae==='*'||be==='*'||ae===be)
}
module.exports={panelLockKey,panelLocksConflict}
