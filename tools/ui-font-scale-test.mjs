import assert from 'node:assert/strict'
import {
  UI_FONT_SCALE_DEFAULT,
  UI_FONT_SCALE_PRESETS,
  normalizeUiFontScale,
  normalizeSettingsPrefs,
  resetAppearancePrefs
} from '../src/components/skins/latent/settings/settings-prefs.js'
import { SETTINGS_CATALOG, searchSettings } from '../src/components/skins/latent/settings/settings-catalog.js'
import { shouldSkipSelector, scalePxValue, scaleFontShorthand } from './postcss-ui-font-scale.mjs'

let passed = 0
const check = (name, fn) => {
  fn()
  console.log('PASS', name)
  passed++
}

check('normalizeUiFontScale clamps to 85..140 in steps of 5 and falls back to 100', () => {
  assert.equal(normalizeUiFontScale(undefined), UI_FONT_SCALE_DEFAULT)
  assert.equal(normalizeUiFontScale(null), 100)
  assert.equal(normalizeUiFontScale('abc'), 100)
  assert.equal(normalizeUiFontScale(60), 85)
  assert.equal(normalizeUiFontScale(180), 140)
  assert.equal(normalizeUiFontScale(113), 115)
  assert.equal(normalizeUiFontScale(112), 110)
  assert.equal(UI_FONT_SCALE_PRESETS.map((p) => p.value).join(','), '90,100,115,130')
})

check('normalizeSettingsPrefs and resetAppearancePrefs include uiFontScale and preserve fontSize', () => {
  const n = normalizeSettingsPrefs({ uiFontScale: 130, fontSize: 20 })
  assert.equal(n.uiFontScale, 130)
  assert.equal(n.fontSize, 20)
  const r = resetAppearancePrefs()
  assert.equal(r.uiFontScale, 100)
  assert.equal(r.fontSize, 17)
})

check('SETTINGS_CATALOG replaces fontSize with uiFontScale and supports search', () => {
  assert.equal(SETTINGS_CATALOG.some((x) => x.id === 'fontSize'), false)
  assert.equal(SETTINGS_CATALOG.some((x) => x.id === 'uiFontScale'), true)
  const hits = searchSettings('全局字体')
  assert.equal(hits.some((x) => x.id === 'uiFontScale'), true)
  const hits2 = searchSettings('大字')
  assert.equal(hits2.some((x) => x.id === 'uiFontScale'), true)
})

check('postcss-ui-font-scale transforms UI px fonts and skips manuscript & canvas cards', () => {
  assert.equal(scalePxValue('13px'), 'calc(13px * var(--ui-font-scale, 1))')
  assert.equal(scalePxValue('12.5px'), 'calc(12.5px * var(--ui-font-scale, 1))')
  assert.equal(scalePxValue('var(--editor-fs)'), null)
  assert.equal(scalePxValue('calc(12px * 1.2)'), null)
  assert.equal(scalePxValue('1.2em'), null)
  assert.equal(
    scaleFontShorthand('500 13px/20px "Microsoft YaHei", sans-serif'),
    '500 calc(13px * var(--ui-font-scale, 1))/calc(20px * var(--ui-font-scale, 1)) "Microsoft YaHei", sans-serif'
  )
  assert.equal(
    scaleFontShorthand('500 18px/1.5 var(--set-serif)'),
    '500 calc(18px * var(--ui-font-scale, 1))/1.5 var(--set-serif)'
  )
  assert.equal(shouldSkipSelector('.ProseMirror p'), true)
  assert.equal(shouldSkipSelector('.rich-inner h1'), true)
  assert.equal(shouldSkipSelector('.preview-copy'), true)
  assert.equal(shouldSkipSelector('.oc-fit-title'), true)
  assert.equal(shouldSkipSelector('.oc-node.event .oc-label'), true)
  assert.equal(shouldSkipSelector('.draft-card-main p'), true)
  assert.equal(shouldSkipSelector('html'), true)
  /* UI chrome, sidebars, drawers, popovers, settings MUST scale */
  assert.equal(shouldSkipSelector('.settings-shell .setting-copy p'), false)
  assert.equal(shouldSkipSelector('.oc-node-drawer h2'), false)
  assert.equal(shouldSkipSelector('.draft-detail p'), false)
  assert.equal(shouldSkipSelector('.editor-toolbar .tb'), false)
  assert.equal(shouldSkipSelector('.oc-ctx-item'), false)
})

console.log(`ui-font-scale: ${passed}/${passed} checks passed`)
