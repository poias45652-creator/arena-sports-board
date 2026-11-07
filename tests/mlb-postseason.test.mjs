import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {parseMlbSchedule,withMlbSeasonRecords}=await import(moduleUrl('lib/mlb-schedule.ts'));
const {isPregame,canShowPregameMarkets,taipeiDay,baseProbability}=await import(moduleUrl('lib/baseball.ts'));
const {parsePitcherRates}=await import(moduleUrl('lib/pitcher-era.ts'));
const {winnerAnalysis}=await import(moduleUrl('lib/winner-analysis.ts'));
const {assembleAnalysis}=await import(moduleUrl('lib/pregame-analysis.ts'));
const fixture=JSON.parse(readFileSync('tests/fixtures/mlb-postseason-20260929.json','utf8'));
const now=Date.parse('2026-09-29T12:54:29Z');
const schedule=()=>parseMlbSchedule(fixture.schedule);
function readyGames(){
 const games=withMlbSeasonRecords(schedule(),fixture.standings,2026),rates=parsePitcherRates(fixture.pitchers,2026);
 for(const g of games)for(const side of [g.away,g.home])Object.assign(side,{pitcherEra:rates[side.pitcherId]?.era??null,pitcherWhip:rates[side.pitcherId]?.whip??null});
 return games;
}
test('official screenshot fixtures remain future postseason games with the correct Taiwan day',()=>{
 const games=readyGames().filter(g=>taipeiDay(g.date)==='2026-09-30');
 assert.deepEqual(games.map(g=>g.id),[849845,849849,849851,849843]);
 for(const g of games){assert.equal(g.gameType,'F');assert.equal(g.status,'Scheduled');assert.equal(isPregame(g,now),true);assert.equal(canShowPregameMarkets(g,now),true);}
 assert.deepEqual(games[0].away.wins,88);assert.deepEqual(games[0].home.wins,94);
 assert.equal(games[0].away.pitcherId,666200);assert.equal(games[0].home.pitcherId,519242);
});
test('every MLB playoff round uses the existing pregame gates and still rejects unsafe states',()=>{
 for(const gameType of ['R','F','D','L','W']){
  const g={...readyGames()[0],gameType};assert.equal(isPregame(g,now),true);
  for(const change of [{state:'Live'},{state:'Final'},{status:'Postponed'},{status:'Cancelled'},{date:new Date(now).toISOString()},{startTimeTBD:true}])assert.equal(isPregame({...g,...change},now),false);
  assert.equal(canShowPregameMarkets({...g,startTimeTBD:true},now),true);
  assert.equal(canShowPregameMarkets({...g,state:'Live',startTimeTBD:true},now),false);
 }
 for(const gameType of ['S','A','I','E','unknown']){
  const g={...readyGames()[0],gameType};assert.equal(isPregame(g,now),false);assert.equal(canShowPregameMarkets({...g,startTimeTBD:true},now),false);
 }
});
test('postseason 0–0 never substitutes for the season baseline, and bad standings cannot fill it',()=>{
 const games=schedule();assert.equal(games[0].away.wins,null);assert.equal(baseProbability(games[0]),null);
 for(const mutate of [s=>s.records[0].standingsType='postseason',s=>s.records[0].teamRecords[0].season='2025',s=>s.records[0].teamRecords.pop(),s=>s.records[0].teamRecords[0].wins=-1]){
  const bad=structuredClone(fixture.standings);mutate(bad);assert.throws(()=>withMlbSeasonRecords(games,bad,2026));
 }
 assert.equal(games[0].away.wins,null);
 const regular={...games[0],gameType:'R',away:{...games[0].away,wins:70,losses:50}};
 const otherYear={...games[0],season:2025};
 const result=withMlbSeasonRecords([regular,otherYear],fixture.standings,2026);
 assert.equal(result[0],regular);assert.equal(result[1],otherYear);
});
test('all four screenshot games calculate usable estimates without inventing missing advanced inputs',()=>{
 for(const g of readyGames().filter(g=>taipeiDay(g.date)==='2026-09-30')){
  const result=winnerAnalysis(g,undefined,now,true);
  assert.equal(result.canEstimate,true);assert.equal(result.status,'preliminary');assert.equal(result.ready,false);
  assert.ok(result.homeWin>0&&result.homeWin<1);
  const report=assembleAnalysis(g,{},now);
  assert.ok(!report.issues.some(issue=>/已開賽|非可分析/.test(issue)));
  assert.equal(report.candidate.modelApplied,false);
  assert.equal(winnerAnalysis(g,report,now,true).canEstimate,true);
  assert.equal(winnerAnalysis({...g,home:{...g.home,pitcherId:null}},undefined,now,true).canEstimate,false);
  assert.equal(winnerAnalysis(g,undefined,now,false).canEstimate,false);
 }
});

test('offseason standings request the entire regular season and keep each team’s verified last five',async()=>{
 const {standingsScheduleUrl,parseStandings}=await import(moduleUrl('lib/standings.ts'));
 const query=new URL(standingsScheduleUrl(2026)).searchParams;
 assert.equal(query.get('season'),'2026');
 assert.equal(query.get('gameType'),'R');
 assert.ok(!query.has('startDate')&&!query.has('endDate'));
 // Milwaukee’s final five from MLB’s 2026 regular-season schedule, in road/home order.
 const games=[
  [23,823410,158,4,143,1],[24,823411,158,5,143,1],[25,823735,138,4,158,8],
  [26,823733,138,2,158,3],[27,823731,138,4,158,6],
 ].map(([day,gamePk,away,awayScore,home,homeScore])=>({
  gamePk,officialDate:`2026-09-${day}`,gameDate:`2026-09-${day}T19:00:00Z`,gameType:'R',season:'2026',
  status:{abstractGameState:'Final',codedGameState:'F'},
  teams:{away:{team:{id:away},score:awayScore},home:{team:{id:home},score:homeScore}},
 }));
 const last=games.at(-1);
 const ineligible=[
  {...last,gamePk:1,gameType:'D'},{...last,gamePk:2,season:'2025'},
  {...last,gamePk:3,status:{abstractGameState:'Final',codedGameState:'C'}},
  {...last,gamePk:4,status:{abstractGameState:'Live',codedGameState:'I'}},
  {...last,gamePk:5,teams:{...last.teams,away:{team:{id:138}}}},
 ];
 const parsed=parseStandings(fixture.standings,{dates:[{games:[...games.toReversed(),last,...ineligible]}]},2026);
 const brewers=parsed.rows.find(row=>row.id===158);
 assert.deepEqual(brewers.lastFive.map(g=>[g.gameId,g.result,g.score,g.against]),[
  [823410,'W',4,1],[823411,'W',5,1],[823735,'W',8,4],[823733,'W',3,2],[823731,'W',6,4],
 ]);
 assert.equal(parsed.recentAvailable,false); // The other teams’ schedules are incomplete.
 for(const unavailable of [null,{dates:[]}]){
  const result=parseStandings(fixture.standings,unavailable,2026);
  assert.equal(result.rows.length,30);
  assert.equal(result.recentAvailable,false);
  assert.ok(result.rows.every(r=>r.lastFive.length===0));
 }
});
