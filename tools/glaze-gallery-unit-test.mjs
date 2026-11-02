import assert from 'node:assert/strict'
import { galleryIndex, gallerySlots, galleryCursorFor, galleryDragStep, gallerySelection, GALLERY_DRAG_THRESHOLD } from '../src/services/glaze-gallery.js'

assert.equal(galleryIndex(-1,6),5)
assert.equal(galleryIndex(6,6),0)
assert.equal(galleryIndex(10,0),0)
assert.equal(galleryCursorFor(5,0,6),6,'last-to-first moves one slot forward')
assert.equal(galleryCursorFor(0,5,6),-1,'first-to-last moves one slot backward')
assert.equal(galleryCursorFor(600,1,6),601,'logical cursor remains continuous')
assert.equal(galleryDragStep(-150,240),1)
assert.equal(galleryDragStep(150,240),-1)
assert.equal(galleryDragStep(-60,240),0)
assert.equal(galleryDragStep(500,0),0)
assert.equal(GALLERY_DRAG_THRESHOLD,8)
for(const count of [0,1,2,3,4,6,100]){
  const works=Array.from({length:count},(_,i)=>({id:'book-'+i,title:'作品'+i}))
  const before=JSON.stringify(works)
  for(const cursor of [-601,-1,0,1,601]){
    const slots=gallerySlots(works,cursor),visible=slots.filter(s=>!s.buffer)
    assert.ok(slots.length<=7,'rendering window is bounded')
    assert.equal(new Set(slots.map(s=>s.key)).size,slots.length,'slot keys are unique')
    assert.equal(new Set(visible.map(s=>s.book.id)).size,visible.length,'visible works never repeat')
    if(count){assert.equal(slots.find(s=>s.offset===0).book.id,works[galleryIndex(cursor,count)].id);assert.equal(visible.length,count>=5?5:count>=3?3:count)}
    else assert.deepEqual(slots,[])
  }
  assert.equal(JSON.stringify(works),before,'browsing never mutates sorted works')
  assert.equal(gallerySelection(works,'missing'),works[0]?.id??null)
  if(count>1){assert.equal(gallerySelection(works,works[1].id),works[1].id);assert.equal(gallerySelection(works,works[1].id,true),works[0].id)}
}
const works=Array.from({length:100},(_,i)=>({id:String(i)}))
assert.equal(gallerySlots(works,50).filter(s=>gallerySlots(works,51).some(next=>next.key===s.key)).length,6,'adjacent movement retains DOM keys')
console.log('PASS gallery circular indices, stable seven-slot window, small collections, drag snapping and selection reconciliation')
