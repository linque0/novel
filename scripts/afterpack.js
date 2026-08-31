/* electron-builder afterPack 钩子：清理对运行无用的许可文件（语言包主体由 electronLanguages 裁剪） */
const fs = require('fs')
const path = require('path')

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return
  const out = context.appOutDir
  // 保留 vk_swiftshader（无 GPU 老机器的软件渲染回退）与 d3dcompiler（旧系统着色器编译）
  for (const f of ['LICENSES.chromium.html', 'LICENSE.electron.txt']) {
    try {
      fs.rmSync(path.join(out, f), { force: true })
    } catch {
      /* 文件不存在时忽略 */
    }
  }
  console.log('[afterpack] 已清理许可文件（LICENSES.chromium.html / LICENSE.electron.txt）')
}
