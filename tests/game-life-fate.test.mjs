import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base=new URL('../public/game-life/',import.meta.url),ctx=vm.createContext({console}),copy=x=>JSON.parse(JSON.stringify(x));
for(const [,url]of fs.readFileSync(new URL('index.html',base),'utf8').matchAll(/<script src="([^"]+)"/g)){const f=url.split('?')[0].split('/').pop();if(f==='app.js')continue;let code=fs.readFileSync(new URL(f,base),'utf8');if(f==='engine.js')code=code.replace('const api={','const api={context:footballContext,');vm.runInContext(code,ctx,{filename:f})}
const {XZEngine:E,XZFate:N,XZOrigins:O,XZFocus:UI,XZMoments:M}=ctx;
const player=(sport=0,seed='fate-player',extra={})=>E.create({sport,seed,pos:['投手','前鋒','控球後衛'][sport],country:'random',talent:-1,pace:'quick',length:'short',...extra});
test('unselected origins vary across seeds, affect real starting resources, and reproduce exactly',()=>{
 for(const sport of [0,1,2]){
  const countries=new Set(),backgrounds=new Set(),resources=new Set();
  for(let i=0;i<80;i++){
   const s=player(sport,'born-'+i);countries.add(s.country);backgrounds.add(s.fate.background);resources.add(s.money);assert.equal(O.current(s).country,s.country);assert.deepEqual(copy(s),copy(player(sport,'born-'+i)));assert.deepEqual(copy(E.migrate(copy(s))),copy(s));E.validate(s);
   const before=JSON.stringify(s);assert(UI.background(s).includes(N.BACKGROUNDS.find(b=>b.id===s.fate.background).name));UI.trainingIntro(s);UI.fateRecord(s);assert.equal(JSON.stringify(s),before);
  }
  assert.equal(countries.size,5);assert.equal(backgrounds.size,8);assert(resources.size>=6);
  for(const country of O.COUNTRIES)assert.equal(player(sport,'chosen',{country}).country,country);
 }
});
test('all 36 fate events apply once, have no choice, save actual changes and use a dedicated animation',()=>{
 assert.equal(N.EVENTS.length,36);const signs={positive:0,negative:0,mixed:0};
 for(const event of N.EVENTS){
  const sport=event.context==='foot'?1:event.context==='basket'?2:0,s=player(sport,event.id,{country:'日本',pos:event.context==='base-bat'?'內野手':undefined});
  if(['partner','child'].includes(event.context)){for(const [i,id]of ['meet','date',...(event.context==='child'?['distance','marry','birth']:[])].entries()){s.age=17+i;s.phase='event';s.event='family-'+id;s.eventsLeft=1;assert(E.choose(s,0).ok)}}
  s.a=[50,50,50,50];s.caps=[99,99,99,99];s.energy=s.health=s.mood=s.morale=60;s.money=100;s.eventsLeft=2;
  const before=M.snapshot(s),rng=s.rng,stats=copy(s.a);assert(N.resolve(s,event,E.context(),E.effectsText));assert.equal(s.phase,'outcome');assert.equal(s.event,null);assert.equal(s.eventsLeft,1);assert(s.outcome.unchosen);assert.notEqual(s.rng,rng);assert.equal(s.fate.history.length,1);
  assert.equal(E.choose(s,0).ok,false);const after=JSON.stringify(s);assert.equal(N.resolve(s,event,E.context(),E.effectsText),false);assert.equal(JSON.stringify(s),after);
  const html=UI.outcome(s);assert(!html.includes('eventChoice('));assert(!html.includes('你選擇了'));assert(html.includes(s.outcome.detail));assert.equal((html.match(/<button/g)||[]).length,1);assert.equal(JSON.stringify(s),after);
  assert(M.detect(before,s).some(e=>e.kind==='fate'&&e.detail===s.outcome.detail));assert(!M.detect(M.snapshot(s),s).some(e=>e.kind==='fate'));
  if(event.effect.a)assert.notDeepEqual(copy(s.a),stats);signs[event.tone>0?'positive':event.tone<0?'negative':'mixed']++;
  assert.deepEqual(copy(E.migrate(copy(s))),copy(s));E.validate(s)
 }
 assert(signs.positive>10&&signs.negative>10&&signs.mixed>=2);
});
test('random fate replaces a scene, never adds turns or removes every decision, and cannot reroll on reload',()=>{
 for(const sport of [0,1,2]){
  const seen=new Set();let seasons=0,first=0,second=0;
  for(let i=0;i<60;i++){
   const s=player(sport,'year-'+i);s.sessions=3;E.advance(s);const reloaded=E.migrate(copy(s));let automatic=0,choices=0;
   for(let scene=0;scene<2;scene++){
    if(s.phase==='outcome'&&s.outcome.unchosen){automatic++;seen.add(s.outcome.fateId);scene===0?first++:second++}
    else{assert.equal(s.phase,'event');choices++;const options=E.eventData(s).options,index=options.findIndex(c=>!c.cost&&c.chance===undefined&&!c.defer);assert(E.choose(s,index<0?0:index).ok);assert(E.choose(reloaded,index<0?0:index).ok)}
    assert.deepEqual(copy(reloaded),copy(s));assert.equal(s.eventsLeft,1-scene);if(scene===0){E.advance(s);E.advance(reloaded)}
   }
   assert(automatic<=1);assert(choices>=1);if(automatic)seasons++;assert.equal(s.seasonEvents,2);E.validate(s);
  }
  assert(seasons>=20&&seasons<=52,`${sport}: ${seasons}`);assert(first>0&&second>0);assert(seen.size>=15);
 }
});
test('old active scenes and contracts stay exact, while future fate never grants a new childhood',()=>{
 for(const sport of [0,1,2]){
  const s=player(sport,'legacy',{country:'台灣'});delete s.fate;s.phase='event';s.event='v5-youth-1';s.eventsLeft=2;s.salary=777;s.yearsLeft=3;const before=copy(s),event=copy(E.eventData(s));assert.deepEqual(copy(E.migrate(copy(s))),before);assert.deepEqual(copy(E.eventData(E.migrate(copy(s)))),event);
  const team=s.team;assert(N.resolve(s,N.EVENTS.find(e=>e.id==='fate-old-letter'),E.context(),E.effectsText));assert.equal(s.fate.background,null);assert.equal(s.fate.start,null);assert.equal(s.salary,777);assert.equal(s.yearsLeft,3);assert.equal(s.team,team);E.validate(s);
 }
});
test('queued consequences remain first and relationship encounters require real relationships',()=>{
 for(const sport of [0,1,2])for(let i=0;i<15;i++){
  const s=player(sport,'due-'+i);s.pending=[{id:'echo-home',due:16}];E.advance(s);assert.equal(s.event,'echo-home');assert.equal(s.fate.history.length,0);
  assert(!N.EVENTS.filter(e=>N.eligible(s,e)).some(e=>['partner','child'].includes(e.context)));
 }
 const s=player();s.eventsLeft=2;N.resolve(s,N.EVENTS[0],E.context(),E.effectsText);const bad=copy(s);bad.fate.history.push(copy(bad.fate.history[0]));assert.throws(()=>E.migrate(bad));
});
test('an unavoidable health drop uses existing care and resumes the saved outcome without another penalty',()=>{
 let s;
 for(let i=0;i<300;i++){const candidate=player(0,'care-fate-'+i);candidate.health=30;candidate.sessions=3;E.advance(candidate);if(candidate.outcome?.unchosen&&candidate.care?.active){s=candidate;break}}
 assert(s);const event=s.outcome.fateId,detail=s.outcome.detail,count=s.fate.history.length,reloaded=E.migrate(copy(s));assert.deepEqual(copy(reloaded),copy(s));
 while(reloaded.care?.active){const care=reloaded.care.active;assert((care.stage==='decision'?E.careChoice(reloaded,'team'):E.careRecover(reloaded,care.kind==='surgery'?'rehab':'therapy')).ok)}
 assert.equal(reloaded.outcome.fateId,event);assert.equal(reloaded.outcome.detail,detail);assert.equal(reloaded.fate.history.length,count);assert(E.advance(reloaded).ok);assert.equal(reloaded.fate.history.length,count);assert.equal(reloaded.phase,'event');E.validate(reloaded);
});
