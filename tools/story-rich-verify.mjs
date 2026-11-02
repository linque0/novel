import assert from 'node:assert/strict'
import {connect} from './_cdp-lib.mjs'
const c=await connect('http://',process.env.CDP_PORT||9333)
try{
 const result=await c.evalx(`(async()=>{const rich=await import('/src/services/story-richtext.js').catch(()=>({}));if(typeof rich.reviseStoryHTML!=='function')return {available:false};const old='<p style="text-align: center"><u><strong>船灯亮了。</strong></u></p><p><span style="color: rgb(180, 80, 50); font-size: 22px"><mark>他走向门口。</mark></span></p>';const normalized=rich.normalizeStoryHTML(old);const {normalizeText}=await import('/src/services/project/text.js');const before=normalizeText(normalized,'html');const revised=rich.reviseStoryHTML(normalized,before,before+'\\n\\n守灯人转过身。');const protect='<p><span data-dl-target="character:c" data-dl-title="人物">船灯</span>亮了。</p>';return {available:true,before,keptUnderline:revised.includes('<u>'),keptBold:revised.includes('<strong>'),keptColor:revised.includes('rgb(180, 80, 50)'),keptSize:revised.includes('22px'),keptAlign:revised.includes('text-align: center'),keptHighlight:revised.includes('<mark'),newText:normalizeText(revised,'html'),protected:rich.normalizeStoryHTML(protect).includes('data-dl-target')}})()`)
 assert(!result?.PAGE_ERR,result?.PAGE_ERR)
 assert.equal(result.available,true,'story editor and revision must preserve the formal rich-text schema')
 for(const key of ['keptUnderline','keptBold','keptColor','keptSize','keptAlign','keptHighlight','protected'])assert.equal(result[key],true,key)
 assert.equal(result.newText,result.before+'\n\n守灯人转过身。')
 console.log('story rich text verification passed: underline, bold, color, size, alignment, highlight, links and untouched revision formatting')
}catch(e){console.error(e);process.exitCode=1}finally{process.exit(process.exitCode||0)}
