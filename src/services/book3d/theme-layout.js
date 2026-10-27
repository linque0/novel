/** Measure real glyphs while keeping ordinary Latin words together. */
export function wrapBookLines(text,ctx,width) {
  const rows=[]
  let row=''
  for(let token of String(text).replace(/\r\n?/g,'\n').match(/[A-Za-z0-9]+|[\s\S]/gu)||[]) {
    if(token==='\n'){rows.push(row.trimEnd());row='';continue}
    if(/\s/.test(token)){if(row&&!row.endsWith(' '))row+=' ';continue}
    if(row&&ctx.measureText(row+token).width>width){rows.push(row.trimEnd());row=''}
    while(ctx.measureText(token).width>width){
      let prefix=''
      for(const ch of token){if(prefix&&ctx.measureText(prefix+ch).width>width)break;prefix+=ch}
      rows.push(prefix);token=token.slice(prefix.length)
    }
    row+=token
  }
  if(row.trim())rows.push(row.trimEnd())
  return rows
}
