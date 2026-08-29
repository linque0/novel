import { exportBackupJson, importBackupJson, buildBookText } from '../db/repo'
import { saveTextFile } from './fileio'
import { decodeText } from './importers'

const stamp = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

export async function backupAll() {
  const json = await exportBackupJson()
  return saveTextFile(`novel-studio-备份-${stamp()}.json`, json)
}

export async function restoreBackup(arrayBuffer) {
  const { text } = decodeText(arrayBuffer)
  await importBackupJson(text)
}

export async function exportBook(work, volumes, chapters, asMarkdown) {
  const text = await buildBookText(work, volumes, chapters, asMarkdown)
  return saveTextFile(`${work.title || '未命名作品'}.${asMarkdown ? 'md' : 'txt'}`, text)
}
