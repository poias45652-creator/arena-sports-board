import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=f=>ts.transpileModule(readFileSync(new URL('../lib/'+f,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const {superOdds}=await import(url(code('super007.ts').replace("'./settlement'",JSON.stringify(url(code('settlement.ts'))))));
const {matchOdds}=await import(url(code('pinnacle.ts')));
const {isPregame,canShowPregameMarkets,matchStartLabel}=await import(url(code('baseball.ts')));
const now=Date.parse('2026-09-25T16:40:00Z');
const game=(number,date='2026-09-25T20:05:00Z')=>({id:100+number,date,gameType:'R',state:'Preview',status:'Scheduled',startTimeTBD:false,doubleHeader:'Y',gameNumber:number,home:{name:'New York Yankees',zh:'紐約洋基'},away:{name:'Baltimore Orioles',zh:'巴爾的摩金鶯'}});
const row=(number,start='2026/09/26 07:10:00')=>({id:200+number,home:`紐約洋基(G${number})(主)`,away:`巴爾的摩金鶯(G${number})`,start,live:false,displayMarkets:[{period:'full',type:103,quotes:[{primary:true,open:true,homeLine:'1+50',homePrice:'.95',awayPrice:'.95'}]}]});
const snapshot=rows=>({source:'hr9988',fetchedAt:new Date(now).toISOString(),games:rows});
const convert=(rows,games)=>superOdds(snapshot(rows),games,t=>t.zh);

test('TBD G2 never presents its placeholder as a confirmed time or a started game',()=>{
 const g={...game(2,'2026-09-25T20:10:00Z'),startTimeTBD:true};
 assert.match(matchStartLabel(g),/G1 結束後，開賽時間待定/);
 assert.doesNotMatch(matchStartLabel(g),/04:10/);
 assert.equal(canShowPregameMarkets(g,now),true);
 assert.equal(canShowPregameMarkets(g,Date.parse(g.date)+60000),true);
 assert.equal(isPregame(g,now),false);
 for(const state of ['Live','Final'])assert.equal(canShowPregameMarkets({...g,state},now),false);
 assert.equal(canShowPregameMarkets({...g,status:'Postponed'},now),false);
});
test('a confirmed split-doubleheader start remains the official time',()=>{
 const g={...game(2,'2026-09-25T21:35:00Z'),doubleHeader:'S'};
 assert.match(matchStartLabel(g),/05:35/);
 assert.equal(isPregame(g,now),true);
});
test('explicit G1/G2 identity survives changed times and same-time placeholders',()=>{
 const games=[game(1),{...game(2),startTimeTBD:true}];
 const result=convert([row(1,'2026/09/26 04:05:00'),row(2)],games);
 assert.equal(result.games.length,2);
 assert.equal(matchOdds(games[0],result).id,201);
 assert.equal(matchOdds(games[1],result).id,202);
 assert.equal(matchOdds(games[1],result).sourceStart,'2026-09-26T07:10:00+08:00');
 assert.equal(matchOdds(games[1],result).spread.first,.95);
});
test('supported second-game suffixes map exactly, including source home marker',()=>{
 for(const suffix of [' G2','（G2）','[G2]','(2)','[2]','第二場','第2場']){
  const r={...row(2),home:'紐約洋基'+suffix+'(主)',away:'巴爾的摩金鶯'+suffix};
  assert.equal(convert([r],[game(1),game(2)]).games[0]?.gameId,102,suffix);
 }
});
test('conflicting numbers, opposite orientation, other dates and duplicate sources fail closed',()=>{
 const games=[game(1),game(2)];
 for(const rows of [[{...row(2),away:'巴爾的摩金鶯(G1)'}],[{...row(2),home:'巴爾的摩金鶯(G2)',away:'紐約洋基(G2)'}],[row(2,'2026/09/27 07:10:00')],[row(2),{...row(2),id:999}]])assert.equal(convert(rows,games).games.length,0);
 assert.equal(convert([row(2)],[{...game(2),doubleHeader:'N'}]).games.length,0);
});
test('unlabelled events retain the ten-minute and unique-fixture safeguards',()=>{
 const unlabelled={...row(1),home:'紐約洋基(主)',away:'巴爾的摩金鶯',start:'2026/09/26 04:05:00'};
 assert.equal(convert([unlabelled],[game(1)]).games.length,1);
 assert.equal(convert([unlabelled],[game(1),game(2)]).games.length,0);
 assert.equal(convert([{...unlabelled,start:'2026/09/26 07:10:00'}],[game(1)]).games.length,0);
});
test('matched closed primaries remain closed rather than promoted',()=>{
 const r=row(2);r.displayMarkets[0].quotes[0].open=false;
 const out=convert([r],[game(2)]).games[0];
 assert.equal(out.spread,null);assert.match(out.issues.spread,/沒有開放的主盤/);
});
