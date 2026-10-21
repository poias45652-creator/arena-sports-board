import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base=new URL('../public/game-life/',import.meta.url),copy=x=>JSON.parse(JSON.stringify(x));
function runtime(ui=false,memory={}){
 const nodes={},node=()=>({value:'',innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},querySelector(){return node()},focus(){},showModal(){this.open=true},close(){this.open=false}});
 const ctx=vm.createContext({console,crypto:globalThis.crypto,setTimeout(){},clearTimeout(){},window:{scrollTo(){}},document:{body:{dataset:{},appendChild(el){nodes[el.id]=el}},createElement:node,querySelector(){return node()},getElementById:id=>nodes[id]??=node()},localStorage:{getItem:k=>memory[k]??null,setItem:(k,v)=>memory[k]=v,removeItem:k=>delete memory[k]}});
 for(const [,url]of fs.readFileSync(new URL('index.html',base),'utf8').matchAll(/<script src="([^"]+)"/g)){const file=url.split('?')[0].split('/').pop();if(!ui&&file==='app.js')continue;vm.runInContext(fs.readFileSync(new URL(file,base),'utf8'),ctx,{filename:file})}
 return {ctx,nodes,memory,E:ctx.XZEngine,F:ctx.XZFocus,C:ctx.XZContent};
}
const {ctx,E,F,C}=runtime();
test('all three sports restore the next scene after a choice without a forced page-top scroll',()=>{
 for(const sport of [0,1,2]){
  const {ctx}=runtime(true),restored=[];let topScrolls=0;
  ctx.window.scrollTo=()=>topScrolls++;
  ctx.XZViewport.capture=()=>({top:700,action:null});
  ctx.XZViewport.restore=(host,before,options)=>restored.push({before,options});
  vm.runInContext(`s=E.create({sport:${sport},pos:C.SPORTS[${sport}].pos[0],seed:'scroll-${sport}',length:'short',pace:'quick'});render();act(()=>E.train(s,0))`,ctx);
  assert.equal(topScrolls,0);assert.equal(restored.length,1);assert.equal(restored[0].before.top,700);
  const state=vm.runInContext('JSON.stringify(s)',ctx);
  vm.runInContext("act(()=>({ok:false,message:'尚未開放'}))",ctx);
  assert.equal(restored.length,1);assert.equal(vm.runInContext('JSON.stringify(s)',ctx),state);
 }
});
const player=()=>E.create({sport:0,pos:'投手',seed:'focus-stories',length:'short',pace:'quick'});
function at(id,seed=0){const s=player();s.rng=seed;s.phase='event';s.event=id;s.eventsLeft=1;s.seasonEvents=1;s.visits[id]=1;return s}
test('all added followups resolve and remain eligible only after the matching choice',()=>{
 assert.equal(new Set(C.EVENTS.map(e=>e.id)).size,C.EVENTS.length);
 for(const e of C.EVENTS)for(const c of e.options)for(const key of ['chain','chainSuccess','chainFailure'])if(c[key])assert(E.byId[c[key]],e.id+' '+key);
 for(const id of ['echo-reset','echo-bench','echo-rival','echo-home']){assert(E.byId[id].chainOnly);assert(E.byId[id].once);assert.equal(E.byId[id].options.length,4)}
 for(const [id,i,next]of [['chapter-trust',0,'echo-bench'],['chapter-trust',3,'echo-bench'],['chapter-balance',1,'echo-home']]){const s=at(id);assert(E.choose(s,i).ok);assert.equal(s.pending[0].id,next);assert.equal(s.pending[0].due,17);assert(s.outcome.narrative.length>25);assert.deepEqual(copy(E.migrate(copy(s))),copy(s));s.age=17;s.phase='train';s.sessions=3;E.advance(s);assert.equal(s.event,next);for(let choice=0;choice<4;choice++){const branch=copy(s);assert(E.choose(branch,choice).ok);assert(branch.outcome.narrative);E.validate(branch)}}
 const noEcho=at('chapter-balance');E.choose(noEcho,0);assert(!noEcho.pending.some(p=>p.id==='echo-home'));
 let success=false,failure=false;
 for(let seed=0;seed<100&&(!success||!failure);seed++){const s=at('chapter-growth',seed);E.choose(s,0);if(s.outcome.success){success=true;assert(s.pending.some(p=>p.id==='chapter-return'));assert(!s.pending.some(p=>p.id==='echo-reset'))}else{failure=true;assert(s.pending.some(p=>p.id==='echo-reset'));assert(!s.pending.some(p=>p.id==='chapter-return'));assert.match(s.outcome.narrative,/沒有接上/)}}
 assert(success&&failure);
});
test('focused scenes, outcomes and the player HUD preserve state, RNG and escaped user text',()=>{
 const s=at('chapter-trust');s.name='<img src=x onerror=alert(1)>';s.team='<script>球隊</script>';const raw=JSON.stringify(s);
 const html=F.hud(s,E)+F.trainingIntro(s)+F.event(s,E,ctx.XZDynamics)+F.memory(s);assert.equal(JSON.stringify(s),raw);assert(!html.includes('<img'));assert(!html.includes('<script>'));assert(html.includes('&lt;img'));assert(html.includes('教練'));
 const primary=F.event(s,E,ctx.XZDynamics).split('<details')[0];assert.equal((primary.match(/onclick="eventChoice/g)||[]).length,3);assert(F.event(s,E,ctx.XZDynamics).includes('eventChoice(3)'));
 E.choose(s,0);const resolved=JSON.stringify(s);const outcome=F.outcome(s);assert(outcome.indexOf('scene-prose')<outcome.indexOf('這次改變了什麼'));assert(outcome.includes(s.outcome.narrative));assert.equal(JSON.stringify(s),resolved);
});
test('the screenshot legacy advanced preference now opens the integrated UI without altering old saves',()=>{
 const memory={'xingzhun-play-mode-v1':'advanced','xingzhun-focus-mode-v1':'advanced','xingzhun-theme-v1':'paper','triple-0':'previous-save-sentinel','xingzhun-save-preserved':'kept'};
 const {ctx,nodes}=runtime(true,memory);assert.equal(vm.runInContext('playMode',ctx),'simple');assert.equal(vm.runInContext('journeyTheme',ctx),'broadcast');assert.equal(memory['triple-0'],'previous-save-sentinel');assert.equal(memory['xingzhun-save-preserved'],'kept');
 vm.runInContext("$('name').value='整合測試';$('number').value=9;$('position').value='投手';$('seed-mode').value='fixed';$('seed').value='focus-ui';$('length').value='short';start()",ctx);
 assert(!nodes.game.innerHTML.includes('play-mode-switch'));assert(!nodes.game.innerHTML.includes('growth-intensities'));assert(!nodes.game.innerHTML.includes('onclick="openSaves()"'));
 const raw=vm.runInContext('JSON.stringify(s)',ctx),saves=Object.entries(memory).filter(([k])=>k.startsWith('xingzhun-save'));
 vm.runInContext('openHub();closeHub();openHub();toggleTouch();togglePlays();toggleMoments();closeHub()',ctx);assert.equal(vm.runInContext('JSON.stringify(s)',ctx),raw);assert.deepEqual(Object.entries(memory).filter(([k])=>k.startsWith('xingzhun-save')),saves);assert(nodes['career-hub-content'].innerHTML.includes('生涯回憶'));
 vm.runInContext("setPlayMode('advanced')",ctx);assert(nodes.game.innerHTML.includes('prep-training'));assert(!nodes.game.innerHTML.includes('expert-notice'));assert.equal(vm.runInContext('playMode',ctx),'simple');vm.runInContext("openHub('settings')",ctx);assert(!nodes['career-hub-content'].innerHTML.includes('操作安排'));assert(!nodes['career-hub-content'].innerHTML.includes('setPlayMode'));
});
