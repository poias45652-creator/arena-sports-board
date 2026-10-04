import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const code=file=>stripTypeScriptTypes(readFileSync(new URL('../lib/'+file,import.meta.url),'utf8'));
const {inspectSportEvent,matchSportEvent,sportTeamKey,settleSportGrid,basketballMarketGrid,footballMarketGrids,preferredSportOutcome}=await import(url(code('sport-super-markets.ts').replace("'./settlement'",JSON.stringify(url(code('settlement.ts'))))));
const now=Date.parse('2026-10-04T20:00:00+08:00');
const game={id:'regression-aze-ltu',league:'uefa.nations',state:'scheduled',timeConfirmed:true,start:'2026-10-04T21:00:00+08:00',home:{name:'亞塞拜然'},away:{name:'立陶宛'}};
const quote={primary:true,open:true,homeLine:'',awayLine:'0/0.5',total:'2.5',homePrice:.95,awayPrice:.95,over:.96,under:.94,drawPrice:2.7};
const sourceRow=()=>({id:10001,league:'FOOTBALL',competition:'uefa.nations',live:false,home:'阿塞拜疆(主)',away:'立陶宛',start:'2026/10/04 21:00:00',displayMarkets:[101,102,110].map(type=>({period:'full',type,quotes:[{...quote}]}))});
const snapshot=()=>({source:'test-only',fetchedAt:new Date(now).toISOString(),sportGames:[sourceRow()]});
const inspect=(s=snapshot(),g=game,sport='FOOTBALL',clock=now)=>inspectSportEvent(s,g,sport,clock);
const mutated=changes=>{const s=snapshot();Object.assign(s.sportGames[0],changes);return s;};

