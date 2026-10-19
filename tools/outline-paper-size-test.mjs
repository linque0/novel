import assert from 'node:assert/strict'
import {effSize} from '../src/components/outline/canvas-model.js'
// Detailed paper cards must fit their title/body/status while preserving manual geometry.
assert.ok(effSize({kind:'event'},'paper').h >= 140,'paper event must have a readable content area')
assert.ok(effSize({kind:'event',shape:'diamond'},'paper').h > effSize({kind:'event'},'paper').h,'diamond needs extra safe text area')
assert.ok(effSize({kind:'cite'},'paper').h >= 150,'quote needs a readable text area')
assert.deepEqual(effSize({kind:'event',w:132,h:62},'paper'),{w:132,h:62},'manual card sizes must survive visual calibration')
assert.deepEqual(effSize({kind:'event'},'compact'),{w:138,h:40},'compact geometry remains compatible')
console.log('5/5 paper geometry checks passed')
