const { createHash, timingSafeEqual } = require('node:crypto')
const { createReadStream } = require('node:fs')
const semver = require('semver')

const repository = 'https://github.com/linque0/novel'
const latest = 'https://api.github.com/repos/linque0/novel/releases/latest'
const releases = repository + '/releases'

function readRelease(row, current) {
  const tag = row?.tag_name
  const version = typeof tag === 'string' && semver.valid(tag)
  if (!version || row.draft || row.prerelease || semver.prerelease(version) || !semver.gt(version, current)) return null
  const url = releases + '/tag/' + encodeURIComponent(tag)
  const base = releases + '/download/' + encodeURIComponent(tag) + '/'
  const filename = 'novel-studio-setup-' + version + '.exe'
  const uploaded = name => Array.isArray(row.assets) && row.assets.some(asset =>
    asset?.name === name && asset.state === 'uploaded' && asset.browser_download_url === base + name)
  return {
    version, url, base, filename,
    notes: typeof row.body === 'string' ? row.body.trim().slice(0, 12000) : '',
    hasInstaller: uploaded(filename) && uploaded('latest.yml')
  }
}

function validateUpdate(info, release) {
  const file = Array.isArray(info?.files) && info.files.length === 1 ? info.files[0] : null
  const hash = file?.sha512
  if (info?.version !== release.version || file?.url !== release.filename || file?.packageInfo ||
      info?.packages || typeof hash !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(hash) ||
      Buffer.from(hash, 'base64').toString('base64') !== hash) {
    throw Object.assign(new Error('更新清单与 GitHub 发布不一致，请前往发布页。'), { code: 'INVALID_RELEASE_MANIFEST' })
  }
  return hash
}

async function verifyInstaller(file, digest) {
  const hash = createHash('sha512')
  for await (const bytes of createReadStream(file)) hash.update(bytes)
  if (!timingSafeEqual(hash.digest(), Buffer.from(digest, 'base64'))) {
    throw new Error('安装包校验失败，请重新下载。')
  }
}

function createUpdates({ current, supported, canInstall, fetchRelease, makeUpdater, verify = verifyInstaller,
  prepareWindows, notify, blocked = () => false }) {
  let state = { status: supported ? 'idle' : 'unavailable', current, release: null, progress: 0, error: '' }
  let release
  let downloaded
  let task
  let startupChecked = false
  let startupDismissed = false

  function set(patch) {
    state = { ...state, ...patch }
    notify()
  }
  function run(work) {
    if (task) return task
    task = Promise.resolve().then(work).finally(() => { task = null })
    return task
  }
  const fail = (status, error, fallback) => set({ status, error: error?.message || fallback })

  function check(startup = false) {
    if (!supported || startup && startupChecked) return
    if (startup) startupChecked = true
    if (downloaded || state.status === 'installing') return
    if (startup && task) {
      return task.then(() => {
        if (state.status === 'available' && !startupDismissed) set({ prompt: true })
      })
    }
    return run(async () => {
      set({ status: 'checking', release: null, progress: 0, error: '', prompt: false })
      release = null
      try {
        release = readRelease(await fetchRelease(), current)
        if (!release) { set({ status: 'current' }); return }
        set({
          status: 'available',
          release: { version: release.version, notes: release.notes, url: release.url, installable: canInstall && release.hasInstaller },
          prompt: startup && !startupDismissed
        })
      } catch (error) {
        fail('check-error', error, '无法检查更新，请稍后重试。')
      }
    })
  }

  function download() {
    if (!release || !state.release?.installable || downloaded) return task
    startupDismissed = true
    return run(async () => {
      set({ status: 'downloading', progress: 0, error: '', prompt: false })
      let updater
      const progress = ({ percent }) => set({ progress: Math.max(0, Math.min(100, Math.round(percent) || 0)) })
      try {
        updater = makeUpdater(release.base)
        updater.on('download-progress', progress)
        const candidate = await updater.checkForUpdates()
        const digest = validateUpdate(candidate?.updateInfo, release)
        const [file] = await updater.downloadUpdate()
        downloaded = { updater, file, digest }
        set({ status: 'ready', progress: 100 })
      } catch (error) {
        if (['ERR_UPDATER_CHANNEL_FILE_NOT_FOUND', 'ERR_UPDATER_INVALID_UPDATE_INFO', 'INVALID_RELEASE_MANIFEST'].includes(error?.code)) {
          set({ status: 'available', release: { ...state.release, installable: false }, error: '此版本的更新清单不可用，请前往发布页。' })
        } else {
          console.warn('[update]', error)
          fail('download-error', null, '更新下载失败，请检查网络或磁盘空间后重试。')
        }
      } finally {
        updater?.removeListener('download-progress', progress)
      }
    })
  }

  function install() {
    if (!downloaded || state.status === 'installing') return task
    return run(async () => {
      set({ status: 'installing', error: '', prompt: false })
      try {
        await verify(downloaded.file, downloaded.digest)
      } catch (error) {
        downloaded = null
        fail('download-error', null, '安装包校验失败，请重新下载。')
        return
      }
      let resume
      try {
        if (blocked()) throw new Error('数据正在迁移，请完成后再安装。')
        resume = await prepareWindows()
        if (blocked()) throw new Error('数据正在迁移，请完成后再安装。')
        await downloaded.updater.installAndQuit()
      } catch (error) {
        await resume?.()
        fail('ready', error, '安装未能启动，请重试。')
      }
    })
  }

  return {
    check, download, install,
    snapshot: (main = false) => ({ ...state, prompt: main && state.prompt === true }),
    dismiss() { startupDismissed = true; set({ prompt: false }) },
    url: kind => kind === 'release' ? (release?.url || releases) : repository
  }
}

module.exports = { createUpdates, readRelease, validateUpdate, latest }
