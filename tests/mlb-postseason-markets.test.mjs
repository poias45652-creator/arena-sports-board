import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {hrMlbCompetition,parseHrGameDetail}=await import(moduleUrl('lib/hr9988.ts'));
const {superOdds}=await import(moduleUrl('lib/super007.ts'));
const {matchOdds}=await import(moduleUrl('lib/pinnacle.ts'));
const {BOARD_MARKETS,boardQuote}=await import(moduleUrl('lib/board-markets.ts'));
const {teamZh}=await import(moduleUrl('app/zh.ts'));
const capture=JSON.parse(readFileSync(new URL('./fixtures/mlb-world-series-source-20261023.json',import.meta.url),'utf8'));
const {source,official}=capture;
// Only the event metadata and seven group/type pairs were logged. Quote values
// below are deliberately synthetic and are not claimed to be real market prices.
function raw(){return {code:200,data:[{CatID:101,CatName:'棒球',Items:{List:[{LeagueNameStr:source.league,Team:[{EvtID:source.id,HomeTeamStr:source.home,AwayTeamStr:source.away,ScheduleTimeStr:source.start,Live:source.live,EvtStatus:source.status,Wager:source.markets.map((m,i)=>({WagerGrpID:m.group,WagerTypeID:m.type,Odds:[{GameID:9000+i,Status:1,HomeHdp:m.group===11?'0-50':'1+50',AwayHdp:'',OULine:m.group===11?'4-50':'8+50',HomeHdpOdds:'.95',AwayHdpOdds:'.94',OverOdds:'.96',UnderOdds:'.93'}]}))}]}]}}]};}
const convert=input=>superOdds(parseHrGameDetail(input,capture.capturedAt),[official,{...official,id:849802,date:'2026-10-25T00:00:00Z'}],teamZh);
test('reported World Series category reaches the correct official fixture and all seven separate markets',()=>{
 const input=raw(),parsed=parseHrGameDetail(input,capture.capturedAt);
 assert.equal(parsed.games.length,1);assert.equal(parsed.sourceLeagues[0].league,'MLB');
 const odds=convert(input),game=matchOdds(official,odds);assert.ok(game);
 assert.equal(game.id,25118511);assert.equal(game.gameId,849805);assert.equal(game.home,'Milwaukee Brewers');assert.equal(game.away,'Tampa Bay Rays');
 for(const {key} of BOARD_MARKETS)assert.ok(boardQuote(game,key),key);
 assert.equal(game.spread.line,-1);assert.equal(game.spread.boundary,.5);
 assert.ok(game.additional.firstHalfSpread.line===0);assert.equal(game.additional.firstHalfSpread.boundary,-.5);
 assert.equal(game.total.line,8);assert.equal(game.additional.firstHalfTotal.line,4);
 assert.notEqual(game.spread.signature,game.additional.firstHalfSpread.signature);
 assert.equal(matchOdds({...official,id:849802,date:'2026-10-25T00:00:00Z'},odds),null);
});
test('senior MLB stages accept formatting variants while simulated, props and unrelated competitions stay excluded',()=>{
 for(const name of ['MLB 美國職棒',source.league,'MLB 美國職棒－世界大賽','MLB 美國職棒 - 季後賽','MLB 美國職棒-外卡系列賽','MLB 美國職棒-分區系列賽','MLB 美國職棒-聯盟冠軍賽'])assert.equal(hrMlbCompetition(name),true,name);
 for(const name of ['MLB 美國職棒-世界大賽總冠軍','MLB 美國職棒-世界大賽-特殊玩法','MLB 美國職棒-虛擬賽事','MLB 美國職棒-模擬','MLB 美國職棒-小聯盟','日本職棒-世界大賽','世界大賽','美國職棒女子聯賽']){
  assert.equal(hrMlbCompetition(name),false,name);const input=raw();input.data[0].Items.List[0].LeagueNameStr=name;assert.equal(parseHrGameDetail(input,capture.capturedAt).games.length,0,name);
 }
});
test('World Series parsing preserves live, duplicate, identity, time and closed-primary guards',()=>{
 for(const change of [t=>{t.Live=true;},t=>{[t.HomeTeamStr,t.AwayTeamStr]=[t.AwayTeamStr,t.HomeTeamStr];},t=>{t.ScheduleTimeStr='2026/10/24 09:00:00';},t=>{t.HomeTeamStr='密爾瓦基釀酒人(G2)(主)';}]){
  const input=raw();change(input.data[0].Items.List[0].Team[0]);assert.equal(convert(input).games.length,0);
 }
 const input=raw(),team=input.data[0].Items.List[0].Team[0],market=team.Wager.find(w=>w.WagerGrpID===11&&w.WagerTypeID===103);
 market.Odds.push({...market.Odds[0],GameID:9999});market.Odds[0].Status=-1;
 assert.equal(matchOdds(official,convert(input)).additional.firstHalfSpread,null);
 input.data[0].Items.List[0].Team.push({...team});assert.throws(()=>parseHrGameDetail(input,capture.capturedAt),/重複賽事/);
});
