import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { themeTextures, LINEN_COLORS, SPACE_COLORS } from './theme-textures'

export function createThemeBookModel(book,theme,painting) {
  const group=new THREE.Group(),space=theme==='gravity',maps=themeTextures(book,theme,painting),width=1.42,height=2,depth=space?.19:.17
  const cloth=new THREE.MeshStandardMaterial({color:space?'#182a36':LINEN_COLORS[book.kind]||LINEN_COLORS.novel,bumpMap:maps.cloth,bumpScale:.012,roughness:.85})
  const edge=new THREE.MeshStandardMaterial({color:space?SPACE_COLORS[book.kind]||SPACE_COLORS.novel:'#e9e4d5',bumpMap:maps.cloth,bumpScale:.009,roughness:.8})
  const print=surface=>new THREE.MeshPhysicalMaterial({...surface,roughness:1,metalness:space?.84:0,bumpScale:space?.026:.032,clearcoat:space?.08:.13,clearcoatRoughness:.6})
  const front=print(maps.front),back=print(maps.back),binding=new THREE.MeshStandardMaterial({...maps.spine,roughness:.86,bumpScale:.025})
  const paper=new THREE.MeshStandardMaterial({map:maps.paper,roughness:.95}),topMap=maps.paper.clone();topMap.center.set(.5,.5);topMap.rotation=Math.PI/2;topMap.needsUpdate=true
  const topPaper=paper.clone();topPaper.map=topMap
  const lining=new THREE.MeshStandardMaterial({color:space?'#9a9e94':LINEN_COLORS[book.kind]||'#d7d9cb',roughness:.92})
  function mesh(geometry,material,z=0){const o=new THREE.Mesh(geometry,material);o.position.z=z;o.castShadow=true;o.receiveShadow=true;group.add(o);return o}
  for(const z of[-depth/2-.014,depth/2+.014])mesh(new RoundedBoxGeometry(width,height,.028,3,.014),[edge,edge,edge,edge,z>0?front:cloth,z<0?back:cloth],z)
  mesh(new RoundedBoxGeometry(width-.07,height-.075,depth-.018,2,.008),[paper,paper,topPaper,topPaper,lining,lining])
  for(const z of[-depth/2+.004,depth/2-.004])mesh(new RoundedBoxGeometry(width-.04,height-.04,.005,2,.002),lining,z)
  const vertices=[],uv=[],indices=[],segments=24
  for(let y=0;y<2;y++)for(let i=0;i<=segments;i++){const a=-Math.PI/2+i/segments*Math.PI;vertices.push(-width/2-.038*Math.cos(a),(y-.5)*height,depth/2*Math.sin(a));uv.push(i/segments,y)}
  for(let i=0;i<segments;i++){const c=i+segments+1;indices.push(i,c,i+1,i+1,c,c+1)}
  const spine=new THREE.BufferGeometry();spine.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));spine.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));spine.setIndex(indices);spine.computeVertexNormals();binding.side=THREE.DoubleSide;mesh(spine,binding)
  const hinge=mesh(new THREE.BoxGeometry(.052,height-.07,depth-.018),cloth);hinge.position.x=-.69
  const headband=new THREE.MeshStandardMaterial({color:space?'#ad9572':'#b5bba4',roughness:.82})
  for(const y of[-.967,.967]){const band=mesh(new THREE.CylinderGeometry(.009,.009,depth-.025,10),headband);band.rotation.x=Math.PI/2;band.position.set(-.685,y,0)}
  if(space){
    const metal=new THREE.MeshPhysicalMaterial({color:'#899ca7',metalness:.85,roughness:.38})
    for(const z of[-depth/2-.031,depth/2+.031]){
      for(const x of[-width/2+.009,width/2-.009]){const strip=mesh(new THREE.BoxGeometry(.009,height-.026,.006),metal,z);strip.position.x=x}
      for(const y of[-height/2+.009,height/2-.009]){const strip=mesh(new THREE.BoxGeometry(width-.026,.009,.006),metal,z);strip.position.y=y}
    }
  }
  const radius=new THREE.Box3().setFromObject(group).getBoundingSphere(new THREE.Sphere()).radius
  let disposed=false
  return {group,radius,dispose(){
    if(disposed)return;disposed=true
    const geometries=new Set(),materials=new Set(),textures=new Set()
    group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v)}})
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());group.clear()
  }}
}
