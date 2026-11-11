<script setup>
import { computed } from 'vue'
import { bookDimensions } from '../services/original-shelf.mjs'
import { titleTreatment } from '../services/original-booklist.mjs'

const props = defineProps({ book: { type: Object, required: true }, selected: Boolean, large: Boolean })
const treatment = computed(() => titleTreatment(props.book.title))
const style = computed(() => {
  const dimensions = bookDimensions(props.book)
  return { '--book-depth': `${7 + (dimensions.thickness - 22) / 32 * 7}px`, '--book-height': `${154 + (dimensions.height - 158) * .4}px` }
})
</script>

<template>
  <span class="ob-volume" :class="[book.kind || 'novel', { selected, large }]" :style="style" aria-hidden="true">
    <span class="ob-back"></span>
    <span class="ob-page-block"></span>
    <span class="ob-page-edge"></span>
    <span class="ob-spine"></span>
    <span class="ob-cover">
      <span class="ob-edition">{{ book.genre || '作品' }}</span>
      <span class="ob-title-zone"><span class="ob-title" :class="treatment">{{ book.title || '未命名作品' }}</span></span>
      <span class="ob-colophon"><span v-if="book.author" class="ob-author">{{ book.author }}<small>著</small></span><span class="ob-imprint">小说工坊</span></span>
    </span>
    <span v-if="selected" class="ob-ribbon"></span>
  </span>
</template>

<style scoped>
.ob-volume{--cloth:#354f60;--ink:#eee3c9;--book-width:100px;position:relative;display:block;flex:none;width:var(--book-width);height:var(--book-height);transform-style:preserve-3d;transform:perspective(900px) rotateY(-13deg) rotateZ(-1deg);transition:transform .18s ease;color:var(--ink)}
.ob-volume.note{--cloth:#d9d0b9;--ink:#464638}.ob-volume.cedar{--cloth:#3d5748}.ob-volume.violet{--cloth:#62516b}.ob-volume.claret{--cloth:#70413f}.ob-volume.ink{--cloth:#343c38}
.ob-back{position:absolute;inset:0;background:var(--cloth);border-radius:1px 3px 3px 1px;transform:translateZ(calc(var(--book-depth) * -.5));box-shadow:1px 5px 6px #27251c30}
.ob-page-block{position:absolute;inset:3px 0 3px 5px;background:#e8deca;box-shadow:inset -2px 0 3px #8b785a2b;transform:translateZ(calc(var(--book-depth) * -.5 + 2px))}
.ob-page-edge{position:absolute;left:calc(100% - 1px);top:3px;bottom:3px;width:calc(var(--book-depth) - 2px);transform-origin:0 50%;transform:translateZ(calc(var(--book-depth) * .5 - 1px)) rotateY(90deg);background:repeating-linear-gradient(to bottom,#e5dcc8 0px,#f1e9d8 .7px,#e8deca 1.5px,#e8deca 2.2px);box-shadow:inset 3px 0 4px #7e6b4b26;border:1px solid #baa98c44;box-sizing:border-box}
.ob-spine{position:absolute;left:0;top:0;bottom:0;width:var(--book-depth);transform-origin:0 50%;transform:translateZ(calc(var(--book-depth) * .5)) rotateY(90deg);background:var(--cloth);filter:brightness(.75);border-radius:2px}
.ob-cover{position:absolute;inset:0;transform:translateZ(calc(var(--book-depth) * .5));display:flex;flex-direction:column;box-sizing:border-box;padding:13px 12px 11px 17px;border-radius:1px 3px 3px 1px;background-color:var(--cloth);background-image:linear-gradient(100deg,#0000002e,transparent 9%,#ffffff08 15%,transparent 30%,#00000008),repeating-linear-gradient(0deg,transparent 0 2px,#ffffff06 2px 3px),repeating-linear-gradient(90deg,transparent 0 2px,#00000008 2px 3px);box-shadow:inset 1px 0 1px #ffffff24,inset 5px 0 5px #00000020,inset 7px 0 0 #ffffff0c,inset -1px 0 0 #ffffff2e,1px 1px 1px #121c1930;border:1px solid #00000015}
.note .ob-cover{background-image:linear-gradient(100deg,#8b765522,transparent 12%,#ffffff15 65%,transparent)}.ink .ob-cover,.claret .ob-cover{background-image:linear-gradient(100deg,#0003,transparent 13%,#ffffff05 60%,#0001),repeating-radial-gradient(ellipse at 20% 30%,#ffffff03 0 .7px,transparent .8px 2px)}
.ob-edition{flex:none;text-align:center;font:8px/1.4 'Microsoft YaHei',sans-serif;letter-spacing:2px;opacity:.75;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ob-title-zone{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:8px 0 6px;box-sizing:border-box}
.ob-title{max-height:100%;font-family:'Noto Serif SC',SimSun,serif;font-weight:400;text-align:center;max-width:100%;overflow:hidden;overflow-wrap:anywhere}
.ob-title.vertical{writing-mode:vertical-rl;white-space:nowrap;font-size:18px;line-height:1.25;letter-spacing:2px;max-height:100%;text-orientation:upright}
.ob-title.balanced{font-size:17px;line-height:1.55;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;letter-spacing:1px}
.ob-title.long{font-size:12px;line-height:1.6;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;letter-spacing:.3px}
.ob-title.mixed{font-size:12px;line-height:1.6;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;word-break:normal;overflow-wrap:anywhere}
.ob-colophon{flex:none;display:flex;flex-direction:column;align-items:center;gap:7px;min-height:20px}.ob-author{font:8px/1.4 'Noto Serif SC',SimSun,serif;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ob-author small{font-size:7px;margin-left:4px;opacity:.8}.ob-imprint{font:6px/1 'Microsoft YaHei',sans-serif;letter-spacing:2px;opacity:.6}
.ob-ribbon{position:absolute;right:13px;top:-1px;width:5px;height:calc(100% + 8px);transform:translateZ(calc(var(--book-depth) * .5 + .5px));background:#783f38;clip-path:polygon(0 0,100% 0,100% 100%,50% 97%,0 100%)}
.ob-volume.large{--book-width:160px;height:244px}.large .ob-title.vertical{font-size:28px}.large .ob-title.balanced{font-size:26px}.large .ob-title.long{font-size:21px}.large .ob-title.mixed{font-size:19px}.large .ob-cover{padding:20px 20px 16px 25px}.large .ob-edition{font-size:10px}.large .ob-author{font-size:12px}.large .ob-imprint{font-size:8px}
@media(prefers-reduced-motion:reduce){.ob-volume{transition:none}}
</style>
