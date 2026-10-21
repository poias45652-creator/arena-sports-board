import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base=new URL('../public/game-life/',import.meta.url),ctx=vm.createContext({console}),copy=x=>JSON.parse(JSON.stringify(x));
for(const [,url]of fs.readFileSync(new URL('index.html',base),'utf8').matchAll(/<script src="([^"]+)"/g)){const f=url.split('?')[0].split('/').pop();if(f==='app.js')continue;let code=fs.readFileSync(new URL(f,base),'utf8');if(f==='engine.js')code=code.replace('const api={','const api={context:footballContext,');vm.runInContext(code,ctx,{filename:f})}
const {XZEngine:E,XZOrigins:O,XZLeagues:G,XZFootball:F,XZArena:A,XZMoments:M}=ctx;
const player=(sport,country,seed='country-'+sport+country)=>E.create({sport,country,pos:['投手','前鋒','控球後衛'][sport],seed,pace:'quick',length:'short'});
test('all 15 country/sport choices start in the chosen country and play only its league opponents',()=>{
 for(const sport of [0,1,2])for(const country of O.COUNTRIES){
  const s=player(sport,country),l=O.current(s),api=sport===1?F:A;assert.equal(l.country,country);assert.equal(s.origin.country,country);assert.equal(l.division,l.tier===0&&O.ladders(sport,country).length===1?1:2);assert.equal(l.teams.length,8);assert.equal(new Set(l.teams).size,8);
  const before=copy(s);assert.deepEqual(copy(E.migrate(copy(s))),before);api.makeOffers(s,E.context());assert(s.offers.every(o=>O.current(s,o.team)?.country===country));
  s.phase='ready';assert(api.beginSeason(s,E.context()).ok);const season=(sport===1?s.football:s.arena).season;assert.equal(season.team,s.team);for(const row of season.table)assert.equal(O.current(s,row.team)?.id,l.id);E.validate(s);
  assert(G.panel(s,E.ovr(s)).includes(l.name));
 }
});
test('exceptionally strong debutants skip development but an established career is never relocated',()=>{
 for(const sport of [0,1,2])for(const country of ['日本','韓國','美國','西班牙']){
  const s=player(sport,country);s.a=[89,89,89,89];s.caps=[99,99,99,99];s.potential=99;s.phase='ready';assert((sport===1?F:A).beginSeason(s,E.context()).ok);assert.equal(O.current(s).division,1);assert.equal(O.current(s).country,country);E.validate(s);
  const established=player(sport,country);established.history=[{age:16,team:established.team,o:45,pay:20,stats:'完整一季'}];const before=copy(established);assert.equal(O.debut(established,99),false);assert.deepEqual(copy(established),before);
 }
});
test('legacy saves retain their school start, live season, country and contract without origin migration',()=>{
 for(const sport of [0,1,2]){
  const s=player(sport,'美國');delete s.origin;s.team='高中校隊';s.salary=0;s.yearsLeft=0;s.clubs={};const before=copy(s);assert.deepEqual(copy(E.migrate(copy(s))),before);assert.equal(G.professional(s),false);
  const api=sport===1?F:A;s.phase='ready';api.beginSeason(s,E.context());const active=copy(s);assert.deepEqual(copy(E.migrate(copy(s))),active);
 }
});
test('major choices can substantially improve or damage actual abilities and animate the real result',()=>{
 for(const sport of [0,1,2]){
  const event=ctx.XZCrossroads.EVENTS.find(e=>e.sport===sport),seen=new Set();
  for(let seed=0;seed<60&&seen.size<2;seed++){
   const s=player(sport,'台灣','turning-'+seed);s.a=[55,55,55,55];s.caps=[99,99,99,99];s.health=80;s.mood=65;s.morale=65;s.phase='event';s.event=event.id;s.eventsLeft=1;
   const before=M.snapshot(s);assert(E.choose(s,0).ok);seen.add(s.outcome.success);const delta=s.a[event.options[0].stat]-55;assert(s.outcome.success?delta>=14:delta<=-12);assert(s.outcome.major);assert(M.detect(before,s).some(e=>e.detail===s.outcome.detail));assert.deepEqual(copy(E.migrate(copy(s))),copy(s));E.validate(s);
  }
  assert.equal(seen.size,2);
 }
});
test('the first scene is not a forced objective, and family meetings are neither mandatory nor removed',()=>{
 for(const sport of [0,1,2]){
  const first=new Set(),familyCounts=[0,0];
  for(let i=0;i<60;i++){
   const s=player(sport,'台灣','random-open-'+i);E.seasonGoal(s,'growth');E.seasonTraining(s,'rest');first.add(s.event||s.outcome?.fateId);
   const older=player(sport,'台灣','random-meet-'+i);older.age=20;E.advance(older);const ids=[older.event];E.choose(older,1);E.advance(older);ids.push(older.event);familyCounts[ids.includes('family-meet')?1:0]++;
  }
  assert(first.size>=25);assert(familyCounts.every(n=>n>5));
 }
});
test('foreign starts finish actual paid seasons, preserve reloads and can sign earned overseas offers',()=>{
 for(const [sport,country]of [[0,'日本'],[1,'西班牙'],[2,'美國']]){
  const s=player(sport,country,'foreign-full-'+sport),team=s.team,pay=s.salary;let turns=0;
  while(s.history.length<1&&turns++<50){let r;if(s.care?.active)r=s.care.active.stage==='decision'?E.careChoice(s,'team'):E.careRecover(s,s.care.active.kind==='surgery'?'rehab':'therapy');else if(s.phase==='train')r=E.seasonTraining(s,'rest');else if(s.phase==='event')r=E.choose(s,1);else if(s.phase==='arena-moment')r=E.arenaAuto(s);else if(s.phase==='football-moment')r=E.footballAuto(s);else r=E.advance(s);assert(r.ok,s.phase)}
  assert.equal(s.history.length,1);assert.equal(s.history[0].team,team);assert.equal(s.history[0].pay,pay);assert.equal(s.money>=pay,true);assert.deepEqual(copy(E.migrate(copy(s))),copy(s));
  s.age=20;s.a=[85,85,85,85];s.caps=[99,99,99,99];const hub=sport===1?s.football:s.arena;hub.season.age=20;hub.season.complete=true;Object.assign(hub.season.player,[{apps:25,outs:180,er:15,k:80},{apps:14,ratingSum:110},{apps:28,pts:800,reb:320,ast:230}][sport]);
  for(let i=0;i<1000&&G.report(s,85).invited!==2;i++)s.seed='foreign-scout-'+i;
  (sport===1?F:A).makeOffers(s,E.context(),true);const index=s.offers.findIndex(o=>(O.current(s,o.team)?.country||F.LEAGUES.find(l=>l.id===o.league)?.country)!==country);assert(index>=0,`sport ${sport} has an overseas offer after a strong season`);const offer=copy(s.offers[index]);s.phase='contract';assert(E.sign(s,index).ok);assert.equal(s.team,offer.team);assert.equal(s.salary,offer.salary);assert.equal(s.origin.country,country);E.validate(s);
 }
});

test('switching sports keeps only supported domestic countries, including Korea',()=>{
 const elements=Object.fromEntries(['journey-panel','football-profile','country','position','football-archetype'].map(id=>[id,{innerHTML:'',value:id==='country'?'韓國':id==='position'?'前鋒':'',classList:{toggle(){}}}]));
 ctx.document={getElementById:id=>elements[id]};
 for(const sport of [0,1,2,0]){ctx.XZFootballUI.setup(sport);assert.deepEqual([...elements.country.innerHTML.matchAll(/<option value="(.*?)">.*?<\/option>/g)].map(x=>x[1]),['random',...copy(O.COUNTRIES)]);assert.equal(elements.country.value,'韓國')}
 delete ctx.document;
});
