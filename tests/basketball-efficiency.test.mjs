import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const m=await import(moduleUrl('lib/basketball-efficiency.ts')),n=await import(moduleUrl('lib/nba.ts')),w=await import(moduleUrl('lib/wnba.ts')),presentation=await import(moduleUrl('lib/nba-analysis.ts'));
const now=Date.parse('2026-09-29T16:00:00Z'),read=p=>JSON.parse(readFileSync(p,'utf8'));
function fixture(league){const lower=league.toLowerCase(),parse=league==='NBA'?n.parseNbaEvents:w.parseWnbaEvents,ids=league==='NBA'?['2','5']:['16','20'],game=parse(read(`tests/fixtures/${lower}/${league==='NBA'?'future':'day-20260930'}.json`)).find(g=>g.id===(league==='NBA'?'401898392':'401918019')),history=ids.flatMap(id=>[2,3].flatMap(p=>parse(read(`tests/fixtures/${lower}/team-${id}-2026-${p}.json`),id))),raw=read(`tests/fixtures/basketball-efficiency/${lower}-boxes.json`),games=[...new Map(ids.flatMap(id=>m.efficiencyHistory(game,history,id,league,now)).map(g=>[g.id,g])).values()],boxes=games.map(g=>m.parseEfficiencyBox(raw[g.id],g,league));return {game,history,boxes,raw,games};}
const nba=fixture('NBA'),wnba=fixture('WNBA');
const {fetchEfficiencyBox}=await import(moduleUrl('lib/basketball-box-source.ts'));
// ESPN public Core capture, 2026-10-13: this summary returns 404, but the
// complete original game still exists in the competition/statistics records.
const coreFixture=read('tests/fixtures/basketball-efficiency/nba-core-401873343.json');
const coreGame=nba.games.find(g=>g.id==='401873343');
function coreResponse(url,data=coreFixture){
 const u=new URL(url),base='/v2/sports/basketball/leagues/nba/events/401873343/competitions/401873343';
 assert.equal(u.hostname,'sports.core.api.espn.com');assert.equal(u.protocol,'https:');
 if(u.pathname===base)return Response.json(data.competition);
 if(u.pathname===base+'/status')return Response.json(data.status);
 const match=u.pathname.slice(base.length).match(/^\/competitors\/(5|18)\/(score|linescores|statistics)$/);
 assert.ok(match,'Unexpected Core request: '+u.pathname);return Response.json(data[match[1]][match[2]]);
}
const metrics=(patch={})=>({games:20,ortg:110,drtg:110,pace:100,threePct:.35,threeRate:.4,ftRate:.25,observations:Array.from({length:20},(_,i)=>({offense:110+(i%2?4:-4),defense:110+(i%2?5:-5),three:.35+(i%2?.04:-.04),freeThrows:.25+(i%2?.03:-.03),margin:i%2?10:-10})),...patch});
test('weights normalize to 100%, reject zero/non-finite/out-of-range and share keys for equivalent ratios',()=>{assert.deepEqual(m.normalizedWeights([20,20,20,20,20]),[.2,.2,.2,.2,.2]);assert.equal(m.weightKey([20,20,20,20,20]),m.weightKey([10,10,10,10,10]));for(const value of ['0,0,0,0,0','1,2,3','NaN,20,20,20,20','101,0,0,0,0',',20,20,20,20','-1,20,20,20,20'])assert.throws(()=>m.parseWeights(value));});
test('document golden formula uses alpha 4, HCA 2.5 and sigma 10.5 identically for NBA and WNBA',()=>{for(const league of ['NBA','WNBA']){const p=m.projectEfficiency(metrics(),metrics(),league,false);assert.equal(p.home,112.5);assert.equal(p.away,110);assert.equal(p.finalPace,100);assert.equal(p.adjustment,0);assert.equal(p.alpha,4);assert.equal(p.hca,2.5);assert.equal(p.sigma,10.5);const neutral=m.projectEfficiency(metrics(),metrics(),league,true);assert.equal(neutral.home,neutral.away);}});
test('pace weight is applied to final scores; defense adjustment has the correct sign and is zero-sum',()=>{const p=m.projectEfficiency(metrics(),metrics(),'NBA',false,[0,0,0,0,100]);assert.equal(p.finalPace,108);assert.equal(p.home,121.5);assert.equal(p.away,118.8);const d=m.projectEfficiency(metrics({drtg:100}),metrics(),'NBA',true,[0,100,0,0,0]);assert.ok(d.adjustment>0);assert.equal(d.home+d.away,d.baselineHome+d.baselineAway);assert.ok(d.home>d.baselineHome&&d.away<d.baselineAway);});
test('standardized three-point differences are invariant to percent vs proportion scale',()=>{const h=metrics({threePct:.4}),a=metrics();const p=m.projectEfficiency(h,a,'NBA',true,[0,0,100,0,0]),scale=x=>({...x,threePct:x.threePct*100,observations:x.observations.map(r=>({...r,three:r.three*100}))}),q=m.projectEfficiency(scale(h),scale(a),'NBA',true,[0,0,100,0,0]);assert.ok(Math.abs(p.home-q.home)<1e-10);});
test('10,000 normal-margin simulations are deterministic, complementary and close to the one-sigma normal probability',()=>{const r=m.simulateMargin(10.5,10.5,'golden');assert.deepEqual(r,m.simulateMargin(10.5,10.5,'golden'));assert.equal(r.iterations,10000);assert.equal(r.homeWins+r.awayWins,10000);assert.ok(Math.abs(r.home-.8413447)<.015);assert.equal(m.simulateMargin(0,10.5,'golden').home,.5);assert.equal(m.simulateMargin(-10.5,10.5,'golden').home,r.away);assert.ok(r.marginP10<r.marginP50&&r.marginP50<r.marginP90);});
test('all 78 actual box scores reconcile points, teams, leagues and overtime-normalized possessions',()=>{assert.equal(nba.boxes.length+wnba.boxes.length,78);for(const [league,f,minutes] of [['NBA',nba,48],['WNBA',wnba,40]]){for(const b of f.boxes){assert.equal(b.league,league);assert.ok(b.minutes>=minutes);assert.ok(b.possessions>0);}assert.ok(f.boxes.some(b=>b.minutes>minutes));}const b=wnba.boxes[0],expected=([b.home,b.away].reduce((sum,t)=>sum+t.fga+.44*t.fta-t.oreb+t.turnovers,0))/2;assert.equal(b.possessions,expected);});
test('source mismatch, missing stats and inconsistent final points fail closed',()=>{const g=nba.games[0],raw=structuredClone(nba.raw[g.id]);assert.throws(()=>m.parseEfficiencyBox(raw,g,'WNBA'));delete raw.boxscore.teams[0].statistics;assert.throws(()=>m.parseEfficiencyBox(raw,g,'NBA'));assert.throws(()=>m.parseEfficiencyBox(nba.raw[g.id],{...g,homeScore:g.homeScore+1},'NBA'));});
test('both leagues produce document-model rates, correct shared recommendations, and reject missing boxes or stale weights',()=>{for(const [league,f] of [['NBA',nba],['WNBA',wnba]]){const a=m.analyzeEfficiency(f.game,f.history,f.boxes,league,undefined,now);assert.equal(a.status,'ready');assert.equal(a.simulation.sigma,10.5);assert.equal(a.simulation.iterations,10000);assert.equal(a.probabilities.home,a.simulation.homeWins/10000);assert.equal(a.probabilities.home+a.probabilities.away,1);assert.equal(a.inputs.calculation.hca,f.game.neutral?0:2.5);const report={game:f.game,analysis:a,sourceFetchedAt:new Date(now).toISOString()};assert.ok(presentation.readyNbaAnalysis(f.game,report,now,false,m.weightKey([20,20,20,20,20])));assert.equal(presentation.readyNbaAnalysis(f.game,report,now,false,m.weightKey([0,0,0,0,100])),null);const pick=presentation.nbaPick(f.game,a);assert.equal(pick.probability,Math.max(a.probabilities.home,a.probabilities.away));assert.throws(()=>m.analyzeEfficiency(f.game,f.history,f.boxes.slice(1),league,undefined,now));assert.equal(m.analyzeEfficiency({...f.game,state:'live'},f.history,f.boxes,league,undefined,now).status,'waiting');}});
test('failed efficiency source cannot silently fall back to old-score forecasts',async()=>{
 const original=fetch,oldNow=Date.now;Date.now=()=>now;let calls=0;
 globalThis.fetch=async input=>{calls++;const id=new URL(input).searchParams.get('event');if(id===nba.games.at(-1).id)return new Response('',{status:503});return Response.json(nba.raw[id]);};
 try{const source=await import(moduleUrl('lib/basketball-efficiency-source.ts')+'#failure');await assert.rejects(source.efficiencyGameAnalysis(nba.game,nba.history,'NBA'));await new Promise(r=>setImmediate(r));assert.equal(calls,nba.boxes.length+1);}finally{globalThis.fetch=original;Date.now=oldNow;}
});

