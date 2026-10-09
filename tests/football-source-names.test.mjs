import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {matchSportEvent,sportMarketStatus,sportTeamKey}=await import(moduleUrl('lib/sport-super-markets.ts'));
const {footballTeamName}=await import(moduleUrl('lib/football.ts'));
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
