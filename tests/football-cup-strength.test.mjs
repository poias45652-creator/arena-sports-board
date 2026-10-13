import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const fixture=read('tests/fixtures/football-viking-bayern-20261013.json');
const capture=read('tests/fixtures/football-cup-context-20261014.json');
const now=Date.parse(capture.fetchedAt);
const {parseFootballEvents,parseFootballTeamHistory,analyzeFootball,footballForm,footballDistribution}=await import(moduleUrl('lib/football.ts'));
const {mergeExternalFootballHistory,applyExternalFootballAnalysis}=await import(moduleUrl('lib/football-external-source.ts'));
const {cupPriorEstimate,CUP_PRIOR_VERSION}=await import(moduleUrl('lib/football-cup-prior.ts'));
const {FootballElo,externalDayCutoff}=await import(moduleUrl('lib/football-xg-features.ts'));
const {externalFootballRates}=await import(moduleUrl('lib/football-external-model.ts'));
const {readyFootballAnalysis,footballRecommendations}=await import(moduleUrl('lib/football-recommendations.ts'));
const {validFootballForecast}=await import(moduleUrl('lib/football-ledger.ts'));
const archive=read('data/football/external-history-20260927.json').games.filter(r=>r[1]==='uefa.champions').map(r=>({id:String(r[0]),league:r[1],start:r[2],homeId:r[3],awayId:r[4],homeGoals:r[5],awayGoals:r[6],homeXg:r[7],awayXg:r[8],neutral:!!r[9]}));
const context={...capture,teams:new Set(capture.teams),history:mergeExternalFootballHistory(archive,capture.historyOverrides,capture.excluded).games};
const game=parseFootballEvents(fixture.sources[0].data,'uefa.champions')[0];
const primary=fixture.sources.filter(s=>s.path.startsWith('uefa.champions/teams/')).flatMap(s=>parseFootballEvents(s.data,'uefa.champions'));
const extra=fixture.sources.filter(s=>s.path.startsWith('all/teams/')).flatMap(s=>parseFootballTeamHistory(s.data,'510'));
const base=analyzeFootball(game,primary,now,extra);
const repaired=applyExternalFootballAnalysis(game,base,primary,context,now);
const parameters=read('data/football/external-calibration-runtime.json').leagues['uefa.champions'].parameters;
const target={homeId:'espn:510',awayId:'of:GER:bayernmunchen',start:game.start,league:game.league,neutral:false};
const before=externalDayCutoff(new Date(now).toISOString()),history=context.history.filter(g=>Date.parse(g.start)<before),elo=new FootballElo();history.forEach(g=>elo.update(g));

test('Viking mixed domestic form reproduces the defect; recorded cup/Elo data restores a real model and score grid',()=>{
  const clock=Date.parse(fixture.capturedAt);
  const home=footballForm('510','home',[...extra,...primary],clock,false,{decayDays:90,venueWeight:.6,competition:game.league,otherCompetitionWeight:.35});
  const away=footballForm('132','away',primary,clock);
  const old=footballDistribution((home.scored+away.conceded)/2,(away.scored+home.conceded)/2);
  assert.deepEqual(['home','draw','away'].map(k=>(old.probabilities[k]*100).toFixed(1)),['44.6','18.7','36.7']);
  assert.equal(base.status,'waiting');assert.equal(repaired.status,'ready');assert.equal(repaired.version,CUP_PRIOR_VERSION);
  assert.equal(repaired.homeForm.games,1);assert.equal(repaired.homeForm.supplementGames,0);assert.equal(repaired.awayForm.games,13);
  assert.ok(repaired.probabilities.away>repaired.probabilities.home);assert.equal((repaired.probabilities.away*100).toFixed(1),'72.7');
  assert.equal(repaired.scores.length,3);assert.equal(repaired.scoreDistribution.scores.length,441);
  assert.equal(readyFootballAnalysis(game,{game,analysis:repaired},now),repaired);assert.equal(validFootballForecast(game,repaired,now),true);
  assert.equal(footballRecommendations({games:[game],reports:{[game.id]:{game,analysis:repaired}},league:game.league,day:'2026-10-14',now}).length,1);
  assert.equal(repaired.calibration.status,'baseline');assert.equal(repaired.external.modelApplied,true);
  assert.deepEqual(applyExternalFootballAnalysis(game,base,[...primary,...extra.filter(g=>g.league!==game.league).map(g=>({...g,homeScore:20,awayScore:20}))],context,now),repaired,'domestic goals cannot steer cup model');
});

