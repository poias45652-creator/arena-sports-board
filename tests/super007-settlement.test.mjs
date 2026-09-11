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
