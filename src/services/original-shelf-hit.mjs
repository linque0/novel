export function pickShelfBook(raycaster,books,cabinet) {
  books.updateWorldMatrix(true,true)
  cabinet.updateWorldMatrix(true,true)
  return raycaster.intersectObjects([books,cabinet],true)[0]?.object.userData.book
}