test('404 summary recovers the exact historical box, including team turnovers, from ESPN Core',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async url=>{calls.push(url);return new URL(url).hostname==='site.api.espn.com'?new Response('',{status:404}):coreResponse(url);});
 const actual=await fetchEfficiencyBox(coreGame,'NBA'),golden=m.parseEfficiencyBox(nba.raw[coreGame.id],coreGame,'NBA');
 assert.deepEqual(actual,golden);assert.equal(actual.home.turnovers,18);assert.equal(actual.away.turnovers,15);assert.equal(calls.length,9);
});

test('missing summary no longer drops a game or breaks the complete recent-20 analysis',async t=>{
 t.mock.method(Date,'now',()=>now);let recovered=0;
 t.mock.method(globalThis,'fetch',async url=>{
  const u=new URL(url);if(u.hostname==='sports.core.api.espn.com'){recovered++;return coreResponse(url);}
  const id=u.searchParams.get('event');return id===coreGame.id?new Response('',{status:404}):Response.json(nba.raw[id]);
 });
 const source=await import(moduleUrl('lib/basketball-efficiency-source.ts')+'#core-recovery');
 const actual=await source.efficiencyGameAnalysis(nba.game,nba.history,'NBA'),expected=m.analyzeEfficiency(nba.game,nba.history,nba.boxes,'NBA',undefined,now);
 assert.deepEqual(actual,expected);assert.equal(actual.homeForm.games,20);assert.equal(actual.awayForm.games,20);assert.equal(recovered,8);
});

