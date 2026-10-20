import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const base=new URL('../public/game-life/',import.meta.url);
function runtime(ui=false){
 const nodes={},memory={},node=()=>({value:'',innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},querySelector(){return node()},focus(){},showModal(){this.open=true},close(){this.open=false}});
 const ctx=vm.createContext({console,crypto:globalThis.crypto,setTimeout(){},clearTimeout(){},window:{scrollTo(){}},document:{body:{dataset:{},appendChild(el){nodes[el.id]=el}},createElement:node,querySelector(){return node()},getElementById:id=>nodes[id]??=node()},localStorage:{getItem:k=>memory[k]??null,setItem:(k,v)=>memory[k]=v,removeItem:k=>delete memory[k]}});
 const html=fs.readFileSync(new URL('index.html',base),'utf8');
 for(const [,url]of html.matchAll(/<script src="([^"]+)"/g)){
  const file=url.split('?')[0].split('/').pop();if(!ui&&file==='app.js')continue;
  vm.runInContext(fs.readFileSync(new URL(file,base),'utf8'),ctx,{filename:file});
 }
 return{ctx,nodes,E:ctx.XZEngine,H:ctx.XZCare,D:ctx.XZDynamics};
}
const {E,H,D}=runtime(),copy=s=>JSON.parse(JSON.stringify(s));
const make=(sport=0,seed='care')=>E.create({sport,seed,pos:['投手','前鋒','控球後衛'][sport],pace:'quick'});
function completeCare(s){let n=0;while(s.care.active&&n++<12){const a=s.care.active;const r=a.stage==='decision'?E.careChoice(s,'team'):E.careRecover(s,a.kind==='surgery'?'rehab':'therapy');assert(r.ok);E.validate(s)}assert(n<12);}

test('health threshold interrupts all three sports without advancing the original phase or RNG',()=>{
 for(const sport of [0,1,2]){const s=make(sport);s.health=20;s.phase='ready';const rng=s.rng;assert(E.advance(s).ok);assert.equal(s.care.active.kind,'surgery');assert.equal(s.phase,'ready');assert.equal(s.rng,rng);assert(!s.arena?.season&&!s.football?.season);const state=JSON.stringify(s);E.advance(s);E.seasonTraining(s,'rest');assert.equal(JSON.stringify(s),state);E.validate(s);}
 const safe=make();safe.health=21;assert.equal(H.check(safe,{log(){}}),false);
});

test('surgery requires actual rehabilitation and preserves pending choices, with a real appearance cost',()=>{
 const s=make();s.health=12;s.phase='event';s.event='extra';s.eventsLeft=1;s.pending=[{id:'mentor-return',due:18}];
 E.choose(s,0);assert.equal(s.event,'extra');assert(E.careChoice(s,'team').ok);assert.equal(s.care.surgeries,1);assert.equal(s.care.active.left,2);assert(s.health<55);assert(s.majorRehabPending);
 E.careRecover(s,'rehab');const rng=s.rng,restored=E.migrate(copy(s));assert.equal(JSON.stringify(restored),JSON.stringify(s));assert.equal(restored.rng,rng);
 assert(E.careRecover(restored,'review').ok);assert.equal(restored.care.active,null);assert.equal(restored.phase,'event');assert.equal(restored.event,'extra');assert.equal(restored.pending.length,1);assert(restored.health>=55&&restored.health<100);assert(restored.majorRecovered);assert(D.condition(restored).availability<.66);assert(E.choose(restored,1).ok);assert.equal(restored.phase,'outcome');E.validate(restored);
});

test('all four surgical plans differ; unaffordable options are atomic and a free path always exists',()=>{
 const results=[];for(const plan of H.PLANS.surgery){const s=make();s.health=10;s.money=100;E.advance(s);assert(E.careChoice(s,plan.id).ok);assert.equal(s.money,100-plan.cost);assert.equal(s.care.active.left,plan.steps);completeCare(s);results.push([s.health,s.mood,s.care.availability]);}
 assert.equal(new Set(results.map(JSON.stringify)).size,4);
 const s=make();s.health=0;s.money=0;E.advance(s);const before=JSON.stringify(s);assert.equal(E.careChoice(s,'specialist').ok,false);assert.equal(JSON.stringify(s),before);assert(E.careChoice(s,'team').ok);completeCare(s);assert.equal(s.care.active,null);
});

