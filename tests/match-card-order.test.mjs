import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../lib/match-card-order.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {orderMatchCards}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const games=Object.freeze([{id:1},{id:2},{id:3},{id:4}]);
const quote=(line=0)=>({line,first:.95,second:.95,signature:'source-quote'});
const market=(spread=null,total=null)=>({id:99,away:'Away',home:'Home',start:'2026-09-12T10:00:00Z',spread,total});

test('whole cards with an open spread or total come first; all closed and unmatched games remain at the bottom',()=>{
 const markets=new Map([[1,market()],[2,market(quote())],[4,market(null,quote(8.5))]]);
 const sorted=orderMatchCards(games,g=>markets.get(g.id)||null,true);
 assert.deepEqual(sorted.map(g=>g.id),[2,4,1,3]);
 assert.equal(sorted[0],games[1]);assert.equal(sorted[2],games[0]);
 assert.deepEqual(games.map(g=>g.id),[1,2,3,4]);assert.equal(sorted.length,games.length);
});

test('zero spread and fractional profit odds are valid, missing or invalid quote data is not',()=>{
 for(const invalid of [null,{...quote(),line:NaN},{...quote(),first:0},{...quote(),second:Infinity},{...quote(),signature:''}]){
  assert.deepEqual(orderMatchCards(games,g=>g.id===1?market(invalid):g.id===4?market(quote(0)):null,true).map(g=>g.id),[4,1,2,3]);
 }
});

test('closed markets move down and newly opened markets move up after a refresh',()=>{
 let opened=new Set([2,4]);
 const match=g=>opened.has(g.id)?market(quote()):null;
 assert.deepEqual(orderMatchCards(games,match,true).map(g=>g.id),[2,4,1,3]);
 opened=new Set([1,3]);
 assert.deepEqual(orderMatchCards(games,match,true).map(g=>g.id),[1,3,2,4]);
});

test('failed or stale source data cannot promote old markets, and no cards are removed',()=>{
 const match=g=>g.id===4?market(quote()):null;
 assert.deepEqual(orderMatchCards(games,match,false),games);
 assert.deepEqual(orderMatchCards(games,()=>null,true),games);
 assert.deepEqual(orderMatchCards([],match,true),[]);
});
