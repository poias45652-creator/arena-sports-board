import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {matchSportEvent,sportMarketStatus,sportTeamKey}=await import(moduleUrl('lib/sport-super-markets.ts'));
const {footballTeamName}=await import(moduleUrl('lib/football.ts'));
const {parseFootballEvents}=await import(moduleUrl('lib/football.ts'));
const {sportSourceAudit}=await import(moduleUrl('lib/sport-super-markets.ts'));
const audit=JSON.parse(fs.readFileSync('tests/fixtures/football-source-names-20261009.json'));
const {games}=JSON.parse(fs.readFileSync('tests/fixtures/football-official-fixtures-20261009.json'));
const now=Date.parse(audit.fetchedAt);
// Only identities and market availability were recorded in the production log.
// Prices below are synthetic, used exclusively to exercise the existing reader.
const displayMarkets=[101,102,110].map(type=>({type,period:'full',quotes:[{primary:true,open:true,homeLine:'0.5',awayLine:'',total:'2.5',homePrice:.9,awayPrice:.9,over:.9,under:.9,drawPrice:3}]}));
const snapshot={fetchedAt:audit.fetchedAt,sportGames:audit.fixtures.map(r=>({...r,league:'FOOTBALL',displayMarkets}))};
test('all 27 observed source fixtures uniquely pair with independently retrieved official schedules',()=>{
 assert.equal(games.length,27);assert.equal(snapshot.sportGames.length,27);
 const paired=new Set();
 for(const game of games){
  // Reapply the production team-name parser rather than freezing its old output.
  game.home.name=footballTeamName(game.home.englishName);game.away.name=footballTeamName(game.away.englishName);
  const event=matchSportEvent(snapshot,game,'FOOTBALL',now);
  assert.ok(event,game.home.name+' vs '+game.away.name);assert.ok(!paired.has(event.id));paired.add(event.id);
 }
});
test('Chelsea Bournemouth source alias now exposes all three open full-game markets',()=>{
 const game=games.find(g=>g.id==='401878775'),status=sportMarketStatus(snapshot,game,'FOOTBALL',now);
 assert.equal(status.code,'matched');assert.equal(status.event.id,25082043);assert.equal(status.availableCount,3);
 assert.equal(sportTeamKey('般尼茅夫','FOOTBALL'),'伯恩茅斯');
});
test('exact football aliases cannot merge reserves, women, youth teams, reversed sides or stale feeds',()=>{
 const game=games.find(g=>g.id==='401878775');
 for(const suffix of ['U21','(女)','預備隊']){
  const s=structuredClone(snapshot);s.sportGames.find(r=>r.id===25082043).away+=suffix;
  assert.equal(matchSportEvent(s,game,'FOOTBALL',now),null);
 }
 assert.equal(matchSportEvent(snapshot,{...game,home:game.away,away:game.home},'FOOTBALL',now),null);
 assert.equal(matchSportEvent(snapshot,{...game,league:'uefa.champions'},'FOOTBALL',now),null);
 assert.equal(matchSportEvent(snapshot,game,'FOOTBALL',now+150000),null);
 assert.notEqual(sportTeamKey('巴黎','FOOTBALL'),sportTeamKey('巴黎聖日門','FOOTBALL'));
 assert.equal(sportTeamKey('般尼茅夫','NBA'),'般尼茅夫');
});

const championsAudit=JSON.parse(fs.readFileSync('tests/fixtures/football-champions-source-20261013.json'));
const championsOfficial=JSON.parse(fs.readFileSync('tests/fixtures/football-champions-official-20261013.json'));
const championsGames=championsOfficial.sources.flatMap(s=>parseFootballEvents(s,'uefa.champions'));
const championsNow=Date.parse(championsAudit.fetchedAt);
const championsSnapshot={fetchedAt:championsAudit.fetchedAt,sportGames:championsAudit.fixtures.map(r=>({...r,league:'FOOTBALL',displayMarkets}))};
// The captured production audit contains names, starts and availability only.
// Synthetic quotes exercise the reader; they are never production prices.
test('all 18 October 14/15 Taiwan-time Champions League fixtures match the captured source uniquely',()=>{
 assert.equal(championsGames.length,18);assert.equal(championsSnapshot.sportGames.length,18);
 const paired=new Set();
 for(const game of championsGames){
  const status=sportMarketStatus(championsSnapshot,game,'FOOTBALL',championsNow);
  assert.equal(status.code,'matched',`${game.home.name} vs ${game.away.name}`);
  assert.equal(status.availableCount,3);assert.ok(!paired.has(status.event.id));paired.add(status.event.id);
  // Previously untranslated names may still be in cached reports after deploy.
  const cached={...game,home:{...game.home,name:game.home.englishName},away:{...game.away,name:game.away.englishName}};
  assert.equal(matchSportEvent(championsSnapshot,cached,'FOOTBALL',championsNow)?.id,status.event.id);
 }
 assert.deepEqual(sportSourceAudit(championsSnapshot,championsNow).unrecognizedTeamNames,[]);
});
test('reported Leipzig–PSV and Viking–Bayern games use their own source events',()=>{
 for(const [id,sourceId] of [['401915434',25092676],['401915411',25092667]]){
  const game=championsGames.find(g=>g.id===id);
  assert.equal(matchSportEvent(championsSnapshot,game,'FOOTBALL',championsNow)?.id,sourceId);
 }
 assert.equal(footballTeamName('Viking FK'),'維京');
 assert.equal(sportTeamKey('PSV埃因霍溫','FOOTBALL'),'PSV恩荷芬');
});
test('Champions League aliases still reject wrong opponents, venues, competitions, times and squads',()=>{
 const game=championsGames.find(g=>g.id==='401915434');
 for(const changed of [{...game,home:game.away,away:game.home},{...game,league:'eng.1'},
  {...game,start:new Date(Date.parse(game.start)+3600000).toISOString()},
  {...game,away:{...game.away,name:'Ajax Amsterdam'}},
  ...['U21','(女)','預備隊'].map(suffix=>({...game,away:{...game.away,name:game.away.name+suffix}}))]){
  assert.equal(matchSportEvent(championsSnapshot,changed,'FOOTBALL',championsNow),null);
 }
 assert.equal(matchSportEvent(championsSnapshot,game,'FOOTBALL',championsNow+150000),null);
 const duplicate=structuredClone(championsSnapshot);duplicate.sportGames.push({...duplicate.sportGames.find(g=>g.id===25092676),id:999});
 assert.equal(sportMarketStatus(duplicate,game,'FOOTBALL',championsNow).code,'fixture_ambiguous');
 assert.notEqual(sportTeamKey('Viking FK','NBA'),sportTeamKey('維京','NBA'));
});
