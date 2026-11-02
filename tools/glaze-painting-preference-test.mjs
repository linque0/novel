import assert from 'node:assert/strict'
import { createGlazePaintingPreference, decodePainting } from '../src/services/glaze-painting-preference.js'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

{
  const decoded = deferred()
  const previousImage = globalThis.Image
  let instance
  globalThis.Image = class {
    constructor() { instance = this }
    decode() { return decoded.promise }
  }
  try {
    let finished = false
    const loading = decodePainting('local.webp').then(() => { finished = true })
    instance.onload()
    await Promise.resolve()
    assert.equal(finished, false, 'image load alone cannot commit a painting before decoding')
    decoded.resolve()
    await loading
    assert.equal(finished, true)
  } finally { globalThis.Image = previousImage }
}

{
  const image = deferred()
  const write = deferred()
  const state = { glazePainting: 'sunrise' }
  let notifications = 0
  const preference = createGlazePaintingPreference(state, {
    source: id => id,
    decode: () => image.promise,
    write: () => write.promise,
    notify: () => notifications++
  })
  const choice = preference.choose('starry')
  assert.equal(state.glazePainting, 'sunrise', 'pending decode does not display the new painting')
  image.resolve()
  await Promise.resolve()
  assert.equal(state.glazePainting, 'sunrise', 'pending DB write does not display the new painting')
  write.resolve()
  assert.equal(await choice, true)
  assert.equal(state.glazePainting, 'starry')
  assert.equal(notifications, 1)
}

{
  const state = { glazePainting: 'sunrise' }
  const preference = createGlazePaintingPreference(state, {
    source: id => id,
    decode: async () => {},
    write: async () => { throw new Error('disk full') },
    notify: () => { throw new Error('must not notify') }
  })
  await assert.rejects(preference.choose('poppy'), /disk full/)
  assert.equal(state.glazePainting, 'sunrise', 'failed choice preserves displayed painting')
}

{
  const slow = deferred()
  const writes = []
  const state = { glazePainting: 'sunrise' }
  const preference = createGlazePaintingPreference(state, {
    source: id => id,
    decode: id => id === 'poppy' ? slow.promise : Promise.resolve(),
    write: async row => { writes.push(row.value) },
    notify: () => {}
  })
  const first = preference.choose('poppy')
  const second = preference.choose('starry')
  assert.equal(await second, true)
  slow.resolve()
  assert.equal(await first, false)
  assert.deepEqual(writes, ['starry'], 'obsolete decoded request never writes over newer choice')
  assert.equal(state.glazePainting, 'starry')
}

{
  const firstWrite = deferred()
  const firstWriteStarted = deferred()
  const secondWrite = deferred()
  const writes = []
  const state = { glazePainting: 'sunrise' }
  const preference = createGlazePaintingPreference(state, {
    source: id => id,
    decode: async () => {},
    write: row => { writes.push(row.value); if (writes.length === 1) { firstWriteStarted.resolve(); return firstWrite.promise } return row.value === 'starry' ? secondWrite.promise : Promise.resolve() },
    notify: () => {}
  })
  const first = preference.choose('poppy')
  await firstWriteStarted.promise
  const second = preference.choose('starry')
  firstWrite.resolve()
  assert.equal(await first, false, 'an obsolete in-flight write never displays')
  assert.equal(state.glazePainting, 'sunrise', 'old painting remains while latest choice is pending')
  secondWrite.resolve()
  await second
  assert.deepEqual(writes, ['poppy', 'sunrise', 'starry'], 'obsolete writes are restored before the next serialized write')
  assert.equal(state.glazePainting, 'starry', 'last successful choice wins')
}

{
  const firstWrite = deferred()
  const firstWriteStarted = deferred()
  const latestDecode = deferred()
  const state = { glazePainting: 'sunrise' }
  let stored = 'sunrise'
  let notifications = 0
  const preference = createGlazePaintingPreference(state, {
    source: id => id,
    decode: id => id === 'starry' ? latestDecode.promise : Promise.resolve(),
    write: async row => {
      if (row.value === 'poppy') { firstWriteStarted.resolve(); await firstWrite.promise }
      stored = row.value
    },
    notify: () => notifications++
  })
  const first = preference.choose('poppy')
  await firstWriteStarted.promise
  const second = preference.choose('starry')
  const rejected = assert.rejects(second, /corrupt image/)
  latestDecode.reject(new Error('corrupt image'))
  firstWrite.resolve()
  await Promise.all([first, rejected])
  assert.equal(stored, 'sunrise', 'failed latest decode cannot leave an obsolete choice persisted')
  assert.equal(state.glazePainting, 'sunrise', 'failed latest choice preserves the displayed painting')
  assert.equal(notifications, 0, 'obsolete choices never broadcast')
  assert.equal(preference.saving, false)
}

console.log('PASS glaze painting decode, persistence, failure and rapid choice ordering')
