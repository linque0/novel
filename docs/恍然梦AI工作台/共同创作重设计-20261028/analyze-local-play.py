"""Read-only local ST play research. Export anonymous structure only, never messages/names/secrets.
Run: python analyze-local-play.py --output <anonymous-report.json>
Inputs are limited to the three user-authorized local ST data/default-user roots.
"""
from pathlib import Path
import argparse, base64, collections, hashlib, json, re, statistics, struct, zlib

VERSIONS = ('1.14.0', '1.15.0', '1.19.0')
BASE = Path('E:/SillyTavern')
def sha(raw): return hashlib.sha256(raw).hexdigest()
def root(version): return BASE / ('SillyTavern-' + version) / ('SillyTavern-' + version) / 'data/default-user'
def read_rows(path):
    rows, errors = [], 0
    with path.open(encoding='utf-8-sig') as stream:
        for number, line in enumerate(stream, 1):
            if not line.strip(): continue
            try:
                row=json.loads(line)
                if isinstance(row,dict): rows.append((number,row))
            except (ValueError,TypeError): errors+=1
    return rows,errors

def card_data(path):
    raw=path.read_bytes()
    if raw[:8] != b'\x89PNG\r\n\x1a\n': return None
    offset,found=8,{}
    while offset+12<=len(raw):
        length=struct.unpack('>I',raw[offset:offset+4])[0]
        kind=raw[offset+4:offset+8];body=raw[offset+8:offset+8+length];offset+=length+12
        if kind==b'tEXt' and b'\0' in body:
            key,text=body.split(b'\0',1)
            if key in (b'chara',b'ccv3'):
                try: found[key]=json.loads(base64.b64decode(text))
                except (ValueError,TypeError): pass
        if kind==b'IEND':break
    value=found.get(b'ccv3') or found.get(b'chara')
    if not isinstance(value,dict):return None
    data=value.get('data',value)
    return data if isinstance(data,dict) else None

def stats(messages):
    sizes=[len(str(m.get('mes',''))) for _,m in messages]
    return {'messages':len(sizes),'textCharacters':sum(sizes),'medianTextCharacters':statistics.median(sizes) if sizes else 0,'maxTextCharacters':max(sizes,default=0)}
def generated(m):
    extra=m.get('extra') or {}
    return not m.get('is_user') and bool(m.get('gen_started') or m.get('gen_finished') or extra.get('model'))
def shape(value):
    if isinstance(value,dict):return {'kind':'object','keys':len(value),'hash':sha(json.dumps(value,ensure_ascii=False,sort_keys=True).encode())}
    if isinstance(value,list):return {'kind':'array','items':len(value),'hash':sha(json.dumps(value,ensure_ascii=False,sort_keys=True).encode())}
    return {'kind':type(value).__name__}

