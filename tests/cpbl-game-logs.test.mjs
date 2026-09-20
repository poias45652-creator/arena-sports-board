import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
import {cpblLogSchedule,cpblPitchingLog,collectCpblGameLogs} from '../server/cpbl-game-logs-source.mjs';
const {cpblLogMetrics,supplementCpblGameLogs,cpblLogCoverage}=await import(moduleUrl('lib/cpbl-game-logs.ts'));
const {buildRunAnalysis}=await import(moduleUrl('lib/baseball-run-analysis.ts'));
const {pregameImportsByLeague}=await import(moduleUrl('lib/pregame-imports.ts'));
const {displayPitcherStat,summarizePregameImport}=await import(moduleUrl('lib/international-pregame.ts'));
const fixture=JSON.parse(readFileSync('tests/fixtures/cpbl-yahoo-log-260919341.json'));
const seed=JSON.parse(readFileSync('data/cpbl-game-logs-20260920.json'));
const now=Date.parse(seed.checkedAt)+1000,date='2026-09-21';
const clone=structuredClone;
const page=(raw=fixture.raw)=>({...fixture.source,text:'<script>self.__next_f.push('+JSON.stringify([1,'0:'+JSON.stringify(raw)+'\n'])+')</script>'});
const schedule=()=>cpblLogSchedule(Array(6).fill(page()),2026);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('Yahoo pitcher order separates starters despite every isStarter boolean being true; outs and final totals are checked',()=>{
 const raw=clone(fixture.raw);assert.ok(raw.playerStats.awayTables[0].tableStats.every(r=>r.player.isStarter));
 const g=cpblPitchingLog(page(raw),schedule()[0]);
 assert.equal(g.pitching.away[0].name,'梅賽鍶');assert.equal(g.pitching.away[0].outs,27);
 assert.equal(g.pitching.away[1].outs,1);assert.equal(g.pitching.home[1].outs,2);
 assert.equal(g.pitching.home.reduce((n,p)=>n+p.outs,0),30);
 assert.ok(g.warnings.length,'scoreboard inning mismatch is retained as diagnostic');
 for(const change of [r=>r.status='IN_PROGRESS',r=>r.seasonPhase='POSTSEASON',r=>r.homeScore++,r=>r.awayHits++,r=>r.awayTeamLineup[0].order=2,r=>r.playerStats.awayTables[0].tableStats[0].stats.find(s=>s.statId==='WALKS_ALLOWED').value=null]){
  const r=clone(fixture.raw);change(r);assert.throws(()=>cpblPitchingLog(page(r),schedule()[0]));
 }
});
test('six schedules dedupe a final fixture, reject conflicting reschedules, and skip non-finals',()=>{
 assert.equal(schedule().length,1);
 const changed=clone(fixture.raw);changed.homeScore++;
 assert.throws(()=>cpblLogSchedule([page(changed),...Array(5).fill(page())],2026),/衝突/);
 assert.throws(()=>cpblLogSchedule(Array(5).fill(page()),2026),/六隊/);
 const live={...fixture.raw,status:'PREGAME'};
 assert.throws(()=>cpblLogSchedule(Array(6).fill(page(live)),2026),/沒有/);
});
test('collector reuses a matched box and confines reads to public Yahoo URLs within its detail budget',async()=>{
 const previous={games:[cpblPitchingLog(page(),schedule()[0])]},calls=[];
 const result=await collectCpblGameLogs({season:2026,pages:Array(6).fill(page()),previous,maxDetails:0,fetcher:async url=>{calls.push(url);throw Error('unexpected fetch');}});
 assert.equal(calls.length,0);assert.deepEqual(result.games,previous.games);
 const loaded=await collectCpblGameLogs({season:2026,pages:Array(6).fill(page()),maxDetails:1,fetcher:async url=>{assert.equal(new URL(url).hostname,'tw.sports.yahoo.com');calls.push(url);return new Response(page().text);}});
 assert.equal(calls.length,1);assert.equal(loaded.errors.length,0);assert.equal(loaded.games[0].pitching.away.length,2);
});
test('failed historical pages retain their error and wait six hours before retrying, without fabricated pitching',async()=>{
 let calls=0;
 const options={season:2026,pages:Array(6).fill(page()),fetcher:async()=>{calls++;return new Response('',{status:404});}};
 const failed=await collectCpblGameLogs(options);assert.equal(calls,1);assert.equal(failed.games[0].pitching,undefined);assert.match(failed.errors[0],/404/);
 const waiting=await collectCpblGameLogs({...options,previous:failed});assert.equal(calls,1);assert.deepEqual(waiting.errors,failed.errors);
 waiting.games[0].detailCheckedAt=new Date(Date.now()-7*3600000).toISOString();
 await collectCpblGameLogs({...options,previous:waiting});assert.equal(calls,2);
});
test('season aggregation sums earned runs and baseball outs, deduplicates, excludes same-day results and never averages ERAs',()=>{
 const metrics=cpblLogMetrics(seed,date,'AAA','梅賽鍶',now),games=seed.games.filter(g=>g.away==='AAA'||g.home==='AAA');
 assert.equal(metrics.games,games.length);
 const sample=metrics.bullpenScope==='season'?games:games.slice(-metrics.recentWindow);
 const relievers=sample.flatMap(g=>(g.pitching?.[g.home==='AAA'?'home':'away']||[]).filter(p=>p.order>1));
 assert.ok(metrics.bullpen);
 {
  near(metrics.bullpen.era,relievers.reduce((n,p)=>n+p.earnedRuns,0)*27/relievers.reduce((n,p)=>n+p.outs,0));
  near(metrics.bullpen.whip,relievers.reduce((n,p)=>n+p.hits+p.walks,0)*3/relievers.reduce((n,p)=>n+p.outs,0));
 }
 const duplicate=clone(seed);duplicate.games.push(clone(seed.games[0]));assert.deepEqual(cpblLogMetrics(duplicate,date,'AAA','梅賽鍶',now),metrics);
 const today=clone(seed.games[0]);today.key='CPBL:2026:900';today.date=date;today.awayScore=99;duplicate.games.push(today);
 assert.deepEqual(cpblLogMetrics(duplicate,date,'AAA','梅賽鍶',now),metrics);
 duplicate.games[duplicate.games.length-2].homeScore++;
 assert.equal(cpblLogMetrics(duplicate,date,'AAA','梅賽鍶',now),null);
 assert.equal(cpblLogMetrics(seed,date,'AAA','梅賽鍶',now+37*3600000),null);
 assert.equal(cpblLogMetrics(seed,date,'AAA','梅賽鍶',Date.parse(seed.observedAt)-1),null);
});
test('missing old box uses a complete consecutive recent bullpen sample, never a partial starter season; missing recent box stops bullpen derivation',()=>{
 const partial=clone(seed),games=partial.games.filter(g=>g.away==='AAA'||g.home==='AAA');
 // This test requires the collected latest ten boxes to have passed all source checks.
 assert.ok(games.slice(-5).every(g=>g.pitching));
 delete games[0].pitching;
 const recent=cpblLogMetrics(partial,date,'AAA','梅賽鍶',now);
 assert.equal(recent.starter,null);assert.equal(recent.bullpenScope,'last5');assert.equal(recent.bullpen.games,5);assert.ok(recent.recentStarter);
 delete games.at(-1).pitching;
 assert.equal(cpblLogMetrics(partial,date,'AAA','梅賽鍶',now).bullpen,null);
});
function futurePregame(){
 // Synthetic future fixture only: new evidence is never backdated into 9/20 odds.
 const d=clone(pregameImportsByLeague.CPBL);d.date=date;d.observedAt=seed.checkedAt;
 d.games=d.games.slice(2).map(g=>{
  g.date=date;g.start=date+' 17:05:00';g.home.starter.name='陳克羿';g.source.observedAt=seed.checkedAt;delete g.comparisonSource;
  for(const side of ['away','home']){g[side].starter.source={name:'test fixture',url:fixture.source.url,observedAt:seed.checkedAt,publishedAt:null};delete g[side].retainedSource;delete g[side].starter.review;g[side].starter.quality='unavailable';}
  return g;
 });return d;
}
test('CPBL model consumes independently derived pitching without modifying raw season/bullpen, conserves probability and blocks late evidence',()=>{
 const original=futurePregame(),before=JSON.stringify(original),data=supplementCpblGameLogs(original,seed,now),g=data.games[0];
 assert.equal(JSON.stringify(original),before);
 for(const side of ['away','home']){assert.equal(g[side].bullpen,original.games[0][side].bullpen);assert.deepEqual(g[side].starter.season,original.games[0][side].starter.season);}
 const report=buildRunAnalysis(g,now,'CPBL');assert.equal(report.status,'ready',report.reason);
 assert.equal(report.inputs.home.bullpenMode,'game_logs');assert.equal(report.inputs.away.bullpenMode,'game_logs');
 near(report.win.away+report.win.home+report.win.draw,1);
 assert.equal(displayPitcherStat(g.home,'era'),'—','recent estimates cannot be labeled season ERA');assert.ok(g.home.gameLogs.recentStarter);
 assert.equal(summarizePregameImport(data).completeBullpens,0);assert.equal(summarizePregameImport(data).bullpens,2);
 for(const change of [x=>x.home.starter.name='未公布先發',x=>x.home.gameLogs.observedAt='2026-09-22T00:00:00Z']){
  const bad=clone(g);change(bad);assert.equal(buildRunAnalysis(bad,now,'CPBL').grids,null);
 }
 const live=clone(g);live.start='2026-09-20 17:05:00';live.date='2026-09-20';
 assert.equal(buildRunAnalysis(live,now,'CPBL').status,'started');
 assert.equal(cpblLogCoverage(seed,date,now).teams.length,6);
});
