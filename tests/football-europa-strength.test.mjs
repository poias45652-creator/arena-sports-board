import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {moduleUrl} from './profile-loader.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const capture=JSON.parse(gunzipSync(readFileSync('tests/fixtures/football-europa-analysis-20261015.json.gz')));
const {parseFootballEvents,parseFootballTeamHistory,analyzeFootball,footballDistribution}=await import(moduleUrl('lib/football.ts'));
const {applyExternalFootballAnalysis}=await import(moduleUrl('lib/football-external-source.ts'));
const {selectExternalFootballModel,footballEuropaRuntime:runtime,externalFootballRates}=await import(moduleUrl('lib/football-external-model.ts'));
const {footballGameAnalysis}=await import(moduleUrl('lib/football-source.ts'));
const {readyFootballAnalysis}=await import(moduleUrl('lib/football-recommendations.ts'));
const {validFootballForecast}=await import(moduleUrl('lib/football-ledger.ts'));
const league='uefa.europa',now=Date.parse('2026-10-15T11:40:00Z');
const games=parseFootballEvents(capture.sources.find(s=>s.path.startsWith(league+'/scoreboard?dates=20261015')).data,league);
const archive=read('data/football/europa-history-20261015.json');
const history=archive.games.map(r=>({id:r[0],league:r[1],start:r[2],homeId:r[3],awayId:r[4],homeGoals:r[5],awayGoals:r[6],homeXg:r[7],awayXg:r[8],neutral:r[9]}));
const context={history,fetchedAt:capture.capturedAt,teams:new Set(games.flatMap(g=>['espn:'+g.home.id,'espn:'+g.away.id])),sources:['ESPN'],conflicts:0};
const game=games.find(g=>g.id==='401915575');
const teamSources=capture.sources.filter(s=>[game.home.id,game.away.id].some(id=>s.path.includes('/teams/'+id+'/')));
const primary=teamSources.filter(s=>s.path.startsWith(league+'/')).flatMap(s=>parseFootballEvents(s.data,league));
const extra=teamSources.filter(s=>s.path.startsWith('all/')).flatMap(s=>parseFootballTeamHistory(s.data,s.data.team.id));
const base=analyzeFootball(game,primary,now,extra);
const repaired=applyExternalFootballAnalysis(game,base,primary,context,now);

test('captured Torreense–Sunderland reproduces 1/20 histories and restores a sparse own-cup model',()=>{
 assert.equal(base.status,'waiting');assert.equal(base.homeForm.games,1);assert.equal(base.awayForm.games,20);
 assert.equal(repaired.status,'ready');assert.equal(repaired.version,'football-europa-elo-sparse-v1');
 assert.equal(repaired.homeForm.games,1);assert.equal(repaired.awayForm.games,1);
 assert.equal(repaired.homeForm.supplementGames,0);assert.equal(repaired.historyMode,'competition');
 assert.equal(repaired.scores.length,3);assert.equal(repaired.scoreDistribution.scores.length,441);
 assert.ok(Math.abs(repaired.probabilities.home+repaired.probabilities.draw+repaired.probabilities.away-1)<1e-12);
 assert.equal(readyFootballAnalysis(game,{game,analysis:repaired},now),repaired);
 assert.equal(validFootballForecast(game,repaired,now),true);
 assert.equal(repaired.calibration.status,'baseline');assert.match(repaired.calibration.uncertainty,/2026年尚無/);
 assert.equal(repaired.calibration.holdoutGames,335);assert.equal(repaired.calibration.recentGames,60);
});