test('the independently selected floor uses the existing coefficient equation, with Elo direction and normalization intact',()=>{
  const result=cupPriorEstimate(target,history,elo.difference(target),parameters,before);
  const values=[1,3,result.away.scored,result.away.conceded,0,0,0,0,elo.difference(target)/400,0];
  assert.deepEqual(result.rates,externalFootballRates(values,values,parameters));
  const strongerHome=cupPriorEstimate(target,history,elo.difference(target)+100,parameters,before);
  assert.ok(strongerHome.rates.home>result.rates.home);assert.ok(strongerHome.rates.away<result.rates.away);
  assert.ok(Math.abs(repaired.probabilities.home+repaired.probabilities.draw+repaired.probabilities.away-1)<1e-12);
  const poison=[{...history.at(-1),id:'future',homeId:target.homeId,homeGoals:30,start:new Date(before+1000).toISOString()},{...history.at(-1),id:'domestic',homeId:target.homeId,homeGoals:30,league:'nor.1'}];
  assert.deepEqual(cupPriorEstimate(target,[...history,...poison],elo.difference(target),parameters,before),result);
  for(const args of [[{...target,homeId:'unknown'},history], [target,history.slice(-10)], [{...target,league:'eng.1'},history]])assert.equal(cupPriorEstimate(...args,0,parameters,before),null);
  assert.equal(cupPriorEstimate(target,history,0,{...parameters,usesXg:true},before),null);
  assert.equal(cupPriorEstimate(target,history,NaN,parameters,before),null);
});

test('every still-upcoming recorded Champions fixture can render a model; already-started games are never recalculated',()=>{
  const board=read('tests/fixtures/football-champions-official-20261013.json');
  const games=board.sources.flatMap(s=>parseFootballEvents(s,'uefa.champions'));
  const today=games.filter(g=>g.start.startsWith('2026-10-13'));
  assert.equal(today.length,9);
  for(const g of today){
    const estimate=applyExternalFootballAnalysis(g,analyzeFootball(g,[],now),[],context,now);
    if(Date.parse(g.start)<=now){assert.equal(estimate.status,'closed');continue;}
    assert.equal(estimate.status,'ready',g.home.englishName);assert.equal(estimate.scores.length,3);assert.equal(estimate.historyMode,'competition');
  }
});

test('expired or incomplete external context never creates a new prediction, while old pregame snapshots stay frozen after kickoff',()=>{
  for(const patch of [{fetchedAt:new Date(now-36*60000).toISOString()},{teams:new Set()},{history:[]},{fetchedAt:'invalid'}])assert.notEqual(applyExternalFootballAnalysis(game,base,[],{...context,...patch},now).status,'ready');
  const legacy={...repaired,external:undefined,version:'football-recent-form-v1',historyMode:'recent-form'};
  assert.equal(readyFootballAnalysis(game,{game,analysis:legacy},now),null);assert.equal(validFootballForecast(game,legacy,now),false);
  const live={...game,state:'live'};
  assert.equal(readyFootballAnalysis(live,{game,analysis:legacy},Date.parse(game.start)+1000),legacy);
  assert.equal(readyFootballAnalysis(live,{game,analysis:legacy},Date.parse('2026-10-14T16:00:00Z')),null);
});

test('the audit selected parameters only on the selection years and keeps holdout/recent evidence separate',()=>{
  const audit=read('docs/football-cup-sparse-audit.json');assert.deepEqual(audit.fixedCandidates,[1,3,5]);assert.equal(audit.selected,'prior1');
  for(const group of ['selection','holdout','audit2025']){
    assert.ok(audit.stats[group].prior1.logLoss<audit.stats[group].rawGoals.logLoss);
    assert.ok(audit.stats[group].prior1.brier<audit.stats[group].rawGoals.brier);
  }
  assert.equal(audit.stats.holdout.prior1.n,70);assert.equal(audit.stats.audit2025.prior1.n,53);assert.equal(audit.stats.audit2026,undefined);
});
