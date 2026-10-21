import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const runtime=vm.createContext({console}),base=new URL('../public/game-life/',import.meta.url);
for(const [,url]of fs.readFileSync(new URL('index.html',base),'utf8').matchAll(/<script src="([^"]+)"/g)){const file=url.split('?')[0].split('/').pop();if(file!=='app.js')vm.runInContext(fs.readFileSync(new URL(file,base),'utf8'),runtime,{filename:file})}
const {XZEngine:E,XZFamily:L,XZFamilyUI:UI,XZMoments:M,XZSaves:S}=runtime;
const clone=x=>JSON.parse(JSON.stringify(x));
const equal=(a,b)=>assert.deepEqual(clone(a),clone(b));
function player(sport=1){return E.create({sport,name:'傳承測試',pos:['投手','前鋒','控球後衛'][sport],seed:'family-story-'+sport,length:'short',pace:'quick'})}
function step(s,branch=0){if(s.care?.active)return s.care.active.stage==='decision'?E.careChoice(s,'team'):E.careRecover(s,s.care.active.kind==='surgery'?'rehab':'therapy');if(s.phase==='train')return E.seasonTraining(s,'rest');if(s.phase==='event')return E.choose(s,s.event.startsWith('family-')||s.event.startsWith('romance-')?branch:1);if(s.phase==='football-moment')return E.footballAuto(s);if(s.phase==='arena-moment')return E.arenaAuto(s);if(s.phase==='football-national')return E.footballNational(s,false);if(s.phase==='arena-national')return E.arenaNational(s,3);if(s.phase==='contract')return E.sign(s,0);return E.advance(s)}
function complete(sport=1){const s=player(sport);let moves=0;while(!s.retired&&moves++<160){const family=L.next(s);if(s.phase==='train'&&family)s.pending.unshift({id:family,due:s.age});assert(step(s,['family-date','family-marry','family-birth'].includes(s.event)?1:0).ok,s.phase);E.validate(s)}return s}
function episode(s,index=0){s.phase='event';s.event=L.next(s);s.eventsLeft=1;const id=s.event,pre=M.snapshot(s);assert(E.choose(s,index).ok);E.validate(s);return{id,events:M.detect(pre,s)}}
function storage(){const data=new Map();let writes=0,fail=Infinity;return{data,getItem:k=>data.get(k)??null,setItem(k,v){if(++writes===fail)throw Error('quota');data.set(k,v)},removeItem:k=>data.delete(k),failAt(n){fail=writes+n}}}
function store(mem){let i=0;return S.createStore(mem,()=>`family-save-${++i}`,()=>100)}
test('all three sports can complete the six-part family story when encountered inside eight actual seasons',()=>{for(const sport of [0,1,2]){const s=complete(sport);assert.equal(s.reason,'chapter');assert.equal(s.history.length,8);assert.equal(s.age,23);assert.equal(s.family.stage,'parent');equal(s.family.milestones.map(m=>m.id),['meet','date','distance','marry','birth','coach']);assert(s.family.milestones.at(-1).age<=23);assert.equal(s.family.child.focus,'technique');equal(E.migrate(clone(s)),s);assert.throws(()=>E.createHeir(s,{focus:'mind',parentId:'parent'},E.create));const before=clone(s),snapshot=M.snapshot(s);assert(E.closeChapter(s).ok);assert.equal(M.detect(snapshot,s)[0].kind,'retirement');assert.equal(M.detect(M.snapshot(s),s).length,0);assert.equal(s.reason,'voluntary');equal(s.history,before.history);assert.equal(s.rng,before.rng);assert.equal(E.continueChapter(s).ok,false);E.validate(s)}});
test('meeting is friendship; adults decide dating, marriage and childbirth without forced branches',()=>{
 for(const decline of ['meet','date','distance','marry','birth']){const s=player();for(let age=17;age<=22;age++){s.age=age;const id=L.next(s);if(!id)continue;const chosen=id==='family-'+decline?2:0;episode(s,chosen);if(chosen===2){const before=clone(s);s.age++;assert.equal(L.next(s),null);assert.equal(s.family.child,null);assert(UI.timeline(s).includes(['marry','birth'].includes(decline)?'選擇兩個人的步調':'溫柔告別'));s.age=before.age;equal(s,before);break;}}
 }
 const s=player();s.age=17;episode(s);assert.equal(s.family.stage,'met');assert.equal(L.next(s),null);s.age=18;episode(s);assert.equal(s.family.stage,'dating');s.phase='event';s.event='family-birth';const before=JSON.stringify(s);assert.equal(E.choose(s,0).ok,false);assert.equal(JSON.stringify(s),before);
});
test('old saves retain exact game state and already-due stories stay first',()=>{const old=player();old.age=27;old.pending=[{id:'echo-home',due:27}];const raw=clone(old),loaded=E.migrate(raw);equal(loaded,old);assert.equal(loaded.family,undefined);E.advance(loaded);assert.equal(loaded.event,'echo-home');assert.equal(loaded.eventsLeft,2);E.choose(loaded,0);E.advance(loaded);assert.equal(loaded.phase,'event');assert.notEqual(loaded.event,'echo-home');loaded.event='family-meet';E.choose(loaded,0);assert.equal(loaded.family.milestones[0].age,27);E.validate(loaded)});
test('offspring have deterministic higher potential, distinct identity and bounded attributes without changing parents',()=>{for(const sport of [0,1,2]){const s=complete(sport);E.closeChapter(s);for(const potential of [65,86,98,99]){s.potential=potential;const original=clone(s),params={name:'小星的下一章',focus:'mind',parentId:'parent-1'},child=E.createHeir(s,params);equal(s,original);equal(E.createHeir(s,params),child);assert.equal(child.potential,Math.min(99,Math.max(88,potential+6)));assert.notEqual(child.id,s.id);assert.equal(child.sport,s.sport);assert.equal(child.number,s.number);assert.equal(child.age,16);assert.equal(child.journey.limit,8);assert.equal(child.lineage.elapsedYears,Math.max(0,16-(s.age-s.family.child.bornAt)));assert.equal(child.lineage.generation,2);assert(child.a.every((n,i)=>n<=child.caps[i]&&child.caps[i]<=99&&child.caps[i]>=s.caps[i]));E.validate(child);child.age=17;episode(child);assert.notEqual(child.family.partner,s.family.partner);assert(!child.outcome.narrative.includes(s.family.partner))}}});
test('retirement, birth and wedding animations follow real choices and render without modifying state',()=>{const s=player(),kinds=[];for(let age=17;age<=22;age++){s.age=age;const {events}=episode(s);kinds.push(...events.map(e=>e.kind));const before=JSON.stringify(s);if(events.length)M.markup(events);UI.archive(s);assert.equal(JSON.stringify(s),before)}equal(kinds,['romance','wedding','birth']);E.finish(s,'age');s.name='<img onerror=alert(1)>';const before=JSON.stringify(s);const html=UI.ending(s)+UI.inheritance(s)+M.markup([UI.farewell(s)],true);assert(!html.includes('<img'));assert(html.includes('&lt;img'));assert(html.includes('moment-farewell-player'));assert.equal(JSON.stringify(s),before)});
test('a successor and parent link save atomically, preserving every prior slot and preventing duplicate children',()=>{const mem=storage(),saves=store(mem),unrelated=saves.create(player(0)),unrelatedRaw=saves.raw(unrelated),parent=complete();E.closeChapter(parent);const pid=saves.create(parent),original=saves.raw(pid),child=E.createHeir(parent,{focus:'athletic',parentId:pid});const result=saves.inherit(parent,pid,child);assert(result.created);assert.equal(saves.list().length,3);assert.equal(saves.raw(unrelated),unrelatedRaw);assert.equal(saves.backup(pid),original);const savedParent=JSON.parse(saves.raw(pid));assert.equal(savedParent.family.successorId,result.id);delete savedParent.family.successorId;equal(savedParent,parent);equal(JSON.parse(saves.raw(result.id)),child);const bytes=[...mem.data];const again=saves.inherit(parent,pid,E.createHeir(parent,{focus:'mind',parentId:pid}));assert.equal(again.created,false);assert.equal(again.id,result.id);equal([...mem.data],bytes);E.validate(JSON.parse(saves.raw(pid)))});
test('storage failures roll back both generations and the original catalog at every write',()=>{for(let n=1;n<=8;n++){const mem=storage(),saves=store(mem),parent=complete();E.closeChapter(parent);const pid=saves.create(parent),before=[...mem.data].sort(),child=E.createHeir(parent,{focus:'mind',parentId:pid});mem.failAt(n);assert.throws(()=>saves.inherit(parent,pid,child));equal([...mem.data].sort(),before)}});
test('malformed family and inheritance data is rejected without repairing away saved progress',()=>{const s=complete();for(const edit of [p=>p.family.child.bornAt=17,p=>p.family.milestones[1].age=17,p=>p.family.milestones.reverse(),p=>p.family.child.focus='unknown',p=>p.family.successorId='../../bad']){const bad=clone(s);edit(bad);assert.throws(()=>E.migrate(bad))}E.closeChapter(s);const child=E.createHeir(s,{focus:'mind',parentId:'parent'});child.lineage.parentId="' onclick='bad";assert.throws(()=>E.migrate(child))});
test('the browser application can open inheritance, start a child and return to the saved parent',()=>{
 const nodes={},memory={},node=()=>({value:'',innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},querySelector(){return node()},focus(){},showModal(){this.open=true},close(){this.open=false}});
 const ctx=vm.createContext({console,crypto:globalThis.crypto,setTimeout(){},clearTimeout(){},window:{scrollTo(){}},document:{body:{dataset:{},appendChild(){}},createElement:node,querySelector(){return node()},getElementById:id=>nodes[id]??=node()},localStorage:{getItem:k=>memory[k]??null,setItem:(k,v)=>memory[k]=v,removeItem:k=>delete memory[k]}});
 const base=new URL('../public/game-life/',import.meta.url);for(const [,url] of fs.readFileSync(new URL('index.html',base),'utf8').matchAll(/<script src="([^"]+)"/g)){const file=url.split('?')[0].split('/').pop();vm.runInContext(fs.readFileSync(new URL(file,base),'utf8'),ctx,{filename:file})}
 const parent=complete();E.closeChapter(parent);ctx.fixture=parent;vm.runInContext("s=fixture;activeSaveId=saveStore.create(s);momentsEnabled=false;render();openInheritance()",ctx);assert(nodes['family-dialog'].open);assert(nodes['family-dialog-content'].innerHTML.includes('家族傳承'));vm.runInContext("$('heir-name').value='星二代';startInheritance('mind')",ctx);assert(!nodes['family-dialog'].open);assert.equal(vm.runInContext('s.name',ctx),'星二代');assert(nodes.game.innerHTML.includes('第 2 代'));vm.runInContext('viewParent()',ctx);assert.equal(vm.runInContext('s.name',ctx),parent.name);assert(nodes.game.innerHTML.includes('繼續孩子的生涯'));vm.runInContext('openInheritance()',ctx);assert.equal(vm.runInContext('s.name',ctx),'星二代');assert.equal(vm.runInContext('saveStore.list().length',ctx),2);
});
test('partner and child names vary by career in every sport and never consume game RNG',()=>{
 for(const sport of [0,1,2]){
  const partners=new Set(),children=new Set();
  for(let i=0;i<100;i++){
   const s=E.create({sport,pos:['投手','前鋒','控球後衛'][sport],seed:'names-'+i,pace:'quick',length:'short'}),before=clone(s);
   partners.add(L.partner(s));children.add(L.childName(s));
   for(let n=0;n<3;n++){assert.equal(L.partner(s),L.partner(E.migrate(clone(s))));assert.equal(L.childName(s),L.childName(E.migrate(clone(s))));L.scene(s,L.EVENTS[0]);}
   equal(s,before);
  }
  assert(partners.size>=25,`${sport}: ${partners.size} partner names`);assert(children.size>=25,`${sport}: ${children.size} child names`);
 }
});
test('generated names stay consistent through scenes, birth animation, archives, farewell and inheritance',()=>{
 for(const sport of [0,1,2]){
  const s=player(sport),partner=L.partner(s),name=L.childName(s);
  for(const age of [17,18,19,20,21,22]){
   s.age=age;const id=L.next(s),scene=L.scene(s,E.byId[id]);
   assert.equal(scene.scene.voice,partner);
   const result=episode(s);assert.equal(s.family.partner,partner);
   if(age===21){assert.equal(s.family.child.name,name);assert(s.outcome.narrative.includes(name));assert(result.events.some(e=>e.kind==='birth'&&e.title.includes(name)))}
   equal(E.migrate(clone(s)),s);
  }
  assert(UI.archive(s).includes(name));assert(UI.farewell(s).detail.includes(name));assert(UI.inheritance(s).includes(`value="${name}"`));assert(runtime.XZFocus.memory(s).includes(name));
  E.finish(s,'voluntary');const before=clone(s),heir=E.createHeir(s,{focus:'mind',parentId:'name-parent'});assert.equal(heir.name,name);equal(s,before);
 }
});
test('legacy named families keep their original names and malformed names fail safely',()=>{
 const s=player();for(const age of [17,18,19,20,21,22]){s.age=age;episode(s)}
 s.family.partner='以晴';s.family.child.name='小星';const before=clone(s),loaded=E.migrate(clone(s));equal(loaded,before);
 assert.equal(L.partner(loaded),'以晴');assert.equal(L.childName(loaded),'小星');assert(UI.archive(loaded).includes('小星'));assert(UI.farewell(loaded).detail.includes('以晴牽著小星'));
 const bad=clone(s);bad.family.child.name='<script>';assert.throws(()=>E.migrate(bad));
});
