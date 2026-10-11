const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('native', {
  isElectron: true,
  pickFiles: (opts) => ipcRenderer.invoke('import:pick', opts),
  docxToHtml: (arrayBuffer) => ipcRenderer.invoke('docx:toHtml', { data: arrayBuffer }),
  saveFile: (payload) => ipcRenderer.invoke('export:save', payload),
  clipboardReadText: () => ipcRenderer.invoke('clip:readText'),
  clipboardWriteText: (text) => ipcRenderer.invoke('clip:writeText', text),
  /* AI 凭据加解密（safeStorage/DPAPI；主进程只加解密，密文由渲染层存 appconfig，方案 §三） */
  credentialEncrypt: (plain) => ipcRenderer.invoke('credential:put', plain),
  credentialDecrypt: (cipherB64) => ipcRenderer.invoke('credential:get', cipherB64),
  /* 数据存储位置（设置面板）：查询 / 选目录 / 打开目录 / 迁移（dir 为空 = 恢复默认；迁移后应用重启） */
  getDataLocation: () => ipcRenderer.invoke('data:location'),
  pickDataDir: () => ipcRenderer.invoke('data:pickDir'),
  openDataFolder: () => ipcRenderer.invoke('data:openFolder'),
  moveDataDir: (dir) => ipcRenderer.invoke('data:move', { dir: dir || '' }),
  /* 功能面板多窗口（9.2-W5） */
  panelOpen: (spec) => ipcRenderer.invoke('panel:open', spec),
  panelList: () => ipcRenderer.invoke('panel:list'),
  panelFocus: (key) => ipcRenderer.invoke('panel:focus', key),
  panelCloseSelf: () => ipcRenderer.invoke('panel:close-self'),
  panelSetEntity: (entityId) => ipcRenderer.invoke('panel:set-entity', entityId),
  panelOnEvent: (cb) => {
    const handler = (_e, payload) => cb(payload)
    ipcRenderer.on('panel:event', handler)
    return () => ipcRenderer.removeListener('panel:event', handler)
  }
})
