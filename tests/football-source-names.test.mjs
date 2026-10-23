import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {moduleUrl} from './profile-loader.mjs';
const {matchSportEvent,sportMarketStatus,sportTeamKey}=await import(moduleUrl('lib/sport-super-markets.ts'));
const {footballTeamName,footballDistribution}=await import(moduleUrl('lib/football.ts'));
const {parseFootballEvents}=await import(moduleUrl('lib/football.ts'));
const {sportSourceAudit}=await import(moduleUrl('lib/sport-super-markets.ts'));
const monzaCapture=JSON.parse(fs.readFileSync('tests/fixtures/football-monza-source-20261019.json'));
const monzaNow=Date.parse(monzaCapture.capturedAt);
const monzaGame=()=>parseFootballEvents(monzaCapture.schedule,'ita.1')[0];
// Production metadata proves identity and availability, not the prices.
// Quotes and model below are synthetic regression inputs, never live recommendations.
const monzaSnapshot=()=>({source:'test-only',fetchedAt:monzaCapture.capturedAt,sportGames:[{
 ...monzaCapture.fixture,league:'FOOTBALL',displayMarkets:[
  {type:101,period:'full',quotes:[{primary:true,open:true,homeLine:'0.5',awayLine:'',homePrice:.9,awayPrice:.95}]},
  {type:102,period:'full',quotes:[{primary:true,open:true,total:'2.5',over:.9,under:.95}]},
  {type:110,period:'full',quotes:[{primary:true,open:true,homePrice:2.8,awayPrice:1.2,drawPrice:2.5}]},
 ]
}]});
const forestCapture=JSON.parse(fs.readFileSync('tests/fixtures/football-forest-source-20261023.json'));
const forestNow=Date.parse(forestCapture.capturedAt);
const forestGame=()=>parseFootballEvents(forestCapture.schedule,'eng.1')[0];
// Reuse explicitly synthetic quotes; the production capture contains no prices.
const forestSnapshot=()=>({source:'test-only',fetchedAt:forestCapture.capturedAt,sportGames:[{
 ...forestCapture.fixture,league:'FOOTBALL',displayMarkets:monzaSnapshot().sportGames[0].displayMarkets,
}]});

test('October 23 Ipswich–Forest source pairs with the independently retrieved schedule',()=>{
 const game=forestGame(),snapshot=forestSnapshot();
 assert.equal(game.id,'401879253');assert.equal(game.home.id,'373');assert.equal(game.away.id,'393');
 assert.equal(game.start,'2026-10-23T19:00:00.000Z');
 assert.equal(game.home.name,'伊普斯維奇');assert.equal(game.away.name,'諾丁漢森林');
 for(const awayName of ['諾丁漢森林','Nottingham Forest']){
  const status=sportMarketStatus(snapshot,{...game,away:{...game.away,name:awayName}},'FOOTBALL',forestNow);
  assert.equal(status.code,'matched');assert.equal(status.event.id,25125177);assert.equal(status.availableCount,3);
 }
 assert.deepEqual(sportSourceAudit(snapshot,forestNow).unrecognizedTeamNames,[]);
 for(const name of ['諾定咸森林',' 諾定咸森林（主） ','Nottingham Forest','諾丁漢森林'])assert.equal(sportTeamKey(name,'FOOTBALL'),'諾丁漢森林');
});

test('Forest alias preserves squad, sport, opponent, orientation, time and source guards',()=>{
 const game=forestGame();
 for(const sport of ['NBA','WNBA'])assert.equal(sportTeamKey('諾定咸森林',sport),'諾定咸森林');
 for(const suffix of ['U21','(女)','預備隊','二隊']){
  const snapshot=forestSnapshot();snapshot.sportGames[0].away+=suffix;
  assert.notEqual(sportTeamKey(snapshot.sportGames[0].away,'FOOTBALL'),'諾丁漢森林');
  assert.equal(matchSportEvent(snapshot,game,'FOOTBALL',forestNow),null);
 }
 for(const patch of [{home:game.away,away:game.home},{away:{name:'曼城'}},{league:'uefa.champions'},{start:'2026-10-23T20:00:00Z'}]){
  assert.equal(matchSportEvent(forestSnapshot(),{...game,...patch},'FOOTBALL',forestNow),null);
 }
 for(const sourcePatch of [{live:true},{live:null},{start:'2026/10/24 04:00:00'}]){
  const snapshot=forestSnapshot();Object.assign(snapshot.sportGames[0],sourcePatch);
  assert.equal(matchSportEvent(snapshot,game,'FOOTBALL',forestNow),null);
 }
 assert.equal(matchSportEvent(forestSnapshot(),game,'FOOTBALL',forestNow+150000),null);
 const duplicate=forestSnapshot();duplicate.sportGames.push({...duplicate.sportGames[0],id:999});
 assert.equal(sportMarketStatus(duplicate,game,'FOOTBALL',forestNow).code,'fixture_ambiguous');
 const closed=forestSnapshot();closed.sportGames[0].displayMarkets[0].quotes[0].open=false;
 const status=sportMarketStatus(closed,game,'FOOTBALL',forestNow);
 assert.equal(status.availableCount,2);assert.equal(status.markets.spread.code,'closed');
});

