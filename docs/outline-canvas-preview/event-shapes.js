export const EVENT_SHAPES = {
  process:{label:'矩形',material:'冷白棉纸 · 压印细边',image:'assets/event.webp',original:'assets/originals/event.png',tone:'#f5f7f6',edge:'#b8c9cb',w:224,h:154,path:'M4 1H96Q99 1 99 4V96Q99 99 96 99H4Q1 99 1 96V4Q1 1 4 1Z'},
  diamond:{label:'菱形',material:'象牙压纹纸 · 精切斜边',image:'assets/originals/event-diamond.png',original:'assets/originals/event-diamond.png',tone:'#f6f1e4',edge:'#c8ba99',w:250,h:210,path:'M50 1L99 50L50 99L1 50Z'},
  para:{label:'平行四边形',material:'灰蓝纤维纸 · 平行压线',image:'assets/originals/event-para.png',original:'assets/originals/event-para.png',tone:'#edf3f5',edge:'#aebfc9',w:254,h:170,path:'M12 1H99L88 99H1Z'},
  ellipse:{label:'椭圆',material:'浅青柔纹纸 · 环形压边',image:'assets/originals/event-ellipse.png',original:'assets/originals/event-ellipse.png',tone:'#edf2e9',edge:'#b3c2aa',w:210,h:118,path:'M99 50A49 49 0 1 1 1 50A49 49 0 1 1 99 50Z'}
};
export function eventSurface(id,shape='process') {
  const s=EVENT_SHAPES[shape]||EVENT_SHAPES.process,key='event-clip-'+id.replace(/[^a-zA-Z0-9_-]/g,'');
  return `<svg class="event-surface" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><clipPath id="${key}"><path d="${s.path}"/></clipPath></defs><path class="event-fill" d="${s.path}"/><image class="event-paper" href="${s.image}" width="100" height="100" preserveAspectRatio="none" clip-path="url(#${key})"/><path class="event-border" d="${s.path}"/><path class="event-emboss" d="${s.path}" transform="translate(50 50) scale(.953) translate(-50 -50)"/></svg>`;
}
export function eventPort(n,side) {
  const shape=n.kind==='event'?(n.shape||'process'):'process',vertical=n.kind==='event'?.01:0;
  const inset=n.kind!=='event'?0:shape==='para'?.065:.01;
  return {x:n.x+n.w*(side==='left'?inset:side==='right'?1-inset:.5),y:n.y+n.h*(side==='top'?vertical:side==='bottom'?1-vertical:.5)};
}
