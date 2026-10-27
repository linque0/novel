import assert from 'node:assert/strict'
import { normalizeCanvasOpacity } from '../src/services/canvas-appearance.js'

// Old/missing values keep the opaque default, while zero really is transparent.
for (const [input, expected] of [
  [undefined,100], [null,100], ['',100], [NaN,100], ['bad',100],
  [0,0], ['0',0], [20,20], [55.5,56], [100,100], [-10,0], [200,100]
]) assert.equal(normalizeCanvasOpacity(input),expected,`opacity ${String(input)}`)
console.log('12/12 canvas appearance checks passed')
