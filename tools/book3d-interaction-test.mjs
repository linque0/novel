import assert from 'node:assert/strict'
import { BookInteraction } from '../src/services/book3d/interaction.js'

let opened=0,disabled=false,reduced=false,changes=0
const c=new BookInteraction({onOpen:()=>opened++,onChange:()=>changes++,isDisabled:()=>disabled,isReduced:()=>reduced})
const original=[...c.rotation]
c.down(1,80,100,300,400);c.up(1)
assert.equal(opened,1,'stationary pointer opens the book')
c.down(1,80,100,300,400);c.move(1,83,101);c.up(1)
assert.equal(opened,2,'movement below the 5px threshold remains a click')
c.down(1,80,100,300,400);c.move(1,140,150);c.up(1)
assert.equal(opened,2,'drag never opens a book')
assert.notDeepEqual(c.rotation,original,'drag changes the actual orientation')
for(let i=0;i<25;i++){c.down(1,30,200,300,400);c.move(1,270,200);c.up(1)}
assert.ok(c.rotation.every(Number.isFinite),'repeated full rotations remain finite')
assert.ok(Math.abs(Math.hypot(...c.rotation)-1)<1e-8,'orientation remains a unit quaternion')
c.wheel(-1e6);assert.equal(c.zoom,1.35,'zoom has an upper limit')
c.wheel(1e6);assert.equal(c.zoom,.8,'zoom has a lower limit')
c.reset();assert.deepEqual(c.rotation,original);assert.equal(c.zoom,1)
c.down(1,70,200,300,400);c.down(2,230,200,300,400);c.move(2,270,200);assert.ok(c.zoom>1,'pinch zooms')
c.up(2);c.up(1);assert.equal(opened,2,'pinch never opens a book')
c.down(1,80,100,300,400);c.cancel();c.up(1);assert.equal(opened,2,'pointer cancellation never opens')
disabled=true;c.down(1,80,100,300,400);c.up(1);c.key('Enter');assert.equal(opened,2,'busy blocks pointer and keyboard open')
disabled=false;reduced=true;c.down(1,80,100,300,400);c.move(1,160,180);c.up(1)
assert.equal(c.tick(16),false,'reduced motion removes inertia')
c.key('Home');assert.deepEqual(c.rotation,original,'Home resets view')
c.key('ArrowRight');assert.notDeepEqual(c.rotation,original,'arrow keys rotate the book')
c.key('Enter');assert.equal(opened,3,'Enter opens')
assert.ok(changes>0)
let clock=0
const held=new BookInteraction({now:()=>clock})
held.down(1,80,100,300,400);clock=16;held.move(1,160,180);clock=2016;held.up(1)
assert.equal(held.tick(16),false,'holding still before release discards stale inertia')
held.down(1,80,100,300,400);clock+=16;held.move(1,160,180);held.up(1)
assert.equal(held.tick(16),true,'a fresh release retains short inertia')
console.log('PASS book3d pointer, drag, pinch, quaternion, zoom, reset, keyboard, disabled and reduced-motion contracts')
