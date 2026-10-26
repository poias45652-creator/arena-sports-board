import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {matchSportEvent,sportMarketStatus,sportSourceAudit,sportTeamKey}=await import(moduleUrl('lib/sport-super-markets.ts'));
const {footballTeamName}=await import(moduleUrl('lib/football.ts'));
const {nbaTeam}=await import(moduleUrl('lib/nba.ts'));
const audit=JSON.parse(fs.readFileSync('tests/fixtures/sport-source-names-20261012.json'));
const {games:recorded}=JSON.parse(fs.readFileSync('tests/fixtures/sport-official-fixtures-20261012.json'));
const games=recorded.map(g=>({...g,home:g.sport==='NBA'?nbaTeam(g.home.id):{...g.home,name:footballTeamName(g.home.englishName)},away:g.sport==='NBA'?nbaTeam(g.away.id):{...g.away,name:footballTeamName(g.away.englishName)}}));
const now=Date.parse(audit.fetchedAt);
// Only public fixture metadata and availability were captured from production.
// All prices below are synthetic and test-only.
const snapshot=()=>({fetchedAt:audit.fetchedAt,sportGames:audit.fixtures.map(r=>({...r,league:r.sport,displayMarkets:(r.sport==='FOOTBALL'?[101,102,110]:[103,104,111]).map(type=>({type,period:'full',quotes:[{primary:true,open:true,homeLine:'0.5',awayLine:'',total:'2.5',homePrice:.9,awayPrice:.9,over:.9,under:.9,drawPrice:3}]}))}))});
test('all eight current source fixtures match independent official football and NBA schedules with three markets',()=>{
 assert.equal(games.length,8);assert.equal(audit.fixtureCount,8);
 const paired=new Set();
 for(const g of games){
  const status=sportMarketStatus(snapshot(),g,g.sport,now);
  assert.equal(status.code,'matched',g.home.name+' / '+g.away.name);
  assert.equal(status.availableCount,3);assert.ok(!paired.has(status.event.id));paired.add(status.event.id);
 }
 assert.equal(paired.size,8);
 assert.deepEqual(sportSourceAudit(snapshot(),now).unrecognizedTeamNames,[]);
});
test('new aliases preserve exact senior identities, source freshness, competition, orientation and uniqueness',()=>{
 for(const [name,canonical] of [['利雲特','萊萬特'],['紐卡素聯','紐卡索聯'],['拖連奴','都靈']]){
  assert.equal(sportTeamKey(name+'（主）','FOOTBALL'),canonical);
  for(const sport of ['NBA','WNBA'])assert.notEqual(sportTeamKey(name,sport),canonical);
  for(const suffix of ['U21','(女)','預備隊'])assert.notEqual(sportTeamKey(name+suffix,'FOOTBALL'),canonical);
 }
 const g=games.find(g=>g.home.englishName==='Levante');
 for(const mutate of [s=>s.fetchedAt=new Date(now-150000).toISOString(),s=>s.sportGames.find(r=>r.id===25089269).competition='uefa.champions',s=>s.sportGames.find(r=>r.id===25089269).live=true,s=>s.sportGames.find(r=>r.id===25089269).start='2026/10/13 03:30:00',s=>s.sportGames.push({...s.sportGames.find(r=>r.id===25089269),id:999})]){
  const s=snapshot();mutate(s);assert.equal(matchSportEvent(s,g,'FOOTBALL',now),null);
 }
 assert.equal(matchSportEvent(snapshot(),{...g,home:g.away,away:g.home},'FOOTBALL',now),null);
});
test('source audit detects a newly introduced unknown spelling even when the source has open markets',()=>{
 const s=snapshot(),r=s.sportGames.find(r=>r.id===25089269);r.home='尚未登錄的隊名(主)';
 const result=sportSourceAudit(s,now);
 assert.equal(result.revision,'sport-pairing-v4');
 assert.deepEqual(result.unrecognizedTeamNames,[{sport:'FOOTBALL',name:'尚未登錄的隊名(主)'}]);
 assert.equal(result.fixtures.find(r=>r.id===25089269).availableMarkets,3);
 assert.equal(sportMarketStatus(s,games.find(g=>g.home.englishName==='Levante'),'FOOTBALL',now).code,'team_name_mismatch');
 assert.equal(sportSourceAudit({...s,sportGames:[...s.sportGames,r]},now).unrecognizedTeamNames.length,1);
});