test('October 19 Monza source name joins the official fixture and cached English cards',()=>{
 const game=monzaGame(),snapshot=monzaSnapshot();
 assert.equal(game.home.id,'4007');assert.equal(game.away.id,'2925');
 assert.equal(game.start,'2026-10-19T16:30:00.000Z');
 assert.equal(game.home.name,'蒙扎');assert.equal(game.home.englishName,'Monza');
 for(const homeName of ['Monza','蒙扎']){
  const result=sportMarketStatus(snapshot,{...game,home:{...game.home,name:homeName}},'FOOTBALL',monzaNow);
  assert.equal(result.code,'matched');assert.equal(result.event.id,25112206);
  assert.equal(result.availableCount,3);
 }
 assert.deepEqual(sportSourceAudit(snapshot,monzaNow).unrecognizedTeamNames,[]);
 for(const name of ['Monza','蒙扎','蒙扎(主)',' 蒙扎（主） '])assert.equal(sportTeamKey(name,'FOOTBALL'),'蒙扎');
});

test('Monza localization preserves team, squad, league, time and unique-source guards',()=>{
 const game=monzaGame();
 for(const sport of ['NBA','WNBA'])assert.equal(sportTeamKey('Monza',sport),'Monza');
 for(const name of ['Monza U21','Monza Women','蒙扎U21','蒙扎女足','蒙扎預備隊']){
  assert.notEqual(sportTeamKey(name,'FOOTBALL'),'蒙扎');
  assert.equal(matchSportEvent(monzaSnapshot(),{...game,home:{...game.home,name}},'FOOTBALL',monzaNow),null);
 }
 for(const patch of [{home:game.away,away:game.home},{away:{name:'羅馬'}},{league:'uefa.champions'},{start:'2026-10-20T16:30:00Z'}]){
  assert.equal(matchSportEvent(monzaSnapshot(),{...game,...patch},'FOOTBALL',monzaNow),null);
 }
 assert.equal(matchSportEvent(monzaSnapshot(),game,'FOOTBALL',monzaNow+150000),null);
 const duplicate=monzaSnapshot();duplicate.sportGames.push({...duplicate.sportGames[0],id:999});
 assert.equal(sportMarketStatus(duplicate,game,'FOOTBALL',monzaNow).code,'fixture_ambiguous');
});

test('real market component renders Monza and reported Ipswich–Forest cards after pairing, and suppresses unavailable inputs',async()=>{
 const markets=await import(moduleUrl('lib/sport-super-markets.ts'));
 const oddsClient=await import(moduleUrl('lib/member-odds-client.ts'));
 const code=ts.transpileModule(fs.readFileSync('app/sport-markets.tsx','utf8'),{fileName:'markets.tsx',compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const Component=new Function('require','exports','React',code+'\nreturn exports.default;')(key=>{
  if(key==='@/lib/member-odds-client')return oddsClient;
  assert.equal(key,'@/lib/sport-super-markets');return markets;
 },{},React);
 for(const [game,source,now] of [[monzaGame(),monzaSnapshot,monzaNow],[forestGame(),forestSnapshot,forestNow]]){
 const analysis={status:'ready',capturedAt:source().fetchedAt,expected:{home:1,away:1.5},...footballDistribution(1,1.5)};
 const render=(snapshot,model=analysis)=>renderToStaticMarkup(React.createElement(Component,{game,snapshot,analysis:model,sport:'FOOTBALL',now}));
 const html=render(source());
 assert.match(html,/data-market-status="matched"/);assert.ok(html.includes('2 種玩法'));
 assert.equal((html.match(/>推薦<\/em>/g)||[]).length,2);
 assert.ok(!html.includes('玩法配對待確認'));
 const closed=source();for(const market of closed.sportGames[0].displayMarkets)market.quotes[0].open=false;
 const stale={...analysis,capturedAt:new Date(now-15*60000).toISOString()};
 for(const output of [render(null),render(closed),render(source(),stale),render(source(),{...analysis,scoreDistribution:undefined})])assert.ok(!output.includes('>推薦</em>'));
 }
});
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
