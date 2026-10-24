import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {moduleUrl} from './profile-loader.mjs';
const {matchSportEvent,sportTeamKey,sportMarketStatus}=await import(moduleUrl('lib/sport-super-markets.ts'));
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
 assert.equal(sportTeamKey(' 波士頓塞爾蒂克（主） ','NBA'),'波士頓塞爾提克');
 for(const league of ['FOOTBALL','WNBA'])assert.notEqual(sportTeamKey('曼斐斯灰熊',league),sportTeamKey('曼菲斯灰熊',league));
 for(const league of ['FOOTBALL','WNBA'])assert.notEqual(sportTeamKey('波士頓塞爾蒂克',league),sportTeamKey('波士頓塞爾提克',league));
 assert.notEqual(sportTeamKey('灰熊','NBA'),sportTeamKey('曼菲斯灰熊','NBA'));
 assert.notEqual(sportTeamKey('費城76人二隊','NBA'),sportTeamKey('費城七六人','NBA'));
 for(const name of ['塞爾蒂克','波士頓塞爾蒂克二隊','波士頓塞爾蒂克(女)'])assert.notEqual(sportTeamKey(name,'NBA'),'波士頓塞爾提克');
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

const observed=JSON.parse(readFileSync('tests/fixtures/nba-source-names-20261010.json','utf8'));
const board=JSON.parse(readFileSync('tests/fixtures/nba-board-20261011.json','utf8')).games;
const observedNow=Date.parse(observed.fetchedAt);
test('October 11 board pairs every one of the seven offered NBA fixtures; Celtics spelling no longer blocks the card',()=>{
 const results=board.map(g=>sportMarketStatus(observed,g,'NBA',observedNow));
 assert.equal(results.filter(r=>r.event).length,7);
 assert.deepEqual(new Set(results.flatMap(r=>r.event?[r.event.id]:[])),new Set(observed.sportGames.map(r=>r.id)));
 assert.equal(results[board.findIndex(g=>g.id==='401898398')].event.id,25084156);
 // The source audit contains identities and availability, not usable prices.
 assert.ok(results.every(r=>r.availableCount===0));
 const missing=results[board.findIndex(g=>g.id==='401898400')];
 assert.equal(missing.code,'fixture_unmatched');assert.equal(missing.event,null);
});
test('Celtics pairing exposes the three parsed full-game markets and still rejects a closed primary',()=>{
 const raw=JSON.parse(readFileSync('tests/fixtures/sport-super-game-details.json','utf8'));
 const row=observed.sportGames.find(g=>g.id===25084156);
 // Replay the parser contract with recorded quote structure, not live prices.
 const category=raw.data.find(c=>c.CatID===102),league=category.Items.List.find(l=>l.LeagueNameStr.startsWith('NBA'));
 const team=league.Team[0];
 Object.assign(team,{EvtID:row.id,HomeTeamStr:row.home,AwayTeamStr:row.away,ScheduleTimeStr:row.start});
 league.Team=[team];category.Items.List=[league];raw.data=[category];
 const value=parseHrGameDetail(raw,observed.fetchedAt),game=board.find(g=>g.id==='401898398');
 assert.equal(sportMarketStatus(value,game,'NBA',observedNow).availableCount,3);
 value.sportGames[0].displayMarkets.find(m=>m.type===103).quotes[0].open=false;
 const closed=sportMarketStatus(value,game,'NBA',observedNow);
 assert.equal(closed.availableCount,2);assert.equal(closed.markets.spread.code,'closed');
});
test('Celtics alias retains time, opponent, orientation, freshness and uniqueness guards',()=>{
 const game=board.find(g=>g.id==='401898398');
 for(const patch of [{start:'2026-10-11T08:10:01+08:00'},{home:game.away,away:game.home},{away:{name:'紐約尼克'}},{state:'live'},{timeConfirmed:false}])assert.equal(matchSportEvent(observed,{...game,...patch},'NBA',observedNow),null);
 assert.equal(matchSportEvent(observed,game,'NBA',observedNow+150000),null);
 const row=observed.sportGames.find(g=>g.id===25084156);
 assert.equal(matchSportEvent({...observed,sportGames:[...observed.sportGames,{...row,id:25084199}]},game,'NBA',observedNow),null);
});

