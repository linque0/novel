/* 生成 build/icon.ico：512 超采样绘制开卷图标 → 256px PNG → ICO 容器 */
import zlib from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'build')
mkdirSync(outDir, { recursive: true })

/* ---------- PNG 编码 ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
function crc32(buf) {
  let c = -1
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/* ---------- 绘制（512 超采样） ---------- */
const S = 512
const img = Buffer.alloc(S * S * 4)

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
function inQuad(px, py, q) {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = q[i]
    const [x2, y2] = q[(i + 1) % 4]
    const cross = (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)
    const s = cross > 0 ? 1 : cross < 0 ? -1 : 0
    if (s === 0) continue
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return true
}
const LEFT_PAGE = [
  [248, 176],
  [60, 148],
  [60, 336],
  [248, 364]
]
const RIGHT_PAGE = [
  [264, 176],
  [452, 148],
  [452, 336],
  [264, 364]
]
const R = 96
function inRoundedSquare(x, y) {
  const cx = x < R ? R : x > S - R ? S - R : x
  const cy = y < R ? R : y > S - R ? S - R : y
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= R * R
}

const TOP = hex('#9a7b55')
const BOTTOM = hex('#4a3a29')
const PAGE = hex('#f5edda')
const SPINE = hex('#d6c39a')
const LINE = hex('#b9a67f')

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    if (!inRoundedSquare(x, y)) continue
    const t = y / S
    let r = Math.round(TOP[0] + (BOTTOM[0] - TOP[0]) * t)
    let g = Math.round(TOP[1] + (BOTTOM[1] - TOP[1]) * t)
    let b = Math.round(TOP[2] + (BOTTOM[2] - TOP[2]) * t)
    // 开卷书页
    const inL = inQuad(x, y, LEFT_PAGE)
    const inR = inQuad(x, y, RIGHT_PAGE)
    const inSpine = x >= 244 && x <= 268 && y >= 168 && y <= 372
    if (inL || inR) [r, g, b] = PAGE
    else if (inSpine) [r, g, b] = SPINE
    // 页内文字行
    const onLine = (y >= 206 && y <= 216) || (y >= 246 && y <= 256) || (y >= 286 && y <= 296)
    if (onLine && ((inL && x >= 96 && x <= 224) || (inR && x >= 288 && x <= 416))) [r, g, b] = LINE
    const i = (y * S + x) * 4
    img[i] = r
    img[i + 1] = g
    img[i + 2] = b
    img[i + 3] = 255
  }
}

/* 512 → 256 盒式降采样（软化边缘） */
const OUT = 256
const down = Buffer.alloc(OUT * OUT * 4)
for (let y = 0; y < OUT; y++) {
  for (let x = 0; x < OUT; x++) {
    let r = 0, g = 0, b = 0, a = 0
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const i = ((y * 2 + dy) * S + (x * 2 + dx)) * 4
        r += img[i]
        g += img[i + 1]
        b += img[i + 2]
        a += img[i + 3]
      }
    }
    const o = (y * OUT + x) * 4
    down[o] = r / 4
    down[o + 1] = g / 4
    down[o + 2] = b / 4
    down[o + 3] = a / 4
  }
}

const png = encodePNG(OUT, OUT, down)
writeFileSync(join(outDir, 'icon.png'), png)

/* ---------- ICO 容器（单张 256 PNG） ---------- */
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(1, 4)
const entry = Buffer.alloc(16)
entry[0] = 0 // 256
entry[1] = 0
entry[2] = 0
entry[3] = 0
entry.writeUInt16LE(1, 4)
entry.writeUInt16LE(32, 6)
entry.writeUInt32LE(png.length, 8)
entry.writeUInt32LE(22, 12)
writeFileSync(join(outDir, 'icon.ico'), Buffer.concat([header, entry, png]))
console.log('icon.ico / icon.png generated:', png.length, 'bytes')
