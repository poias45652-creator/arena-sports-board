import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base=new URL('../public/game-life/',import.meta.url),ctx=vm.createContext({console});
for(const [,url]of fs.readFileSync(new URL('index.html',base),'utf8').matchAll(/<script src="([^"]+)"/g)){const file=url.split('?')[0].split('/').pop();if(file!=='app.js')vm.runInContext(fs.readFileSync(new URL(file,base),'utf8'),ctx,{filename:file})}
const {XZEngine:E,XZContent:C,XZVariety:V,XZFate:N,XZLifeScenes:LS,XZFamily:L,XZSaves:S,XZFocus:UI,XZMoments:M}=ctx;
const copy=x=>JSON.parse(JSON.stringify(x));
const player=(sport=0,seed='new-random-life',extra={})=>E.create({sport,seed,pos:['投手','前鋒','控球後衛'][sport],country:'台灣',pace:'quick',length:'short',...extra});
const equal=(a,b)=>assert.deepEqual(copy(a),copy(b));
function episode(s,id,option=1){s.phase='event';s.event='family-'+id;s.eventsLeft=1;delete s.eventRules;assert(E.choose(s,option).ok);E.validate(s)}
function atFamily(id,seed){const s=player(0,seed);s.age=17;if(id==='meet')return s;episode(s,'meet');s.age=18;if(id==='date')return s;episode(s,'date');s.age=19;if(id==='distance')return s;episode(s,'distance',0);s.age=20;if(id==='marry')return s;episode(s,'marry');s.age=21;if(id==='birth')return s;episode(s,'birth');s.age=22;return s}
function resolveScene(s){if(s.phase==='event'){const options=E.eventData(s).options;let i=options.findIndex(c=>!c.defer&&c.chance===undefined&&(!c.cost||s.money>=c.cost));if(i<0)i=0;assert(E.choose(s,i).ok,s.event)}else assert(s.outcome?.unchosen);}
test('random selection permanently excludes old repeatable IDs, duplicate titles and recent themes',()=>{
 const s=player();s.visits.extra=3;s.visits.sleep=1;s.visits.pain=2;s.recent=['extra','sleep','pain'];delete s.storyMemory;
 const eligible=C.EVENTS.filter(e=>E.eligible(s,e));const fresh=V.pool(s,eligible,C.EVENTS);
 assert(fresh.length>100);assert(!fresh.some(e=>['extra','sleep','pain'].includes(e.id)));assert(!fresh.some(e=>['健康','技術'].includes(V.topic(e))));
 const sameTitle={id:'test-another-id',title:E.byId.extra.title,category:'other'};assert(!V.pool(s,[sameTitle,...fresh],C.EVENTS).includes(sameTitle));
 for(const e of eligible)s.visits[e.id]=1;assert.equal(V.pool(s,eligible,C.EVENTS).length,0);
});
test('recent careers influence only a new random save and fixed seeds remain reproducible',()=>{
 const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};let n=0;const saves=S.createStore(storage,()=>`variety-${++n}`);
 const prior=player();prior.visits={extra:1,'v5-youth-1':1,'fate-flu':1,'family-meet':1};prior.recent=['extra','v5-youth-1'];prior.storyMemory.variants=['family-meet#0'];const id=saves.create(prior),before=[...memory];
 const avoid=saves.recentStories();assert(avoid.includes('fate-flu'));assert(avoid.includes('family-meet#0'));equal([...memory],before);
 const fresh=player(0,'next',{previousStories:avoid});const selected=V.pool(fresh,C.EVENTS.filter(e=>E.eligible(fresh,e)),C.EVENTS);assert(!selected.some(e=>avoid.includes(e.id)));
 const fixed=player(0,'same');equal(fixed,player(0,'same'));assert.equal(fixed.storyMemory.avoid.length,0);
 saves.create(fresh);assert.equal(saves.raw(id),JSON.stringify(prior));assert.equal(saves.list().length,2);
 const loaded=E.migrate(copy(fresh));equal(loaded,fresh);equal(loaded.storyMemory.avoid,avoid);
});
test('three sports keep eight short seasons varied, no ordinary repeats and distinct openings across seeds',t=>{
 const report=[];
 for(const sport of [0,1,2]){const firsts=new Set(),all=new Set(),orders=new Set();let families=0;
  for(let i=0;i<70;i++){
   const s=player(sport,'varied-route-'+i),ids=[],ordinary=new Set();
   for(let age=16;age<24;age++){
    s.age=age;s.health=s.mood=s.morale=80;s.energy=100;s.eventsLeft=2;s.seasonEvents=2;s.storyFlow={age,core:false,surprise:false};s.phase='train';
    for(let j=0;j<2;j++){
     E.pickEvent(s);const id=s.event||s.outcome?.fateId;assert(id);ids.push(id);all.add(id);if(age===16&&j===0)firsts.add(id);
     if(!E.byId[id]?.chainOnly){assert(!ordinary.has(id),`${sport} ${i}: repeated ${id}`);ordinary.add(id)}
     if(id==='family-meet')families++;orders.add(j+':'+(id.startsWith('fate-')?'fate':'choice'));
     const reloaded=E.migrate(copy(s));resolveScene(s);resolveScene(reloaded);equal(s,reloaded);assert.equal(s.eventsLeft,1-j);E.validate(s);
    }
   }
   assert.equal(ids.length,16);
  }
  assert(firsts.size>30);assert(all.size>160);assert.equal(orders.size,4);assert(families>10&&families<70);report.push({sport,firstScenes:firsts.size,totalScenes:all.size,families});
 }
 t.diagnostic(JSON.stringify(report));
});
test('new family chapters vary their scene, meeting time and response, retaining both peoples choices',()=>{
 const dates=new Set();for(let i=0;i<60;i++){const s=player(0,'timing-'+i);for(s.age=17;s.age<=20;s.age++)if(V.familyReady(s,'family-meet')){dates.add(s.age);break}}assert.equal(dates.size,4);
 for(const stage of ['meet','date','distance','marry','birth','coach']){const titles=new Set();for(let i=0;i<50;i++){const s=atFamily(stage,'family-variant-'+i),e=E.byId['family-'+stage];s.event=e.id;s.phase='event';s.eventRules=3;V.variant(s,e,LS.variants);const before=JSON.stringify(s),scene=E.eventData(s);titles.add(scene.title);UI.event(s,E,ctx.XZDynamics);assert.equal(JSON.stringify(s),before);equal(E.eventData(E.migrate(copy(s))),scene);assert(!scene.text.includes('以晴')||L.partner(s)==='以晴');}assert.equal(titles.size,3,stage)}
});
test('a partner can postpone dating, marriage or parenting without fake milestones or animations; a distinct sequel resumes',()=>{
 for(const stage of ['date','marry','birth']){
  let delayed;
  for(let i=0;i<100;i++){const s=atFamily(stage,'delayed-'+stage+i);s.phase='event';s.event='family-'+stage;s.eventsLeft=1;s.eventRules=3;V.variant(s,E.byId[s.event],LS.variants);const snap=M.snapshot(s),before=s.family.stage;assert(E.choose(s,0).ok);if(!s.outcome.success){assert.equal(s.family.stage,before);assert(!s.outcome.narrative.includes('以晴')||L.partner(s)==='以晴');assert(M.detect(snap,s).some(e=>e.kind==='heartbreak'));assert(!s.family.milestones.some(m=>m.id===stage));assert(!M.detect(snap,s).some(e=>['wedding','birth'].includes(e.kind)));delayed=s;break}}
  assert(delayed,stage);equal(E.migrate(copy(delayed)),delayed);const wait=delayed.family.pause;assert(wait.due>delayed.age&&wait.due<=delayed.age+2);assert.equal(L.next(delayed),null);
  delayed.age=wait.due;assert.equal(L.next(delayed),wait.id);delayed.pending=[{id:wait.id,due:delayed.age}];delayed.phase='train';delayed.sessions=3;assert(E.advance(delayed).ok);assert.equal(delayed.event,wait.id);assert.notEqual(E.eventData(delayed).title,delayed.outcome?.title);assert(E.choose(delayed,0).ok);assert(!delayed.family.pause);assert(delayed.family.milestones.some(m=>m.id===stage));E.validate(delayed);
 }
});
test('new failed side stories end once while existing saved choices and queued consequences stay intact',()=>{
 const original=player();delete original.storyMemory;original.phase='event';original.event='v5-story-youth-1';original.eventsLeft=1;original.eventRules=2;original.visits[original.event]=1;original.rng=1;
 const snapshot=copy(original),oldScene=copy(E.eventData(original));equal(E.migrate(copy(original)),snapshot);equal(E.eventData(E.migrate(copy(original))),oldScene);assert(oldScene.options[0].retry);
 const fresh=copy(original);fresh.eventRules=3;V.ensure(fresh,C.EVENTS);const choice=E.eventData(fresh).options[0];assert(!choice.retry);for(let r=0;r<200;r++){const attempt=copy(fresh);attempt.rng=r;E.choose(attempt,0);if(!attempt.outcome.success){assert(!attempt.pending.some(p=>p.id===fresh.event));assert(attempt.outcome.narrative.includes('往後'));break}assert(r<199)}
 const queued=copy(original);queued.phase='train';queued.pending=[{id:'v5-story-youth-1',due:queued.age,retry:true}];E.advance(queued);assert.equal(queued.event,'v5-story-youth-1');
});
test('different choices open different future stories, costs are real and no sequel enters the ordinary pool',()=>{
 for(const [root,a,b]of [['last-court','court-community','court-rent'],['silent-room','rookie-stays','rookie-leaves'],['open-notebook','rival-exchange','rival-secret']]){
  for(const [index,next]of [[0,a],[1,b]]){const s=player();s.money=100;s.phase='event';s.event='turn-'+root;s.eventsLeft=1;s.eventRules=3;assert(E.choose(s,index).ok);assert.equal(s.pending[0].id,'turn-'+next);assert(!s.pending.some(p=>p.id==='turn-'+(index?a:b)));assert(!E.eligible(s,E.byId['turn-'+next]));const saved=E.migrate(copy(s));equal(s,saved);s.age++;s.phase='train';E.advance(s);assert.equal(s.event,'turn-'+next);assert(E.choose(s,0).ok);E.validate(s)}
 }
 const s=player();s.money=0;s.phase='event';s.event='turn-last-court';s.eventsLeft=1;s.eventRules=3;const before=JSON.stringify(s);assert.equal(E.choose(s,1).ok,false);assert.equal(JSON.stringify(s),before);
});
test('season introductions and outcome narration vary without changing stats or RNG',()=>{
 const s=player(),titles=new Set();for(let i=1;i<=8;i++){s.age=16+i;s.history=Array.from({length:i},(_,j)=>({age:16+j,o:40,pay:10,team:s.team,stats:'完成賽季'}));s.energy=s.health=s.mood=80;const before=JSON.stringify(s),html=UI.trainingIntro(s);titles.add(html.match(/scene-title">([^<]+)/)[1]);assert.equal(JSON.stringify(s),before)}assert.equal(titles.size,8);
 const outcomes=new Set();for(const id of ['v5-training-5','v5-mind-6','v5-team-9']){const s=player();s.phase='event';s.event=id;s.eventsLeft=1;s.eventRules=3;assert(E.choose(s,1).ok);outcomes.add(s.outcome.narrative);assert(s.outcome.narrative.includes(E.byId[id].title));assert(UI.outcome(s).includes(s.outcome.resultTitle));}assert.equal(outcomes.size,3);
});
