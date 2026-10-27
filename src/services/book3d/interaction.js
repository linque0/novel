const clamp=(n,a,b)=>Math.max(a,Math.min(b,n))
function unit(q){const n=Math.hypot(...q)||1;return q.map(v=>v/n)}
function mul(a,b){return unit([
  a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
  a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
  a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
  a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]
])}
function axisAngle(axis,angle){const s=Math.sin(angle/2);return [...axis.map(v=>v*s),Math.cos(angle/2)]}
const INITIAL=mul(mul(axisAngle([0,1,0],.36),axisAngle([1,0,0],-.09)),axisAngle([0,0,1],-.045))
function trackball(x,y,w,h){const r=Math.max(1,Math.min(w,h)*.48),u=(x-w/2)/r,v=(h/2-y)/r,s=u*u+v*v;if(s<=1)return[u,v,Math.sqrt(1-s)];const n=Math.sqrt(s);return[u/n,v/n,0]}
function between(a,b){const dot=a.reduce((sum,v,i)=>sum+v*b[i],0),cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];if(dot<-.99999)return axisAngle(Math.abs(a[0])<.8?unit3([0,-a[2],a[1]]):unit3([-a[1],a[0],0]),Math.PI);return unit([...cross,1+dot])}
function unit3(a){const n=Math.hypot(...a)||1;return a.map(v=>v/n)}

/** Input state is independent of WebGL, DOM and animation scheduling. */
export class BookInteraction {
  constructor({onOpen=()=>{},onChange=()=>{},isDisabled=()=>false,isReduced=()=>false,now=()=>performance.now()}={}){
    Object.assign(this,{onOpen,onChange,isDisabled,isReduced,now});this.rotation=[...INITIAL];this.zoom=1;this.pointers=new Map();this.inertia=null;this.gesture=false;this.size=[1,1];this.lastMoveAt=0
  }
  down(id,x,y,w,h){
    if(this.isDisabled())return false
    this.inertia=null;this.lastMoveAt=this.now();this.size=[w,h];this.pointers.set(id,{x,y,startX:x,startY:y})
    if(this.pointers.size===1)this.gesture=false
    else this.gesture=true
    return true
  }
  distance(){const p=[...this.pointers.values()];return p.length<2?0:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)}
  move(id,x,y){
    const p=this.pointers.get(id);if(!p)return
    if(this.isDisabled()){this.cancel();return}
    const previous=this.distance(),old=[p.x,p.y];p.x=x;p.y=y
    if(this.pointers.size>1){const distance=this.distance();if(previous>1)this.zoom=clamp(this.zoom*distance/previous,.8,1.35);this.inertia=null;this.onChange();return}
    if(Math.hypot(x-p.startX,y-p.startY)>5)this.gesture=true
    if(!this.gesture)return
    const q=between(trackball(...old,...this.size),trackball(x,y,...this.size))
    this.rotation=mul(q,this.rotation)
    const angle=2*Math.acos(clamp(q[3],-1,1)),axis=unit3(q.slice(0,3))
    const time=this.now(),dt=clamp(time-this.lastMoveAt,8,50);this.lastMoveAt=time
    this.inertia=angle>1e-5?{axis,speed:Math.min(angle/dt,.009),age:0}:null
    this.onChange()
  }
  up(id){
    if(!this.pointers.has(id))return
    this.pointers.delete(id)
    if(!this.pointers.size){if(!this.gesture&&!this.isDisabled())this.onOpen();if(this.isReduced()||this.now()-this.lastMoveAt>90)this.inertia=null;this.onChange()}
  }
  cancel(){this.pointers.clear();this.inertia=null;this.gesture=true}
  tick(dt){
    if(!this.inertia||this.pointers.size||this.isReduced()||this.isDisabled())return false
    const v=this.inertia;v.age+=dt;v.speed*=Math.exp(-dt/105)
    if(v.age>450||v.speed<.000025){this.inertia=null;return false}
    this.rotation=mul(axisAngle(v.axis,v.speed*dt),this.rotation);return true
  }
  wheel(delta){if(this.isDisabled())return;this.zoom=clamp(this.zoom*Math.exp(clamp(-delta*.001,-3,3)),.8,1.35);this.onChange()}
  reset(){this.cancel();this.rotation=[...INITIAL];this.zoom=1;this.onChange()}
  key(key){
    if(this.isDisabled())return false
    if(key==='Home'){this.reset();return true}
    if(key==='Enter'||key===' '){this.onOpen();return true}
    const steps={ArrowLeft:[[0,1,0],-1],ArrowRight:[[0,1,0],1],ArrowUp:[[1,0,0],-1],ArrowDown:[[1,0,0],1]}
    const step=steps[key];if(!step)return false
    this.inertia=null;this.rotation=mul(axisAngle(step[0],step[1]*Math.PI/12),this.rotation);this.onChange();return true
  }
}