// October 19 user screenshot: DET +1 @0.950 and total 222.5 @0.940.
// The model below was independently re-fetched at 10:31Z using this commit's
// NBA/ESPN sources. Quote timestamps are advanced only for deterministic replay;
// these are historical test observations, not a live source snapshot.
const scenarioAt='2026-10-19T10:31:18.961Z',scenarioNow=Date.parse(scenarioAt);
const scenarioGame={id:'401909088',start:'2026-10-20T19:00Z',season:2027,phase:2,state:'scheduled',timeConfirmed:true,home:{id:'8',name:'底特律活塞'},away:{id:'2',name:'波士頓塞爾提克'}};
const scenarioAnalysis={status:'ready',model:'nba-player-opponent-v3',capturedAt:scenarioAt,expected:{home:110.2,away:109.2,total:219.4,margin:1},probabilities:{home:0.5262124878524289,away:0.4737875121475711},totalSigma:19.41384815022514,playerContext:{status:'applied',marginSigma:14.285652442442888,recommendationEligible:false,preseason:false}};
const scenarioSource=()=>({source:'screenshot-replay',fetchedAt:scenarioAt,sportGames:[{id:25109334,league:'NBA',home:'底特律活塞(主)',away:'波士頓塞爾蒂克',start:'2026/10/21 03:00:00',live:false,displayMarkets:[
 {period:'full',type:103,quotes:[{primary:true,open:true,homeLine:'',awayLine:'1',homePrice:.95,awayPrice:.95}]},
 {period:'full',type:104,quotes:[{primary:true,open:true,total:'222.5',over:.94,under:.94}]}
]}]});
const marketModule=await import(moduleUrl('lib/sport-super-markets.ts')),oddsClient=await import(moduleUrl('lib/member-odds-client.ts'));
const panelCode=ts.transpileModule(readFileSync('app/sport-markets.tsx','utf8'),{fileName:'sport-markets.tsx',compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const Panel=new Function('require','exports','React',panelCode+';return exports.default;')(key=>{if(key==='@/lib/member-odds-client')return oddsClient;assert.equal(key,'@/lib/sport-super-markets');return marketModule;},{},React);
const renderScenario=(props={})=>renderToStaticMarkup(React.createElement(Panel,{game:scenarioGame,analysis:scenarioAnalysis,snapshot:scenarioSource(),sport:'NBA',now:scenarioNow,...props}));
const recommendationCount=html=>(html.match(/>推薦<\/em>/g)||[]).length;
test('reported NBA regular-season card shows both scenario recommendations with the unchanged screenshot probabilities',()=>{
 const before=JSON.stringify(scenarioAnalysis),html=renderScenario();
 assert.equal(recommendationCount(html),2);
 assert.match(html,/底特律活塞<\/span><em[^>]*>推薦<\/em>/);
 assert.match(html,/<span>小<\/span><em[^>]*>推薦<\/em>/);
 for(const text of ['2 種玩法','52.6%','44.5%','2.9%','56.3%','43.7%','推薦依目前球員情境推估；出賽狀態待確認。'])assert.ok(html.includes(text),text);
 assert.ok(html.includes('來源尚未提供此全場玩法'));
 assert.equal(JSON.stringify(scenarioAnalysis),before,'presentation must not claim player availability is confirmed');
});
test('NBA and WNBA apply the same pending-availability market presentation',()=>{
 for(const sport of ['NBA','WNBA']){
  const s=scenarioSource();s.sportGames[0].league=sport;s.sportGames[0].away=scenarioGame.away.name;
  const html=renderScenario({sport,snapshot:s});
  assert.equal(recommendationCount(html),2,sport);
  assert.ok(html.includes('出賽狀態待確認'),sport);
 }
 const confirmed=renderScenario({analysis:{...scenarioAnalysis,playerContext:{...scenarioAnalysis.playerContext,recommendationEligible:true}}});
 assert.equal(recommendationCount(confirmed),2);assert.ok(!confirmed.includes('出賽狀態待確認'));
});
test('unavailable, waiting, stale, future or missing NBA models cannot gain a recommendation from the scenario path',()=>{
 const unavailable=renderScenario({analysis:{...scenarioAnalysis,playerContext:{...scenarioAnalysis.playerContext,status:'unavailable'}}});
 assert.equal(recommendationCount(unavailable),0);assert.ok(unavailable.includes('球員資料尚未完整，暫停推薦'));
 for(const analysis of [null,{...scenarioAnalysis,status:'waiting'},...[-900000,60001].map(delta=>({...scenarioAnalysis,capturedAt:new Date(scenarioNow+delta).toISOString()}))]){
  const html=renderScenario({analysis,analysisState:'ready'});
  assert.equal(recommendationCount(html),0);assert.ok(!html.includes('推薦依目前球員情境推估'));
 }
});
test('NBA scenario picks still require a fresh unique fixture and open primary quotes for each market',()=>{
 const closed=scenarioSource();closed.sportGames[0].displayMarkets[0].quotes[0].open=false;
 const partial=renderScenario({snapshot:closed});assert.equal(recommendationCount(partial),1);assert.ok(partial.includes('來源已暫停此全場玩法'));assert.match(partial,/<span>小<\/span><em[^>]*>推薦<\/em>/);
 for(const mutate of [s=>s.fetchedAt=new Date(scenarioNow-150000).toISOString(),s=>s.sportGames.push(structuredClone(s.sportGames[0])),s=>s.sportGames[0].away='紐約尼克',s=>s.sportGames[0].start='2026/10/22 03:00:00',s=>s.sportGames[0].displayMarkets.forEach(m=>m.quotes[0].open=false)]){
  const s=scenarioSource();mutate(s);assert.equal(recommendationCount(renderScenario({snapshot:s})),0);
 }
 assert.equal(recommendationCount(renderScenario({error:'來源連線失效'})),0);
 for(const patch of [{state:'live'},{timeConfirmed:false},{start:new Date(scenarioNow).toISOString()}])assert.equal(renderScenario({game:{...scenarioGame,...patch}}),'');
});
