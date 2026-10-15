const fs = require('fs');
const path = require('path');
const sharp = require('C:/Users/linque/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
async function main(){
  await sharp(path.join(root,'four-book-identities.svg')).png().toFile(path.join(root,'four-book-identities.png'));
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
  for(const s of manifest.styles){
    const dir=path.join(root,s.id);
    await sharp(path.join(dir,'app-icon.svg')).png().toFile(path.join(dir,'app-icon-1024.png'));
    await sharp(path.join(dir,'app-icon-rounded.svg')).png().toFile(path.join(dir,'app-icon-rounded.png'));
    for(const n of [16,24,32,48,64,128,256]){
      const src=n<=24?path.join(dir,`mark-${n}px.svg`):path.join(dir,'mark-black.svg');
      await sharp(src,{density:384}).resize(n,n).png().toFile(path.join(dir,`mark-${n}px.png`));
    }
    const sizes=[16,24,32,48,64,128,256];
    const pngs=await Promise.all(sizes.map(n=>{
      if(n>24)return sharp(path.join(dir,'app-icon.svg')).resize(n,n).png().toBuffer();
      const small=fs.readFileSync(path.join(dir,`mark-${n}px.svg`),'utf8').split('</title>')[1].replace('</svg>','').replaceAll('#111111',s.colors[1]);
      const icon=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${s.colors[0]}"/><g transform="translate(154,143) scale(2.8)">${small}</g></svg>`;
      return sharp(Buffer.from(icon)).resize(n,n).png().toBuffer();
    }));
    let offset=6+16*pngs.length;
    const header=Buffer.alloc(offset); header.writeUInt16LE(1,2);header.writeUInt16LE(pngs.length,4);
    pngs.forEach((buf,i)=>{const p=6+16*i;header[p]=sizes[i]===256?0:sizes[i];header[p+1]=header[p];header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(buf.length,p+8);header.writeUInt32LE(offset,p+12);offset+=buf.length;});
    fs.writeFileSync(path.join(dir,'app-icon.ico'),Buffer.concat([header,...pngs]));
  }
  console.log(JSON.stringify({preview:path.join(root,'four-book-identities.png'),styles:manifest.styles.length}));
}
main().catch(e=>{console.error(e);process.exit(1)});
