import { readFileSync } from 'node:fs'
import { parse, compileScript, compileTemplate, compileStyle } from '@vue/compiler-sfc'
const files=['Workbench','OutlineSidebar','CharacterCenter','LoreRelRows','CharacterGraph','SnippetCenter','SnippetList','GravityShelf','GravityCover','InspirationPrompt']
for(const name of files){
 const filename='src/components/'+name+'.vue', {descriptor,errors}=parse(readFileSync(filename,'utf8'),{filename})
 if(errors.length)throw new Error(JSON.stringify(errors))
 const script=compileScript(descriptor,{id:name})
 const template=compileTemplate({id:name,filename,source:descriptor.template.content,compilerOptions:{bindingMetadata:script.bindings}})
 if(template.errors.length)throw new Error(JSON.stringify(template.errors))
 console.log('PASS compile '+filename)
}
for(const name of ['gravity','gravity-workbench']){
 const filename='src/styles/skins/'+name+'.css'
 const result=compileStyle({id:name,filename,source:readFileSync(filename,'utf8')})
 if(result.errors.length)throw new Error(JSON.stringify(result.errors))
 console.log('PASS parse '+filename)
}
