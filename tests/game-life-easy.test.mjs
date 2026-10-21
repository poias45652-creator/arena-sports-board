import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const base=new URL('../public/game-life/',import.meta.url),copy=x=>JSON.parse(JSON.stringify(x));
function runtime(ui=false){
 const nodes={},memory={},node=()=>({value:'',innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},querySelector(){return node()},focus(){},showModal(){this.open=true},close(){this.open=false}});
 const ctx=vm.createContext({console,crypto:globalThis.crypto,setTimeout(){},clearTimeout(){},window:{scrollTo(){}},document:{body:{dataset:{},appendChild(el){nodes[el.id]=el}},createElement:node,querySelector(){return node()},getElementById:id=>nodes[id]??=node()},localStorage:{getItem:k=>memory[k]??null,setItem:(k,v)=>memory[k]=v,removeItem:k=>delete memory[k]}});
 for(const [,url]of fs.readFileSync(new URL('index.html',base),'utf8').matchAll(/<script src="([^"]+)"/g)){const file=url.split('?')[0].split('/').pop();if(!ui&&file==='app.js')continue;vm.runInContext(fs.readFileSync(new URL(file,base),'utf8'),ctx,{filename:file})}
 return{ctx,nodes,memory,E:ctx.XZEngine,Easy:ctx.XZEasy,J:ctx.XZJourney};
}
const {E,Easy,J}=runtime();
const player=(sport=0,length='short')=>E.create({sport,length,pace:'full',pos:['投手','前鋒','控球後衛'][sport],seed:'easy-'+sport});

