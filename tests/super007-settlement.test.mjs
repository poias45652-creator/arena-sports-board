import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
const code=f=>ts.transpileModule(readFileSync(new URL('../lib/'+f,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const settlementURL=url(code('settlement.ts'));
const {parseSourceLine,netProfit,parlayReturn}=await import(settlementURL);
const {scoreFraction,settle}=await import(url(code('markets.ts')));
const {superOdds}=await import(url(code('super007.ts').replace("'./settlement'",JSON.stringify(settlementURL))));
const {gradeSavedMarkets}=await import(url(code('recommendation-ledger.ts').replace("'./settlement'",JSON.stringify(settlementURL)).replace("'./markets'",JSON.stringify(url(code('markets.ts'))))));
const pick=(line,boundary,side='home',market='spread')=>({gameId:1,market,side,line,boundary});
test('official examples: 2-50 home loss, 8+50 over win, away 1+50',()=>{
 assert.equal(netProfit(scoreFraction({home:5,away:3},pick(-2,-.5)),.9)*1000,-500);
 assert.equal(netProfit(scoreFraction({home:5,away:3},pick(-2,-.5,'away')),.9)*1000,450);
 assert.equal(netProfit(scoreFraction({home:5,away:3},pick(8,.5,'over','total')),.9)*1000,450);
 assert.equal(netProfit(scoreFraction({home:4,away:5},pick(1,-.5,'away')),.9)*1000,450);
});
test('official parlay examples preserve partial loss principal',()=>{
 assert.ok(Math.abs(parlayReturn(1000,[{fraction:.5,price:.9},{fraction:1,price:.9},{fraction:1,price:.9}]).profit-4234.5)<1e-8);
 assert.ok(Math.abs(parlayReturn(1000,[{fraction:-.5,price:.9},{fraction:1,price:.9},{fraction:1,price:.9}]).profit-805)<1e-8);
 assert.equal(parlayReturn(1000,[{fraction:0,price:.9}]).profit,0);
});
test('percentage, split, quarter, PK and malformed lines',()=>{
 assert.deepEqual(parseSourceLine('1+75'),{line:1,boundary:.75,raw:'1+75'});
 assert.equal(parseSourceLine('7-55').boundary,-.55);
 assert.equal(parseSourceLine('平').line,0);
 assert.equal(parseSourceLine('PK').line,0);
 assert.deepEqual(parseSourceLine('0.5/1').parts,[.5,1]);
 assert.deepEqual(parseSourceLine('1.25').parts,[1,1.5]);
 for(const s of ['', '1+101','1.75foo','1/3','-1+75'])assert.equal(parseSourceLine(s),null);
});
test('live Seattle primary quote survives conversion and gives partial outcome',()=>{
 const g={id:1,date:'2026-09-10T20:10:00Z',home:{name:'Seattle',zh:'西雅圖水手'},away:{name:'Texas',zh:'德州遊騎兵'}};
 const snapshot={source:'Super007',fetchedAt:g.date,games:[{id:8,home:'西雅圖水手(主)',away:'德州遊騎兵',start:'2026/09/11 04:10:00',live:false,markets:[{type:103,quotes:[{primary:true,homeLine:'1+75',awayLine:'',homePrice:'.95',awayPrice:'.95'}]},{type:104,quotes:[{primary:true,total:'7+55',over:'.94',under:'.94'}]}]}]};
 const out=superOdds(snapshot,[g],t=>t.zh).games[0];
 assert.equal(out.spread.display,'主讓 1+75');assert.equal(out.total.display,'7+55');
 const r=settle([{home:4,away:3,p:1}],{...pick(out.spread.line,out.spread.boundary),parts:out.spread.parts});
 assert.equal(r.partialWin,1);assert.equal(r.push,0);assert.equal(r.winWeight,.75);
 assert.equal(scoreFraction({home:4,away:3},pick(out.total.line,out.total.boundary,'under','total')),-.55);
});
test('split settlement and probability mass',()=>{
 assert.equal(scoreFraction({home:3,away:2},{...pick(-.75,0),parts:[-.5,-1]}),.5);
 const r=settle([{home:3,away:2,p:.4},{home:4,away:2,p:.6}],pick(-1,.75));
 assert.equal(r.win+r.partialWin+r.push+r.partialLoss+r.loss,1);
});
test('saved Super007 outcomes use original price and fraction; exclude legacy and future quotes',()=>{
 const report={version:'pregame-super007-v2',capturedAt:'2026-09-10T18:00:00Z',game:{id:1,date:'2026-09-10T20:00:00Z',home:{name:'Seattle'},away:{name:'Texas'}},issues:[],baseline:{markets:[{source:'Super007',quoteFetchedAt:'2026-09-10T17:59:30Z',netOdds:.95,pick:{...pick(-1,.75),display:'主讓 1+75'},probability:{win:.4,partialWin:.2,loss:.4,partialLoss:0}}]}};
 const [r]=gradeSavedMarkets(report,5,4);assert.equal(r.result,'partialWin');assert.ok(Math.abs(r.profitUnits-.7125)<1e-9);
 assert.deepEqual(gradeSavedMarkets({...report,version:'pregame-features-v1'},5,4),[]);
 assert.deepEqual(gradeSavedMarkets({...report,capturedAt:'2026-09-10T20:01:00Z'},5,4),[]);
 report.baseline.markets[0].quoteFetchedAt='2026-09-10T17:00:00Z';assert.deepEqual(gradeSavedMarkets(report,5,4),[]);
});

const {parseHrGameDetail}=await import(url(code('hr9988.ts')));
const hrFixture=()=>JSON.parse(readFileSync(new URL('./fixtures/hr9988-game-detail.json',import.meta.url),'utf8'));
test('MLB display keeps full-game and first-half quotes distinct without changing model input',()=>{
 const raw=parseHrGameDetail(hrFixture(),'2026-09-10T19:58:00Z'),g=raw.games[0];
 const full=g.displayMarkets.find(m=>m.period==='full'&&m.type===103);
 const half=g.displayMarkets.find(m=>m.period==='firstHalf'&&m.type===103);
 assert.equal(full.quotes[0].homeLine,'1+90');assert.equal(half.quotes[0].homeLine,'0-5');
 assert.equal(half.quotes[0].homePrice,'0.940');assert.equal(half.quotes[1].homeLine,'PK');
 assert.equal(g.displayMarkets.find(m=>m.period==='firstHalf'&&m.type===104).quotes[0].total,'3-90');
 assert.equal(g.markets.filter(m=>m.type===103).length,1);assert.equal(g.markets.find(m=>m.type===103).quotes[0].homeLine,'1+90');
 assert.ok(!g.displayMarkets.some(m=>m.period==='firstHalf'&&m.type===111));
 assert.deepEqual(raw.games[3].displayMarkets,[]);
});
test('display retains closed primary and does not substitute an open alternate',()=>{
 const input=hrFixture(),team=input.data[0].Items.List[0].Team[0];
 team.Wager.find(w=>w.WagerGrpID===11&&w.WagerTypeID===103).Odds[0].Status=-1;
 const q=parseHrGameDetail(input,'2026-09-10T19:58:00Z').games[0].displayMarkets.find(m=>m.period==='firstHalf'&&m.type===103).quotes;
 assert.equal(q[0].primary,true);assert.equal(q[0].open,false);assert.equal(q[1].primary,false);assert.equal(q[1].open,true);
 team.EvtStatus=-4;
 assert.ok(parseHrGameDetail(input,'2026-09-10T19:58:00Z').games[0].displayMarkets.every(m=>m.quotes.every(q=>!q.open)));
});
test('hr9988 uploaded grouped response yields four MLB fixtures and preserves original source and primary prices',()=>{
 const raw=parseHrGameDetail(hrFixture(),'2026-09-10T19:58:00Z');assert.equal(raw.games.length,4);assert.equal(raw.source,'hr9988');
 const g={id:1,date:'2026-09-10T20:10:00Z',home:{name:'Seattle',zh:'西雅圖水手'},away:{name:'Texas',zh:'德州遊騎兵'}};
 const odds=superOdds(raw,[g],t=>t.zh);assert.equal(odds.source,'hr9988');assert.equal(odds.games.length,1);
 const row=odds.games[0];assert.equal(row.spread.display,'主讓 1+90');assert.equal(row.spread.boundary,.9);assert.equal(row.spread.first,.95);
 assert.equal(row.total.display,'7+15');assert.equal(row.total.boundary,.15);assert.equal(row.total.first,.94);assert.match(row.total.signature,/hr9988/);
});
test('hr9988 closed primary never promotes an alternate quote and suspended events expose no usable quotes',()=>{
 const input=hrFixture(),team=input.data[0].Items.List[0].Team[0];team.Wager.find(w=>w.WagerGrpID===10&&w.WagerTypeID===103).Odds[0].Status=-1;
 const parsed=parseHrGameDetail(input,'2026-09-10T19:58:00Z');assert.equal(parsed.games[0].markets.find(m=>m.type===103).quotes[0].primary,false);
 team.EvtStatus=-4;assert.ok(parseHrGameDetail(input,'2026-09-10T19:58:00Z').games[0].markets.every(m=>!m.quotes.length));
});
test('hr9988 rejects missing grouped data and duplicate events, allows a valid empty list',()=>{
 for(const input of [null,{code:401,data:[]},{code:200,data:{}},{code:200,data:[{}]}])assert.throws(()=>parseHrGameDetail(input,'2026-09-10T19:58:00Z'));
 const input=hrFixture();input.data[0].Items.List[0].Team.push(input.data[0].Items.List[0].Team[0]);assert.throws(()=>parseHrGameDetail(input,'2026-09-10T19:58:00Z'));
 assert.deepEqual(parseHrGameDetail({code:200,data:[]},'2026-09-10T19:58:00Z').games,[]);
});

// Regression inputs transcribed from the user's 2026-09-12 SUPER screenshots.
// Event IDs below are synthetic; no account data or source credentials are fixtures.
function aliasFixture(which='white-sox') {
 const cards=which==='white-sox';
 const g={id:cards?9101:9102,date:cards?'2026-09-12T00:15:00Z':'2026-09-12T01:40:00Z',
  home:{id:cards?138:133,name:cards?'St. Louis Cardinals':'Athletics',zh:cards?'聖路易紅雀':'運動家'},
  away:{id:cards?145:136,name:cards?'Chicago White Sox':'Seattle Mariners',zh:cards?'芝加哥白襪':'西雅圖水手'}};
 const r={id:cards?9201:9202,home:cards?'聖路易斯紅雀(主)':'奧克蘭運動家(主)',away:g.away.zh,
  start:cards?'2026/09/12 08:15:00':'2026/09/12 09:40:00',live:false,
  markets:[{type:103,quotes:[{primary:true,homeLine:'',awayLine:cards?'1+90':'1-80',homePrice:'0.950',awayPrice:'0.950'}]},
   {type:104,quotes:[{primary:true,total:cards?'8-30':'10-55',over:'0.940',under:'0.940'}]}]};
 return {g,r,snapshot:{source:'hr9988',fetchedAt:'2026-09-11T18:20:00Z',games:[r]}};
}
for(const which of ['white-sox','mariners']) {
 test(`SUPER alias pairs ${which} without changing handicap, total, prices or identifiers`,()=>{
  const {g,r,snapshot}=aliasFixture(which),before=JSON.stringify(snapshot);
  const rows=superOdds(snapshot,[g],t=>t.zh).games;
  assert.equal(rows.length,1);
  const out=rows[0];
  assert.equal(out.id,r.id);assert.equal(out.home,g.home.name);assert.equal(out.away,g.away.name);assert.equal(out.start,g.date);
  assert.equal(out.spread.line,1);assert.equal(out.spread.first,.95);assert.equal(out.spread.second,.95);
  assert.equal(out.spread.boundary,which==='white-sox'?-.9:.8);
  assert.equal(out.spread.display,which==='white-sox'?'客讓 1+90':'客讓 1-80');
  assert.equal(out.total.line,which==='white-sox'?8:10);assert.equal(out.total.boundary,which==='white-sox'?-.3:-.55);
  assert.equal(out.total.first,.94);assert.equal(out.total.second,.94);
  assert.equal(JSON.stringify(snapshot),before);
 });
}
test('aliases work in either home/away position and preserve existing whitespace/host-marker normalization',()=>{
 const {g,r,snapshot}=aliasFixture();
 [g.home,g.away]=[g.away,g.home];[r.home,r.away]=[r.away,r.home];
 r.away=' 聖路易斯紅雀（主） ';
 assert.equal(superOdds(snapshot,[g],t=>t.zh).games.length,1);
});
test('alias matching still rejects reversed teams, wrong opponents and unknown variants',()=>{
 for(const change of [r=>{[r.home,r.away]=[r.away,r.home];},r=>{r.away='芝加哥小熊';},r=>{r.home='其他運動家(主)';}]){
  const {g,r,snapshot}=aliasFixture('mariners');change(r);
  assert.equal(superOdds(snapshot,[g],t=>t.zh).games.length,0);
 }
});
test('alias matching keeps the ten-minute window, live-game exclusion and unique-schedule requirement',()=>{
 const {g,r,snapshot}=aliasFixture();
 g.date='2026-09-12T00:25:00Z';assert.equal(superOdds(snapshot,[g],t=>t.zh).games.length,1);
 g.date='2026-09-12T00:25:01Z';assert.equal(superOdds(snapshot,[g],t=>t.zh).games.length,0);
 g.date='2026-09-13T00:15:00Z';assert.equal(superOdds(snapshot,[g],t=>t.zh).games.length,0);
 g.date='2026-09-12T00:15:00Z';r.live=true;assert.equal(superOdds(snapshot,[g],t=>t.zh).games.length,0);r.live=false;
 assert.equal(superOdds(snapshot,[g,{...g,id:9103}],t=>t.zh).games.length,0);
});
test('matched aliases still reject alternate-only or missing primary markets',()=>{
 const {g,r,snapshot}=aliasFixture();
 r.markets[0].quotes[0].primary=false;r.markets[1].quotes=[];
 const rows=superOdds(snapshot,[g],t=>t.zh).games;
 assert.equal(rows.length,1);assert.equal(rows[0].spread,null);assert.equal(rows[0].total,null);
 assert.match(rows[0].issues.spread,/主盤/);assert.match(rows[0].issues.total,/主盤/);
});

const {formatSpreadLine,formatTotalLine,formatPickLine}=await import(url(code('market-display.ts')));
function displayQuote(rawLine,favorite='home'){
 const g={id:1,date:'2026-09-12T00:15:00Z',home:{name:'Detroit Tigers',zh:'底特律老虎'},away:{name:'Colorado Rockies',zh:'科羅拉多洛磯'}};
 const raw={source:'Super007',fetchedAt:g.date,games:[{id:8,home:g.home.zh,away:g.away.zh,start:'2026/09/12 08:15:00',live:false,markets:[{type:103,quotes:[{primary:true,homeLine:favorite==='home'?rawLine:'',awayLine:favorite==='away'?rawLine:'',homePrice:'.95',awayPrice:'.95'}]}]}]};
 return superOdds(raw,[g],t=>t.zh).games[0].spread;
}
test('each team sees its own spread and opposite percentage sign',()=>{
 for(const [raw,home,away,fraction] of [
  ['1-35','主讓 -1-35','客受讓 +1+35',-.35],
  ['1+35','主讓 -1+35','客受讓 +1-35',.35],
  ['2-50','主讓 -2-50','客受讓 +2+50',-.5],
 ]){
  const q=displayQuote(raw),before=structuredClone(q);
  assert.equal(formatSpreadLine(q,'home'),home);
  assert.equal(formatSpreadLine(q,'away'),away);
  assert.equal(formatPickLine({...q,market:'spread',side:'away'}),away);
  assert.equal(scoreFraction({home:1-q.line,away:1},{...q,market:'spread',side:'home'}),fraction);
  assert.equal(scoreFraction({home:1-q.line,away:1},{...q,market:'spread',side:'away'}),-fraction);
  assert.deepEqual(q,before);
 }
});
test('away favorites invert both sides, including fractional zero spreads',()=>{
 for(const [raw,home,away] of [
  ['1-35','主受讓 +1+35','客讓 -1-35'],
  ['1+35','主受讓 +1-35','客讓 -1+35'],
  ['0-55','主受讓 +0+55','客讓 -0-55'],
 ]){
  const q=displayQuote(raw,'away');
  assert.equal(formatSpreadLine(q,'home'),home);
  assert.equal(formatSpreadLine(q,'away'),away);
 }
 const q=displayQuote('0+50');
 assert.equal(formatSpreadLine(q,'home'),'主讓 -0+50');
 assert.equal(formatSpreadLine(q,'away'),'客受讓 +0-50');
});
test('split, quarter, half-run and PK spreads keep their original meaning',()=>{
 for(const [raw,home,away] of [
  ['0.5/1','主讓 -0.5/-1','客受讓 +0.5/+1'],
  ['1.25','主讓 -1.25','客受讓 +1.25'],
  ['1.5','主讓 -1.5','客受讓 +1.5'],
  ['PK','主平手 PK','客平手 PK'],
 ]){
  const q=displayQuote(raw);
  assert.equal(formatSpreadLine(q,'home'),home);
  assert.equal(formatSpreadLine(q,'away'),away);
 }
});
test('manual spreads follow each team',()=>{
 assert.equal(formatSpreadLine({line:-1.5},'away'),'客受讓 +1.5');
 assert.equal(formatSpreadLine({line:1.5},'away'),'客讓 -1.5');
});

test('total labels reverse percentage signs for under and agree with settlement',()=>{
 for(const [raw,under,fraction] of [
  ['8+65','8-65',.65],['8-65','8+65',-.65],
  ['7+5','7-5',.05],['9+100','9-100',1],['10-100','10+100',-1],
 ]){
  const parsed=parseSourceLine(raw),q={...parsed,display:raw},before=structuredClone(q);
  const overPick={...q,gameId:1,market:'total',side:'over'},underPick={...overPick,side:'under'};
  assert.equal(formatTotalLine(q,'over'),raw);
  assert.equal(formatTotalLine(q,'under'),under);
  assert.equal(formatPickLine(overPick),raw);
  assert.equal(formatPickLine(underPick),under);
  assert.equal(scoreFraction({home:q.line-3,away:3},overPick),fraction);
  assert.equal(scoreFraction({home:q.line-3,away:3},underPick),-fraction);
  assert.deepEqual(q,before);
 }
});
test('integer, half, quarter and split totals preserve the score threshold',()=>{
 for(const raw of ['8','8.5','8.25','7.5/8','8平']){
  const q={...parseSourceLine(raw),display:raw};
  for(const side of ['over','under'])assert.equal(formatTotalLine(q,side),raw);
 }
 assert.equal(formatTotalLine({line:8,boundary:.65},'over'),'8+65');
 assert.equal(formatTotalLine({line:8,boundary:.65},'under'),'8-65');
});