test('quick training stops at a critical injury, then resumes its remaining sessions after recovery',()=>{
 for(const sport of [0,1,2]){const s=make(sport,'batch-care');s.health=21;const id=E.trainingOptions(s)[0].id;assert(E.seasonTraining(s,id).ok);assert.equal(s.care.active.kind,'surgery');assert.equal(s.sessions,1);assert.equal(s.phase,'train');completeCare(s);assert(E.seasonTraining(s,id).ok);assert.equal(s.sessions,3);assert.equal(s.phase,'event');E.validate(s);}
});

test('persistent low mood leads to professional depression assessment and a saved counseling course',()=>{
 for(const sport of [0,1,2]){const s=make(sport,'low-mood');s.mood=24;E.trainingIntensity(s,'careful');const id=E.trainingOptions(s)[0].id;for(let i=0;i<2;i++){assert((sport===1?E.footballTrain(s,id):E.arenaTrain(s,id)).ok);assert.equal(s.care.active,null)}assert((sport===1?E.footballTrain(s,id):E.arenaTrain(s,id)).ok);assert.equal(s.care.active.kind,'mental');assert.equal(s.care.active.diagnosis,true);assert.equal(s.care.mentalStatus,'well');
 assert(E.careChoice(s,'team').ok);assert.equal(s.care.mentalStatus,'depression');assert(H.stageHTML(s).includes('憂鬱症'));assert(E.careRecover(s,'therapy').ok);const r=E.migrate(copy(s));assert.equal(JSON.stringify(r),JSON.stringify(s));completeCare(r);assert.equal(r.care.mentalStatus,'followup');assert(r.mood>=45);assert.equal(r.care.counseling,1);assert.equal(r.sessions,3);assert(E.advance(r).ok);assert.equal(r.phase,'event');E.validate(r);}
});

test('an acute mood drop prompts evaluation but is not automatically diagnosed as depression',()=>{
 const s=make();s.mood=10;E.advance(s);assert.equal(s.care.active.kind,'mental');assert.equal(s.care.active.diagnosis,false);E.careChoice(s,'family');assert.equal(s.care.mentalStatus,'followup');assert(!H.stageHTML(s).includes('專業評估：憂鬱症'));completeCare(s);assert(s.mood<100);
});

test('simultaneous crises handle surgery first and then emotional care without losing the phase',()=>{
 const s=make();s.health=0;s.mood=0;s.care.lowMoodSteps=3;E.advance(s);assert.equal(s.care.active.kind,'surgery');E.careChoice(s,'team');E.careRecover(s,'rehab');E.careRecover(s,'rehab');assert.equal(s.care.active.kind,'mental');assert.equal(s.phase,'train');completeCare(s);assert.equal(s.care.active,null);E.validate(s);
});

test('optional counseling has a real mood effect and cannot be farmed during a season',()=>{
 const s=make();s.mood=40;s.morale=50;assert(E.moodSupport(s).ok);assert.equal(s.mood,52);assert.equal(s.morale,53);const before=JSON.stringify(s);assert.equal(E.moodSupport(s).ok,false);assert.equal(JSON.stringify(s),before);s.phase='result';E.advance(s);assert(E.moodSupport(s).ok);assert.equal(s.care.supportAge,s.age);
});

test('mood independently changes actual event chances and training gains',()=>{
 const s=make(),low=copy(s);s.mood=90;low.mood=20;assert(E.chance(s,E.byId.extra.options[0])-E.chance(low,E.byId.extra.options[0])>.10);assert.equal(s.morale,low.morale);
 let high=0,weak=0;for(let i=0;i<20;i++){const a=make(0,'growth-'+i),b=copy(a);a.mood=90;b.mood=30;const id=E.trainingOptions(a)[0].id;E.arenaTrain(a,id);E.arenaTrain(b,id);high+=a.dynamics.last.points;weak+=b.dynamics.last.points;}assert(high>weak);
});

