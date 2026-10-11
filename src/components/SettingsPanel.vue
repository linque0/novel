<script setup>
/* 设置面板（G 色带书封风格）：主题 / 中英文字体 / 字号 / 数据 / 书签 / 统计帮助 的统一入口。
   替代原顶栏「⋯」集合栏与独立主题选择、字体按钮（v1.0.23）。 */
import { NPopover, NButton, NSelect } from 'naive-ui'
import OIcon from './OIcon.vue'
import { useUiStore, FONT_MAP, LATIN_MAP } from '../stores/ui'

const ui = useUiStore()
const props = defineProps({
  bookmarks: { type: Array, default: () => [] } // 书签跳转项（工作台传入，书架为空则不显示该区）
})
const emit = defineEmits(['backup', 'restore', 'bookmark'])

const THEMES = [
  { key: 'xuan', label: '宣纸' },
  { key: 'parchment', label: '羊皮纸' },
  { key: 'night', label: '暗夜书房' }
]
const CJK_OPTS = Object.entries(FONT_MAP).map(([value, f]) => ({ label: f.label, value }))
const LATIN_OPTS = Object.entries(LATIN_MAP).map(([value, f]) => ({ label: f.label, value }))
function bumpFont(d) {
  ui.setPref('fontSize', Math.min(24, Math.max(13, ui.fontSize + d)))
}
</script>

<template>
  <NPopover trigger="click" placement="bottom-end" :show-arrow="false" class="g-set-pop">
    <template #trigger>
      <NButton size="small" title="设置：主题 / 字体 / 数据 / 帮助"><OIcon name="gear" :size="14" /> 设置</NButton>
    </template>
    <div class="g-set">
      <div class="g-set-head"><span class="cn">设置</span><span class="en">Settings</span></div>
      <div class="g-set-h"><span class="en">Appearance</span>外观</div>
      <div class="g-row">
        <span class="lb">主题</span>
        <span class="chips">
          <span v-for="t in THEMES" :key="t.key" class="chip" :class="{ on: ui.theme === t.key }" @click="ui.setPref('theme', t.key)">{{ t.label }}</span>
        </span>
      </div>
      <div class="g-row">
        <span class="lb">中文字体</span>
        <NSelect size="small" :value="ui.editorFont" :options="CJK_OPTS" @update:value="(v) => ui.setPref('editorFont', v)" />
      </div>
      <div class="g-row">
        <span class="lb">西文字体</span>
        <NSelect size="small" :value="ui.editorLatin" :options="LATIN_OPTS" @update:value="(v) => ui.setPref('editorLatin', v)" />
      </div>
      <div class="g-row">
        <span class="lb">正文字号</span>
        <span class="fs">
          <NButton size="tiny" :disabled="ui.fontSize <= 13" @click="bumpFont(-1)">A－</NButton>
          <b>{{ ui.fontSize }} px</b>
          <NButton size="tiny" :disabled="ui.fontSize >= 24" @click="bumpFont(1)">A＋</NButton>
        </span>
      </div>

      <div class="g-set-h"><span class="en">Data</span>数据</div>
      <div class="g-item" @click="ui.importOpen = true"><OIcon name="download" :size="13" /> 导入作品…</div>
      <div class="g-item" @click="ui.exportOpen = true"><OIcon name="download" :size="13" /> 导出正文（TXT / MD / Word）…</div>
      <div class="g-item" @click="emit('backup')"><OIcon name="download" :size="13" /> 备份全部数据（JSON）</div>
      <div class="g-item" @click="emit('restore')"><OIcon name="upload" :size="13" /> 恢复备份（JSON）…</div>
      <div class="g-item" @click="ui.trashOpen = true"><OIcon name="trash" :size="13" /> 回收站</div>

      <template v-if="props.bookmarks.length">
        <div class="g-set-h"><span class="en">Bookmarks</span>书签</div>
        <div v-for="b in props.bookmarks" :key="b.key" class="g-item" @click="emit('bookmark', b.key)">
          <OIcon name="bookmark" :size="13" /> {{ b.label }}
        </div>
        <div v-if="!props.bookmarks.length" class="g-empty">暂无书签</div>
      </template>

      <div class="g-set-h"><span class="en">More</span>更多</div>
      <div class="g-item" @click="ui.statsOpen = true"><OIcon name="stats" :size="13" /> 写作统计</div>
      <div class="g-item" @click="ui.helpOpen = true"><OIcon name="note" :size="13" /> 帮助与键位手册</div>

      <div class="g-foot">本地优先 · 自动保存 · 色带书封 G</div>
    </div>
  </NPopover>
