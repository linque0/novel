const { app } = require('electron')
const path = require('node:path')

/** 解析主窗与独立面板窗口图标路径：打包态取 extraResources，开发态取 build/icon.ico。 */
function windowIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '..', 'build', 'icon.ico')
}

module.exports = { windowIconPath }