test('rendering and invalid actions cannot trigger repeated assessments or reroll recovery',()=>{
 const s=make();s.health=0;E.advance(s);const before=JSON.stringify(s);for(let i=0;i<3;i++){H.stageHTML(s);H.statusHTML(s);D.statusHTML(s);}assert.equal(JSON.stringify(s),before);assert.equal(E.careRecover(s,'rehab').ok,false);assert.equal(E.careChoice(s,'bad-id').ok,false);assert.equal(JSON.stringify(s),before);E.careChoice(s,'team');const started=JSON.stringify(s);assert.equal(E.careChoice(s,'team').ok,false);assert.equal(JSON.stringify(s),started);
});

test('legacy v3 saves gain a deterministic mood without changing RNG, and malformed care saves fail',()=>{
 const s=make();delete s.mood;delete s.care;const r=E.migrate(copy(s));assert.equal(r.mood,70);assert.equal(r.rng,s.rng);assert.equal(r.health,s.health);assert.equal(r.phase,s.phase);
 for(const bad of [{...r,mood:NaN},{...r,mood:-1},{...r,mood:101},{...r,care:{...r.care,lowMoodSteps:4}},{...r,care:{...r.care,active:{kind:'surgery',stage:'recovery',plan:'team',left:-1,total:2,diagnosis:false}}}])assert.throws(()=>E.migrate(bad));
});

test('the real published UI shows mood, a playable care stage and professional counseling',()=>{
 const {ctx,nodes}=runtime(true);vm.runInContext("$('name').value='照護測試';$('number').value=7;$('position').value='投手';$('seed-mode').value='fixed';$('seed').value='care-ui';$('pace').value='quick';start();s.health=10;advance()",ctx);
 assert(nodes['major-moment'].open);assert(nodes['major-moment'].innerHTML.includes('醫療暫停'));vm.runInContext('openHub()',ctx);assert(nodes['career-hub-content'].innerHTML.includes('重大動畫：開啟'));vm.runInContext('closeHub()',ctx);assert(nodes.game.innerHTML.includes('心情'));assert(nodes.game.innerHTML.includes('接受球隊安排的手術'));assert(!nodes.game.innerHTML.includes('onclick="seasonTraining('));
 vm.runInContext("careChoice('team');careRecover('rehab');careRecover('rehab');s.mood=20;s.care.lowMoodSteps=3;advance();careChoice('team')",ctx);
 assert(nodes.game.innerHTML.includes('憂鬱症'));assert(nodes.game.innerHTML.includes('完成本次心理輔導'));assert(nodes.game.innerHTML.includes('onclick="careRecover('));
});

test('three sports complete careers with care interruptions and keep season statistics valid',()=>{
 for(const sport of [0,1,2])for(const seed of ['career-care-a','career-care-b']){const s=make(sport,seed);let moves=0;while(!s.retired&&moves++<700){let r;if(s.care.active){completeCare(s);continue;}if(s.phase==='train'){if(s.mood<55&&s.care.supportAge!==s.age){E.moodSupport(s);continue;}r=E.seasonTraining(s,s.health<65?'rest':E.trainingOptions(s)[0].id);}else if(s.phase==='event')r=E.choose(s,1);else if(s.phase==='arena-moment')r=E.arenaAuto(s);else if(s.phase==='football-moment')r=E.footballAuto(s);else if(s.phase==='arena-national')r=E.arenaNational(s,3);else if(s.phase==='football-national')r=E.footballNational(s,false);else if(s.phase==='contract')r=E.sign(s,0);else r=E.advance(s);assert(r.ok,s.phase);E.validate(s);}assert(s.retired);assert(moves<700);assert(s.history.length>0);}
});
