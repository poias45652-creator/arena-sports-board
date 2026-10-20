import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const {cupAdjustedEstimate,cupOpponentFeatures,selectCupAdjustment,footballCupAdjustmentRuntime:runtime}=await import(moduleUrl('lib/football-cup-adjustment.ts'));
const {FootballOpponentXgHistory}=await import(moduleUrl('lib/football-opponent-xg.ts'));
const {mergeExternalFootballHistory,applyExternalFootballAnalysis}=await import(moduleUrl('lib/football-external-source.ts'));
const {FootballElo,externalDayCutoff}=await import(moduleUrl('lib/football-xg-features.ts'));
const {analyzeFootball,footballDistribution}=await import(moduleUrl('lib/football.ts'));
const {validFootballForecast}=await import(moduleUrl('lib/football-ledger.ts'));
const capture=read('tests/fixtures/football-cup-context-20261020.json'),ids=read('data/football/external-team-map.json').teams;
const archive=read('data/football/external-history-20260927.json').games.filter(r=>r[1]==='uefa.champions').map(r=>({id:String(r[0]),league:r[1],start:r[2],homeId:r[3],awayId:r[4],homeGoals:r[5],awayGoals:r[6],homeXg:null,awayXg:null,neutral:!!r[9]}));
const history=mergeExternalFootballHistory(archive,capture.historyOverrides).games;
const now=Date.parse(runtime.createdAt)+1000,before=externalDayCutoff(new Date(now).toISOString());
const context={history,fetchedAt:new Date(now).toISOString(),teams:new Set(history.flatMap(g=>[g.homeId,g.awayId])),conflicts:0,sources:['OpenFootball','ESPN']};
const p=read('data/football/external-calibration-runtime.json').leagues['uefa.champions'].parameters;
const elo=new FootballElo();history.filter(g=>Date.parse(g.start)<before).forEach(g=>elo.update(g));
const target=g=>({homeId:ids[g.home.id].openfootball,awayId:ids[g.away.id].openfootball,start:g.start,league:g.league,neutral:g.neutral});
const stuttgart=capture.games.find(g=>g.id==='401915392'),t=target(stuttgart);
const estimate=(g=t,rows=history,options=runtime.parameters)=>cupAdjustedEstimate(g,rows,elo.difference(g),p,before,options);

test('actual two-match Stuttgart form receives continuous shrinkage while preserving real sample counts',()=>{
 const r=estimate();assert.equal(r.home.games,2);assert.equal(r.away.games,16);
 assert.ok(r.home.effectiveGames<2&&r.home.reliability>0&&r.home.reliability<1);
 assert.ok(r.home.reliability<r.away.reliability);
 const noOpponent=estimate(t,history,{...runtime.parameters,opponentWeight:0});
 assert.notDeepEqual(noOpponent.rates,r.rates,'historical opponent adjustment enters the rates');
 const d=footballDistribution(r.rates.home,r.rates.away,r.rates.rho);
 assert.ok(Math.abs(d.probabilities.home+d.probabilities.draw+d.probabilities.away-1)<1e-12);
 assert.equal(d.scoreDistribution.scores.length,441);
});

test('both reported fixtures reach the deployed model and retain consistent scores and valid forecasts',()=>{
 for(const game of capture.games){
  const result=applyExternalFootballAnalysis(game,analyzeFootball(game,[],now),[],context,now);
  assert.equal(result.status,'ready');assert.equal(result.version,runtime.version);
  assert.equal(result.scores.length,3);assert.equal(result.external.modelApplied,true);
  assert.equal(result.expected.home,result.scoreDistribution.home);assert.equal(result.expected.away,result.scoreDistribution.away);
  assert.equal(validFootballForecast(game,result,now),true);assert.ok(result.cupAdjustment.homeReliability<1);
  assert.match(result.notes.join(''),/尚未納入實際xG/);
  const custom=applyExternalFootballAnalysis(game,analyzeFootball(game,[],now),[],context,now,{model:'elo',weights:{elo:[50,50,0,0,0]}});
  assert.notDeepEqual(custom.probabilities,result.probabilities);
 }
});

test('bounded production opponent index exactly matches chronological audit features and invalidates corrected results',()=>{
 const index=new FootballOpponentXgHistory({decayDays:90,lookbackDays:365,priorGames:5});
 const days=new Map();for(const g of history.filter(g=>Date.parse(g.start)<before)){const day=g.start.slice(0,10);if(!days.has(day))days.set(day,[]);days.get(day).push(g);}
 for(const games of days.values())index.addDay(games);
 assert.deepEqual(cupOpponentFeatures(history,t.homeId,t.awayId,before),index.features(t.homeId,t.awayId,before));
 const row=history.findLast(g=>(g.homeId===t.homeId||g.awayId===t.homeId)&&Date.parse(g.start)<before);
 const changed=history.map(g=>g.id===row.id?{...g,homeGoals:g.homeGoals+1}:g);
 assert.notDeepEqual(cupOpponentFeatures(history,t.homeId,t.awayId,before),cupOpponentFeatures(changed,t.homeId,t.awayId,before));
});

test('future, same-day and domestic scores cannot affect the cup estimate; neutral identity swap is symmetric',()=>{
 const sample=history.at(-1),poison=[{...sample,id:'today',start:new Date(before).toISOString(),homeId:t.homeId,homeGoals:30},{...sample,id:'future',start:new Date(before+86400000).toISOString(),homeId:t.homeId,homeGoals:30},{...sample,id:'domestic',league:'ger.1',homeId:t.homeId,homeGoals:30}];
 assert.deepEqual(estimate(t,[...history,...poison]),estimate());
 const a=estimate({...t,neutral:true}),b=estimate({...t,neutral:true,homeId:t.awayId,awayId:t.homeId});
 assert.ok(Math.abs(a.rates.home-b.rates.away)<1e-12);assert.ok(Math.abs(a.rates.away-b.rates.home)<1e-12);
 assert.equal(estimate({...t,homeId:'unknown'}),null);assert.equal(estimate({...t,league:'uefa.europa'}),null);
 assert.equal(selectCupAdjustment(Date.parse(runtime.createdAt)-1),null);assert.equal(selectCupAdjustment(Date.parse(runtime.expiresAt)),null);
 assert.equal(estimate(t,history,{...runtime.parameters,priorGames:0}),null);
 const closed={...stuttgart,state:'live'};assert.equal(applyExternalFootballAnalysis(closed,analyzeFootball(closed,[],now),[],context,now).status,'closed');
});

test('candidate selection and later validation remain separate with modest gains and disclosed selection regression',()=>{
 const audit=read('docs/football-cup-adjustment-audit.json');assert.deepEqual(audit.selected,runtime.parameters);assert.equal(audit.accepted,true);
 for(const split of ['holdout','audit2025','audit2026'])for(const metric of ['logLoss','brier'])assert.ok(audit.comparison[split].candidate[metric]<audit.comparison[split].legacy[metric]);
 assert.ok(audit.comparison.selection.candidate.logLoss>audit.comparison.selection.legacy.logLoss);
 assert.equal(audit.comparison.holdout.candidate.n,636);assert.equal(audit.sparseComparison.audit2026.candidate.n,13);
});
