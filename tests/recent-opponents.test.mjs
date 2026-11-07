import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const form=await import(moduleUrl('lib/recent-opponents.ts'));
const football=await import(moduleUrl('lib/football-match-context.ts'));
const {footballDistribution}=await import(moduleUrl('lib/football.ts'));
const {multifactorWin}=await import(moduleUrl('lib/multifactor-win.ts'));
const {buildRunAnalysis}=await import(moduleUrl('lib/baseball-run-analysis.ts'));
const {defaultBaseballSettings}=await import(moduleUrl('lib/baseball-model-settings.ts'));
const {parseBaseballAbsences,mlbReportedAbsences}=await import(moduleUrl('lib/baseball-match-context.ts'));
const day=86400000,now=Date.parse('2026-09-20T04:00:00Z'),start=new Date(now+day).toISOString();
const summary=(rating)=>({games:8,wins:4,ties:0,ratedOpponents:8,rating,latest:new Date(now-day).toISOString()});
const evidence={asOf:new Date(now).toISOString(),home:summary(.7),away:summary(.3),absences:{home:[],away:[{name:'傷員',weight:1}],source:'test',checkedAt:new Date(now).toISOString()}};
const row=(n,home,away,win)=>({id:String(n),at:now-(30-n)*day,home,away,homeScore:win?2:0,awayScore:1});
test('same results against stronger opponents increase form, preserving the pregame cutoff and unique fixtures',()=>{
 const pool=[];
 for(let i=0;i<6;i++)pool.push(row(i,'strong','other'+i,true),row(i+6,'weak','other'+i,false));
 for(let i=0;i<4;i++)pool.push(row(i+12,'h','strong',true),row(i+16,'a','weak',true));
 const result=form.recentOpponents(pool,'h','a',now,60);
 assert.ok(result.home.rating>result.away.rating);
 assert.equal(result.home.ratedOpponents,4);
 assert.deepEqual(form.recentOpponents([...pool,...pool,row(32,'h','weak',false)],'h','a',now,60),result);
 assert.equal(form.recentOpponents([], 'h','a',now,60).home,null);
});
test('injuries change soccer probabilities and all score markets share the adjusted grid',()=>{
 const game={state:'scheduled',league:'ita.1',id:'x',start,home:{id:'h'},away:{id:'a'}};
 const base={status:'ready',version:'test',notes:[],...footballDistribution(1.2,1.2)};
 const adjusted=football.withFootballMatchContext(game,base,[],evidence.absences,now);
 assert.ok(adjusted.probabilities.home>base.probabilities.home);
 const grid=adjusted.scoreDistribution.scores,p=sum=>grid.filter(sum).reduce((n,s)=>n+s.probability,0);
 assert.ok(Math.abs(p(()=>true)-1)<1e-10);
 assert.equal(p(s=>s.home>s.away),adjusted.probabilities.home);
 assert.equal(p(s=>s.home+s.away>2),adjusted.probabilities.over25);
 assert.equal(football.withFootballMatchContext({...game,state:'final'},base,[],evidence.absences,now),base);
 assert.deepEqual(football.withFootballMatchContext(game,base,[],null,now).probabilities,base.probabilities);
});
test('both baseball model families use recent results and injury reports, while old snapshots keep their baseline',()=>{
 const team=id=>({id,wins:40,losses:40,pitcherId:id+10,pitcherEra:3,pitcherWhip:1});
 const game={id:1,season:2026,date:start,home:team(1),away:team(2)};
 const base=multifactorWin(game,undefined,now);
 const recent=multifactorWin({...game,matchEvidence:{...evidence,absences:null}},undefined,now);
 assert.ok(recent.homeWin>base.homeWin);
 assert.ok(multifactorWin({...game,matchEvidence:evidence},undefined,now).homeWin>recent.homeWin);
 const fixture=JSON.parse(readFileSync('data/npb-pregame-20260920.json')).games[3];
 const settings=defaultBaseballSettings();
 for(const family of ['multifactor','innings']){
   settings.moneyline=family;
   const before=buildRunAnalysis(fixture,now,'NPB',false,settings),after=buildRunAnalysis({...fixture,matchEvidence:evidence},now,'NPB',false,settings);
   assert.ok(after.win.home>before.win.home);
   assert.ok(Math.abs(after.win.home+after.win.away+after.win.draw-1)<1e-9);
   assert.notEqual(after.version,before.version);
 }
 const expired=new Date(now-2*day).toISOString();
 assert.equal(form.pregameEvidence({...evidence,asOf:expired,absences:{...evidence.absences,checkedAt:expired}},now,now+day),undefined);
});
test('Asian baseball reports require a recent dated player and team; activated players do not count',()=>{
 const tr=(status,slug,date)=>`<tr data-status="${status}" data-team="/en/team/${slug}/" data-pos="IF" data-k-player="P" data-k-checked="${date}">`;
 for(const [league,slug,code] of [['NPB','npb-sbh','h'],['CPBL','cpbl-ul','ADD'],['KBO','kbo-ds','OB']]){
   const parse=(status,date)=>parseBaseballAbsences(tr(status,slug,date),league,now);
   assert.equal(parse('OUT','2026-09-19').get(code).size,1);
   assert.equal(parse('AVAILABLE','2026-09-19').size,0);
   assert.equal(parseBaseballAbsences(tr('IL',slug,'2026-09-18')+tr('RETURNED',slug,'2026-09-19'),league,now).size,0);
   assert.equal(parse('OUT','2026-08-10').size,0);
   assert.equal(parse('OUT','2026-09-23').size,0);
 }
});
test('MLB injury report rejects wrong teams and stale reports and a later return supersedes an injury',()=>{
 const player={displayName:'P',team:{id:'29',abbreviation:'ARI'},position:{abbreviation:'RF'}};
 const injury={athlete:player,status:'Out',details:{type:'Elbow'},date:new Date(now-86400000).toISOString()};
 const group={id:'29',displayName:'Arizona Diamondbacks',injuries:[injury]};
 const raw={status:'success',timestamp:new Date(now).toISOString(),season:{year:2026},injuries:[group]};
 const game={season:2026,date:start,home:{id:109,name:group.displayName},away:{id:147,name:'New York Yankees'}};
 assert.equal(mlbReportedAbsences(raw,game,now).home.length,1);
 assert.equal(mlbReportedAbsences(raw,game,now).away,null);
 group.injuries.push({...injury,status:'Active',date:new Date(now).toISOString()});
 assert.equal(mlbReportedAbsences(raw,game,now).home.length,0);
 assert.equal(mlbReportedAbsences(raw,game,now+2*86400000),null);
});

