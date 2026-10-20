import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx=vm.createContext({console}),base=new URL('../public/game-life/',import.meta.url);
for(const [,url]of fs.readFileSync(new URL('index.html',base),'utf8').matchAll(/<script src="([^"]+)"/g)){const file=url.split('?')[0].split('/').pop();if(file!=='app.js')vm.runInContext(fs.readFileSync(new URL(file,base),'utf8'),ctx,{filename:file})}
const {XZEngine:E,XZRomance:R,XZFamily:L,XZFamilyUI:UI,XZFeats:T,XZArena:A,XZFootball:F,XZDynamics:D,XZMoments:M}=ctx;
const clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>assert.deepEqual(clone(a),clone(b));
const player=(sport=1,seed='drama',pos)=>E.create({sport,name:'故事驗證',pos:pos||['投手','前鋒','控球後衛'][sport],seed,length:'short',pace:'quick'});
const logctx={log(s,t){s.log.unshift(t)}};
function core(s,age,id,index=0){s.age=age;s.phase='event';s.event='family-'+id;s.eventsLeft=1;assert(E.choose(s,index).ok);E.validate(s)}
function dating(seed='drama'){const s=player(1,seed);core(s,17,'meet');core(s,18,'date');s.age=19;return s}
function drama(s,id,index){s.phase='event';s.event='romance-'+id;s.eventsLeft=1;const before=M.snapshot(s),mood=s.mood;assert(E.choose(s,index).ok,id);assert.equal(s.mood,Math.max(0,Math.min(100,mood+E.byId['romance-'+id].options[index].effect.mood)));E.validate(s);return M.detect(before,s)}
function match(s,stats={}){return {home:s.team,away:'測試隊',hg:3,ag:0,round:1,done:false,player:{apps:1,...stats}}}
function mount(s,m){const h=s.sport===1?s.football:s.arena;h.season={moment:{match:m},playoffGames:[]};}
test('thirteen relationship stories cover betrayals, consequences and support with explicit mood changes',()=>{
 assert.equal(R.EVENTS.length,13);assert(R.EVENTS.some(e=>e.text.includes('外遇')||e.title.includes('揭穿')));
 const signs=new Set();for(const e of R.EVENTS){assert.equal(e.options.length,3);assert(e.minAge>=19);for(const c of e.options){assert(Number.isFinite(c.effect.mood));assert(c.hint.includes('心情'));signs.add(Math.sign(c.effect.mood));}}
 same([...signs].sort(),[-1,1]);
});
test('an affair has a saved next-season consequence and a breakup has a healing followup',()=>{
 const s=dating();let events=drama(s,'temptation',1);assert.equal(events[0].kind,'romance');assert.equal(s.romance.pending.id,'romance-exposed');same(E.migrate(clone(s)),s);
 s.age=20;s.phase='train';s.sessions=3;assert(E.advance(s).ok);assert.equal(s.event,'romance-exposed');const before=M.snapshot(s),mood=s.mood;assert(E.choose(s,1).ok);assert.equal(s.mood,Math.max(0,mood-38));assert.equal(M.detect(before,s)[0].kind,'heartbreak');assert.equal(s.romance.bond,'separated');assert.equal(L.next(s),null);assert.equal(s.romance.pending.id,'romance-alone');
 s.age=21;s.mood=50;drama(s,'alone',0);assert.equal(s.mood,66);assert.equal(s.romance.bond,'separated');assert.equal(s.romance.pending,null);
});
test('partner betrayal and rebuilding trust affect mood without erasing the shared family',()=>{
 const s=dating();core(s,19,'distance');core(s,20,'marry');core(s,21,'birth');core(s,22,'coach');s.age=23;const child=clone(s.family.child),milestones=clone(s.family.milestones);drama(s,'betrayed',1);same(s.family.child,child);same(s.family.milestones,milestones);assert(UI.farewell(s).detail.includes(s.family.child.name+'從看台跑向你'));assert(!UI.farewell(s).detail.includes('牽著'+s.family.child.name));E.finish(s,'voluntary');const heir=E.createHeir(s,{focus:'mind',parentId:'parent'});assert.equal(heir.age,16);assert(heir.potential>=s.potential);assert.equal(heir.romance,undefined);assert.equal(heir.feats,undefined);
 const sameYear=dating();drama(sameYear,'betrayed',0);assert.equal(R.pick(sameYear,{random:()=>0}),null);
 const t=dating();drama(t,'betrayed',2);t.age=20;t.mood=50;drama(t,'rebuild',0);assert.equal(t.romance.bond,'together');assert.equal(t.mood,64);t.age=21;assert.equal(L.next(t),'family-marry');
});
test('new relationship episodes share two short slots; pending stories retain priority; old pending family events still resolve',()=>{
 const s=dating();s.phase='train';s.sessions=3;assert(E.advance(s).ok);assert.equal(s.eventsLeft,2);let romance=0;for(let i=0;i<2;i++){if(s.event.startsWith('romance-'))romance++;assert(E.choose(s,0).ok);if(i===0)assert(E.advance(s).ok)}assert(romance<=1);assert.equal(s.eventsLeft,0);
 const old=dating();old.phase='event';old.event='family-distance';old.eventsLeft=1;const loaded=E.migrate(clone(old));same(loaded,old);assert(E.choose(loaded,2).ok);assert.equal(loaded.family.stage,'single');
 const queued=dating();queued.phase='train';queued.pending=[{id:'echo-home',due:19}];assert(E.advance(queued).ok);assert.equal(queued.event,'echo-home');
 const young=dating();young.age=18;assert.equal(R.pick(young,{random:()=>0}),null);
});
test('all drama branches validate, followups are gated, and view/replay never mutate saves',()=>{
 for(const e of R.EVENTS)for(let i=0;i<e.options.length;i++){const s=dating();if(e.followup||e.separated){drama(s,'temptation',1);s.age=20;if(e.id!=='romance-exposed'){drama(s,'exposed',e.separated?1:0);s.age=21;if(!e.followup){drama(s,'alone',0);s.age=23}}}s.mood=65;drama(s,e.id.slice(8),i);const before=JSON.stringify(s);R.historyHTML(s);UI.archive(s);T.panel(s);M.markup([{kind:'heartbreak',player:s.name,age:s.age,title:e.title,detail:s.outcome.narrative}],true);assert.equal(JSON.stringify(s),before);same(E.migrate(clone(s)),s);}
 const s=dating(),before=JSON.stringify(s);s.phase='event';s.event='romance-exposed';const blocked=JSON.stringify(s);assert.equal(E.choose(s,0).ok,false);assert.equal(JSON.stringify(s),blocked);assert(before);
});
test('match titles award only from actual qualifying personal stats, improve abilities and cannot stack repeatedly',()=>{
 for(const sport of [0,1,2]){const s=player(sport),module=sport===1?F:A,initial=module.abilities(s),baseA=clone(s.a),stats=[{k:8},{goals:3},{pts:30}][sport],m=match(s,stats);T.settle(s,m,logctx);assert.equal(s.feats.titles.length,1);assert(module.abilities(s).some((v,i)=>v>initial[i]));same(s.a,baseA);const saved=clone(s);T.settle(s,m,logctx);same(s,saved);T.settle(s,match(s,stats),logctx);same(s,saved);E.validate(s);same(E.migrate(clone(s)),s);}
 const s=player(0);T.settle(s,match(s,{apps:0,k:12}),logctx);assert.equal(s.feats,undefined);T.settle(s,match(s,{k:7}),logctx);assert.equal(s.feats,undefined);
});
test('all twelve titles have bounded derived bonuses; one match can award several without duplicating later',()=>{
 for(const sport of [0,1,2]){const s=player(sport);s.feats={v:1,titles:Object.entries(T.TITLES).filter(([,t])=>t.sport===sport).map(([id])=>({id,age:16,match:'驗證'})),awakening:null};assert(T.abilities(s,Array(9).fill(95)).every(v=>v<=99));assert(Array.from({length:9},(_,i)=>T.bonus(s,i)).every(v=>v<=8));E.validate(s);}
 const s=player(2);T.settle(s,match(s,{pts:35,ast:12,reb:16}),logctx);assert.equal(s.feats.titles.length,4);
});
test('awakening is rare and deterministic, stays through the match, affects real checks, and expires at the whistle',()=>{
 const s=player(1);let hits=0;for(let i=0;i<20000;i++)if(T.roll(s,'sample-'+i)<T.RATE)hits++;assert(hits>=30&&hits<=100,`observed ${hits}/20000`);
 const m=match(s);mount(s,m);const key=`1:16:league:1:${m.home}:${m.away}`;let n=0;while(T.roll(s,key)>=T.RATE&&n<20000)s.seed='spark-'+(++n);assert(n<20000);const rng=s.rng,baseline=F.momentChance(s,F.SCENES['前鋒'][0][2][0]);T.start(s,m,logctx);assert(T.active(s));assert.equal(s.rng,rng);const chance=F.momentChance(s,F.SCENES['前鋒'][0][2][0]);assert(chance>baseline);same(T.combat(s,[40,80]),[65,99]);const active=clone(s);T.start(s,m,logctx);same(s,active);const copy=clone(s);assert(T.active(copy));same(T.combat(copy,[40]),[65]);T.settle(s,m,logctx);assert(!T.active(s));same(T.combat(s,[40]),[40]);assert.equal(s.a[0],active.a[0]);
});
test('new titles and awakening produce one animation each; snapshots and panels are read-only',()=>{
 const s=player(2),before=M.snapshot(s);T.settle(s,match(s,{pts:35,ast:12,reb:16}),logctx);const events=M.detect(before,s);assert.equal(events.length,1);assert.equal(events[0].kind,'title');assert(events[0].detail.includes('三域主宰'));const json=JSON.stringify(s);T.panel(s);M.markup(events,true);assert.equal(JSON.stringify(s),json);assert.equal(M.detect(M.snapshot(s),s).length,0);
});
test('old saves gain no retroactive titles or random rolls, malformed new fields fail safely',()=>{
 const s=player();const old=clone(s);same(E.migrate(old),s);assert.equal(old.romance,undefined);assert.equal(old.feats,undefined);const titled=player(2);T.settle(titled,match(titled,{pts:32}),logctx);for(const edit of [x=>x.feats.titles.push(x.feats.titles[0]),x=>x.feats.titles[0].id='keeper',x=>x.feats.awakening={age:16,key:'fake',active:true}]){const bad=clone(titled);edit(bad);assert.throws(()=>E.migrate(bad));}
 const r=dating();drama(r,'temptation',1);const bad=clone(r);bad.romance.pending.id='romance-unknown';assert.throws(()=>E.migrate(bad));
});

test('later relationship mistakes still receive their promised consequences after an earlier repair',()=>{
 const s=dating();for(const [age,id,choice]of [[19,'temptation',1],[20,'exposed',0],[21,'rebuild',0],[23,'ex-message',1],[24,'exposed',0],[25,'rebuild',0]]){s.age=age;s.mood=65;if(s.romance?.pending)assert.equal(R.pick(s,{random:()=>0}),'romance-'+id);drama(s,id,choice);}
 assert.equal(s.romance.history.filter(h=>h.id==='romance-exposed').length,2);assert.equal(s.romance.bond,'together');same(E.migrate(clone(s)),s);
});
