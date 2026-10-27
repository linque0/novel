import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { bookTextures, BOOK_COLORS } from './textures'

export function createBookModel(book){
  const group=new THREE.Group(),maps=bookTextures(book),width=1.42,height=2,depth=.18
  const leather=new THREE.MeshPhysicalMaterial({color:BOOK_COLORS[book.kind]||BOOK_COLORS.novel,roughness:.67,metalness:0,bumpMap:maps.leather,bumpScale:.009,clearcoat:.13,clearcoatRoughness:.55})
  const printed=surface=>new THREE.MeshPhysicalMaterial({...surface,metalness:.95,roughness:1,bumpScale:.038,clearcoat:.27,clearcoatRoughness:.38,envMapIntensity:1.4})
  const front=printed(maps.front),back=printed(maps.back),spineMaterial=printed(maps.spine)
  const paper=new THREE.MeshStandardMaterial({map:maps.paper,color:'#fff9e7',roughness:.94,metalness:0})
  const topMap=maps.paper.clone();topMap.center.set(.5,.5);topMap.rotation=Math.PI/2;topMap.needsUpdate=true
  const topPaper=paper.clone();topPaper.map=topMap
  const sheet=new THREE.MeshStandardMaterial({color:'#e9dfcc',roughness:.9})
  function mesh(geometry,materials,z=0){const m=new THREE.Mesh(geometry,materials);m.position.z=z;m.castShadow=true;m.receiveShadow=true;group.add(m);return m}
  mesh(new RoundedBoxGeometry(width,height,.028,3,.018),[leather,leather,leather,leather,front,leather],depth/2+.014)
  mesh(new RoundedBoxGeometry(width,height,.028,3,.018),[leather,leather,leather,leather,leather,back],-depth/2-.014)
  mesh(new RoundedBoxGeometry(width-.075,height-.075,depth-.022,2,.009),[paper,paper,topPaper,topPaper,sheet,sheet])
  const hinge=leather.clone();hinge.color.multiplyScalar(.5)
  const lining=mesh(new THREE.BoxGeometry(.055,height-.075,depth-.022),hinge);lining.position.x=-.689
  for(const z of[-.086,.086])mesh(new RoundedBoxGeometry(width-.044,height-.04,.005,2,.002),sheet,z)
  const positions=[],uvs=[],indices=[],segments=20
  for(let y=0;y<=1;y++)for(let i=0;i<=segments;i++){
    const theta=-Math.PI/2+i/segments*Math.PI
    positions.push(-width/2-.047*Math.cos(theta),(y-.5)*height,depth/2*Math.sin(theta));uvs.push(i/segments,y)
  }
  for(let i=0;i<segments;i++){const a=i,b=i+1,c=i+segments+1,d=c+1;indices.push(a,c,b,b,c,d)}
  const spine=new THREE.BufferGeometry();spine.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));spine.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));spine.setIndex(indices);spine.computeVertexNormals();spineMaterial.side=THREE.DoubleSide;mesh(spine,spineMaterial)
  // Subtle raised headbands, a visible detail when inspecting top and bottom.
  const bandMaterial=new THREE.MeshStandardMaterial({color:'#b49a61',roughness:.8})
  for(const y of[-.974,.974]){const band=mesh(new THREE.CylinderGeometry(.011,.011,.155,10),bandMaterial);band.rotation.x=Math.PI/2;band.position.set(-.69,y,0)}
  const radius=new THREE.Box3().setFromObject(group).getBoundingSphere(new THREE.Sphere()).radius
  let disposed=false
  return{group,radius,dispose(){if(disposed)return;disposed=true;const geometries=new Set(),materials=new Set(),textures=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value)}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();group.clear()}}
}
