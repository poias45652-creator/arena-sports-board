import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const settingsApi=await import(moduleUrl('lib/baseball-model-settings.ts'));
const {defaultBaseballSettings,parseBaseballSettings,rebalanceBaseballWeight,baseballSettingsKey,customBaseballSettings}=settingsApi;
const {mlbInningProjection,mlbSelectedWinner,mlbRunsFresh}=await import(moduleUrl('lib/mlb-model-analysis.ts'));
const {buildRunAnalysis,matchingRunAnalysis,analysisFixtureKey,marketOutcomes,inningRunRate}=await import(moduleUrl('lib/baseball-run-analysis.ts'));
const {settleBoard,makeBoardPick}=await import(moduleUrl('lib/board-markets.ts'));
const now=Date.parse('2026-09-20T04:00:00Z'),stamp=new Date(now).toISOString();
const game={id:1,date:'2026-09-20T07:00:00Z',season:2026,state:'Preview',status:'Scheduled',gameType:'R',startTimeTBD:false,away:{id:121,name:'紐約大都會',wins:90,losses:60,pitcherId:101,pitcherEra:2,pitcherWhip:1},home:{id:120,name:'華盛頓國民',wins:60,losses:90,pitcherId:102,pitcherEra:5,pitcherWhip:1.6}};
const runs={year:2026,league:4.5,source:'test-only',fetchedAt:stamp,rows:[{id:121,scored:760,allowed:600,batGames:150,pitchGames:150},{id:120,scored:600,allowed:750,batGames:150,pitchGames:150}]};
const report={game,capturedAt:stamp,features:{home_starter_recent_era:5,away_starter_recent_era:2},issues:[],context:{sides:{home:{lineupStatus:'confirmed'},away:{lineupStatus:'confirmed'}}}};
const npb=JSON.parse(readFileSync('data/npb-pregame-20260920.json','utf8')).games[3];
const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const all=(w,key)=>Object.fromEntries(Object.keys(w).map(k=>[k,k===key?100:0]));
const selected=(s,market='moneyline',g=game,r=report,time=now,schedule=true)=>mlbSelectedWinner(g,r,time,schedule,s,market,mlbInningProjection(g,runs,s.weights.innings),mlbRunsFresh(runs,'',time));
test('defaults retain starter 60% and settings are isolated by league and immutable',()=>{
 const s=defaultBaseballSettings();close(Object.values(s.weights.multifactor).reduce((a,b)=>a+b),100);close(s.weights.multifactor.starterEra+s.weights.multifactor.starterWhip+s.weights.multifactor.starterRecentEra,60);
 assert.equal(customBaseballSettings(parseBaseballSettings(JSON.stringify(s))),false);
 assert.notEqual(baseballSettingsKey('MLB'),baseballSettingsKey('NPB'));s.weights.innings.starter=1;assert.equal(defaultBaseballSettings().weights.innings.starter,60);
});
test('slider 0 and 100 remain finite, normalize the remaining budget, and do not mutate inputs',()=>{
 const s=defaultBaseballSettings(),original=structuredClone(s);let w=rebalanceBaseballWeight(s.weights.innings,'starter',100);close(w.starter,100);close(w.offense,0);w=rebalanceBaseballWeight(w,'starter',0);close(Object.values(w).reduce((a,b)=>a+b),100);assert.ok(Object.values(w).every(Number.isFinite));assert.deepEqual(s,original);
});
test('stored settings reject invalid/unknown/zero values and normalize positive raw ratios',()=>{
 for(const invalid of ['{bad',null,[],{...defaultBaseballSettings(),version:2},{...defaultBaseballSettings(),moneyline:'random'}])assert.equal(parseBaseballSettings(invalid),null);
 for(const invalid of [NaN,Infinity,-1,101,'50']){const s=defaultBaseballSettings();s.weights.innings.starter=invalid;assert.equal(parseBaseballSettings(s),null);}
 const s=defaultBaseballSettings();s.weights.innings={starter:0,offense:0,defense:0,bullpen:0};assert.equal(parseBaseballSettings(s),null);s.weights.innings={starter:3,offense:1,defense:1,bullpen:1};close(parseBaseballSettings(s).weights.innings.starter,50);s.weights.innings.extra=1;assert.equal(parseBaseballSettings(s),null);
});
test('MLB custom weights change the calculated winner; unavailable factors retain a neutral 50%',()=>{
 const s=defaultBaseballSettings(),base=selected(s);s.weights.multifactor=all(s.weights.multifactor,'starterEra');close(selected(s).homeWin,.125);assert.notEqual(base.homeWin,selected(s).homeWin);
 s.weights.multifactor=all(s.weights.multifactor,'weatherPark');close(selected(s).homeWin,.5);close(selected(s).coverage,0);assert.equal(selected(s).canRecommend,false);
});
test('MLB inning weights change score distributions, moneyline and separate zero-handicap selection',()=>{
 const s=defaultBaseballSettings();s.moneyline='innings';const p=mlbInningProjection(game,runs,s.weights.innings),i=selected(s),pk=selected(s,'fullGamePk');assert.notEqual(i.homeWin,pk.homeWin);close(i.homeWin,p.homeWin);
 s.weights.innings=all(s.weights.innings,'offense');const offense=mlbInningProjection(game,runs,s.weights.innings);assert.notEqual(p.runs.home,offense.runs.home);assert.notEqual(i.homeWin,selected(s).homeWin);
 s.fullGamePk='innings';close(selected(s).homeWin,selected(s,'fullGamePk').homeWin);
 const pick=makeBoardPick(game.id,'spread','home',{line:0,first:1,second:1,signature:'zero'});close(settleBoard(offense.full,pick,selected(s,'fullGamePk').homeWin).win,selected(s).homeWin);
 for(const grid of [p.full,p.half,offense.full])close(grid.reduce((n,o)=>n+o.p,0),1);assert.ok(p.full.every(o=>o.home!==o.away));assert.ok(p.half.some(o=>o.home===o.away&&o.p>0));
});
test('MLB source gates survive both model families and independent full-game selections',()=>{
 for(const family of ['multifactor','innings']){const s=defaultBaseballSettings();s.moneyline=s.fullGamePk=family;
  for(const result of [selected(s,'moneyline',game,report,now,false),selected(s,'moneyline',game,{...report,capturedAt:new Date(now-300001).toISOString()}),selected(s,'moneyline',game,{...report,issues:['先發資料衝突']}),selected(s,'moneyline',{...game,home:{...game.home,pitcherId:999}},report),selected(s,'moneyline',game,report,Date.parse(game.date)),selected(s,'moneyline',{...game,home:{...game.home,pitcherWhip:null}},undefined)]){assert.equal(result.canEstimate,false);assert.equal(result.homeWin,null);}
 }
 const s=defaultBaseballSettings();s.moneyline='innings';assert.equal(mlbSelectedWinner(game,report,now,true,s,'moneyline',mlbInningProjection(game,runs,s.weights.innings),false).homeWin,null);assert.equal(mlbRunsFresh({...runs,fetchedAt:new Date(now-1500001).toISOString()},'',now),false);
});
test('all-starter innings weights do not divide by zero in extra innings',()=>{
 const s=defaultBaseballSettings();s.weights.innings=all(s.weights.innings,'starter');const p=mlbInningProjection(game,runs,s.weights.innings);assert.ok(p);close(p.full.reduce((n,o)=>n+o.p,0),1);
 assert.ok(Number.isFinite(inningRunRate({offense:4},{starterEra:3,defense:4,bullpenEra:5},10,s.weights.innings)));
});
test('NPB actual captured data responds to both families while retaining its draw mass',()=>{
 const s=defaultBaseballSettings(),multi=buildRunAnalysis(npb,now,'NPB',false,s);assert.equal(multi.status,'ready');assert.ok(multi.win.draw>0);close(multi.win.home+multi.win.away+multi.win.draw,1);
 s.moneyline='innings';const innings=buildRunAnalysis(npb,now,'NPB',false,s);assert.notEqual(multi.win.home,innings.win.home);close(multi.win.draw,innings.win.draw);
 s.weights.innings=all(s.weights.innings,'offense');const offense=buildRunAnalysis(npb,now,'NPB',false,s);assert.notEqual(innings.expected.home,offense.expected.home);assert.notEqual(innings.win.home,offense.win.home);
 s.moneyline='multifactor';s.weights.multifactor=all(s.weights.multifactor,'weatherPark');const neutral=buildRunAnalysis(npb,now,'NPB',false,s);close(neutral.win.home,neutral.win.away);assert.equal(neutral.personalModel.multifactor.coverage,0);
});
test('NPB moneyline, true PK and half-inning draws use their selected settlement without redirecting split lines',()=>{
 const s=defaultBaseballSettings(),r=buildRunAnalysis(npb,now,'NPB',false,s);
 const market=(period,type,homeLine='PK')=>({period,type,quotes:[{homeLine,awayLine:'',homePrice:'.95',awayPrice:'.95',primary:true,open:true}]});
 const g={id:1,home:npb.home.team,away:npb.away.team,displayMarkets:[market('full',111),market('full',103),market('firstHalf',103)]};
 const ml=marketOutcomes(g,'moneyline',r,true),pk=marketOutcomes(g,'spread',r,true);assert.equal(ml.length,2);assert.equal(pk.length,2);close(ml[0].result.win,pk[0].result.win);close(pk[0].result.push,r.win.draw);assert.ok(marketOutcomes(g,'firstHalfSpread',r,true)[0].result.push>0);
 s.fullGamePk='innings';const other=buildRunAnalysis(npb,now,'NPB',false,s);assert.notEqual(marketOutcomes(g,'spread',other,true)[0].result.win,ml[0].result.win);close(marketOutcomes(g,'moneyline',other,true)[0].result.win,ml[0].result.win);assert.deepEqual(marketOutcomes(g,'moneyline',other,false),[]);
});
test('NPB changed starters, stale evidence and started games cannot reuse personal predictions',()=>{
 const s=defaultBaseballSettings(),r=buildRunAnalysis(npb,now,'NPB',false,s),reports=new Map([[analysisFixtureKey(r.fixture),r]]);
 for(const [fixture,time] of [[{...r.fixture,starters:{...r.fixture.starters,home:'已更換的投手'}},now],[r.fixture,now+3600000*48],[{...r.fixture,live:true},now]]){const blocked=matchingRunAnalysis(fixture,reports,time);assert.equal(blocked.win,null);assert.equal(blocked.grids,null);}
 const missing=structuredClone(npb);missing.home.starter.season.whip='';const unavailable=buildRunAnalysis(missing,now,'NPB',true,s);assert.equal(unavailable.personalModel.multifactor.homeWin,null);assert.equal(unavailable.win,null);
});
test('personal settings do not mutate source records or the default shared forecast',()=>{
 const before=JSON.stringify(npb),original=buildRunAnalysis(npb,now,'NPB');const s=defaultBaseballSettings();s.weights.innings=all(s.weights.innings,'offense');const custom=buildRunAnalysis(npb,now,'NPB',false,s);assert.ok(custom.personalModel);assert.equal(JSON.stringify(npb),before);assert.deepEqual(buildRunAnalysis(npb,now,'NPB'),original);assert.equal(original.personalModel,undefined);
});

