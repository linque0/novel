const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('native', {
  isElectron: true,
  pickFiles: (opts) => ipcRenderer.invoke('import:pick', opts),
  docxToHtml: (arrayBuffer) => ipcRenderer.invoke('docx:toHtml', { data: arrayBuffer }),
  saveFile: (payload) => ipcRenderer.invoke('export:save', payload),
  clipboardReadText: () => ipcRenderer.invoke('clip:readText'),
  clipboardWriteText: (text) => ipcRenderer.invoke('clip:writeText', text),
  /* 功能面板多窗口（9.2-W5） */
  panelOpen: (spec) => ipcRenderer.invoke('panel:open', spec),
  panelList: () => ipcRenderer.invoke('panel:list'),
  panelFocus: (key) => ipcRenderer.invoke('panel:focus', key),
  panelCloseSelf: () => ipcRenderer.invoke('panel:close-self'),
  panelOnEvent: (cb) => {
    const handler = (_e, payload) => cb(payload)
    ipcRenderer.on('panel:event', handler)
    return () => ipcRenderer.removeListener('panel:event', handler)
  }
})