test('partial or stale injury coverage cannot move either sport; an explicit empty list is comparable',()=>{
 const fixture=JSON.parse(readFileSync('data/npb-pregame-20260920.json')).games[3];
 const g={state:'scheduled',league:'ita.1',id:'x',start,home:{id:'h'},away:{id:'a'}};
 const b={status:'ready',version:'test',notes:[],...footballDistribution(1.2,1.2)};
 const unknown={...evidence.absences,home:null};
 const stale={...evidence.absences,checkedAt:new Date(now-7200000).toISOString()};
 for(const report of [unknown,{...unknown,home:unknown.away,away:null},stale]){
   const forecast=football.withFootballMatchContext(g,b,[],report,now);
   assert.deepEqual(forecast.probabilities,b.probabilities);
   assert.equal(forecast.contextForecast.injuryShiftApplied,false);
   assert.equal(forecast.contextForecast.injuryCoverage,report===stale?'none':'partial');
   for(const moneyline of ['multifactor','innings']){
     const settings={...defaultBaseballSettings(),moneyline};
     const neutral=buildRunAnalysis(fixture,now,'NPB',false,settings);
     const adjusted=buildRunAnalysis({...fixture,matchEvidence:{asOf:evidence.asOf,home:null,away:null,absences:report}},now,'NPB',false,settings);
     assert.deepEqual(adjusted.win,neutral.win);
     assert.equal(adjusted.personalModel.multifactor.coverage,neutral.personalModel.multifactor.coverage);
   }
 }
 const complete=football.withFootballMatchContext(g,b,[],evidence.absences,now);
 assert.equal(complete.contextForecast.injuryCoverage,'both');
 assert.equal(complete.contextForecast.injuryShiftApplied,true);
 assert.deepEqual(complete.contextForecast.baseline,complete.contextForecast.formOnly);
 assert.notDeepEqual(complete.probabilities,complete.contextForecast.formOnly);
});

test('the frozen score-model gate keeps German form inside the baseline and admits the verified Italian adjustment',()=>{
 const b={status:'ready',version:'football-market-v4-20260928',notes:[],...footballDistribution(1.4,1.1)};
 const g={state:'scheduled',id:'target',start,home:{id:'h'},away:{id:'a'}};
 const rows=Array.from({length:8},(_,i)=>({id:String(i),start:new Date(now-(i+1)*day).toISOString(),state:'final',statusName:'STATUS_FULL_TIME',home:{id:i%2?'h':'x'+i},away:{id:i%2?'y'+i:'a'},homeScore:2,awayScore:0}));
 const de=football.withFootballMatchContext({...g,league:'ger.1'},b,rows,null,now);
 const it=football.withFootballMatchContext({...g,league:'ita.1'},b,rows,null,now);
 assert.equal(de.contextForecast.formPolicy,'base');
 assert.equal(de.matchEvidence.home.games,4);
 assert.deepEqual(de.probabilities,b.probabilities);
 assert.equal(it.contextForecast.formPolicy,'recent');
 assert.ok(it.probabilities.home>b.probabilities.home);
 const combined=football.withFootballMatchContext({...g,league:'ita.1'},b,rows,evidence.absences,now);
 assert.deepEqual(combined.contextForecast.formOnly,it.probabilities);
 assert.ok(combined.probabilities.home>it.probabilities.home);
});
