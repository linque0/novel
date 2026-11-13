const { app } = require('electron')
const path = require('node:path')

function windowIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '..', 'build', 'icon.ico')
}

module.exports = { windowIconPath }
