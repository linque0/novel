<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
const canvas = ref(null)
let cleanup = () => {}
onMounted(() => {
  const el = canvas.value, ctx = el.getContext('2d'), media = matchMedia('(prefers-reduced-motion: reduce)')
  if (!ctx) return
  let frame = 0, visible = true, width = 1, height = 1, elapsed = 0, previous = 0
  const particles = Array.from({length:22},(_,i)=>({x:(i*.618)%1,y:(i*.381)%1,r:.5+(i%3)*.3}))
  const resize = new ResizeObserver(([entry]) => { width=entry.contentRect.width; height=entry.contentRect.height; const dpr=Math.min(devicePixelRatio,2);el.width=width*dpr;el.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0) })
  function draw(time) {
    elapsed += previous ? Math.min(time-previous,50) : 0; previous=time
    ctx.clearRect(0,0,width,height)
    for(const p of particles){const x=(p.x+elapsed/180000)%1, y=(p.y-elapsed/120000+100)%1;ctx.beginPath();ctx.fillStyle='rgba(255,246,214,.42)';ctx.arc(x*width,y*height,p.r,0,Math.PI*2);ctx.fill()}
    frame=requestAnimationFrame(draw)
  }
  function sync(){cancelAnimationFrame(frame);previous=0;ctx.clearRect(0,0,width,height);if(visible&&!document.hidden&&!media.matches)frame=requestAnimationFrame(draw)}
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync()})
  resize.observe(el);observer.observe(el);media.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);sync()
  cleanup=()=>{cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();media.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync)}
})
onBeforeUnmount(()=>cleanup())
</script>
<template><canvas ref="canvas" class="os-dust" aria-hidden="true" /></template>
<style scoped>.os-dust{position:absolute;inset:0;width:100%;height:min(800px,100%);pointer-events:none;clip-path:polygon(74% 0,100% 0,58% 100%,7% 100%);z-index:2}@media(prefers-reduced-motion:reduce){.os-dust{display:none}}</style>
