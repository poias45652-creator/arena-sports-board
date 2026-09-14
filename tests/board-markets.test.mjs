import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
const code=f=>ts.transpileModule(readFileSync(new URL('../lib/'+f,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const marketsURL=url(code('markets.ts')),settlementURL=url(code('settlement.ts'));
const {scoreGrid,settle}=await import(marketsURL);
const {BOARD_MARKETS,boardQuote,makeBoardPick,sameBoardPick,settleBoard,binaryOutcome}=await import(url(code('board-markets.ts').replace("'./markets'",JSON.stringify(marketsURL))));
const {superOdds}=await import(url(code('super007.ts').replace("'./settlement'",JSON.stringify(settlementURL))));
const {parseHrGameDetail}=await import(url(code('hr9988.ts')));
const {orderMatchCards}=await import(url(code('match-card-order.ts')));
const fixture=()=>JSON.parse(readFileSync(new URL('./fixtures/hr9988-game-detail.json',import.meta.url),'utf8'));
const game={id:1,date:'2026-09-10T20:10:00Z',home:{id:136,name:'Seattle',zh:'西雅圖水手'},away:{id:140,name:'Texas',zh:'德州遊騎兵'}};
function normalize(raw=fixture()){
 return superOdds(parseHrGameDetail(raw,'2026-09-10T19:58:00Z'),[game],t=>t.zh).games[0];
}
test('all seven observed source markets preserve period, line, orientation and distinct prices',()=>{
 const raw=fixture(),wagers=raw.data[0].Items.List[0].Team[0].Wager;
 // Distinct odd/even prices make accidental field swapping detectable.
 const oe=wagers.find(w=>w.WagerGrpID===11&&w.WagerTypeID===105).Odds[0];oe.OverOdds='0.910';oe.UnderOdds='0.960';
 const row=normalize(raw);
 assert.equal(BOARD_MARKETS.length,7);
 for(const {key} of BOARD_MARKETS)assert.ok(boardQuote(row,key),key);
 assert.equal(row.spread.line,-1);assert.equal(row.spread.boundary,.9);
 assert.equal(row.additional.runline.line,-1.5);assert.equal(row.additional.runline.first,1.844);assert.equal(row.additional.runline.second,.452);
 assert.equal(row.additional.moneyline.first,.889);assert.equal(row.additional.moneyline.second,.997);
 assert.ok(row.additional.firstHalfSpread.line===0);assert.equal(row.additional.firstHalfSpread.boundary,-.05);
 assert.equal(row.total.line,7);assert.equal(row.additional.firstHalfTotal.line,3);
 assert.equal(row.additional.firstHalfOddEven.first,.91);assert.equal(row.additional.firstHalfOddEven.second,.96);
 assert.equal(new Set(BOARD_MARKETS.map(({key})=>boardQuote(row,key).signature)).size,7);
});
test('closed primaries, ambiguous markets and missing prices never promote an alternate or another period',()=>{
 for(const key of ['runline','moneyline','firstHalfSpread','firstHalfTotal','firstHalfOddEven']){
  const raw=fixture(),wagers=raw.data[0].Items.List[0].Team[0].Wager;
  const [group,type]=({runline:[10,106],moneyline:[10,111],firstHalfSpread:[11,103],firstHalfTotal:[11,104],firstHalfOddEven:[11,105]})[key];
  const market=wagers.find(w=>w.WagerGrpID===group&&w.WagerTypeID===type);
  market.Odds.push({...market.Odds[0],GameID:998877,Status:1});market.Odds[0].Status=-1;
  assert.equal(boardQuote(normalize(raw),key),null,key);
  market.Odds[0].Status=1;wagers.push(structuredClone(market));
  assert.equal(boardQuote(normalize(raw),key),null,key+' duplicate');
 }
 const raw=fixture();raw.data[0].Items.List[0].Team[0].EvtStatus=-4;
 for(const {key} of BOARD_MARKETS)assert.equal(boardQuote(normalize(raw),key),null);
 const invalid=fixture();invalid.data[0].Items.List[0].Team[0].Wager.find(w=>w.WagerTypeID===111).Odds[0].HomeOdds='';
 assert.equal(boardQuote(normalize(invalid),'moneyline'),null);
});
test('full-game behavior is unchanged and first-half ties are retained for PK refunds',()=>{
 const full=scoreGrid(4,4),half=scoreGrid(4*5/9,4*5/9,false);
 assert.ok(full.every(o=>o.home!==o.away));
 const tie=half.filter(o=>o.home===o.away).reduce((sum,o)=>sum+o.p,0);assert.ok(tie>.1);
 assert.ok(Math.abs(half.reduce((sum,o)=>sum+o.p,0)-1)<1e-10);
 const q={line:0,first:.94,second:.94,signature:'half-pk'};
 const p=makeBoardPick(1,'firstHalfSpread','home',q),outcome=settleBoard(half,p);
 assert.ok(Math.abs(outcome.push-tie)<1e-10);assert.ok(Math.abs(outcome.win-outcome.loss)<1e-10);
 const fullPick=makeBoardPick(1,'spread','home',{...q,line:-1.5});
 assert.deepEqual(settleBoard(full,fullPick),settle(full,fullPick));
});
test('one-loss uses its own 1.5 line; half percentage and parity settle the correct score',()=>{
 const row=normalize();
 const runline=makeBoardPick(1,'runline','home',row.additional.runline);
 assert.equal(settleBoard([{home:4,away:3,p:1}],runline).loss,1);
 assert.equal(settleBoard([{home:5,away:3,p:1}],runline).win,1);
 const spread=makeBoardPick(1,'firstHalfSpread','home',row.additional.firstHalfSpread);
 assert.equal(settleBoard([{home:2,away:2,p:1}],spread).partialLoss,1);
 assert.equal(settleBoard([{home:2,away:2,p:1}],{...spread,side:'away'}).partialWin,1);
 const grid=[{home:0,away:0,p:.2},{home:2,away:1,p:.3},{home:1,away:1,p:.5}],q=row.additional.firstHalfOddEven;
 assert.equal(settleBoard(grid,makeBoardPick(1,'firstHalfOddEven','over',q)).win,.3);
 assert.equal(settleBoard(grid,makeBoardPick(1,'firstHalfOddEven','under',q)).win,.7);
 assert.equal(settleBoard(grid,makeBoardPick(1,'firstHalfOddEven','home',q)),null);
});
test('selections keep period and price identity after quote refresh',()=>{
 const q={line:-1.5,first:.95,second:.95,signature:'original'};
 const full=makeBoardPick(1,'spread','home',q),half=makeBoardPick(1,'firstHalfSpread','home',q),one=makeBoardPick(1,'runline','home',q);
 assert.equal(sameBoardPick(full,half),false);assert.equal(sameBoardPick(full,one),false);
 assert.equal(sameBoardPick(full,{...full,quote:'updated-price'}),false);
 assert.equal(sameBoardPick(full,{...full}),true);
 assert.equal(binaryOutcome(NaN),null);assert.equal(binaryOutcome(.6).win,.6);
});
test('games with only a newly supported open market are above all unopened games',()=>{
 const closed={...game,id:2},halfOnly={...game,id:3},source={id:33,home:'Seattle',away:'Texas',start:game.date,spread:null,total:null,additional:{firstHalfTotal:normalize().additional.firstHalfTotal}};
 assert.deepEqual(orderMatchCards([closed,halfOnly],g=>g.id===3?source:null,true).map(g=>g.id),[3,2]);
 assert.deepEqual(orderMatchCards([closed,halfOnly],g=>g.id===3?source:null,false).map(g=>g.id),[2,3]);
});
