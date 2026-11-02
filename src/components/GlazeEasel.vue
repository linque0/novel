<script setup>
import { useId } from 'vue'
const props = defineProps({ layer: { type: String, default: 'back' } })
const back = props.layer !== 'front'
const uid = 'gg-easel-' + useId().replace(/[^a-z0-9-]/gi, '')
const wood = uid + '-wood'
const woodH = uid + '-wood-h'
const brass = uid + '-brass'
const soft = uid + '-soft'
const fWoodH = uid + '-f-wood-h'
const fBrass = uid + '-f-brass'
const fShade = uid + '-f-shade'
const woodFill = `url(#${wood})`
const woodHFill = `url(#${woodH})`
const brassFill = `url(#${brass})`
const softFilter = `url(#${soft})`
const frontWoodHFill = `url(#${fWoodH})`
const frontBrassFill = `url(#${fBrass})`
const frontShadeFill = `url(#${fShade})`
</script>

<template>
  <svg v-if="back" class="gg-easel gg-easel-back" viewBox="0 0 240 400" fill="none" aria-hidden="true">
    <defs>
      <linearGradient :id="wood" x1="34" y1="0" x2="206" y2="0" gradientUnits="userSpaceOnUse">
        <stop stop-color="#332015"/><stop offset=".2" stop-color="#67452b"/><stop offset=".42" stop-color="#8b5e3b"/>
        <stop offset=".6" stop-color="#734d31"/><stop offset=".84" stop-color="#4b3120"/><stop offset="1" stop-color="#2e1c12"/>
      </linearGradient>
      <linearGradient :id="woodH" x1="0" y1="0" x2="0" y2="1">
        <stop stop-color="#8e603c"/><stop offset=".25" stop-color="#714b2f"/><stop offset=".72" stop-color="#523620"/><stop offset="1" stop-color="#342114"/>
      </linearGradient>
      <linearGradient :id="brass" x1="0" y1="0" x2="0" y2="1">
        <stop stop-color="#f3dca2"/><stop offset=".32" stop-color="#cba560"/><stop offset=".7" stop-color="#967134"/><stop offset="1" stop-color="#dfbd79"/>
      </linearGradient>
      <filter :id="soft" x="-40%" y="-120%" width="180%" height="340%"><feGaussianBlur stdDeviation="3.2"/></filter>
    </defs>

    <ellipse cx="120" cy="392" rx="94" ry="9" fill="#1b140e" opacity=".25" :filter="softFilter"/>
    <ellipse cx="120" cy="391" rx="58" ry="4" fill="#140e09" opacity=".3" :filter="softFilter"/>

    <path d="M133 246 147 246 205 391 190 393Z" fill="#382417" opacity=".92"/>
    <path d="M136 252 191 389" stroke="#7d5637" stroke-width="1.6" opacity=".42"/>

    <path d="M111 4 129 4 127 330 113 330Z" :fill="woodFill" stroke="#2a1a10" stroke-width=".8"/>
    <path d="M122 5 129 5 127 330 121 330Z" fill="#28180e" opacity=".34"/>
    <path d="M114 7 114 327" stroke="#c08a5a" stroke-width="1.5" opacity=".5"/>
    <path d="M118 54C117 142 119 238 118 316" stroke="#2b190f" stroke-width="1" opacity=".2"/>
    <path d="M116 20 116 86" stroke="#e3b27e" stroke-width=".8" opacity=".3"/>
    <rect x="110" y="4" width="20" height="9" rx="3" :fill="brassFill" stroke="#5c4520" stroke-width=".6"/>
    <circle cx="120" cy="4" r="2.6" :fill="brassFill"/>

    <path d="M100 196 91 196 33 389 49 393Z" :fill="woodFill" stroke="#2a1a10" stroke-width=".8"/>
    <path d="M94 199 37 388 43 390 98 202Z" fill="#2b1b10" opacity=".26"/>
    <path d="M96 201 41 387" stroke="#c08a5a" stroke-width="1.4" opacity=".45"/>
    <path d="M140 196 149 196 207 389 191 393Z" :fill="woodFill" stroke="#2a1a10" stroke-width=".8"/>
    <path d="M146 199 203 388 197 390 142 202Z" fill="#2b1b10" opacity=".26"/>
    <path d="M144 201 199 387" stroke="#c08a5a" stroke-width="1.4" opacity=".45"/>
    <ellipse cx="41" cy="390" rx="9" ry="4.2" fill="#2a1a10"/>
    <ellipse cx="199" cy="390" rx="9" ry="4.2" fill="#2a1a10"/>
    <path d="M36 386 44 387" stroke="#8d6443" stroke-width="1" opacity=".6"/>
    <path d="M194 386 202 387" stroke="#8d6443" stroke-width="1" opacity=".6"/>

    <path d="M57 340 183 340 185 350 55 350Z" :fill="woodHFill" stroke="#2a1a10" stroke-width=".7"/>
    <path d="M60 342 180 342" stroke="#c08a5a" stroke-width="1.1" opacity=".42"/>
    <path d="M57 351 183 351" stroke="#1d120a" stroke-width="1" opacity=".4"/>
    <rect x="112" y="344" width="16" height="5" rx="1.2" :fill="brassFill" opacity=".9"/>
    <circle cx="116" cy="346.5" r="1" fill="#5d4822"/><circle cx="124" cy="346.5" r="1" fill="#5d4822"/>

    <path d="M14 326 226 326 222 340 18 340Z" :fill="woodHFill" stroke="#2a1a10" stroke-width=".8"/>
    <path d="M18 327 222 327 220 331 20 331Z" fill="#a37148" opacity=".42"/>
    <path d="M18 340 222 340 220 344 20 344Z" fill="#22140c" opacity=".42"/>
    <path d="M24 338 216 338" :stroke="brassFill" stroke-width="1.3" opacity=".92"/>
    <rect x="11" y="326" width="7" height="15" rx="2" :fill="brassFill" stroke="#6e5225" stroke-width=".5"/>
    <rect x="222" y="326" width="7" height="15" rx="2" :fill="brassFill" stroke="#6e5225" stroke-width=".5"/>
    <path d="M64 340 71 340 75 357 67 357Z" :fill="woodHFill" stroke="#2a1a10" stroke-width=".6"/>
    <path d="M169 340 176 340 173 357 165 357Z" :fill="woodHFill" stroke="#2a1a10" stroke-width=".6"/>
    <circle cx="68" cy="348" r="1.4" fill="#c8a362"/><circle cx="172" cy="348" r="1.4" fill="#c8a362"/>

    <circle cx="96" cy="204" r="4.8" :fill="brassFill" stroke="#5c4520" stroke-width=".6"/>
    <circle cx="96" cy="204" r="1.5" fill="#4c391b"/>
    <circle cx="144" cy="204" r="4.8" :fill="brassFill" stroke="#5c4520" stroke-width=".6"/>
    <circle cx="144" cy="204" r="1.5" fill="#4c391b"/>

    <path d="M46 232C38 292 33 340 30 378" stroke="#3a2414" stroke-width="1" opacity=".2"/>
    <path d="M189 236C197 296 202 344 205 380" stroke="#3a2414" stroke-width="1" opacity=".18"/>
    <path d="M70 184C64 198 58 214 52 228" stroke="#b07a4f" stroke-width=".9" opacity=".28"/>
    <path d="M170 184C176 198 182 214 188 228" stroke="#b07a4f" stroke-width=".9" opacity=".28"/>
  </svg>

  <svg v-else class="gg-easel gg-easel-front" viewBox="0 0 240 400" fill="none" aria-hidden="true">
    <defs>
      <linearGradient :id="fWoodH" x1="0" y1="0" x2="0" y2="1">
        <stop stop-color="#8e603c"/><stop offset=".25" stop-color="#714b2f"/><stop offset=".72" stop-color="#523620"/><stop offset="1" stop-color="#342114"/>
      </linearGradient>
      <linearGradient :id="fBrass" x1="0" y1="0" x2="0" y2="1">
        <stop stop-color="#f3dca2"/><stop offset=".32" stop-color="#cba560"/><stop offset=".7" stop-color="#967134"/><stop offset="1" stop-color="#dfbd79"/>
      </linearGradient>
      <linearGradient :id="fShade" x1="0" y1="0" x2="0" y2="1">
        <stop stop-color="#1d130c" stop-opacity="0"/><stop offset=".55" stop-color="#1d130c" stop-opacity=".42"/><stop offset="1" stop-color="#1d130c" stop-opacity="0"/>
      </linearGradient>
    </defs>

    <path d="M105 20 135 20 135 28 127 28 127 40 113 40 113 28 105 28Z" :fill="frontBrassFill" stroke="#5c4520" stroke-width=".7"/>
    <rect x="110" y="38" width="20" height="7" rx="2" fill="#2a231d"/>
    <rect x="110" y="38" width="20" height="2" rx="1" fill="#4a3f34"/>
    <circle cx="120" cy="16" r="4.6" :fill="frontBrassFill" stroke="#5c4520" stroke-width=".6"/>
    <path d="M117 16 123 16" stroke="#5b4520" stroke-width=".7"/>

    <rect x="26" y="324" width="188" height="8" :fill="frontShadeFill"/>

    <path d="M10 324 230 324 228 345 12 345Z" :fill="frontWoodHFill" stroke="#2a1a10" stroke-width=".8"/>
    <path d="M14 326 226 326" stroke="#c08a5a" stroke-width="1.6" opacity=".55"/>
    <path d="M16 330 224 330" :stroke="frontBrassFill" stroke-width="1.2" opacity=".95"/>
    <path d="M14 338 226 338" stroke="#2a1a10" stroke-width=".7" opacity=".35"/>
    <path d="M13 345 227 345" stroke="#1c110a" stroke-width="1.2" opacity=".45"/>
    <rect x="7" y="324" width="8" height="21" rx="2" :fill="frontBrassFill" stroke="#6e5225" stroke-width=".5"/>
    <rect x="225" y="324" width="8" height="21" rx="2" :fill="frontBrassFill" stroke="#6e5225" stroke-width=".5"/>
    <circle cx="11" cy="334" r="1" fill="#5d4822"/><circle cx="229" cy="334" r="1" fill="#5d4822"/>
    <path d="M20 326 220 326" stroke="#f2d5a6" stroke-width=".7" opacity=".35"/>
  </svg>
</template>
