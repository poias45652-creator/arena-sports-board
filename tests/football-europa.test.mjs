import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';

const f=await import(moduleUrl('lib/football.ts'));
const source=await import(moduleUrl('lib/football-source.ts'));
const external=await import(moduleUrl('lib/football-external-source.ts'));
const {selectExternalFootballModel}=await import(moduleUrl('lib/football-external-model.ts'));
const {hrFootballCompetition}=await import(moduleUrl('lib/hr9988.ts'));
const {sportSourceAudit,matchSportEvent}=await import(moduleUrl('lib/sport-super-markets.ts'));
const {scheduleLiveUntil}=await import(moduleUrl('lib/sport-live.ts'));
const fixture=JSON.parse(readFileSync('tests/fixtures/football-europa-20261015.json','utf8'));
const league='uefa.europa',day='2026-10-16',now=Date.parse('2026-10-15T10:00:00Z');
const games=f.parseFootballEvents(fixture.data,league),game=games[0];

test('Europa is a distinct supported senior league; captured 18 fixtures use Taiwan next-day dates and Chinese names',()=>{
  assert.deepEqual(f.FOOTBALL_LEAGUES.find(l=>l.code===league),{code:league,name:'歐霸',fullName:'歐洲足總歐霸聯賽'});
  assert.ok(f.isFootballLeague(league));
  assert.equal(games.length,18);
  for(const g of games){
    assert.equal(f.footballDay(g.start),day);assert.equal(g.league,league);
    assert.match(g.home.name,/[\u3400-\u9fff]/);assert.match(g.away.name,/[\u3400-\u9fff]/);
    assert.equal(g.homeScore,null);assert.equal(g.awayScore,null);
  }
  assert.equal(f.isFootballLeague('uefa.europa.conf'),false);
  assert.equal(f.parseFootballEvents(fixture.data,'uefa.champions').length,0);
});

test('Europa schedule deduplicates adjacent source days and next-match navigation returns the actual Taiwan date',async()=>{
  const original=globalThis.fetch,paths=[];
  globalThis.fetch=async url=>{paths.push(String(url));return Response.json(fixture.data);};
  try{
    const schedule=await source.footballSchedule(league,day);
    assert.equal(schedule.games.length,18);assert.equal(schedule.league,league);assert.equal(schedule.day,day);
    assert.deepEqual(await source.nextFootballDay(league,'2026-10-15'),{day});
    assert.ok(paths.some(p=>p.endsWith('uefa.europa/scoreboard?dates=20261015&limit=100')));
    assert.ok(paths.some(p=>p.endsWith('uefa.europa/scoreboard?dates=20261016&limit=100')));
    assert.ok(paths.every(p=>p.includes('/uefa.europa/')));
  }finally{globalThis.fetch=original;}
});

test('Europa analysis uses its own history and keeps the same three-score contract without borrowing Champions calibration',()=>{
  const history=Array.from({length:10},(_,i)=>({...game,id:String(8000+i),start:new Date(now-(i+2)*86400000).toISOString(),state:'final',statusName:'STATUS_FULL_TIME',homeScore:2,awayScore:1}));
  const result=f.analyzeFootball(game,history,now);
  assert.equal(result.status,'ready');assert.equal(result.scores.length,3);
  assert.ok(Math.abs(result.probabilities.home+result.probabilities.draw+result.probabilities.away-1)<1e-10);
  assert.equal(result.calibration.status,'baseline');assert.equal(result.calibration.holdoutGames,0);
  assert.equal(selectExternalFootballModel(league,now),null);
  const foreign=history.map(g=>({...g,league:'uefa.champions'}));
  assert.equal(f.analyzeFootball(game,foreign,now).probabilities,undefined);
  const cross=f.analyzeFootball(game,[],now,foreign);
  assert.equal(cross.status,'waiting');assert.equal(cross.historyMode,'recent-form');
  assert.equal(cross.version,'football-cup-strength-required-v1');assert.equal(cross.probabilities,undefined);
  assert.equal(cross.calibration.status,'baseline');assert.equal(cross.calibration.holdoutGames,0);
});

test('Europa annual recovery requests its own league and preserves ESPN team identities',async()=>{
  const original=globalThis.fetch,paths=[];
  const final=structuredClone(fixture.data);
  for(const [i,e] of final.events.entries()){
    e.date=e.competitions[0].date=new Date(now-(i+2)*86400000).toISOString();
    e.competitions[0].status={type:{name:'STATUS_FULL_TIME',state:'post',completed:true}};
    for(const c of e.competitions[0].competitors)c.score=c.homeAway==='home'?'2':'1';
  }
  globalThis.fetch=async url=>{paths.push(String(url));return Response.json(final);};
  try{
    const context=await external.loadExternalFootballContext(league,now);
    assert.ok(context.history.length>5000);assert.ok(context.history.some(g=>g.id==='espn:'+game.id));assert.deepEqual(context.sources,['ESPN']);
    assert.ok(context.history.every(g=>g.league===league&&g.homeId.startsWith('espn:')&&g.awayId.startsWith('espn:')));
    assert.equal(paths.length,2);assert.ok(paths.every(p=>p.includes('/uefa.europa/scoreboard?dates=')));
  }finally{globalThis.fetch=original;}
});

test('Europa source labels match exactly and cannot capture Champions, Conference, youth or women competitions',()=>{
  for(const label of ['歐霸','歐足總歐霸聯賽','歐霸聯賽','歐洲足總歐霸聯賽','歐洲聯賽','歐羅巴聯賽','歐霸盃','歐聯盃','歐洲聯盟杯','UEFA Europa League','歐洲聯賽-聯賽階段'])assert.equal(hrFootballCompetition(label),league,label);
  assert.equal(hrFootballCompetition('歐洲聯賽冠軍盃'),'uefa.champions');
  for(const label of ['歐洲協會聯賽','歐洲足總歐洲協會聯賽','歐羅巴協會聯賽','歐洲U19聯賽','歐洲女子聯賽','歐霸聯賽U21'])assert.equal(hrFootballCompetition(label),null,label);
  const start=new Date(Date.parse(game.start)+8*3600000).toISOString().slice(0,19).replaceAll('-','/').replace('T',' ');
  const snapshot={fetchedAt:new Date(now).toISOString(),sportGames:[{id:9001,league:'FOOTBALL',competition:league,leagueName:'歐洲聯賽',home:game.home.name,away:game.away.name,start,live:false,markets:[]}]};
  assert.ok(matchSportEvent(snapshot,game,'FOOTBALL',now));
  assert.equal(matchSportEvent(snapshot,{...game,league:'uefa.champions'},'FOOTBALL',now),null);
  assert.equal(sportSourceAudit(snapshot,now).fixtureCount,1);
});

test('Europa live scores light the shared football badge only for a fresh matching schedule',()=>{
  const liveNow=Date.parse(game.start)+60000;
  const board={day,league,fetchedAt:new Date(liveNow).toISOString(),games:[{...game,state:'live',homeScore:1,awayScore:0}]};
  assert.ok(scheduleLiveUntil(board,league,day,liveNow)>liveNow);
  assert.equal(scheduleLiveUntil(board,'uefa.champions',day,liveNow),0);
  assert.equal(scheduleLiveUntil(board,league,day,liveNow+120000),0);
});
