import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';

const fixture=JSON.parse(readFileSync('tests/fixtures/football-viking-bayern-20261013.json','utf8'));
const now=Date.parse(fixture.capturedAt),payload=path=>fixture.sources.find(s=>s.path===path)?.data;
const {parseFootballEvents,parseFootballTeamHistory,analyzeFootball,footballForm,footballDistribution,CUP_STRENGTH_REASON}=await import(moduleUrl('lib/football.ts'));
const {parseFootballMarketReference,currentFootballMarketReference}=await import(moduleUrl('lib/football-market-reference.ts'));
const {readyFootballAnalysis,footballRecommendations}=await import(moduleUrl('lib/football-recommendations.ts'));
const {validFootballForecast}=await import(moduleUrl('lib/football-ledger.ts'));
const {footballAnalysisPresentation}=await import(moduleUrl('app/football-report-refresh.ts'));
const event=payload('uefa.champions/scoreboard?dates=20261013&limit=100').events[0];
const game=parseFootballEvents({events:[event]},'uefa.champions')[0];
const primary=fixture.sources.filter(s=>s.path.startsWith('uefa.champions/teams/')).flatMap(s=>parseFootballEvents(s.data,'uefa.champions'));
const extra=fixture.sources.filter(s=>s.path.startsWith('all/teams/')).flatMap(s=>parseFootballTeamHistory(s.data,'510'));
const reference=parseFootballMarketReference(event,game,fixture.capturedAt);

test('recorded Viking–Bayern reproduces the erroneous mixed-league 44.6/18.7/36.7 and blocks its publication',()=>{
  assert.equal(game.home.id,'510');assert.equal(game.home.englishName,'Viking FK');assert.equal(game.away.id,'132');
  const home=footballForm('510','home',[...extra,...primary],now,false,{decayDays:90,venueWeight:.6,competition:game.league,otherCompetitionWeight:.35});
  const away=footballForm('132','away',primary,now);
  const old=footballDistribution((home.scored+away.conceded)/2,(away.scored+home.conceded)/2);
  assert.deepEqual(['home','draw','away'].map(k=>(old.probabilities[k]*100).toFixed(1)),['44.6','18.7','36.7']);
  const corrected=analyzeFootball(game,primary,now,extra);
  assert.equal(corrected.status,'waiting');assert.equal(corrected.reason,CUP_STRENGTH_REASON);
  assert.equal(corrected.homeForm.supplementGames,19);assert.equal(corrected.awayForm.supplementGames,0);
  for(const key of ['probabilities','scores','scoreDistribution','expected','lean'])assert.equal(corrected[key],undefined,key);
  // Reject the old in-memory/persisted report as well as new incomplete reports.
  const legacy={...corrected,...old,status:'ready',version:'football-recent-form-v1',reason:''};
  assert.equal(readyFootballAnalysis(game,{game,analysis:legacy},now),null);
  assert.equal(validFootballForecast(game,legacy,now),false);
  assert.deepEqual(footballAnalysisPresentation(game,{game,analysis:legacy},now),{state:'waiting',message:CUP_STRENGTH_REASON});
  assert.equal(footballRecommendations({games:[game],reports:{[game.id]:{game,analysis:legacy}},league:game.league,day:'2026-10-14',now}).length,0);
});

test('captured three-way quotes independently imply Bayern 85.4%, with -2.5 a handicap rather than a score prediction',()=>{
  assert.ok(reference);assert.equal(reference.provider,'DraftKings');
  const raw=[1/17,1/10.5,.9],sum=raw.reduce((s,p)=>s+p,0);
  for(const [i,key] of ['home','draw','away'].entries())assert.ok(Math.abs(reference.probabilities[key]-raw[i]/sum)<1e-12);
  assert.equal((reference.probabilities.away*100).toFixed(1),'85.4');
  assert.equal(reference.homeHandicap,2.5);assert.equal(reference.awayHandicap,-2.5);assert.equal(reference.total,4.5);
  assert.equal(reference.scores,undefined);assert.equal(reference.scoreDistribution,undefined);
  const g={...game,marketReference:reference};assert.equal(currentFootballMarketReference(g,now),reference);
  assert.equal(readyFootballAnalysis(g,{game:g},now),null);
  for(const patch of [{state:'live'},{timeConfirmed:false},{id:'other'},{home:game.away,away:game.home},{start:'2026-10-13T18:00:00Z'}])assert.equal(currentFootballMarketReference({...g,...patch},now),null);
  for(const clock of [now+120000,now-5001,Date.parse(game.start),NaN])assert.equal(currentFootballMarketReference(g,clock),null);
});

test('market reference refuses incomplete/current-opening mixtures, invalid prices, and mismatched fixtures',()=>{
  const mutate=fn=>{const e=structuredClone(event);fn(e);return parseFootballMarketReference(e,game,fixture.capturedAt);};
  for(const value of [null,'',0,99,-99,'NaN','+900junk',Infinity])assert.equal(mutate(e=>e.competitions[0].odds[0].moneyline.away.close.odds=value),null);
  assert.equal(mutate(e=>{const q=e.competitions[0].odds[0].moneyline.away;q.open=q.close;delete q.close;}),null);
  assert.equal(mutate(e=>{delete e.competitions[0].odds[0].moneyline.draw;}),null);
  assert.equal(mutate(e=>e.id='other'),null);
  assert.equal(mutate(e=>e.competitions[0].competitors.reverse().forEach((c,i)=>c.homeAway=i?'away':'home')),null);
  assert.equal(mutate(e=>e.competitions[0].date='2026-10-13T18:00Z'),null);
  assert.equal(parseFootballMarketReference(event,{...game,state:'live'},fixture.capturedAt),null);
  assert.equal(parseFootballMarketReference(event,game,game.start),null);
  const mismatched=mutate(e=>e.competitions[0].odds[0].pointSpread.away.close.line='+2.5');
  assert.equal(mismatched.homeHandicap,null);assert.equal(mismatched.awayHandicap,null);
});

test('source pipeline blocks the uncalibrated cup fallback even when the annual opponent model is unavailable',async()=>{
  const {footballGameAnalysis}=await import(moduleUrl('lib/football-source.ts'));
  const RealDate=globalThis.Date,originalFetch=globalThis.fetch;
  globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
  globalThis.fetch=async url=>{const path=String(url).replace(fixture.source,'');const data=payload(path);if(data)return Response.json(data);if(/^uefa\.champions\/scoreboard\?dates=202[56]&limit=1000$/.test(path))return new Response('Unavailable',{status:503});assert.fail('unexpected '+path);};
  try{
    const result=await footballGameAnalysis(game.league,'2026-10-14',game.id);
    assert.equal(result.analysis.status,'waiting');assert.equal(result.analysis.reason,CUP_STRENGTH_REASON);
    assert.equal(result.analysis.probabilities,undefined);assert.equal(result.analysis.scoreDistribution,undefined);
    assert.deepEqual(result.game.marketReference,{...reference,fetchedAt:new Date(now).toISOString()});
    assert.equal(validFootballForecast(result.game,result.analysis,now),false);
  }finally{globalThis.Date=RealDate;globalThis.fetch=originalFetch;}
});
