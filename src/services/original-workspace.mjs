export function originalPaneMode(width,sideWidth=252) {
  return { directory: width<960 || width-sideWidth-48<640, notes:width<1280 || width-sideWidth-272-48<640 }
}
export function originalSaveState(state) {
  return state.saving?'saving':state.error?'error':state.pending?'dirty':'saved'
}
