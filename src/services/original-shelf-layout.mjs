import { bookDimensions } from './original-shelf.mjs'
export function layoutShelfBooks(books) {
  return books.slice(0,8).map((book,index)=>{
    const dimensions=bookDimensions(book), column=index%4, row=Math.floor(index/4)
    return { id:book.id, book, row, column, faceOut:column===0,
      x:[-.63,-.36,.28,.55][column], baseY:row===0?.454:.074,
      height:Math.min(.24,.20+(dimensions.height-158)/12*.04),
      width:.148, thickness:.016+(dimensions.thickness-22)/32*.026,
      angle:column===0?-.16:1.13-(column%2)*.12 }
  })
}
