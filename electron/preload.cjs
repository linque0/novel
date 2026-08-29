const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('native', {
  isElectron: true,
  pickFiles: (opts) => ipcRenderer.invoke('import:pick', opts),
  docxToHtml: (arrayBuffer) => ipcRenderer.invoke('docx:toHtml', { data: arrayBuffer }),
  saveFile: (payload) => ipcRenderer.invoke('export:save', payload),
  clipboardReadText: () => ipcRenderer.invoke('clip:readText'),
  clipboardWriteText: (text) => ipcRenderer.invoke('clip:writeText', text)
})
