import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createBookModel } from './model'
import { BookInteraction } from './interaction'
import { bookKey } from './textures'
import { createThemeBookModel } from './theme-model'
import { prepareThemeArt } from './theme-assets'

const diagnostics={viewers:0,posterRenderers:0,models:0,frames:0}
export const getBook3DDiagnostics=()=>({...diagnostics,cachedPosters:cache.size})

export function createBookRenderer(canvas,{poster=false,theme='crimson'}={}){
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'})
  const counter=poster?'posterRenderers':'viewers';diagnostics[counter]++
  let room,pmrem,environment
  try {
  renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.82
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(29,1,.1,40)
  room=new RoomEnvironment();pmrem=new THREE.PMREMGenerator(renderer);environment=pmrem.fromScene(room,.04)
  scene.environment=environment.texture;scene.environmentIntensity=.45;room.dispose();pmrem.dispose();room=null;pmrem=null
  scene.add(new THREE.HemisphereLight('#fff6e1','#5d5d56',.55))
  const key=new THREE.DirectionalLight('#fff1d2',2);key.position.set(-3.5,4.2,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=2;key.shadow.camera.bottom=-2;key.shadow.bias=-.0003;key.shadow.normalBias=.02;scene.add(key)
  const fill=new THREE.DirectionalLight('#c8e0ed',.6);fill.position.set(4,1.5,3);scene.add(fill)
  const rim=new THREE.DirectionalLight('#fff0ce',1.8);rim.position.set(-1,3,-3);scene.add(rim)
  if(theme==='gravity'){
    renderer.toneMappingExposure=.95;scene.environmentIntensity=.3
    key.color.set('#dbeaff');key.intensity=2.2;fill.color.set('#a4bccd');fill.intensity=.55;rim.color.set('#d7a781');rim.intensity=2.1
  }else if(theme==='glaze'){
    renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=.95;scene.environmentIntensity=.4
    key.color.set('#fff6df');key.intensity=1.65;fill.color.set('#e5f0f1');fill.intensity=.65;rim.color.set('#fff8e8');rim.intensity=1.1
  }
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.ShadowMaterial({opacity:.19}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.28;floor.receiveShadow=true;scene.add(floor)
  floor.visible=!poster
  let model=null,w=1,h=1,disposed=false
  function setBook(book,painting){if(disposed)return;clearBook();model=theme==='crimson'?createBookModel(book):createThemeBookModel(book,theme,painting);diagnostics.models++;scene.add(model.group)}
  function clearBook(){if(!model)return;scene.remove(model.group);model.dispose();model=null;diagnostics.models--}
  function resize(width,height){if(disposed)return;w=Math.max(1,width);h=Math.max(1,height);renderer.setPixelRatio(poster?1:Math.min(devicePixelRatio||1,2));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
  function render(rotation,zoom=1){
    if(disposed||!model)return
    if(renderer.getContext().isContextLost())throw new Error('Book WebGL context lost')
    model.group.quaternion.fromArray(rotation)
    camera.position.set(0,.06,model.radius*(poster?1:1.35)/(Math.sin(THREE.MathUtils.degToRad(29/2))*Math.min(1,w/h))*1.025)
    if(poster&&theme!=='crimson'){
      const size=new THREE.Box3().setFromObject(model.group).getSize(new THREE.Vector3()),tan=Math.tan(THREE.MathUtils.degToRad(29/2))
      camera.position.set(0,.025,(Math.max(size.y/2/tan,size.x/2/(tan*w/h))+size.z/2)*1.035)
    }
    camera.zoom=zoom;camera.lookAt(0,0,0);camera.updateProjectionMatrix();renderer.render(scene,camera);diagnostics.frames++
  }
  return{canvas,theme,setBook,resize,render,capture(){return canvas.toDataURL('image/webp',.92)},dispose(){if(disposed)return;disposed=true;clearBook();floor.geometry.dispose();floor.material.dispose();key.shadow.dispose();environment.dispose();renderer.dispose();renderer.forceContextLoss();scene.clear();diagnostics[counter]--}}
  } catch(error) {
    room?.dispose();pmrem?.dispose();environment?.dispose();renderer.dispose();renderer.forceContextLoss();diagnostics[counter]--
    throw error
  }
}

// All directory images share one transient renderer, released with its users.
const cache=new Map(),initial=new BookInteraction().rotation
let users=0,epoch=0,pool=null,queue=Promise.resolve(),unavailable=false
export function retainBookPosters(){users++;let released=false;return()=>{if(released)return;released=true;users--;if(users===0){epoch++;cache.clear();const cleanupEpoch=epoch;queue.finally(()=>{if(users||epoch!==cleanupEpoch)return;pool?.dispose();pool=null;unavailable=false})}}}
export function themeRotation(pose='front'){
  const rotations={front:[-.13,.28,-.025],back:[-.1,Math.PI+.25,.02],spine:[-.1,1.2,0],paper:[-.1,-1.15,0],top:[1.08,.1,-.2],lying:[-1.05,.08,-1.64]}
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rotations[pose]||rotations.front))).toArray()
}
export function getBookPoster(book,{theme='crimson',size='mini',pose='front'}={}){
  const key=JSON.stringify([theme,size,pose,bookKey(book)]);if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return value}
  const generation=epoch,snapshot={...book}
  const promise=queue.then(async()=>{
    if(generation!==epoch||!users||unavailable||document.hidden)return null
    try{
      const painting=await prepareThemeArt(theme,snapshot.kind).catch(()=>null)
      if(theme==='glaze'&&!painting)return null
      if(generation!==epoch||!users||document.hidden)return null
      if(pool&&pool.theme!==theme){pool.dispose();pool=null}
      if(!pool)pool=createBookRenderer(document.createElement('canvas'),{poster:true,theme})
      const dimensions=theme==='crimson'?[224,320]:size==='hero'?[448,640]:pose==='lying'?[640,320]:[168,240]
      pool.resize(...dimensions);pool.setBook(snapshot,painting);pool.render(theme==='crimson'?initial:themeRotation(pose),theme==='crimson'?1.28:1);return pool.capture()
    }
    catch{unavailable=true;pool?.dispose();pool=null;return null}
  }).then(url=>{if(!url&&cache.get(key)===promise)cache.delete(key);return url})
  queue=promise.catch(()=>null);cache.set(key,promise);while(cache.size>24)cache.delete(cache.keys().next().value)
  return promise
}