def analyze():
    code=BASE/'SillyTavern-1.19.0/SillyTavern-1.19.0/public/scripts/chats.js'
    code_bytes=code.read_bytes();code_lines=code_bytes.decode('utf-8-sig').splitlines()
    technical={'file':'public/scripts/chats.js','localVersion':'1.19.0','sha256':sha(code_bytes),'function':'hideChatMessageRange','line':next(i+1 for i,line in enumerate(code_lines) if 'export async function hideChatMessageRange' in line),'interpretation':'is_system also marks messages hidden from context, independent of user/model authorship'}
    copies,inventory={},[]
    for version in VERSIONS:
        files=list((root(version)/'chats').rglob('*.jsonl'))
        digests=[]
        for path in files:
            digest=sha(path.read_bytes());digests.append(digest)
            copies.setdefault(digest,[]).append((version,path))
        inventory.append({'version':version,'chatFiles':len(files),'chatBytes':sum(p.stat().st_size for p in files),'cards':len(list((root(version)/'characters').glob('*.png'))),'worldFiles':len(list((root(version)/'worlds').glob('*.json'))),'contentHashes':sorted(digests)})
    cards={};rows=[]
    for number,(digest,locations) in enumerate(sorted(copies.items()),1):
        version,path=locations[-1];parsed,errors=read_rows(path)
        messages=[(line,m) for line,m in parsed if 'mes' in m]
        headers=[m for _,m in parsed if 'mes' not in m]
        meta=next((m.get('chat_metadata') or {} for m in headers if 'chat_metadata' in m),{})
        users=[pair for pair in messages if pair[1].get('is_user')]
        outputs=[pair for pair in messages if generated(pair[1])]
        other=[pair for pair in messages if not pair[1].get('is_user') and not generated(pair[1])]
        link=None;opening_match=None
        cp=root(version)/'characters'/(path.parent.name+'.png')
        if cp.exists():
            data=card_data(cp)
            if data:
                card_hash=sha(cp.read_bytes());link='C-'+card_hash[:12]
                if link not in cards:
                    fields={k:len(str(data.get(k) or '')) for k in ('description','personality','scenario','first_mes','mes_example','system_prompt','post_history_instructions')}
                    greetings=data.get('alternate_greetings') or []
                    book=data.get('character_book') or {};entries=book.get('entries') or []
                    if isinstance(entries,dict):entries=list(entries.values())
                    corpus='\n'.join(str(data.get(k) or '') for k in fields)+'\n'+'\n'.join(str(e.get('content') or '') for e in entries if isinstance(e,dict))
                    rule_patterns={
                        'storyInitiative':r'主动.{0,30}(推进|推动|引入|发展)|推动.{0,20}(剧情|故事)|剧情.{0,20}(推进|发展)|NPC.{0,20}(自主|主动)',
                        'playerAgency':r'(禁止|不要|不得|不能|不应).{0,30}(代替|替|控制|决定).{0,30}(玩家|用户|user|主角)',
                        'stateContinuity':r'状态|变量|追踪|记忆|时间线|前因后果',
                        'optionsOrActions':r'选项|选择|行动|下一步',
                    }
                    cards[link]={'alias':link,'pngSha256':card_hash,'cardDataSha256':sha(json.dumps(data,ensure_ascii=False,sort_keys=True).encode()),'fieldCharacterCounts':fields,'alternateGreetings':len(greetings),'alternateGreetingCharacterCounts':[len(str(x)) for x in greetings],'embeddedLoreEntries':len(entries),'enabledLoreEntries':sum(isinstance(e,dict) and e.get('enabled') is not False for e in entries),'constantLoreEntries':sum(isinstance(e,dict) and bool(e.get('constant')) and e.get('enabled') is not False for e in entries),'openingHasHtmlOrScript':bool(re.search(r'<(?:html|style|script|div|details)\b',str(data.get('first_mes') or ''),re.I)),'instructionPatternHits':{k:bool(re.search(pattern,corpus,re.I|re.S)) for k,pattern in rule_patterns.items()},'patternDisclaimer':'keyword signals only; no claim that model followed the rules'}
                if messages:
                    first=str(messages[0][1].get('mes') or '')
                    # Exact matching only. Mismatch can result from macros, scripts, edits or greeting choice.
                    candidates=[str(data.get('first_mes') or '')]+[str(x) for x in data.get('alternate_greetings') or []]
                    opening_match=first in candidates
        swipe_messages=[(line,m) for line,m in messages if len(m.get('swipes') or [])>1]
        states=[shape(m.get('variables')) for _,m in messages if isinstance(m.get('variables'),(dict,list))]
        user_texts=[str(m.get('mes') or '') for _,m in users]
        plot_states=[(line,m.get('qrf_plot')) for line,m in messages if m.get('qrf_plot') is not None]
        hidden_outputs=sum(bool(m.get('is_system')) for _,m in outputs)
        buckets=collections.Counter()
        for _,message in messages:
            for key,value in message.items():
                if key=='mes':bucket='messageText'
                elif key=='variables':bucket='variableSnapshots'
                elif key.startswith('TavernDB_ACU_'):bucket='persistedMemoryExtensionFields'
                elif key.startswith('qrf_'):bucket='plotExtensionFields'
                elif key in ('swipes','swipe_info'):bucket='responseVariantFields'
                else:bucket='otherMessageFields'
                buckets[bucket]+=len(json.dumps(value,ensure_ascii=False,separators=(',',':')).encode())
        markers={'htmlDisplay':0,'variableUpdate':0,'optionsOrActions':0,'stateDisplay':0}
        for _,message in outputs:
            text=str(message.get('mes') or '')
            markers['htmlDisplay']+=bool(re.search(r'<(?:style|script|div|details|table)\b',text,re.I))
            markers['variableUpdate']+=bool(re.search(r'<(?:UpdateVariable|updatevariable|变量更新|JSONPatch)\b',text,re.I))
            markers['optionsOrActions']+=bool(re.search(r'<(?:options|choices|Actions|选项|行动选项)\b|(?:行动|选择|下一步)[：:]',text,re.I))
            markers['stateDisplay']+=bool(re.search(r'<(?:Status|StatusBlock|StatusPlaceHolderImpl|状态栏|stat_data)\b',text,re.I))
        row={'alias':'S%02d'%number,'sha256':digest,'copyVersions':[v for v,_ in locations],'bytes':path.stat().st_size,'messageCount':len(messages),'parseErrors':errors,'canonicalValueBytesByCategory':dict(buckets),'modelOutputStructureMarkers':markers,'linkedCard':link,'cardOpeningExactMatch':opening_match,'firstRole':'user' if messages and messages[0][1].get('is_user') else 'non-user' if messages else 'none','user':stats(users),'modelTaggedOutput':stats(outputs),'otherNonUser':stats(other),'excludedUserMessages':sum(bool(m.get('is_system')) for _,m in users),'excludedModelOutputs':hidden_outputs,'shortUserMessagesAtMost80Characters':sum(len(t)<=80 for t in user_texts),'shortContinueLikeHeuristic':sum(len(t)<=80 and bool(re.search(r'继续|接着|推进|下一幕|下一段|continue',t,re.I)) for t in user_texts),'swipeMessages':len(swipe_messages),'extraVariants':sum(len(m.get('swipes') or [])-1 for _,m in swipe_messages),'maxVariants':max((len(m.get('swipes') or []) for _,m in messages),default=0),'swipeEvidenceLines':[line for line,_ in swipe_messages],'generationEvidenceLines':[line for line,_ in outputs[:3]],'branchLinks':sum(len((m.get('extra') or {}).get('branches') or []) for _,m in messages),'checkpointLinks':sum(bool((m.get('extra') or {}).get('bookmark_link')) for _,m in messages),'nonemptyAuthorNote':bool(meta.get('note_prompt')),'authorNoteInterval':meta.get('note_interval'),'worldBound':bool(meta.get('world_info')),'messageVariableSnapshots':len(states),'distinctVariableSnapshots':len({v.get('hash') for v in states if v.get('hash')}),'headerVariableShape':shape(meta.get('variables')),'plotStateRecords':len(plot_states),'plotStateShapes':[{'line':line,**shape(value)} for line,value in plot_states[:2]],'structuredMemoryMessages':sum(any(k.startswith('TavernDB_ACU_') for k in m) for _,m in messages),'summaryMetadataMessages':sum('TavernDB_ACU_SummaryData' in m for _,m in messages),'firstRoleSequence':['U' if m.get('is_user') else 'G' if generated(m) else 'B' for _,m in messages[:9]]}
        rows.append(row)
    return {'date':'2026-10-28','method':'read-only local records; anonymous structural analysis; exact file-hash deduplication','sourceRoots':[str(root(v)).replace('\\','/') for v in VERSIONS],'privacy':'No character names, filenames, message text, notes, reasoning text, private variable names/values or API settings exported. Content hashes and line numbers permit local verification by rescanning.','counts':{'physicalChatFiles':sum(i['chatFiles'] for i in inventory),'uniqueContentFiles':len(rows),'emptyFiles':sum(not r['messageCount'] for r in rows),'singleMessageFiles':sum(r['messageCount']==1 for r in rows),'multiMessageFiles':sum(r['messageCount']>1 for r in rows),'userMessages':sum(r['user']['messages'] for r in rows),'modelTaggedMessages':sum(r['modelTaggedOutput']['messages'] for r in rows),'linkedCards':len(cards),'swipeMessages':sum(r['swipeMessages'] for r in rows),'extraVariants':sum(r['extraVariants'] for r in rows),'excludedModelMessages':sum(r['excludedModelOutputs'] for r in rows)},'technicalInterpretationEvidence':technical,'inventory':inventory,'samples':rows,'cards':list(cards.values()),'limits':['Files with shared prefixes or separate branches can be related; unique content files are not independent users or experiments.','gen_started/gen_finished/model fields identify recorded generation metadata, not verified authorship or generation quality.','First non-user messages can be card greetings, UI templates or edits, and are not proof of a model request from a blank input.','Raw character lengths include markup and auxiliary text, not pure story word counts.','No local branch links does not prove branching was never used; edits/continue actions may not have an action log.','Extension keys prove persisted structure only; correctness and which plugin produced it are unverified.','Byte buckets sum compact UTF-8 JSON field values, not original serialized-file byte attribution; categories are mutually exclusive.','Card rule regexes also inspect conditional/disabled text and are search signals, not evidence of prompt activation.']}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    result=analyze();args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result['counts'],ensure_ascii=True))
    for row in result['samples']:
        print(json.dumps({k:row[k] for k in ('alias','messageCount','linkedCard','firstRoleSequence','shortUserMessagesAtMost80Characters','swipeMessages','extraVariants','worldBound','messageVariableSnapshots','distinctVariableSnapshots','plotStateRecords','structuredMemoryMessages')},ensure_ascii=True))
