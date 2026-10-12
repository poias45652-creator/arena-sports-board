import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseCpbl,collectLeague} from '../server/baseball-live-providers.mjs';
import {collectCpblCurrent,inspectCpblSchedule} from '../server/cpbl-current.mjs';
import {moduleUrl} from './profile-loader.mjs';
const {parseInternational}=await import(moduleUrl('lib/international.ts'));
const {cpblYahooGames,cpblUpcoming}=await import(moduleUrl('lib/international-profile.ts'));
const {currentPregame}=await import(moduleUrl('lib/international-current-pregame.ts'));
const {buildRunAnalysis}=await import(moduleUrl('lib/baseball-run-analysis.ts'));
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/cpbl-postseason-20261012.json'));
const raw=fixture.raw,date='2026-10-12';
const html=rows=>'<script>self.__next_f.push('+JSON.stringify([1,'0:'+JSON.stringify(rows)+'\n'])+')</script>';
const page={url:raw.alias.url,fetchedAt:fixture.fetchedAt};
test('observed CPBL postseason payload retains current scores, inning, teams and unique full fixture ID',()=>{
 const g=parseCpbl(raw,page);
 assert.equal(g.key,'CPBL:261012004');assert.equal(g.seasonPhase,'POSTSEASON');assert.equal(g.status,'live');assert.equal(g.date,date);
 assert.equal(g.home.name,'中信兄弟');assert.equal(g.away.name,'統一獅');assert.equal(g.home.score,raw.homeScore);assert.equal(g.away.score,raw.awayScore);
 assert.ok(g.pitching.home.length);assert.ok(g.pitching.away.length);
 for(const phase of ['PRESEASON','UNKNOWN',undefined])assert.throws(()=>parseCpbl({...raw,seasonPhase:phase},page));
});
const teams=['中信','統一','富邦','樂天','味全','台鋼'],ids=['cpbl.t.1','cpbl.t.2','cpbl.t.5','cpbl.t.6','cpbl.t.7','cpbl.t.8'];
// Synthetic regular fixtures exercise the collector's six-team coverage; the
// postseason fixture itself is the recorded public source payload.
const pages=()=>teams.map((name,i)=>({teamId:ids[i],page:{url:'https://tw.sports.yahoo.com/cpbl/teams/'+encodeURIComponent(name)+'/',fetchedAt:fixture.fetchedAt,text:html([{...raw,gameId:'cpbl.g.260920'+String(i+1).padStart(3,'0'),seasonPhase:'REGULAR_SEASON',startTime:'2026-09-20T18:35:00+08:00',homeTeamId:ids[i],awayTeamId:ids[(i+1)%6],alias:{url:'https://tw.sports.yahoo.com/cpbl/fixture-260920'+String(i+1).padStart(3,'0')+'/'}},...([raw.homeTeamId,raw.awayTeamId].includes(ids[i])?[raw]:[])])}}));
test('both current collectors and schedule validation retain postseason while off-day proof remains strict',async()=>{
 const p=pages(),schedule=inspectCpblSchedule(p,date);assert.equal(schedule.matches.length,1);assert.equal(schedule.proof,null);
 const fetcher=async url=>new Response(p.find(p=>p.page.url===url)?.page.text||html([raw]));
 const result=await collectCpblCurrent({date,fetcher});assert.equal(result.status,'ok');assert.equal(result.games.length,1);assert.equal(result.games[0].id,'261012004');
 const legacy=await collectLeague('CPBL',{date,fetcher});assert.equal(legacy.games.length,1);assert.equal(legacy.games[0].id,'261012004');
 const conflict=pages();conflict[1].page.text=html([{...raw,seasonPhase:'REGULAR_SEASON'}]);assert.throws(()=>inspectCpblSchedule(conflict,date),/衝突/);
 const bad=await collectCpblCurrent({date,fetcher:async url=>new Response(p.find(p=>p.page.url===url)?.page.text||html([{...raw,seasonPhase:'PRESEASON'}]))});
 assert.equal(bad.games.length,0);assert.equal(bad.status,'partial');assert.equal(bad.errors.length,1);
});
test('schedule, box score and team profiles show postseason without colliding with regular game number four',()=>{
 const regular={...raw,gameId:'cpbl.g.260401004',seasonPhase:'REGULAR_SEASON',startTime:'2026-04-01T18:35:00+08:00',alias:{url:'https://tw.sports.yahoo.com/cpbl/test-260401004/'}};
 const markup=html([regular,raw]),schedule=parseInternational(markup,'cpbl-schedule',2026);
 assert.equal(schedule.games.length,2);assert.match(schedule.games.find(g=>g.id==='261012004').label,/季後賽/);
 const box='<table><tr><th>球隊</th><th>R</th><th>H</th><th>E</th></tr><tr><td>統一獅</td><td>'+raw.awayScore+'</td><td>0</td><td>0</td></tr><tr><td>中信兄弟</td><td>'+raw.homeScore+'</td><td>0</td><td>0</td></tr></table>';
 assert.ok(parseInternational(html([raw])+box,'cpbl-game',2026).tables.some(t=>t.title.includes('投手')));
 assert.deepEqual(cpblYahooGames(markup,2026).map(g=>g.id),[260401004,261012004]);
 assert.deepEqual(cpblUpcoming(markup,2026).map(g=>g.id),[260401004,261012004]);
 assert.throws(()=>parseInternational(html([{...raw,seasonPhase:'PRESEASON'}]),'cpbl-schedule',2026));
});
test('postseason phase survives pregame merge and cannot invoke regular-season tie/automatic-runner estimates',()=>{
 const pre={...raw,status:'PREGAME'},observed='2026-10-12T08:00:00Z',g=parseCpbl(pre,{...page,fetchedAt:observed});
 const data=currentPregame('CPBL',date,{games:[g]},[]);assert.equal(data.games[0].seasonPhase,'POSTSEASON');
 for(const simulation of [false,true]){
  const analysis=buildRunAnalysis(data.games[0],Date.parse(observed),'CPBL',simulation);
  assert.equal(analysis.status,'waiting_data');assert.match(analysis.reason,/季後賽/);assert.equal(analysis.win,null);
 }
});
test('rescheduled regular-season games do not discard the entire team profile or count postponements as wins',()=>{
 const regular={...raw,seasonPhase:'REGULAR_SEASON',gameId:'cpbl.g.260404014',startTime:'2026-04-04T17:05:00+08:00',status:'POSTPONED'};
 const completed={...regular,gameId:'cpbl.g.261005014',startTime:'2026-10-05T18:35:00+08:00',status:'FINAL',homeScore:4,awayScore:2};
 const rows=cpblYahooGames(html([regular,completed,raw]),2026);
 assert.deepEqual(rows.map(r=>r.id),[260404014,261005014,261012004]);
 assert.deepEqual(rows.filter(r=>r.completed).map(r=>r.id),[261005014]);
});
