// Design-only label layout: demonstrate the requested clear container header.
// Production route geometry and saved relationships are not changed.
export function arrangeDraftLabels() {
  const stage=document.querySelector('.crimson-outline-draft .oc-canvas');
  if(!stage)return;
  const labels=[...stage.querySelectorAll('.oc-elabel')];
  for(const label of labels)label.style.marginTop='';
  const containers=[...stage.querySelectorAll('.oc-node.oc-container')].filter(e=>parseFloat(e.style.height)>200);
  const placed=[];
  for(const label of labels){
    const rect=label.getBoundingClientRect();
    const host=containers.find(e=>{const r=e.getBoundingClientRect();return rect.right>r.left&&rect.left<r.right&&rect.bottom>r.top&&rect.top<r.top+130*r.width/parseFloat(e.style.width)});
    if(!host)continue;
    const h=host.getBoundingClientRect(),scale=h.width/parseFloat(host.style.width);
    let bottom=h.top-10;
    while(placed.some(r=>rect.left<r.right+6&&rect.right>r.left-6&&bottom>r.top-6&&bottom-rect.height<r.bottom+6))bottom-=rect.height+7;
    label.style.marginTop=((bottom-rect.bottom)/scale)+'px';
    placed.push({left:rect.left,right:rect.right,top:bottom-rect.height,bottom});
  }
}
