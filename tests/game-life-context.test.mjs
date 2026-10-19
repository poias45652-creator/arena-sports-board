import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base=new URL('../public/game-life/',import.meta.url),copy=x=>JSON.parse(JSON.stringify(x));
function runtime(){
 const ctx=vm.createContext({console,document:{getElementById(){return{}}}});
 const html=fs.readFileSync(new URL('index.html',base),'utf8');
 for(const [,url]of html.matchAll(/<script src="([^"]+)"/g)){
  const file=url.split('?')[0].split('/').pop();if(['app.js','saves.js'].includes(file))continue;
  let source=fs.readFileSync(new URL(file,base),'utf8');
  // Inspect real simulation transitions without adding a production/debug API.
  if(file==='arena.js')source=source.replace('const api={','const api={test:{liveMatch,simulateLive,baseballOutcome,baseballSpotlight},');
  if(file==='engine.js')source=source.replace('const api={','const api={testContext:footballContext,');
  vm.runInContext(source,ctx,{filename:file});
 }
 return{E:ctx.XZEngine,A:ctx.XZArena,UI:ctx.XZArenaUI};
}
const {E,A,UI}=runtime(),ctx=E.testContext();
function game(pos='投手',seed='context',pace='quick',arch){
 const s=E.create({sport:0,pos,seed,pace,archetype:arch});s.age=26;s.team=A.CONFIG[0].teams[1][0];s.tier=1;s.a=[70,70,70,70];s.caps=[99,99,99,99];s.arena.season={round:0,availability:1};
 const m=A.test.liveMatch(s,s.team,A.CONFIG[0].teams[1][1],ctx);m.app.present=true;m.player.apps=1;
 if(pos==='投手'){m.app.pitcher=true;m.app.relief=arch==='closer';m.app.innings=6;m.app.bats=false;}
 return{s,m};
}
function snapshot(m){return copy({hg:m.hg,ag:m.ag,bases:m.bases,outs:m.outs,order:m.order,inning:m.inning,half:m.half,player:m.player,lines:m.lines,recent:m.recentPlateAppearances})}
test('spotlights use real runner situations across all baseball roles and both paces',t=>{
 const counts={empty:0,one:0,two:0,loaded:0},outs=new Set(),modes=new Set();let n=0;
 for(const pace of ['quick','full'])for(const pos of ['投手','捕手','內野手','外野手','二刀流'])for(let seed=0;seed<50;seed++){
  const {s,m}=game(pos,`variety-${seed}`,pace);if(A.test.simulateLive(s,m,ctx,true))continue;
  n++;counts[['empty','one','two','loaded'][m.bases.filter(Boolean).length]]++;outs.add(m.outs);modes.add(m.mode);
  const previous=m.recentPlateAppearances?.at(-1);assert(previous);
  if(previous.inning===m.inning&&previous.half===m.half){assert.deepEqual(copy(m.bases),copy(previous.after.bases));assert.equal(m.outs,previous.after.outs)}
  assert.deepEqual([m.hg,m.ag],copy(previous.after.score));assert(m.keyCount===1);
 }
 t.diagnostic(JSON.stringify({n,counts,outs:[...outs],modes:[...modes]}));
 assert(n>450);assert((n-counts.empty)/n>.7);for(const k of ['empty','one','two','loaded'])assert(counts[k]>0,k);assert.equal(outs.size,3);assert.equal(modes.size,3);
});
test('scouting does not mutate RNG, player stats, scores or bases; auto completion preserves the unpaused game',()=>{
 for(const pos of ['投手','內野手','二刀流'])for(let seed=0;seed<20;seed++){
  const {s,m}=game(pos,`replay-${seed}`),before=JSON.stringify({s,m}),target=A.test.baseballSpotlight(s,m,ctx);assert.equal(JSON.stringify({s,m}),before);assert.equal(A.test.baseballSpotlight(s,m,ctx),target);
  const s2=copy(s),m2=copy(m);A.test.simulateLive(s,m,ctx,true);A.test.simulateLive(s,m,ctx,false);A.test.simulateLive(s2,m2,ctx,false);
  assert.deepEqual(snapshot(m),snapshot(m2));assert.equal(s.rng,s2.rng);
 }
});
test('a dominant pitcher can still face empty bases, and relief highlights occur only while pitching',()=>{
 const {s,m}=game();m.hg=1;const noHits={...ctx,random:()=>.8};A.test.simulateLive(s,m,noHits,true);assert.equal(m.mode,'pitch');assert.equal(m.bases.filter(Boolean).length,0);assert(m.inning<=m.app.innings);
 for(let i=0;i<15;i++){const {s,m}=game('投手',`closer-${i}`,'quick','closer');if(!A.test.simulateLive(s,m,ctx,true)){assert.equal(m.mode,'pitch');assert(m.inning>=9)}}
});
test('walks, hits, double plays, home runs and force plays maintain real base/score transitions',()=>{
 const {s,m}=game();m.half=0;m.pitching=true;m.bases=['team','team','team'];
 A.test.baseballOutcome(s,m,'walk',ctx);assert.equal(m.ag,1);assert.equal(m.player.er,1);assert.equal(m.player.walks,1);assert.equal(m.bases.filter(Boolean).length,3);
 A.test.baseballOutcome(s,m,'double',ctx);assert.equal(m.ag,3);assert.deepEqual(copy(m.bases),[null,'team','team']);assert.equal(m.player.hitsAllowed,1);
 A.test.baseballOutcome(s,m,'homer',ctx);assert.equal(m.ag,6);assert.deepEqual(copy(m.bases),[null,null,null]);
 m.bases=['team',null,'you'];m.outs=0;A.test.baseballOutcome(s,m,'force',ctx);assert.deepEqual(copy(m.bases),['team',null,'you']);assert.equal(m.outs,1);assert.equal(m.ag,6);
 m.bases=['you','team','auto'];A.test.baseballOutcome(s,m,'force',ctx);assert.deepEqual(copy(m.bases),['team','you','team']);assert.equal(m.outs,2);
 m.bases=[null,'you','team'];m.outs=0;A.test.baseballOutcome(s,m,'force',ctx);assert.deepEqual(copy(m.bases),[null,'you','team']);assert.equal(m.outs,1);
 m.bases=['team','you',null];m.outs=0;A.test.baseballOutcome(s,m,'dp',ctx);assert.equal(m.outs,2);assert.deepEqual(copy(m.bases),[null,'you',null]);
});
test('one-year offers cannot be shortened or lose money, RNG, or their negotiation opportunity',()=>{
 for(const sport of [0,2])for(const age of [26,36]){
  const s=E.create({sport,pos:sport===0?'投手':'控球後衛',seed:'contract-'+age});s.age=age;s.team=A.CONFIG[sport].teams[0][0];s.phase='contract';A.makeOffers(s,ctx);s.offers[0].years=1;s.offers[0].salary=3020;
  const before=JSON.stringify(s);assert.equal(E.arenaNegotiate(s,0,'short').ok,false);assert.equal(JSON.stringify(s),before);
  const card=UI.stage(s).match(/<article class="football-offer">[\s\S]*?<\/article>/)[0];assert(card.includes('已是一年合約'));assert(!card.includes("'short'"));assert(E.arenaNegotiate(s,0,'salary').ok);
 }
});
test('multi-year deals shorten once, survive reload/reopened market and sign with the actual year and salary',()=>{
 for(const sport of [0,2])for(const years of [2,3,4]){
  const s=E.create({sport,pos:sport===0?'投手':'控球後衛',seed:'short-'+years});s.age=26;s.team=A.CONFIG[sport].teams[0][0];assert(E.arenaMarket(s).ok);s.offers[0].years=years;s.offers[0].salary=1000;s.arena.marketOffers=copy(s.offers);
  assert(UI.stage(s).includes(`${years} 年 → 1 年`));assert(E.arenaNegotiate(s,0,'short').ok);assert.equal(s.offers[0].years,1);assert.equal(s.offers[0].salary,900);
  const saved=JSON.stringify(s);assert.equal(E.arenaNegotiate(s,0,'short').ok,false);assert.equal(JSON.stringify(s),saved);
  const loaded=E.migrate(copy(s));E.arenaMarketClose(loaded);E.arenaMarket(loaded);assert.equal(loaded.offers[0].years,1);assert.equal(loaded.offers[0].salary,900);assert(loaded.offers[0].negotiated);assert(E.sign(loaded,0).ok);assert.equal(loaded.yearsLeft,1);assert.equal(loaded.salary,900);
 }
});
test('live match state survives save/load and UI uses the actual occupied bases and prior PAs',()=>{
 for(let seed=0;seed<10;seed++){
  const s=E.create({sport:0,pos:'投手',seed:`saved-bases-${seed}`,pace:'full'});s.phase='ready';E.advance(s);if(s.phase!=='arena-moment')continue;
  const saved=copy(s),legacy=copy(s);delete legacy.arena.season.moment.match.recentPlateAppearances;delete legacy.arena.season.live.recentPlateAppearances;assert.doesNotThrow(()=>E.migrate(legacy));const corrupt=copy(s);corrupt.arena.season.moment.match.recentPlateAppearances=[{label:'invalid'}];assert.throws(()=>E.migrate(corrupt));const loaded=E.migrate(saved);assert.deepEqual(copy(loaded.arena.season.moment),saved.arena.season.moment);assert.equal(loaded.rng,s.rng);
  const html=UI.stage(loaded),m=loaded.arena.season.moment.match;assert(html.includes('這個局面怎麼形成'));assert.equal((html.match(/class="occupied"/g)||[]).length,m.bases.filter(Boolean).length);
  E.arenaAuto(s);E.arenaAuto(loaded);assert.deepEqual(snapshot(s.arena.season.highlight.match),snapshot(loaded.arena.season.highlight.match));E.validate(loaded);
 }
});
