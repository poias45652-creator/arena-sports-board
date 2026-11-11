import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleUrl} from './profile-loader.mjs';
const {regionalTeams}=await import(moduleUrl('lib/regional-basketball-names.ts'));
const {sportTeamKey}=await import(moduleUrl('lib/sport-team-names.ts'));
const {regionalTzMarkets}=await import(moduleUrl('lib/regional-tz-markets.ts'));
const {parseHrGameDetail}=await import(moduleUrl('lib/hr9988.ts'));

// Names, opponents and kickoff times observed in production pairing logs.
// Prices are synthetic and must never be presented as historical quotes.
const reported=[
 {league:'NBL',id:25179316,date:'2026-11-08',time:'14:00',home:'珀斯野貓',away:'凱恩斯大班',codes:['PER','CNS']},
 {league:'KBL',id:25179196,date:'2026-11-08',time:'13:00',home:'蔚山現代太陽神',away:'安陽正官庄赤紅火箭',codes:['MOB','JJK']},
 {league:'KBL',id:25182893,date:'2026-11-09',time:'18:00',home:'首爾三星迅雷',away:'水原KT爆音',codes:['SAM','KT']},
];
function capture(row){
 const start=row.date+'T'+row.time+':00+08:00';
 const checkedAt=new Date(Date.parse(start)-60000).toISOString();
 const wager=(type,quote)=>({WagerGrpID:10,WagerTypeID:type,Odds:[{GameID:type,Status:1,...quote}]});
 const team={EvtID:row.id,HomeTeamStr:row.home+'(主)',AwayTeamStr:row.away,ScheduleTimeStr:row.date.replaceAll('-','/')+' '+row.time+':00',EvtStatus:1,Live:false,Wager:[
  wager(103,{HomeHdp:'7.5',HomeHdpOdds:.928,AwayHdpOdds:.915}),
  wager(104,{OULine:'179.5',OverOdds:.944,UnderOdds:.958}),wager(111,{HomeOdds:.6,AwayOdds:1.3})]};
 return parseHrGameDetail({code:200,data:[{CatID:102,Items:{List:[{LeagueNameStr:row.league==='NBL'?'澳洲國家籃球聯賽':'韓國籃球聯賽',Team:[team]}]}}]},checkedAt);
}
for(const row of reported)test(row.league+' production alias '+row.away+' preserves fixture and quote sides',()=>{
 const snapshot=capture(row),[market]=regionalTzMarkets(snapshot);
 assert.ok(market);assert.deepEqual([market.home,market.away],row.codes);
 assert.equal(market.startsAt,new Date(row.date+'T'+row.time+':00+08:00').toISOString());
 assert.equal(market.quotes.length,3);
 const [spread,total,moneyline]=market.quotes;
 assert.equal(spread.line,-7.5);assert.equal(spread.home,.928);assert.equal(spread.away,.915);
 assert.deepEqual(spread.labels,['主讓 -7.5','客受讓 +7.5']);
 assert.equal(total.line,179.5);assert.equal(total.home,.944);assert.equal(total.away,.958);
 assert.equal(moneyline.home,.6);assert.equal(moneyline.away,1.3);
 for(const suffix of ['(女)','U21','二隊']){
  assert.deepEqual(regionalTzMarkets(capture({...row,away:row.away+suffix})),[]);
 }
 const other=row.league==='NBL'?'KBL':'NBL';
 assert.deepEqual(regionalTzMarkets(capture({...row,league:other})),[]);
});
test('all twenty regional clubs and registered aliases retain exact league-scoped identities',()=>{
 for(const league of ['NBL','KBL']){
  assert.equal(Object.keys(regionalTeams[league]).length,10);
  for(const [code,names] of Object.entries(regionalTeams[league]))for(const name of [...names,code]){
   assert.equal(sportTeamKey(name,league),code);
   assert.equal(sportTeamKey(' '+name+'（主） ',league),code);
   for(const suffix of ['(女)','U21','二隊'])assert.notEqual(sportTeamKey(name+suffix,league),code);
  }
 }
});
