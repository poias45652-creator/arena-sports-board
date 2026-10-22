import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base=new URL('../public/game-life/',import.meta.url),ctx=vm.createContext({console});
for(const [,url]of fs.readFileSync(new URL('index.html',base),'utf8').matchAll(/<script src="([^"]+)"/g)){
 const file=url.split('?')[0].split('/').pop();
 if(file!=='app.js')vm.runInContext(fs.readFileSync(new URL(file,base),'utf8'),ctx,{filename:file});
}
const {XZEngine:E,XZArena:A,XZFootball:F,XZStadium:S,XZMatchStory:M,XZFocus:UI}=ctx;
const copy=x=>JSON.parse(JSON.stringify(x));
function player(sport=0){return E.create({sport,pos:['投手','前鋒','控球後衛'][sport],seed:'rules-proof',pace:'full',length:'career',country:'美國'})}
function pitching(){for(let seed=0;seed<80;seed++){const s=E.create({sport:0,pos:'投手',seed:'pitch-proof-'+seed,pace:'full',length:'career'});s.phase='ready';E.advance(s);if(s.phase==='arena-moment'&&s.arena.season.moment.match.mode==='pitch')return s}throw Error('No pitching fixture')}

test('baseball preview and replay color the fielding team and runners by current role',()=>{
 for(const mode of ['bat','pitch','field'])for(const animated of [false,true]){
  const html=S.frame({sport:0,mode,number:17,bases:['runner',null,null],outs:0,success:true,gain:0,lost:0},{animated});
  assert(html.includes('is-you'));
  assert(html.includes(`tactical-player ${mode==='bat'?'teammate':'opponent'} runner`));
  assert(html.includes(`tactical-player ${mode==='bat'?'opponent':'teammate'} catcher`));
  const opponents=(html.match(/tactical-player opponent/g)||[]).length;
  assert.equal(opponents,mode==='bat'?8:2);
 }
});

test('double-play choices and settled outs agree for every base mask and out count',()=>{
 const original=pitching();
 for(let mask=0;mask<8;mask++)for(let outs=0;outs<3;outs++){
  const s=copy(original),m=s.arena.season.moment.match;
  m.bases=[0,1,2].map(i=>mask&(1<<i)?'opp':null);m.outs=outs;
  const possible=!!(mask&1)&&outs<2;
  for(const mode of ['pitch','field']){
   m.mode=mode;const choices=A.momentOptions(s,m),c=choices.find(c=>['ground','double'].includes(c.kind));
   assert.equal(M.results(s,c,m)[0].includes('雙殺'),possible);
   assert.equal(c.hint.includes('雙殺'),possible);
   if(mode==='field')assert.equal(c.label.includes('雙殺'),possible);
  }
  m.mode='pitch';
  const successContext={int:()=>1,random:()=>0,log(){},apply(state,effect){for(const key of ['energy','health','morale','mood','chemistry'])if(effect[key])state[key]=Math.max(0,Math.min(100,state[key]+effect[key]))}};
  assert(A.chooseMoment(s,2,successContext).ok);
  assert.equal(s.arena.season.highlight.success,true);
  assert.equal(m.outs-outs,possible?2:1);
  assert(m.outs<=3);
 }
});

test('national teams have a hard ability gate, including direct and chained story invitations',()=>{
 for(const sport of [0,1,2]){
  const s=player(sport),engine=sport===1?F:A;s.age=24;s.a=[25,25,25,25];s.fame=10000;s.awards=20;
  assert.equal(engine.nationalEligibility(s).eligible,false);
  assert.equal(E.eligible(s,E.byId['p-national']),false);
  s.phase='event';s.event='national-final';s.eventsLeft=2;
  const raw=JSON.stringify(s);assert.equal(E.choose(s,0).ok,false);assert.equal(JSON.stringify(s),raw);
  const restored=E.migrate(copy(s));assert.notEqual(restored.event,'national-final');E.validate(restored);
  s.a=[99,99,99,99];s.caps=[99,99,99,99];assert.equal(engine.nationalEligibility(s).eligible,true);
  s.age=17;assert.equal(engine.nationalEligibility(s).eligible,false);
 }
});

test('an outdated national invitation is removed on reload or selection without caps or rewards',()=>{
 for(const sport of [0,1,2]){
  const s=player(sport);s.age=24;s.a=[25,25,25,25];s.caps=[99,99,99,99];s.phase='ready';E.advance(s);
  const hub=sport===1?s.football:s.arena;hub.season.complete=true;
  hub.nationalOffer={year:2034,competition:'世界國家盃'};s.phase=sport===1?'football-national':'arena-national';
  const national=copy(hub.national),money=s.money;
  const restored=E.migrate(copy(s)),restoredHub=sport===1?restored.football:restored.arena;
  assert.equal(restoredHub.nationalOffer,null);assert.notEqual(restored.phase,s.phase);assert.deepEqual(copy(restoredHub.national),national);assert.equal(restored.money,money);E.validate(restored);
  assert((sport===1?E.footballNational(s,true):E.arenaNational(s,0)).ok);
  assert.equal(hub.nationalOffer,null);assert.deepEqual(copy(hub.national),national);
 }
});

test('all event and seasonal choices are rendered without a collapsed extra-options group',()=>{
 const items=Array.from({length:7},(_,i)=>`<button onclick="choose(${i})">選項${i}</button>`),html=UI.choices(items);
 assert.equal((html.match(/<button/g)||[]).length,7);assert(!html.includes('<details'));
});
