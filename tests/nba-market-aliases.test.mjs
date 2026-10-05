import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {matchSportEvent,sportTeamKey}=await import(moduleUrl('lib/sport-super-markets.ts'));
const {NBA_TEAMS}=await import(moduleUrl('lib/nba.ts'));
const {parseHrGameDetail}=await import(moduleUrl('lib/hr9988.ts'));
// Exact public fixture fields observed in Render at 2026-10-05T12:43:16.775Z.
// These are replay observations, not current odds. No private session fields.
const at='2026-10-05T12:43:16.775Z',now=Date.parse(at);
const rows=[
 [25068655,'費城76人(主)','紐約尼克','07:00:00','費城七六人','紐約尼克'],
 [25068649,'底特律活塞(主)','鳳凰城太陽','07:00:00','底特律活塞','鳳凰城太陽'],
 [25068656,'亞特蘭大老鷹(主)','曼斐斯灰熊','07:00:00','亞特蘭大老鷹','曼菲斯灰熊'],
 [25068659,'密爾瓦基公鹿(主)','明尼蘇達灰狼','08:00:00','密爾瓦基公鹿','明尼蘇達灰狼'],
 [25068661,'沙加緬度國王(主)','洛杉磯湖人','10:00:00','沙加緬度國王','洛杉磯湖人']
];
const snapshot={fetchedAt:at,sportGames:rows.map(([id,home,away,time])=>({id,home,away,start:`2026/10/06 ${time}`,league:'NBA',live:false,displayMarkets:[]}))};
const fixture=r=>({id:String(r[0]),home:{name:r[4]},away:{name:r[5]},state:'scheduled',timeConfirmed:true,start:`2026-10-06T${r[3]}+08:00`});
test('all five observed production fixtures pair uniquely, including both reported cards',()=>{
 for(const row of rows)assert.equal(matchSportEvent(snapshot,fixture(row),'NBA',now)?.id,row[0]);
 assert.equal(new Set(NBA_TEAMS.map(t=>sportTeamKey(t.name,'NBA'))).size,30);
});
test('NBA aliases remain exact and isolated from football and WNBA',()=>{
 assert.equal(sportTeamKey(' 費城７６人（主） ','NBA'),'費城七六人');
 assert.equal(sportTeamKey('曼斐斯灰熊','NBA'),'曼菲斯灰熊');
 for(const league of ['FOOTBALL','WNBA'])assert.notEqual(sportTeamKey('曼斐斯灰熊',league),sportTeamKey('曼菲斯灰熊',league));
 assert.notEqual(sportTeamKey('灰熊','NBA'),sportTeamKey('曼菲斯灰熊','NBA'));
 assert.notEqual(sportTeamKey('費城76人二隊','NBA'),sportTeamKey('費城七六人','NBA'));
});
test('aliases never weaken dates, freshness, league, state, orientation or ambiguity checks',()=>{
 const game=fixture(rows[0]);
 assert.equal(matchSportEvent(snapshot,game,'NBA',now+150000),null);
 for(const patch of [{state:'live'},{timeConfirmed:false},{start:'2026-10-07T07:00:00+08:00'},{start:'2026-10-06T07:10:01+08:00'},{home:game.away,away:game.home}])assert.equal(matchSportEvent(snapshot,{...game,...patch},'NBA',now),null);
 assert.equal(matchSportEvent(snapshot,game,'WNBA',now),null);
 assert.equal(matchSportEvent({...snapshot,sportGames:[...snapshot.sportGames,snapshot.sportGames[0]]},game,'NBA',now),null);
 assert.equal(matchSportEvent({...snapshot,sportGames:snapshot.sportGames.map(r=>({...r,live:true}))},game,'NBA',now),null);
});
test('actual market parser contract exposes quotes after name pairing and preserves closed markets',()=>{
 const raw=JSON.parse(readFileSync('tests/fixtures/sport-super-game-details.json','utf8'));
 const value=parseHrGameDetail(raw,at),base=value.sportGames.find(g=>g.league==='NBA');assert.ok(base);
 // Use recorded market structure to test propagation; not these fixtures live prices.
 const row={...base,...snapshot.sportGames[0],displayMarkets:base.displayMarkets};
 const s={...snapshot,sportGames:[row]},g=fixture(rows[0]);
 const result=matchSportEvent(s,g,'NBA',now);assert.ok(result.spread&&result.total&&result.moneyline);
 row.displayMarkets.find(m=>m.type===103).quotes[0].open=false;
 const closed=matchSportEvent(s,g,'NBA',now);assert.equal(closed.spread,null);assert.ok(closed.total);
});
