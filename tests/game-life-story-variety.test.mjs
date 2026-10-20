import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base=new URL('../public/game-life/',import.meta.url),ctx=vm.createContext({console});
for(const [,url]of fs.readFileSync(new URL('index.html',base),'utf8').matchAll(/<script src="([^"]+)"/g)){const f=url.split('?')[0].split('/').pop();if(f!=='app.js')vm.runInContext(fs.readFileSync(new URL(f,base),'utf8'),ctx)}
const E=ctx.XZEngine,B=ctx.XZStoryBalance,C=ctx.XZContent,UI=ctx.XZFocus,copy=x=>JSON.parse(JSON.stringify(x));
const player=(sport,seed)=>E.create({sport,pos:['投手','前鋒','控球後衛'][sport],seed,pace:'quick',length:'short'});
test('every sport has varied two-scene seasons, both orders, and reproducible reloads',()=>{
 for(const sport of [0,1,2]){
  const scenes=new Set(),orders=new Set();
  for(let i=0;i<40;i++){
   const s=player(sport,'variety-'+i);s.age=17;s.sessions=3;assert(E.advance(s).ok);assert.equal(s.eventsLeft,2);
   const loaded=E.migrate(copy(s));assert.deepEqual(copy(loaded),copy(s));
   const first=s.event;scenes.add(first);orders.add(first==='family-meet'?'core-first':'surprise-first');
   assert(E.choose(s,0).ok);assert(E.choose(loaded,0).ok);assert(E.advance(s).ok);assert(E.advance(loaded).ok);
   assert.deepEqual(copy(loaded),copy(s));scenes.add(s.event);
   assert.equal([first,s.event].filter(id=>id==='family-meet').length,1);assert.equal(s.eventsLeft,1);E.validate(s);
  }
  assert.equal(orders.size,2);assert(scenes.size>=25,`${sport}: ${scenes.size} scenes`);
 }
});
test('all five vitals share gains and losses; aggressive results exceed safe rewards and collaboration losses',()=>{
 const totals=Array(5).fill(0),value=(e,k)=>k===0?(e.a?.[0]||0):(e[['a','energy','health','mood','morale'][k]]||0);
 const source=C.EVENTS.filter(e=>e.id.startsWith('v5-')&&!e.chainOnly);
 assert.equal(source.length,400);
 for(const event of source){
  const before=JSON.stringify(event),e=B.scene(event,E.effectsText),risk=e.options[0],safe=e.options[1],team=e.options[2];
  assert.equal(JSON.stringify(event),before);
  for(let k=0;k<5;k++)if(value(risk.good,k)>0){totals[k]++;assert(value(risk.good,k)>=value(safe.effect,k));assert(value(risk.bad,k)<0);assert(Math.abs(value(team.bad,k))<Math.abs(value(risk.bad,k)));}
  assert.match(risk.label,/全力投入/);assert.match(safe.label,/穩穩來/);
  assert(ctx.XZDynamics.eventVitalHTML(risk).includes('失敗'));
 }
 for(const n of totals)assert(n>120&&n<200,totals.join(','));
});
test('legacy current choices stay identical and new active choices survive save/load',()=>{
 const s=player(0,'legacy-scene');s.phase='event';s.event='v5-youth-1';s.eventsLeft=1;
 const before=copy(s),old=copy(E.eventData(s));const loaded=E.migrate(copy(s));
 assert.deepEqual(copy(loaded),before);assert.deepEqual(copy(E.eventData(loaded)),old);
 s.eventRules=2;assert.notDeepEqual(copy(E.eventData(s)),old);assert.deepEqual(copy(E.eventData(E.migrate(copy(s)))),copy(E.eventData(s)));
 const broken=copy(s);broken.storyFlow={age:99,core:true,surprise:false};assert.throws(()=>E.migrate(broken));
});
test('earned titles appear beside names in all sports without mutation or extra awards',()=>{
 for(const [sport,id]of [[0,'strikeout'],[1,'hat-trick'],[2,'scorer']]){
  const s=player(sport,'title');s.name='<b>新星</b>';assert(!UI.hud(s,E).includes('name-title'));
  s.feats={v:1,titles:[{id,age:16,match:'earned-match'}],awakening:null};const before=JSON.stringify(s),html=UI.hud(s,E);
  assert(html.includes(ctx.XZFeats.TITLES[id].name));assert.match(html,/&lt;b&gt;新星&lt;\/b&gt;<span class="name-title"/);assert.equal(JSON.stringify(s),before);
 }
});
