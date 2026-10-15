from pathlib import Path
R=Path(__file__).resolve().parent
p=R/'aligned.js'
s=p.read_text(encoding='utf-8')
s=s.replace("let t=e.target.closest('button');if(!t)return;", "let t=e.target.closest('button');if(!t){let card=e.target.closest('[data-drag-module]');if(card){activeModule=card.dataset.dragModule;document.querySelectorAll('[data-drag-module]').forEach(el=>el.classList.toggle('selected',el===card));document.querySelectorAll('[data-mod-id]').forEach(el=>el.classList.toggle('active',el.dataset.modId===activeModule))}return;}",1)
s=s.replace("openDialog(t.dataset.demo,'设计演示输入')", "openDialog(t.dataset.demo,t.dataset.demo.includes('类型')?'类型名称':'名称或说明')")
s=s.replace('<path data-edit-edge d="M450 140L190 370M450 140L710 370M190 370H710"/><text x="288" y="228">师徒</text><text x="594" y="228">对立</text><text x="435" y="352">旧识</text>', '${graphLayout===\'grid\'?\'<path data-edit-edge d="M235 250H375M525 250H665M160 145V105H740V145"/><text x="288" y="234">师徒</text><text x="580" y="234">旧识</text><text x="435" y="90">对立</text>\':\'<path data-edit-edge d="M450 140L190 370M450 140L710 370M190 370H710"/><text x="288" y="228">师徒</text><text x="594" y="228">对立</text><text x="435" y="352">旧识</text>\'}')
p.write_text(s,encoding='utf-8')
p=R/'aligned.css';s=p.read_text(encoding='utf-8').replace('.af-character-canvas.is-grid .af-char-net svg{opacity:.2}', '.af-character-canvas.is-grid .af-char-net svg{opacity:1}')
p.write_text(s,encoding='utf-8')
p=R/'index.html';s=p.read_text(encoding='utf-8').replace('红月海报 / 巨字宋体 / 人物专访','红月海报 / 巨字宋体 / 编辑档案').replace('荧光切片 / 金属雕塑 / 场景剪辑','荧光切片 / 金属雕塑 / 模块画布')
p.write_text(s,encoding='utf-8')
p=R/'build.py';s=p.read_text(encoding='utf-8').replace("+s['id']+'.html')", "+s['id']+'.html?state=world-detail')")
p.write_text(s,encoding='utf-8')
