<script setup>
import { useUiStore } from '../../../../stores/ui'
import { FLOW_PRESETS, rgbFromHex } from '../../../../services/latent/flow-palette.js'

const ui = useUiStore()
const channels = ['R', 'G', 'B']

function choose(mode, colors = ui.flowBackground.colors) {
  const current = ui.flowBackground
  if (current.mode === mode && current.colors.every((hex, i) => hex === colors[i])) return
  ui.applyPref('flowBackground', { mode, colors })
}

function changeColor(index, hex) {
  const colors = [...ui.flowBackground.colors]
  colors[index] = hex.toUpperCase()
  choose('custom', colors)
}

function changeChannel(index, channel, event) {
  const input = event.target
  const rgb = rgbFromHex(ui.flowBackground.colors[index])
  if (Number.isFinite(input.valueAsNumber)) {
    rgb[channel] = Math.min(255, Math.max(0, Math.round(input.valueAsNumber)))
  }
  input.value = rgb[channel]
  changeColor(index, '#' + rgb.map(value => value.toString(16).padStart(2, '0')).join(''))
}
</script>

<template>
  <section class="setting-group flow-settings">
    <div class="section-title">
      <h2>流动背景</h2>
      <small>书架 · 工作台 · 设置</small>
    </div>
    <div class="setting-row" data-setting="flowBackground">
      <div class="setting-copy">
        <label for="flow-background-mode">配色模式</label>
        <p>随作品变化，或在各页面使用同一组颜色</p>
      </div>
      <select id="flow-background-mode" class="select" :value="ui.flowBackground.mode"
        @change="choose($event.target.value)">
        <option value="cover">跟随作品封面</option>
        <option value="custom">自定义两色</option>
      </select>
    </div>

    <div v-if="ui.flowBackground.mode === 'custom'" class="flow-colors">
      <fieldset v-for="(hex, index) in ui.flowBackground.colors" :key="index" class="flow-color">
        <legend>颜色 {{ index + 1 }}</legend>
        <div class="flow-rgb">
          <input type="color" :aria-label="`颜色 ${index + 1} 色板`" :value="hex"
            @change="changeColor(index, $event.target.value)" />
          <label v-for="(value, channel) in rgbFromHex(hex)" :key="channel" class="flow-channel">
            <span>{{ channels[channel] }}</span>
            <input type="number" min="0" max="255" step="1" :value="value"
              :aria-label="`颜色 ${index + 1} ${channels[channel]}`"
              @change="changeChannel(index, channel, $event)" @keydown.enter.prevent="$event.target.blur()" />
          </label>
        </div>
      </fieldset>
      <div class="flow-preset-group" role="group" aria-label="推荐配色">
        <p>推荐配色</p>
        <div class="flow-presets">
          <button v-for="preset in FLOW_PRESETS" :key="preset.name" type="button" class="flow-preset"
            :aria-pressed="preset.colors.every((hex, i) => hex === ui.flowBackground.colors[i])"
            @click="choose('custom', preset.colors)">
            <span class="flow-swatch" aria-hidden="true">
              <i v-for="color in preset.colors" :key="color" :style="{ backgroundColor: color }"></i>
            </span>
            {{ preset.name }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.flow-settings .select { width: auto; }
.flow-settings .setting-row { gap: 12px; flex-wrap: wrap; }
.flow-settings .setting-copy { flex-basis: 130px; }
.flow-colors { display: grid; gap: 12px; padding-top: 12px; }
.flow-color { min-width: 0; margin: 0; padding: 8px 10px 10px; border: 1px solid var(--set-line); border-radius: 8px; }
.flow-color legend { padding: 0 4px; font-size: 12px; color: var(--set-muted); }
.flow-rgb { display: grid; grid-template-columns: 36px repeat(3, minmax(0, 1fr)); gap: 8px; align-items: center; }
.flow-rgb input[type=color] { width: 36px; height: 32px; padding: 3px; border: 1px solid var(--set-line); border-radius: 6px; background: var(--set-wash); cursor: pointer; }
.flow-channel { display: flex; align-items: center; gap: 4px; min-width: 0; color: var(--set-muted); font-size: 11px; }
.flow-channel input { width: 100%; min-width: 0; height: 32px; padding: 0 4px; text-align: center; border: 1px solid var(--set-line); border-radius: 6px; background: var(--set-wash); font-variant-numeric: tabular-nums; appearance: textfield; }
.flow-channel input::-webkit-inner-spin-button { appearance: none; }
.flow-settings .flow-rgb input:focus-visible, .flow-settings .select:focus-visible { outline: 2px solid var(--set-accent); outline-offset: 2px; }
.flow-preset-group p { margin-bottom: 7px; font-size: 12px; color: var(--set-muted); }
.flow-presets { display: flex; flex-wrap: wrap; gap: 6px; }
.flow-preset { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 3px 8px; border: 1px solid var(--set-line); border-radius: 8px; background: var(--set-wash); white-space: nowrap; cursor: pointer; }
.flow-preset:hover, .flow-preset[aria-pressed=true] { border-color: var(--set-accent); }
.flow-swatch { display: flex; width: 24px; height: 12px; overflow: hidden; border-radius: 3px; }
.flow-swatch i { flex: 1; }
</style>
