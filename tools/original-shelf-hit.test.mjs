import test from 'node:test'
import assert from 'node:assert/strict'
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { pickShelfBook } from '../src/services/original-shelf-hit.mjs'
test('cabinet occludes books and world matrices are current before pointer picking',()=>{
 const cabinet=new Group(),books=new Group(),geo=new BoxGeometry(1,1,.1),material=new MeshBasicMaterial()
 const board=new Mesh(geo,material);board.position.z=1;cabinet.add(board)
 const book=new Mesh(geo,material);book.userData.book={id:'a'};books.add(book)
 const ray=new Raycaster(new Vector3(0,0,3),new Vector3(0,0,-1))
 assert.equal(pickShelfBook(ray,books,cabinet),undefined)
 board.position.x=2
 assert.equal(pickShelfBook(ray,books,cabinet)?.id,'a')
 geo.dispose();material.dispose()
})