test('Azerbaijan source aliases match the displayed team and preserve all three full-game markets',()=>{
 for(const home of ['阿塞拜疆(主)','亞塞拜疆（主）','阿塞拜然','亞塞拜然',' 阿塞拜疆（ 主 ） ']){
  const s=mutated({home}),r=inspect(s);
  assert.equal(r.status,'matched');assert.equal(r.event.id,10001);assert.ok(r.event.spread);assert.ok(r.event.total);assert.ok(r.event.moneyline);
  assert.deepEqual(r.event,matchSportEvent(s,game,'FOOTBALL',now));
  assert.equal(r.event.spread.line,.25);assert.deepEqual(r.event.spread.parts,[0,.5]);assert.equal(r.event.total.line,2.5);
 }
});
test('existing national-team and club alias mappings stay compatible',()=>{
 for(const [source,display] of [['聖馬力諾','聖馬利諾'],['意大利','義大利'],['克羅地亞','克羅埃西亞'],['斯洛文尼亞','斯洛維尼亞'],['阿仙奴','阿森納'],['祖雲達斯','尤文圖斯']])assert.equal(sportTeamKey(source+'(主)'),sportTeamKey(display));
});
test('never collapse youth, women, corner markets, or a different team into the national team',()=>{
 for(const home of ['阿塞拜疆U21(主)','阿塞拜疆(女)(主)','阿塞拜疆-角球數(主)','阿塞拜疆B(主)','亞美尼亞(主)'])assert.equal(inspect(mutated({home})).event,null);
});
test('missing source capabilities are not misreported as unopened markets',()=>{
 assert.equal(inspect(null).status,'loading');
 assert.equal(inspect({source:'Super007',games:[],fetchedAt:new Date(now).toISOString()}).status,'source_missing_sport');
 assert.equal(inspect({...snapshot(),sportGames:[]}).status,'sport_empty');
 assert.equal(inspect({...snapshot(),sportGames:[{league:'NBA'}]}).status,'sport_empty');
});
test('freshness and future-clock boundaries are enforced without changing timestamps',()=>{
 const s=snapshot();const original=structuredClone(s);
 assert.equal(inspect(s,game,'FOOTBALL',now+149999).status,'matched');
 assert.equal(inspect(s,game,'FOOTBALL',now+150000).status,'source_stale');
 assert.equal(inspect({...s,fetchedAt:'invalid'}).status,'source_time_invalid');
 assert.equal(inspect({...s,fetchedAt:new Date(now+60000).toISOString()}).status,'matched');
 assert.equal(inspect({...s,fetchedAt:new Date(now+60001).toISOString()}).status,'source_time_invalid');
 assert.equal(inspect(s,game,'FOOTBALL',NaN).status,'fixture_unavailable');
 assert.equal(matchSportEvent(s,game,'FOOTBALL',NaN),null);
 assert.deepEqual(s,original);
});
test('started, cancelled, unconfirmed, or invalid fixture times remain unavailable',()=>{
 for(const changes of [{state:'live'},{state:'final'},{state:'cancelled'},{timeConfirmed:false},{start:new Date(now).toISOString()},{start:'invalid'}])assert.equal(inspect(snapshot(),{...game,...changes}).status,'fixture_unavailable');
});
test('reversed home and away teams are diagnosed but never swapped to force a match',()=>{
 const r=inspect(mutated({home:'立陶宛(主)',away:'阿塞拜疆'}));assert.equal(r.status,'sides_reversed');assert.equal(r.event,null);
});
test('wrong opponent cannot inherit another match market',()=>{
 assert.equal(inspect(mutated({away:'拉脫維亞'})).status,'fixture_unconfirmed');
});
test('competition mismatch and unknown competition fail closed',()=>{
 for(const competition of ['eng.1',null,'uefa.champions']){
  const r=inspect(mutated({competition}));assert.equal(r.status,'competition_mismatch');assert.equal(r.event,null);
 }
});
test('in-play and unknown source state are not accepted as pregame',()=>{
 for(const live of [true,undefined,0,'false'])assert.equal(inspect(mutated({live})).status,'source_not_pregame');
});
test('source time format and ten-minute matching window stay strict',()=>{
 for(const start of ['invalid','2026-10-04T21:00:00+08:00','2026/10/04 21:00'])assert.equal(inspect(mutated({start})).status,'source_start_invalid');
 for(const start of ['2026/10/04 20:50:00','2026/10/04 21:10:00'])assert.equal(inspect(mutated({start})).status,'matched');
 for(const start of ['2026/10/04 20:49:59','2026/10/04 21:10:01','2026/10/05 21:00:00'])assert.equal(inspect(mutated({start})).status,'start_mismatch');
});
test('duplicate matching rows are not silently deduplicated or selected',()=>{
 const s=snapshot();s.sportGames.push({...sourceRow(),id:10002});assert.equal(inspect(s).status,'ambiguous');assert.equal(inspect(s).event,null);
});
test('an unrelated duplicate or malformed row does not block a unique valid fixture',()=>{
 const s=snapshot();s.sportGames.push(null,{},{...sourceRow(),competition:'eng.1'},{...sourceRow(),start:'2026/10/05 21:00:00'});
 assert.equal(inspect(s).status,'matched');assert.equal(inspect(s).event.id,10001);
});
test('closed primary is not replaced by an open alternative; duplicated market is rejected',()=>{
 const s=snapshot(),m=s.sportGames[0].displayMarkets[0];m.quotes[0].open=false;m.quotes.push({...quote,primary:false});
 assert.equal(inspect(s).event.spread,null);assert.ok(inspect(s).event.total);
 m.quotes[0].open=true;s.sportGames[0].displayMarkets.push(m);assert.equal(inspect(s).event.spread,null);
});
test('missing, malformed, first-half-only, or invalid-price markets do not crash or fabricate quotes',()=>{
 for(const displayMarkets of [null,{},[null],[],[{period:'firstHalf',type:101,quotes:[quote]}],[{period:'full',type:101,quotes:{}}],[{period:'full',type:101,quotes:[null]}],[{period:'full',type:101,quotes:[{...quote,homePrice:0}]}]]){
  const r=inspect(mutated({displayMarkets}));assert.equal(r.status,'matched');assert.equal(r.event.spread,null);
 }
});
test('NBA and WNBA still match only their own sports and preserve handicap direction',()=>{
 for(const sport of ['NBA','WNBA']){
  const g={...game,league:undefined,home:{name:'主隊'},away:{name:'客隊'}};
  const r={...sourceRow(),league:sport,competition:null,home:'主隊(主)',away:'客隊',displayMarkets:[103,104,111].map(type=>({period:'full',type,quotes:[{...quote,awayLine:'1-25',total:'228.5'}]}))};
  const s={...snapshot(),sportGames:[r]},result=inspect(s,g,sport);
  assert.equal(result.status,'matched');assert.equal(result.event.spread.line,1);assert.equal(result.event.spread.boundary,.25);assert.equal(result.event.total.line,228.5);
  assert.equal(inspect(s,g,sport==='NBA'?'WNBA':'NBA').event,null);
 }
});
test('matched football totals produce a real normalized settlement, not a display-only fix',()=>{
 const r=inspect().event,grid=[{value:2,p:.638},{value:3,p:.362}],over=settleSportGrid(grid,r.total,'over'),under=settleSportGrid(grid,r.total,'under');
 assert.equal(over.win,.362);assert.equal(under.win,.638);assert.equal(preferredSportOutcome([over,under]),1);
 for(const result of [over,under])assert.ok(Math.abs(result.win+result.partialWin+result.push+result.partialLoss+result.loss-1)<1e-12);
 assert.equal(settleSportGrid([{value:0,p:1}],r.spread,'home').partialWin,1);
 assert.equal(settleSportGrid([{value:0,p:1}],r.spread,'away').partialLoss,1);
});
test('basketball remains tie-free and football preserves the model-distribution consistency gate',()=>{
 const grid=basketballMarketGrid(2,10.5,'margin',.555);assert.ok(!grid.some(r=>r.value===0));assert.ok(Math.abs(grid.reduce((n,r)=>n+r.p,0)-1)<1e-9);
 const analysis={expected:{home:1,away:1},probabilities:{home:.25,draw:.5,away:.25},scoreDistribution:{home:1,away:1,scores:[{home:2,away:0,probability:.25},{home:0,away:2,probability:.25},{home:1,away:1,probability:.5}]}};
 assert.ok(footballMarketGrids(analysis));assert.equal(footballMarketGrids({...analysis,expected:{home:2,away:1}}),null);
});
test('matching and diagnostics have no network side effects or cross-member state',()=>{
 const real=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Matching must never make a network request');};
 try{
  assert.equal(inspect().status,'matched');assert.equal(inspect({...snapshot(),sportGames:[]}).status,'sport_empty');assert.equal(inspect().event.id,10001);
 }finally{globalThis.fetch=real;}
});
