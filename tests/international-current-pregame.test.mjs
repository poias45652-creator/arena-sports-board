import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {currentPregame,addNewsStarters,pregameMissing}=await import(moduleUrl('lib/international-current-pregame.ts'));
const {collectProfilePlayers,collectProfileGames}=await import(moduleUrl('lib/international-profile-source.ts'));
const baseline=JSON.parse(readFileSync('data/cpbl-pregame-20260920.json','utf8'));
const news=JSON.parse(readFileSync('data/cpbl-starter-news-20260920.json','utf8'));
const side=()=>({id:'x',name:'',score:null});
function live(old,starters={away:null,home:null}){return {league:'CPBL',date:old.date,id:'343',status:'pregame',startTime:old.start.replace(' ','T')+'+08:00',away:{...side(),name:old.away.team},home:{...side(),name:old.home.team},starters,source:{provider:'test',url:'https://tw.sports.yahoo.com/cpbl/',fetchedAt:'2026-09-20T05:10:00Z'},lineups:{away:[],home:[]}};}
test('news fills six dated names, preserves prior stats and never spills into another date',()=>{
 const before=JSON.stringify(baseline),value=addNewsStarters(baseline,news);
 assert.equal(JSON.stringify(baseline),before);assert.equal(pregameMissing(value).starters,6);
 assert.equal(value.games[1].away.starter.name,'李東洺');assert.equal(value.games[2].home.starter.name,'林子崴');
 assert.equal(value.games[1].away.starter.quality,'unavailable');assert.equal(pregameMissing(value).era,0);
 assert.equal(addNewsStarters({...baseline,date:'2026-09-21'},news).games[1].away.starter.name,'');
});
test('a changed starter never inherits another pitcher ERA, WHIP or recent results',()=>{
 const archive=addNewsStarters(baseline,news),g=archive.games[0];g.away.starter.quality='source_reported';g.away.starter.season.whip='1.23';g.away.starter.season.era='3.12';
 const now=live(g,{away:{name:'替補先發',era:2.34},home:null});
 const result=currentPregame('CPBL',g.date,{games:[now]},[archive]);
 assert.equal(result.games[0].away.starter.name,'替補先發');assert.equal(result.games[0].away.starter.season.era,'2.34');assert.equal(result.games[0].away.starter.season.whip,'');
 assert.deepEqual(result.games[0].away.starter.recent.rows,[]);assert.equal(result.games[0].away.retainedSource.observedAt,g.source.observedAt);
});
test('stale, wrong-date and already-started observations cannot freshen a pregame archive',()=>{
 const archive=addNewsStarters(baseline,news),g=archive.games[0];
 for(const change of [x=>x.sourceStale=true,x=>x.date='2026-09-21',x=>x.status='live',x=>x.source.fetchedAt='2026-09-20T08:00:00Z']){const x=live(g);change(x);assert.deepEqual(currentPregame('CPBL',g.date,{games:[x]},[archive]).games,archive.games);}
 assert.equal(currentPregame('CPBL','2026-09-21',{games:[]},[archive]).games.length,0);
});
test('missing update fields preserve provenance and flagged stats remain flagged',()=>{
 const archive=addNewsStarters(baseline,news),g=archive.games[0];g.away.starter.quality='needs_review';g.away.starter.season.era='6.75';
 const result=currentPregame('CPBL',g.date,{games:[live(g,{away:{name:g.away.starter.name,era:1},home:null})]},[archive]);
 assert.equal(result.games[0].away.starter.quality,'needs_review');assert.equal(result.games[0].away.starter.season.era,'6.75');
 assert.equal(result.games[0].home.starter.source.observedAt,news.source.observedAt);
});
test('CPBL collection cannot call the official website, including a players fallback',async()=>{
 const original=globalThis.fetch,urls=[];globalThis.fetch=async url=>{urls.push(String(url));throw Error('test unavailable');};
 try{await assert.rejects(()=>collectProfilePlayers('CPBL','AAA',2026));assert.equal(urls.length,0);await assert.rejects(()=>collectProfileGames('CPBL',2026));assert.equal(urls.length,6);assert.ok(urls.every(u=>new URL(u).hostname==='tw.sports.yahoo.com'));}finally{globalThis.fetch=original;}
});
