import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {selectInternationalBoardFixtures,taipeiFixtureDay}=await import(moduleUrl('lib/international-board-fixtures.ts'));
const {mergePregameFixtures}=await import(moduleUrl('lib/international-pregame.ts'));
const {buildRunAnalysis,matchingRunAnalysis,analysisFixtureKey,suggestedPicks}=await import(moduleUrl('lib/baseball-run-analysis.ts'));
const captures=JSON.parse(readFileSync('data/playsport-capture-20260921.json','utf8'));
const npb=captures.find(x=>x.league==='NPB');
const afternoon=Date.parse('2026-09-21T14:17:00+08:00');
const select=(now,day='auto')=>selectInternationalBoardFixtures(mergePregameFixtures([],npb,'NPB'),[],'NPB',now,day,npb.excludedFixtures);

test('14:17 regression: the three real NPB games remain after first pitch, with cancelled games excluded',()=>{
 const before=select(Date.parse('2026-09-21T12:59:59+08:00')),after=select(afternoon);
 assert.equal(before.games.length,3);assert.equal(after.games.length,3);
 assert.deepEqual(after.games.map(g=>g.id),before.games.map(g=>g.id));
 assert.equal(after.automaticDay,'2026-09-21');assert.equal(after.targetDay,'2026-09-21');
 assert.ok(after.games.every(g=>g.pregame&&g.starters.away&&g.starters.home));
});
test('visible started cards never retain pregame probabilities or produce recommendations',()=>{
 const {games}=select(afternoon),reports=new Map(npb.games.map(g=>{const r=buildRunAnalysis(g,Date.parse('2026-09-21T12:30:00+08:00'),'NPB');return [analysisFixtureKey(r.fixture,'NPB'),r]}));
 for(const game of games){const r=matchingRunAnalysis(game,reports,afternoon,'NPB');assert.equal(r.status,'started');assert.equal(r.win,null);assert.equal(r.grids,null)}
 assert.deepEqual(suggestedPicks(games,reports,afternoon,true,false,'NPB'),[]);
});
test('empty feeds still select a concrete Taipei date so the pregame request can load',()=>{
 const result=selectInternationalBoardFixtures([],[],'NPB',afternoon);
 assert.equal(result.targetDay,'2026-09-21');assert.deepEqual(result.days,['2026-09-21']);
 assert.equal(taipeiFixtureDay(Date.parse('2026-09-21T16:00:00Z')),'2026-09-22');
 assert.equal(select(Date.parse('2026-09-22T00:00:00+08:00')).games.length,0);
});
test('today remains selected with tomorrow fixtures present; tomorrow can still be explicitly selected',()=>{
 const today=select(afternoon).games,tomorrow={...today[0],id:'tomorrow',start:'2026-09-22 13:00:00'};
 const automatic=selectInternationalBoardFixtures([...today,tomorrow],[],'NPB',afternoon);
 assert.equal(automatic.targetDay,'2026-09-21');assert.equal(automatic.games.length,3);
 assert.deepEqual(selectInternationalBoardFixtures([...today,tomorrow],[],'NPB',afternoon,'2026-09-22').games,[tomorrow]);
 assert.equal(selectInternationalBoardFixtures([tomorrow],[],'NPB',afternoon).targetDay,'2026-09-22');
});
test('live source cards merge once with same-time canonical fixtures, keep pitchers, and sort first',()=>{
 const g=select(afternoon).games.find(g=>g.home==='北海道日本火腿鬥士');
 const live={...g,id:'live',start:'2026/09/21 13:00:00',home:'日本火腿',live:true,oddsSource:true,starters:undefined,pregame:undefined};
 const later={...g,id:'doubleheader',start:'2026-09-21 18:00:00',pregame:undefined};
 const result=selectInternationalBoardFixtures([later,g],[live],'NPB',afternoon);
 assert.equal(result.games.length,2);assert.equal(result.games[0].id,'live');assert.equal(result.games[0].home,'北海道日本火腿鬥士');
 assert.equal(result.games[0].starters.home,g.starters.home);assert.equal(result.games[0].pregame,g.pregame);
});
test('KBO and CPBL also retain today after start, while explicit postponements stay hidden',()=>{
 for(const league of ['KBO','CPBL']){
  const game={id:league,start:'2026-09-21 13:00:00',away:'客隊',home:'主隊',live:false,displayMarkets:[]};
  assert.equal(selectInternationalBoardFixtures([game],[],league,afternoon).games.length,1);
  assert.equal(selectInternationalBoardFixtures([{...game,note:'延賽'}],[],league,afternoon).games.length,0);
 }
});