test('an earlier WHIP observation cannot stay usable after its own freshness window expires',()=>{
 const g=structuredClone(npb);g.home.starter.statSources??={};g.home.starter.statSources.whip={observedAt:new Date(now-35.5*3600000).toISOString()};
 const r=buildRunAnalysis(g,now,'NPB',false,defaultBaseballSettings());assert.ok(r.personalModel.multifactor.homeWin!==null);
 const expired=matchingRunAnalysis(r.fixture,new Map([[analysisFixtureKey(r.fixture),r]]),now+31*60000);assert.equal(expired.win,null);assert.match(expired.reason,/多因子統計已過期/);
});


test('日職官方欄位更新後，未使用的舊備份不會讓全場讓分誤報多因子統計已過期',()=>{
 const g=structuredClone(npb),old=new Date(now-48*3600000).toISOString();
 g.source.observedAt=stamp;g.comparisonSource={observedAt:stamp};
 for(const side of ['home','away']){
  const t=g[side];t.retainedSource={...g.source,observedAt:old};
  t.starter.source={observedAt:stamp};
  t.starter.statSources=Object.fromEntries(['era','whip','innings'].map(field=>[field,{observedAt:stamp}]));
  t.bullpenSource={observedAt:stamp};
 }
 const before=JSON.stringify(g),r=buildRunAnalysis(g,now,'NPB',false,defaultBaseballSettings());
 const matched=matchingRunAnalysis(r.fixture,new Map([[analysisFixtureKey(r.fixture),r]]),now);
 assert.equal(matched.status,'ready');assert.ok(matched.win);assert.ok(matched.grids);
 assert.equal(matched.personalModel.multifactor.observedAt,stamp);
 assert.equal(matched.personalModel.multifactor.factors.find(f=>f.name===settingsApi.BASEBALL_FACTOR_LABELS.starterRecentEra).score,null);
 const fixture={...r.fixture,id:1,displayMarkets:[{period:'full',type:103,quotes:[{homeLine:'1+30',awayLine:'',homePrice:'.95',awayPrice:'.95',primary:true,open:true}]}]};
 const outcomes=marketOutcomes(fixture,'spread',matched,true);
 assert.equal(outcomes.length,2);assert.ok(outcomes.every(o=>Number.isFinite(o.result.win)&&o.result.win>0));
 assert.equal(JSON.stringify(g),before);
});

test('實際採用的先發公告與近期成績到期後仍須阻擋舊多因子結果',()=>{
 for(const dependency of ['announcement','recent']){
  const g=structuredClone(npb),old=new Date(now-35.5*3600000).toISOString();
  if(dependency==='announcement')g.home.starter.source={observedAt:old};
  else{
   for(const side of ['home','away']){
    const t=g[side];t.retainedSource={...g.source,observedAt:old};
    t.starter.recent={headers:['日期','投球局','責失'],rows:[['2026-09-18','6','2'],['2026-09-12','6','1'],['2026-09-06','6','3']]};
    t.starter.statSources=Object.fromEntries(['era','whip','innings'].map(field=>[field,{observedAt:stamp}]));
    t.bullpenSource={observedAt:stamp};
   }
   g.comparisonSource={observedAt:stamp};
  }
  const r=buildRunAnalysis(g,now,'NPB',false,defaultBaseballSettings());assert.ok(r.win);
  const matched=matchingRunAnalysis(r.fixture,new Map([[analysisFixtureKey(r.fixture),r]]),now+31*60000);
  assert.equal(matched.win,null);assert.match(matched.reason,/多因子統計已過期/);
 }
});
