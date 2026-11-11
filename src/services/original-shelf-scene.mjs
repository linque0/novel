import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { layoutShelfBooks } from './original-shelf-layout.mjs'
import { pickShelfBook } from './original-shelf-hit.mjs'
import woodUrl from '../assets/skins/original/oak-smoked.webp'
import normalUrl from '../assets/skins/original/oak-normal.jpg'
import roughUrl from '../assets/skins/original/oak-roughness.jpg'

const colours={novel:'#354f64',note:'#d8d0b9',cedar:'#3c5347',violet:'#645568',claret:'#693f3b',ink:'#303633'}
export function createShelfScene(host,{onProject,onOpen,onFail,onReady}){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'})
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05
 renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.type=THREE.PCFShadowMap
 renderer.domElement.setAttribute('aria-hidden','true');host.prepend(renderer.domElement)
 const scene=new THREE.Scene();scene.background=new THREE.Color('#e5e0d5')
 const camera=new THREE.PerspectiveCamera(30,1,.01,20)
 const resources=new Set(), bookResources=new Set(), bookRoot=new THREE.Group(), cabinet=new THREE.Group()
 scene.add(cabinet,bookRoot)
 const own=(r,book=false)=>{(book?bookResources:resources).add(r);return r}
 const pmrem=own(new THREE.PMREMGenerator(renderer)), room=new RoomEnvironment()
 const environment=own(pmrem.fromScene(room,.05));scene.environment=environment.texture;scene.environmentIntensity=.6;room.dispose()
 let disposed=false,frame=0,previous=0,selectedId=null,hoverId=null,books=[],width=1,height=1,visible=true,ready=false
 const media=matchMedia('(prefers-reduced-motion: reduce)')
 const loader=new THREE.TextureLoader()
 function load(url,colour=false){const t=own(loader.load(url,()=>{if(!disposed){t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);for(const r of resources)if(r.isTexture&&r.source===t.source)r.needsUpdate=true;invalidate()}}));t.wrapS=t.wrapT=THREE.RepeatWrapping;if(colour)t.colorSpace=THREE.SRGBColorSpace;return t}
 const wood=load(woodUrl,true), woodNormal=load(normalUrl), woodRough=load(roughUrl)
 function woodMaterial(horizontal=false){const map=own(wood.clone()),normalMap=own(woodNormal.clone()),roughnessMap=own(woodRough.clone());for(const t of [map,normalMap,roughnessMap]){t.rotation=horizontal?Math.PI/2:0;t.center.set(.5,.5);t.repeat.set(horizontal?2.2:.7,horizontal?.4:1.4)}return own(new THREE.MeshStandardMaterial({map,normalMap,roughnessMap,color:'#c1b6a2',roughness:.9,normalScale:new THREE.Vector2(.07,.07)}))}
 const horizontal=woodMaterial(true),vertical=woodMaterial(),back=own(new THREE.MeshStandardMaterial({color:'#63665b',roughness:1})),wall=own(new THREE.MeshStandardMaterial({color:'#d9d4c8',roughness:1}))
 const white=own(new THREE.MeshStandardMaterial({color:'#ded6c3',roughness:1}))
 function box(parent,w,h,d,x,y,z,material,rounded=.0015,book=false){const geo=own(rounded?new RoundedBoxGeometry(w,h,d,2,rounded):new THREE.BoxGeometry(w,h,d),book);const mesh=new THREE.Mesh(geo,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
 box(cabinet,4,2,.05,0,.5,-.24,wall,0)
 box(cabinet,1.86,.85,.018,0,.426,-.145,back)
 for(const x of [-.946,.946])box(cabinet,.038,.91,.31,x,.435,-.004,vertical)
 for(const y of [.055,.435,.845])box(cabinet,1.93,.038,.32,0,y,.005,horizontal)
 // The counter is a real projecting board, rather than a floating UI card.
 box(cabinet,2.08,.055,.50,0,-.025,.11,horizontal,.003)
 box(cabinet,.022,.76,.26,.02,.44,-.015,vertical)
 const sun=new THREE.DirectionalLight('#fff0d8',2.3);sun.position.set(1.6,2.5,2.1);sun.target.position.set(-.3,.3,-.12);scene.add(sun,sun.target)
 sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-1.8,right:1.8,top:1.8,bottom:-1.8,near:.1,far:7});sun.shadow.normalBias=.003;sun.shadow.bias=-.00015;sun.shadow.radius=4
 own(sun.shadow)
 const fill=new THREE.HemisphereLight('#e7edf1','#817866',1.35);scene.add(fill)
 // Thin off-camera mullions cast actual directional shadows through the cabinet.
 const mullionMat=own(new THREE.MeshStandardMaterial({color:'#615b4c',roughness:1}))
 const windowFrame=new THREE.Group();scene.add(windowFrame)
 for(const x of [1.18,1.53,1.88])box(windowFrame,.026,1.5,.025,x,1.35,.75,mullionMat,0)
 box(windowFrame,.95,.025,.025,1.53,1.48,.75,mullionMat,0)
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2()
 function bookTexture(book,spine=false){
  const canvas=document.createElement('canvas');canvas.width=spine?256:768;canvas.height=1024;const c=canvas.getContext('2d')
  c.fillStyle=colours[book.kind]||colours.novel;c.fillRect(0,0,canvas.width,1024)
  let seed=31;for(let i=0;i<18000;i++){seed=(seed*1664525+1013904223)>>>0;const x=seed%canvas.width;seed=(seed*1664525+1013904223)>>>0;c.fillStyle=i%2?'#ffffff06':'#00000009';c.fillRect(x,seed%1024,1,2)}
  const ink=book.kind==='note'?'#4a493e':'#e0d5b6';c.fillStyle=ink;c.textAlign='center'
  const title=String(book.title||'未命名作品')
  if(spine){c.font='38px "Noto Serif SC", SimSun, serif';const chars=[...title];const size=Math.min(44,660/Math.max(chars.length,1));c.font=`${size}px "Noto Serif SC", SimSun, serif`;chars.slice(0,40).forEach((ch,i)=>c.fillText(ch,128,170+i*size*1.2));c.font='20px serif';c.fillText(String(book.author||'').slice(0,8),128,920)}
  else{
   c.font='19px "Microsoft YaHei",sans-serif';c.fillText(book.genre||'文学作品',384,108)
   c.fillRect(334,146,100,1)
   if([...title].length<=6){c.font='106px "Noto Serif SC",SimSun,serif';const chars=[...title],step=120;const top=490-(chars.length-1)*step/2;chars.forEach((ch,i)=>c.fillText(ch,384,top+i*step))}
   else{c.font='72px "Noto Serif SC",SimSun,serif';const chars=[...title];let lines=[],line='';for(const ch of chars){if(c.measureText(line+ch).width>580){lines.push(line);line=ch}else line+=ch}if(line)lines.push(line);lines=lines.slice(0,6);const top=470-(lines.length-1)*49;lines.forEach((l,i)=>c.fillText(l,384,top+i*98))}
   if(book.author){c.font='26px "Noto Serif SC",SimSun,serif';c.fillText(String(book.author).slice(0,18)+' 著',384,820)}
   c.font='17px serif';c.fillText('小 说 工 坊',384,940)
  }
  const t=own(new THREE.CanvasTexture(canvas),true);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t
 }
 // Neutral micro-normal gives cloth a response to light without baking highlights into its colour.
 const clothCanvas=document.createElement('canvas');clothCanvas.width=clothCanvas.height=128;const cc=clothCanvas.getContext('2d');const image=cc.createImageData(128,128);for(let y=0;y<128;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4;image.data[i]=128+(x%4<2?7:-7);image.data[i+1]=128+(y%4<2?7:-7);image.data[i+2]=255;image.data[i+3]=255}cc.putImageData(image,0,0);const cloth=own(new THREE.CanvasTexture(clothCanvas));cloth.wrapS=cloth.wrapT=THREE.RepeatWrapping;cloth.repeat.set(6,8)
 function makeBook(layout){
  const {book,width:w,height:h,thickness:d}=layout,group=new THREE.Group();group.position.set(layout.x,layout.baseY,0);group.rotation.y=layout.angle;group.userData={book,layout,baseZ:0};bookRoot.add(group)
  const face=own(new THREE.MeshStandardMaterial({map:bookTexture(book),roughness:book.kind==='ink'?.55:.9,normalMap:cloth,normalScale:new THREE.Vector2(.1,.1)}),true)
  const side=own(new THREE.MeshStandardMaterial({color:colours[book.kind]||colours.novel,roughness:.85,normalMap:cloth,normalScale:new THREE.Vector2(.12,.12)}),true)
  const spine=own(new THREE.MeshStandardMaterial({map:bookTexture(book,true),roughness:.85}),true)
  const leaf=own(new THREE.MeshStandardMaterial({color:'#e7dfc9',roughness:.95}),true)
  box(group,w-.006,h-.007,d-.005,.002,h/2,0,leaf,.001,true)
  const coverParts=[]
  const part=(w,h,d,x,y,z)=>{const geo=new RoundedBoxGeometry(w,h,d,1,Math.min(.001,d/2));geo.translate(x,y,z);coverParts.push(geo)}
  for(const z of [-d/2,d/2])part(w,h,.003,0,h/2,z)
  part(.005,h,d,-w/2,h/2,0)
  const shell=new THREE.Mesh(own(mergeGeometries(coverParts),true),side);shell.castShadow=true;shell.receiveShadow=true;group.add(shell);coverParts.forEach(g=>g.dispose())
  const front=new THREE.Mesh(own(new THREE.PlaneGeometry(w-.006,h-.006),true),face);front.position.set(0,h/2,d/2+.0016);front.receiveShadow=true;group.add(front)
  const spinePlane=new THREE.Mesh(own(new THREE.PlaneGeometry(d-.003,h-.006),true),spine);spinePlane.receiveShadow=true;spinePlane.rotation.y=-Math.PI/2;spinePlane.position.set(-w/2-.0026,h/2,0);group.add(spinePlane)
  // Fine headbands at the top and bottom are physical, but deliberately restrained.
  box(group,w-.014,.0015,d-.004,.002,h-.004,0,white,0,true)
  {const ribbon=own(new THREE.MeshStandardMaterial({color:'#713b37',roughness:1,side:THREE.DoubleSide}),true);const ribbonMesh=box(group,.006,h+.012,.0005,w*.26,h/2-.006,d/2+.002,ribbon,0,true);ribbonMesh.name='bookmark';ribbonMesh.visible=book.id===selectedId}
  group.traverse(o=>{if(o.isMesh)o.userData.book=book})
  return group
 }
 function clearBooks(){bookRoot.clear();for(const r of bookResources)r.dispose();bookResources.clear()}
 let signature=''
 function setBooks(next,id){selectedId=id;const key=JSON.stringify(next.map(b=>[b.id,b.title,b.author,b.kind,b.totalWords,b.genre]));if(key!==signature){signature=key;clearBooks();books=layoutShelfBooks(next).map(makeBook)}else for(const g of books)g.getObjectByName('bookmark').visible=g.userData.book.id===id;invalidate();project()}
 function project(){camera.updateMatrixWorld();onProject(books.map(g=>{const v=new THREE.Vector3(g.position.x,g.userData.layout.baseY-.006,.21).project(camera);return{book:g.userData.book,x:(v.x+1)*50,y:(1-v.y)*50,labelWidth:Math.min(144,width*.10)}}))}
 function resize(){if(disposed)return;width=host.clientWidth;height=host.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;const dist=Math.max(1.0/(2*Math.tan(Math.PI/12)),2.12/(2*Math.tan(Math.PI/12)*camera.aspect));camera.position.set(0,.43+dist*.105,dist);camera.lookAt(0,.43,0);camera.updateProjectionMatrix();project();invalidate()}
 function hover(id){hoverId=id;invalidate()}
 function tick(time){frame=0;if(disposed||document.hidden||!visible)return;const dt=previous?Math.min(time-previous,40):16;previous=time;let moving=false
  for(const g of books){const target=(g.userData.book.id===hoverId ? .01 : 0)+(g.userData.book.id===selectedId ? .018 : 0);const delta=target-g.position.z;if(media.matches)g.position.z=target;else if(Math.abs(delta)>.0001){g.position.z+=delta*(1-Math.exp(-dt/55));moving=true}else g.position.z=target}
  renderer.shadowMap.needsUpdate=renderer.shadowMap.needsUpdate||moving;renderer.render(scene,camera);renderer.domElement.dataset.frames=Number(renderer.domElement.dataset.frames||0)+1;renderer.domElement.dataset.textures=renderer.info.memory.textures;renderer.domElement.dataset.drawCalls=renderer.info.render.calls;renderer.domElement.dataset.triangles=renderer.info.render.triangles;if(!ready){ready=true;onReady?.()}if(moving)frame=requestAnimationFrame(tick)
 }
 function invalidate(){renderer.shadowMap.needsUpdate=true;if(!disposed&&!frame&&!document.hidden&&visible)frame=requestAnimationFrame(tick)}
 function hit(event){const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return pickShelfBook(raycaster,bookRoot,cabinet)}
 const move=e=>{const b=hit(e);renderer.domElement.style.cursor=b?'pointer':'default';if((b?.id??null)!==hoverId)hover(b?.id??null)}
 const leave=()=>hover(null), click=e=>{const book=hit(e);if(book)onOpen(book)}, lost=e=>{e.preventDefault();onFail()}, visibility=()=>{previous=0;if(document.hidden){cancelAnimationFrame(frame);frame=0}else invalidate()}
 const intersection=new IntersectionObserver(([e])=>{visible=e.isIntersecting;visibility()});intersection.observe(host)
 renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerleave',leave);renderer.domElement.addEventListener('click',click);renderer.domElement.addEventListener('webglcontextlost',lost)
 document.addEventListener('visibilitychange',visibility);media.addEventListener('change',invalidate)
 document.fonts.ready.then(()=>{if(!disposed){signature='';setBooks(books.map(g=>g.userData.book),selectedId)}})
 resize()
 return{setBooks,resize,hover,dispose(){disposed=true;cancelAnimationFrame(frame);intersection.disconnect();document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',invalidate);renderer.domElement.removeEventListener('pointermove',move);renderer.domElement.removeEventListener('pointerleave',leave);renderer.domElement.removeEventListener('click',click);renderer.domElement.removeEventListener('webglcontextlost',lost);clearBooks();for(const r of resources)r.dispose?.();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove()}}
}
