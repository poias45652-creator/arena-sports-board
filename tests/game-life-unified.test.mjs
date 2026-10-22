import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base=new URL('../public/game-life/',import.meta.url),ctx=vm.createContext({console});
for(const [,url]of fs.readFileSync(new URL('index.html',base),'utf8').matchAll(/<script src="([^"]+)"/g)){const f=url.split('?')[0].split('/').pop();if(f!=='app.js')vm.runInContext(fs.readFileSync(new URL(f,base),'utf8'),ctx,{filename:f})}
const {XZEngine:E,XZEasy:U,XZPreparation:P,XZFeats:T,XZArena:A,XZFootball:F,XZFocus:UI,XZMoments:M,XZContent:C,XZDynamics:D}=ctx;
const copy=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>assert.deepEqual(copy(a),copy(b));
const player=(sport=0,pos,seed='unified-proof')=>E.create({sport,pos:pos||['投手','前鋒','控球後衛'][sport],seed,length:'short',pace:'quick'});
const logctx={log(s,t){s.log.unshift(t)}};
const match=(s,stats,ag=0)=>({home:s.team,away:'驗證對手',hg:3,ag,round:1,player:{apps:1,...stats}});

test('all choices retain legacy rules, amplify five vitals only on new scenes, and show actual effects',()=>{
 let count=0;const plus=new Set(),minus=new Set();
 for(const event of C.EVENTS){const s=player(event.sport??0);s.phase='event';s.event=event.id;s.eventRules=3;if(['p-national','national-final'].includes(event.id)){s.age=24;s.a=[99,99,99,99];s.caps=[99,99,99,99]}
  const old=copy(E.eventData(s)),source=JSON.stringify(s);same(E.eventData(E.migrate(copy(s))),old);assert.equal(JSON.stringify(s),source);
  s.eventRules=4;const fresh=E.eventData(s);same(E.eventData(E.migrate(copy(s))),fresh);
  if(event.major)continue;
  for(let i=0;i<fresh.options.length;i++){if(fresh.options[i].defer)continue;for(const kind of ['effect','good','bad']){
   const a=old.options[i][kind],b=fresh.options[i][kind];if(!a)continue;
   for(const key of ['a','energy','health','mood','morale']){const av=key==='a'?a.a?.[0]:a[key],bv=key==='a'?b.a?.[0]:b[key];if(!av)continue;assert.equal(Math.sign(bv),Math.sign(av));assert(Math.abs(bv)>=Math.abs(av));if(Math.abs(bv)>Math.abs(av))count++;if(bv>0)plus.add(key);else minus.add(key)}
   same(b.flags||{},a.flags||{});assert.equal(b.money,a.money);
  }const html=D.eventVitalHTML(fresh.options[i]);if(html)assert(html.includes('固定')||html.includes('成功')||html.includes('失敗'));}
 }
 assert(count>1500);assert.equal(plus.size,5);assert.equal(minus.size,5);
 const s=player();s.phase='event';s.event='v5-training-1';s.eventRules=4;const c=E.eventData(s).options[0];assert(Object.values(c.good).some(v=>v>=20)||c.good.a?.some(v=>v>=7));
});

test('inline customization uses the real position-specific training, tactics and load without extra turns',()=>{
 for(const sport of [0,1,2]){const s=player(sport),b=copy(s),training=E.trainingOptions(s).filter(t=>t.id!=='rest').at(-1).id,plan=U.tactics(s).at(-1).id;
  assert(U.run(s,'growth',E,{training,intensity:'careful',plan,load:'protect',pace:'full',challenge:false}).ok);
  E.setPace(b,'full');E.seasonGoal(b,'growth');sport===1?E.footballPlan(b,plan):E.arenaPlan(b,plan);if(sport!==1)E.arenaLoad(b,'protect');E.trainingIntensity(b,'careful');E.seasonTraining(b,training);same(s,b);E.validate(s);assert.equal(s.sessions,3);
  const untouched=player(sport),before=JSON.stringify(untouched);assert(!U.run(untouched,'growth',E,{training:'invalid'}).ok);assert.equal(JSON.stringify(untouched),before);
 }
});

test('seasonal opportunities vary, resolve once, survive reload and trigger a matching animation',()=>{
 for(const sport of [0,1,2]){const s=player(sport),ids=new Set();for(let age=16;age<22;age++){s.age=age;ids.add(P.offer(s).id)}assert.equal(ids.size,6);
  const outcomes=new Set();for(let seed=0;seed<30;seed++){const x=player(sport,undefined,'opportunity-'+seed),saved=JSON.stringify(x),offer=P.offer(x);U.training(x,E);assert.equal(JSON.stringify(x),saved);const before=M.snapshot(x),b=copy(x);assert(E.preparationChallenge(x,offer.id).ok);assert(E.preparationChallenge(b,offer.id).ok);same(x,b);outcomes.add(x.preparation.success);const result=JSON.stringify(x);assert(!E.preparationChallenge(x,offer.id).ok);assert.equal(JSON.stringify(x),result);same(E.migrate(copy(x)),x);assert(M.detect(before,x).some(e=>['awakening','setback'].includes(e.kind)));}
  assert.equal(outcomes.size,2);
 }
 const s=player();s.health=20;const before=s.rng;assert(E.preparationChallenge(s,P.offer(s).id).interrupted);assert.equal(s.rng,before);assert.equal(s.preparation,undefined);
});

