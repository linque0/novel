import { readFileSync } from 'node:fs'
import { parse, compileScript, compileTemplate, compileStyle } from '@vue/compiler-sfc'
const files=['App','components/Workbench','components/PanelHost','components/SettingsWindow','components/ChapterTree','components/CharacterCenter','components/CharacterList','components/EditorPane','components/RightPanel','components/OutlineCenter','components/OutlineSidebar','components/MubuView','components/MubuTree','components/SnippetCenter','components/SnippetList','components/LoreDetail','components/InspirationPrompt','components/OutlineCanvas','components/GlazeShelf','components/GlazeCover','components/Bookshelf','components/CharacterGraph','components/OIcon','components/ai/TaskLauncher']
for(const file of files){
  const filename='src/'+file+'.vue', {descriptor,errors}=parse(readFileSync(filename,'utf8'),{filename})
  if(errors.length)throw new Error(JSON.stringify(errors))
  const script=compileScript(descriptor,{id:file})
  const template=compileTemplate({id:file,filename,source:descriptor.template.content,compilerOptions:{bindingMetadata:script.bindings}})
  if(template.errors.length)throw new Error(JSON.stringify(template.errors))
  console.log('PASS compile '+filename)
}
const css=compileStyle({id:'gravity',filename:'src/styles/skins/gravity-workbench.css',source:readFileSync('src/styles/skins/gravity-workbench.css','utf8')})
if(css.errors.length)throw new Error(JSON.stringify(css.errors))
console.log('PASS gravity CSS parse')

const glaze=compileStyle({id:'glaze',filename:'src/styles/skins/glaze.css',source:readFileSync('src/styles/skins/glaze.css','utf8')})
if(glaze.errors.length)throw new Error(JSON.stringify(glaze.errors))
console.log('PASS glaze CSS parse')
