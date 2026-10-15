const fs=require('fs');
const path=require('path');
const sharp=require('C:/Users/linque/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
async function main(){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
 const tiles=[];
 for(const s of manifest.styles){
  const dir=path.join(root,s.id);
  for(const name of ['emblem-color','emblem-white','emblem-black','app-icon','app-icon-rounded']){
   await sharp(path.join(dir,name+'.svg')).resize(1024,1024).png().toFile(path.join(dir,name+'-1024.png'));
  }
  const sizes=[16,24,32,48,64,128,256],pngs=[];
  for(const n of sizes){
   const buf=await sharp(path.join(dir,n<=64?'app-icon-small.svg':'app-icon.svg')).resize(n,n).png().toBuffer();
   fs.writeFileSync(path.join(dir,`app-icon-${n}.png`),buf);pngs.push(buf);
  }
  let offset=6+16*sizes.length;
  const header=Buffer.alloc(offset);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
  pngs.forEach((png,i)=>{const p=6+i*16;header[p]=sizes[i]===256?0:sizes[i];header[p+1]=header[p];header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(png.length,p+8);header.writeUInt32LE(offset,p+12);offset+=png.length;});
  fs.writeFileSync(path.join(dir,'app-icon.ico'),Buffer.concat([header,...pngs]));
  tiles.push({input:await sharp(path.join(dir,'app-icon-rounded.svg')).resize(260,260).png().toBuffer(),left:40+320*tiles.length,top:50});
 }
 await sharp({create:{width:1960,height:360,channels:4,background:'#DEE2E8'}}).composite(tiles).png().toFile(path.join(root,'six-app-icons.png'));
 console.log(JSON.stringify({styles:manifest.styles.length,pngExports:manifest.styles.length*12,icoExports:manifest.styles.length}));
}
main().catch(e=>{console.error(e);process.exit(1)});