const negativeCases=[
 [0,'投手','lost-zone',{pitchApps:1,walks:4},{outs:12,walks:1}],
 [0,'內野手','swing-fog',{ab:4,so:3},{h:2}],
 [0,'投手','run-alarm',{pitchApps:1,er:6},{outs:15,er:2}],
 [1,'後衛','red-edge',{red:1},{minutes:60,yellow:0,red:0}],
 [1,'前鋒','lost-rhythm',{minutes:60,ratingSum:5},{minutes:60,ratingSum:7}],
 [1,'門將','goal-shadow',{minutes:60},{cleanSheets:1}],
 [2,'得分後衛','cold-rim',{fga:12,fgm:2},{fga:10,fgm:5}],
 [2,'控球後衛','loose-handle',{tov:5},{minutes:20,ast:4,tov:1}],
 [2,'中鋒','foul-siren',{fouls:6},{minutes:20,fouls:2}]
];
test('nine negative titles reduce actual abilities, clear after two qualifying games, and can return without duplication',()=>{
 for(const [sport,pos,id,bad,good]of negativeCases){const s=player(sport,pos),module=sport===1?F:A,baseline=module.abilities(s),core=copy(s.a),snap=M.snapshot(s),m=match(s,bad,4);T.settle(s,m,logctx);assert(T.equipped(s).some(t=>t.id===id),id);assert(module.abilities(s).some((v,i)=>v<baseline[i]),id);same(s.a,core);assert(M.detect(snap,s).some(e=>e.kind==='setback'));E.validate(s);same(E.migrate(copy(s)),s);
  const saved=JSON.stringify(s);T.settle(s,m,logctx);assert.equal(JSON.stringify(s),saved);const first=match(s,good);T.settle(s,first,logctx);assert.equal(s.feats.titles.find(t=>t.id===id).recoveryProgress,1,id);const once=JSON.stringify(s);T.settle(s,first,logctx);assert.equal(JSON.stringify(s),once);const before=M.snapshot(s);T.settle(s,match(s,good),logctx);assert(!T.equipped(s).some(t=>t.id===id));assert(M.detect(before,s).some(e=>e.kind==='recovery'));assert(module.abilities(s).every((v,i)=>v>=baseline[i]));E.validate(s);same(E.migrate(copy(s)),s);
  T.settle(s,match(s,bad,4),logctx);assert(T.equipped(s).some(t=>t.id===id));assert.equal(s.feats.titles.filter(t=>t.id===id).length,1);assert.equal(s.feats.titles.find(t=>t.id===id).recoveryProgress,0);E.validate(s);same(E.migrate(copy(s)),s);
 }
});

test('multiple positive and negative badges appear beside the name and stack with bounded net effects',()=>{
 const s=player(2),baseA=copy(s.a);T.settle(s,match(s,{pts:35,ast:12,reb:16,tov:6}),logctx);assert.equal(T.equipped(s).length,5);const raw=JSON.stringify(s),html=UI.hud(s,E);assert.equal((html.match(/class="name-title/g)||[]).length,5);for(const t of T.equipped(s))assert(html.includes(T.TITLES[t.id].name));assert(html.includes('is-negative'));assert(!html.includes('<small> +4'));assert.equal(T.bonus(s,3),1);same(s.a,baseA);T.panel(s);assert.equal(JSON.stringify(s),raw);
 for(const sport of [0,1,2]){const x=player(sport);x.feats={v:1,titles:Object.entries(T.TITLES).filter(([,t])=>t.sport===sport).map(([id])=>({id,age:16,match:'上限驗證'})),awakening:null};assert(T.abilities(x,Array(9).fill(1)).every(v=>v>=1));assert(T.abilities(x,Array(9).fill(99)).every(v=>v<=99));for(let i=0;i<9;i++)assert(T.bonus(x,i)>=-18&&T.bonus(x,i)<=16);E.validate(x)}
});

test('new rules preserve relationship history validation while old active choices remain unchanged',()=>{
 const s=player();for(const [age,id]of [[17,'meet'],[18,'date']]){s.age=age;s.event='family-'+id;s.phase='event';s.eventsLeft=1;E.choose(s,1)}s.age=19;s.event='romance-temptation';s.phase='event';s.eventsLeft=1;s.eventRules=4;assert(E.choose(s,1).ok);assert.equal(s.romance.history[0].rules,4);E.validate(s);same(E.migrate(copy(s)),s);const broken=copy(s);broken.romance.history[0].mood=999;assert.throws(()=>E.validate(broken));
});

test('amplified collaboration costs are gated before mutation and ability deltas are shown',()=>{
 const s=player();s.event='v5-training-1';s.eventRules=4;s.phase='event';s.eventsLeft=1;s.energy=8;const option=E.eventData(s).options[2];assert(option.effect.energy<=-12);const before=JSON.stringify(s);assert(!E.choose(s,2).ok);assert.equal(JSON.stringify(s),before);assert(UI.event(s,E,D).includes('需要體力 12'));
 const old={ability:E.ovr(s),health:s.health,mood:s.mood,morale:s.morale,energy:s.energy,fame:s.fame};s.a=s.a.map(v=>v+4);assert(ctx.XZJourneyUI.feedback(old,s).includes('能力 +4'));
});