</template>

<style scoped>
.g-set {
  width: 308px;
  padding: 4px 2px 6px;
  font-size: 12.5px;
  color: var(--text);
  /* 纸感底板：顶部极淡的品牌蓝渐沉 + 主题纸底（三主题各自适配，非纯白） */
  background:
    linear-gradient(180deg, rgba(0, 47, 167, 0.04), rgba(0, 47, 167, 0) 110px),
    var(--bg-panel, #faf7ec);
}
.theme-night .g-set {
  background:
    linear-gradient(180deg, rgba(0, 47, 167, 0.1), rgba(0, 47, 167, 0) 110px),
    var(--bg-panel);
}
/* 面板头：衬线中文 + Playfair 微标 + 双细线（书版式扉页感） */
.g-set-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 8px 10px 2px;
  padding-bottom: 7px;
  border-bottom: 1px solid var(--border);
  box-shadow: 0 1px 0 var(--bg-panel);
}
.g-set-head .cn { font-family: var(--g-serif); font-size: 14px; font-weight: 700; color: var(--ikb); }
.g-set-head .en { font-family: var(--g-disp); font-size: 8px; letter-spacing: 0.28em; color: var(--text-dim); text-transform: uppercase; font-weight: 600; }
.g-set-h {
  display: flex; align-items: baseline; gap: 8px;
  font-family: var(--g-serif); font-size: 12.5px; font-weight: 700; color: var(--ikb, #002fa7);
  margin: 12px 10px 6px; padding-bottom: 5px; border-bottom: 1px solid var(--border);
}
.g-set-h .en { font-family: var(--g-disp, serif); font-size: 8px; letter-spacing: .26em; color: var(--text-dim); text-transform: uppercase; font-weight: 600; }
.g-row { display: flex; align-items: center; gap: 10px; padding: 4px 10px; }
.g-row .lb { width: 56px; color: var(--text-dim); font-size: 11.5px; flex: none; }
.g-row .chips { display: flex; gap: 6px; }
.chip { height: 22px; padding: 0 10px; border: 1px solid var(--border); border-radius: 2px; background: var(--bg-panel);
  font-size: 11.5px; color: var(--text); display: inline-flex; align-items: center; cursor: pointer; }
.chip:hover { border-color: var(--accent); color: var(--accent); }
.chip.on { background: var(--accent); border-color: var(--accent); color: var(--bg-panel); }
.g-row .fs { display: flex; align-items: center; gap: 8px; }
.g-row .fs b { font-variant-numeric: tabular-nums; font-size: 11.5px; min-width: 40px; text-align: center; color: var(--text); }
.g-item { display: flex; align-items: center; gap: 9px; height: 30px; padding: 0 12px; border-radius: 2px; color: var(--text); cursor: pointer; }
.g-item:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--accent); }
.g-empty { padding: 2px 12px 6px; font-size: 11px; color: var(--text-faint, #b3a892); }
.g-foot { margin: 12px 10px 2px; padding-top: 8px; border-top: 1px solid var(--border); font-size: 10px; letter-spacing: .08em; color: var(--text-faint, #b3a892); }
</style>

/* NPopover 容器 teleport 到 body，scoped 选不中——这里非 scoped 覆盖底板与顶规；
   主题变量经 App.vue 的 body 镜像继承，兜底值防变量失效时整条声明透明 */
<style>
.g-set-pop.n-popover {
  background: var(--bg-panel, #faf7ec);
  border: 1px solid var(--border-strong, #d0c4a6);
  border-top: 2px solid var(--ikb);
  box-shadow: 0 12px 32px rgba(30, 30, 30, 0.18);
}
.g-set-pop .n-popover__content {
  padding: 0;
  background: transparent;
}
</style>