test('each direction produces exactly the same seeded state as the real individual engine actions',()=>{
 for(const sport of [0,1,2])for(const p of Easy.plans(player(sport),E)){
  const a=player(sport),b=copy(a);assert(Easy.run(a,p.id,E).ok);
  E.setPace(b,'quick');E.seasonGoal(b,p.id);E.trainingIntensity(b,p.intensity);E.seasonTraining(b,p.training.id);
  assert.deepEqual(copy(a),copy(b));assert(a.phase==='event'||a.phase==='outcome'&&a.outcome.unchosen);assert.equal(a.sessions,3);E.validate(a);
 }
});
test('one-click preparation cannot repeat, reroll or alter an invalid phase',()=>{
 const s=player(),before=JSON.stringify(s);assert.equal(Easy.run(s,'unknown',E).ok,false);assert.equal(JSON.stringify(s),before);
 assert(Easy.run(s,'growth',E).ok);const done=JSON.stringify(s);assert.equal(Easy.run(s,'balance',E).ok,false);assert.equal(JSON.stringify(s),done);
});
test('an existing partially trained career retains its goal, history and full-career length',()=>{
 const s=player(1,'career');E.seasonGoal(s,'growth');E.footballTrain(s,E.trainingOptions(s)[0].id);const goal=copy(s.journey.goal),before=copy(s);
 assert(Easy.run(s,'balance',E).ok);assert.deepEqual(copy(s.journey.goal),goal);assert.equal(s.sessions,3);assert.equal(s.journey.limit,null);assert.equal(s.dynamics.batch.rows.length,2);assert.deepEqual(copy(s.history),before.history);E.validate(E.migrate(copy(s)));
 const old=player(0,'career');delete old.journey;assert(Easy.run(old,'trust',E).ok);assert.equal(old.journey.limit,null);
});
test('medical emergencies interrupt before pace, goals or training can change',()=>{
 for(const kind of ['surgery','mental']){
  const s=player();if(kind==='surgery')s.health=20;else{s.mood=24;s.care.lowMoodSteps=3}
  const before=copy(s);assert(Easy.run(s,'contend',E).interrupted);assert.equal(s.care.active.kind,kind);assert.equal(s.sessions,0);assert.equal(s.rng,before.rng);assert.equal(s.pace,'full');assert.deepEqual(copy(s.journey),before.journey);
  const active=JSON.stringify(s);Easy.run(s,'growth',E);assert.equal(JSON.stringify(s),active);
 }
 const s=player();s.health=21;assert(Easy.run(s,'contend',E).interrupted);assert.equal(s.sessions,1);assert(s.care.active);assert.equal(s.phase,'train');
});
test('simple presentation reads state without changing it and escapes actual contract names',()=>{
 const s=player();E.seasonGoal(s,'trust');s.offers=[{team:'<img src=x>',role:'<script>',salary:10,years:1,fit:60}];const before=JSON.stringify(s);
 Easy.training(s,E);Easy.flow(s);Easy.status(s,E);Easy.goal(s,J,E);const html=Easy.contracts(s);
 assert.equal(JSON.stringify(s),before);assert(!html.includes('<img'));assert(!html.includes('<script>'));assert(html.includes('&lt;img'));assert(html.includes('10'));
});
test('real UI presents three primary directions plus an optional challenge; menu and preferences preserve saves',()=>{
 const {ctx,nodes,memory}=runtime(true);
 vm.runInContext("$('name').value='輕鬆玩法測試';$('number').value=7;$('position').value='投手';$('seed-mode').value='fixed';$('seed').value='easy-ui';$('pace').value='full';$('length').value='short';start()",ctx);
 assert.equal((nodes.game.innerHTML.match(/class="easy-plan"/g)||[]).length,4);assert.equal((nodes.game.innerHTML.split('<details')[0].match(/class="easy-plan"/g)||[]).length,3);assert(!nodes.game.innerHTML.includes('growth-intensities'));
 const before=vm.runInContext('JSON.stringify(s)',ctx),slots=Object.entries(memory).filter(([k])=>k.startsWith('xingzhun-save'));
 vm.runInContext("setPlayMode('advanced')",ctx);assert(nodes.game.innerHTML.includes('growth-intensities'));
 vm.runInContext("setPlayMode('simple');setJourneyView('story');setJourneyTheme('paper');setJourneyView('play');setPlayMode('invalid')",ctx);
 assert.equal(vm.runInContext('JSON.stringify(s)',ctx),before);assert.deepEqual(Object.entries(memory).filter(([k])=>k.startsWith('xingzhun-save')),slots);assert.equal(memory['xingzhun-play-mode-v1'],'simple');
 vm.runInContext("easyPlan('trust')",ctx);assert(nodes.game.innerHTML.includes(vm.runInContext('E.eventData(s).title',ctx)));vm.runInContext('openHub()',ctx);assert(nodes['career-hub-content'].innerHTML.includes('本季目標'));assert.equal(vm.runInContext('s.phase',ctx),'event');assert.equal(vm.runInContext('s.sessions',ctx),3);
});
test('one-click preparation keeps three sports within eight seasons with varied events and no added turns',t=>{
 for(const sport of [0,1,2]){
  const s=player(sport),events=new Set();let moves=0;
  while(!s.retired&&moves++<110){let r;
   if(s.care?.active){const c=s.care.active;r=c.stage==='decision'?E.careChoice(s,'team'):E.careRecover(s,c.kind==='surgery'?'rehab':'therapy')}
   else if(s.phase==='train')r=Easy.run(s,s.health<70||s.mood<50?'balance':['growth','trust','contend'][s.age%3],E);
   else if(s.phase==='event'){events.add(s.event);r=E.choose(s,1)}
   else if(s.phase==='arena-moment')r=E.arenaAuto(s);
   else if(s.phase==='football-moment')r=E.footballAuto(s);
   else if(s.phase==='arena-national')r=E.arenaNational(s,3);
   else if(s.phase==='football-national')r=E.footballNational(s,false);
   else if(s.phase==='contract')r=E.sign(s,0);
   else r=E.advance(s);
   assert(r.ok,s.phase);E.validate(s);
  }
  assert.equal(s.reason,'chapter');assert.equal(s.history.length,8);assert(moves<110);assert(events.size>=4);assert.deepEqual(copy(E.migrate(copy(s))),copy(s));t.diagnostic(JSON.stringify({sport,moves,events:events.size}));
 }
});