test('all 18 captured Europa fixtures pass through the production source adapter with score scenarios',async t=>{
 const RealDate=Date;globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
 t.after(()=>{globalThis.Date=RealDate;});
 const paths=[];t.mock.method(globalThis,'fetch',async value=>{
  const path=String(value).split('/soccer/')[1];paths.push(path);
  const key=path.replace(/&limit=100$/,'&limit=1000');
  const source=capture.sources.find(s=>s.path===path||s.path===key);
  if(source)return Response.json(source.data);
  // The schedule merges adjacent UTC days; isolate the captured match day.
  if(path===league+'/scoreboard?dates=20261016&limit=100')return Response.json({events:[]});
  assert.fail('Unexpected public request '+path);
 });
 assert.equal(games.length,18);
 for(const g of games){
  const result=await footballGameAnalysis(league,'2026-10-16',g.id),a=result.analysis;
  assert.equal(a.status,'ready',g.home.englishName+': '+a.reason);assert.equal(a.scores.length,3);
  assert.equal(a.historyMode,'competition');assert.equal(a.external.modelApplied,true);
  assert.ok(readyFootballAnalysis(g,result,now));
 }
 assert.ok(paths.includes(league+'/scoreboard?dates=2026&limit=1000'));
 assert.ok(paths.every(p=>!p.includes('uefa.champions')));
});

test('foreign, future and same-day results cannot steer Europa sparse estimates',()=>{
 const poison=[{...history.at(-1),id:'foreign',league:'uefa.champions',homeId:'espn:'+game.home.id,homeGoals:25},
  {...history.at(-1),id:'today',start:'2026-10-15T00:00:01Z',homeId:'espn:'+game.home.id,homeGoals:25},
  {...history.at(-1),id:'future',start:'2026-10-16T00:00:01Z',homeId:'espn:'+game.home.id,homeGoals:25}];
 const result=applyExternalFootballAnalysis(game,base,primary,{...context,history:[...history,...poison]},now);
 assert.deepEqual(result.probabilities,repaired.probabilities);
 assert.deepEqual(result.expected,repaired.expected);
 for(const patch of [{fetchedAt:new Date(now-36*60000).toISOString()},{teams:new Set()},{history:[]},{history:history.filter(g=>![g.homeId,g.awayId].includes('espn:'+game.home.id))}]){
  assert.notEqual(applyExternalFootballAnalysis(game,base,[],{...context,...patch},now).status,'ready');
 }
 const legacy={...repaired,historyMode:'recent-form',external:undefined};
 assert.equal(readyFootballAnalysis(game,{game,analysis:legacy},now),null);
 assert.equal(validFootballForecast(game,legacy,now),false);
 assert.equal(selectExternalFootballModel(league,Date.parse(runtime.createdAt)-1),null);
 assert.equal(selectExternalFootballModel(league,Date.parse(runtime.expiresAt)),null);
 assert.notDeepEqual(runtime.full.parameters,read('data/football/external-calibration-runtime.json').leagues['uefa.champions'].parameters);
});

test('independent Europa calibration retains its frozen gates and discloses the unavailable sparse 2026 audit',()=>{
 assert.equal(createHash('sha256').update(readFileSync('docs/football-europa-protocol.json')).digest('hex'),runtime.protocolSha256);
 assert.equal(createHash('sha256').update(JSON.stringify(archive.games)).digest('hex'),runtime.sourceSha256);
 assert.equal(runtime.full.enabled,true);assert.deepEqual(runtime.full.reasons,[]);
 for(const split of ['selection','holdout','audit2025','audit2026']){
  const {baseline:b,candidate:c}=runtime.full.metrics[split];assert.ok(c.logLoss<b.logLoss);assert.ok(c.brier<=b.brier);
  for(const k of ['over25Brier','bttsBrier'])assert.ok(c[k]<=b[k]+.002);
 }
 assert.equal(runtime.sparse.enabled,false);assert.equal(runtime.sparse.observationEnabled,true);
 assert.deepEqual(runtime.sparse.reasons,['audit2026_sample_small']);assert.equal(runtime.sparse.sampleSizes.audit2026,0);
 assert.equal(runtime.sparse.priorMatches,3);
 for(const split of ['selection','holdout','audit2025']){
  const {rawGoals:b,prior3:c}=runtime.sparse.stats[split];assert.ok(c.logLoss<b.logLoss);assert.ok(c.brier<=b.brier);
 }
});