test('Core recovery refuses inconsistent identities, scores, periods, partial stats and untrusted references',async t=>{
 const stat=(d,name)=>d['5'].statistics.splits.categories.flatMap(c=>c.stats).find(s=>s.name===name);
 const changes=[
  d=>d.competition.id='999',d=>d.competition.uid=d.competition.uid.replace('l:46','l:59'),d=>d.competition.date='2026-05-25T00:00Z',
  d=>d.competition.neutralSite=true,d=>d.competition.competitors[0].id='18',d=>d.competition.status.$ref='https://example.test/status',
  d=>d['5'].statistics.team.$ref=d['5'].statistics.team.$ref.replace('teams/5','teams/18'),
  d=>d['5'].statistics.competition.$ref=d['5'].statistics.competition.$ref.replaceAll('401873343','401873344'),
  d=>d['5'].statistics.splits.type='home',d=>d['5'].score.value=109,d=>d['5'].linescores.items[0].value++,
  d=>d['5'].linescores.items[0].period=2,d=>d['5'].linescores.pageCount=2,d=>d.status.period=5,
  d=>d.status.type.completed=false,d=>stat(d,'points').value=109,d=>stat(d,'fieldGoalsMade').value=41,
  d=>stat(d,'totalTurnovers').value=null,d=>stat(d,'freeThrowsAttempted').value=NaN,
 ];
 let current;t.mock.method(globalThis,'fetch',async url=>new URL(url).hostname==='site.api.espn.com'?new Response('',{status:404}):coreResponse(url,current));
 for(const change of changes){current=structuredClone(coreFixture);change(current);await assert.rejects(fetchEfficiencyBox(coreGame,'NBA'));}
});

test('Core is not used for forbidden requests, transient failures, invalid JSON or conflicting summary data',async t=>{
 let calls;t.mock.method(globalThis,'fetch',async url=>{assert.equal(new URL(url).hostname,'site.api.espn.com');calls++;return reply();});
 let reply;
 for(const [response,count] of [[()=>new Response('',{status:403}),1],[()=>new Response('',{status:503}),2],[()=>new Response('not JSON'),1],[()=>Response.json({...nba.raw[coreGame.id],header:{id:'wrong'}}),1]]){
  calls=0;reply=response;await assert.rejects(fetchEfficiencyBox(coreGame,'NBA'));assert.equal(calls,count);
 }
});
