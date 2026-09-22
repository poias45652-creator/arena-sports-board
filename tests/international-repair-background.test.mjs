import test from 'node:test';
import assert from 'node:assert/strict';
import {createBaseballRefreshLoops} from '../server/baseball-refresh-loop.mjs';
import {retainFixtureStart} from '../server/baseball-live-retention.mjs';
import {createLiveFeed} from '../server/baseball-live-feed.mjs';
import {recoverNpbPregameState} from '../server/baseball-npb-start.mjs';
const base={league:'NPB',date:'2026-09-22',id:'123',key:'NPB:123',away:{id:'1'},home:{id:'6'},startTime:'2026-09-22T05:00:00Z',source:{url:'https://example.test/game/123',fetchedAt:'2026-09-22T04:00:00Z'}};
test('same-fixture start survives the transition to live, with its original provenance',()=>{
 const fresh={...base,startTime:null,status:'live',source:{...base.source,fetchedAt:'2026-09-22T06:00:00Z'}};
 const out=retainFixtureStart(fresh,base);assert.equal(out.startTime,base.startTime);
 assert.equal(out.startTimeSource.fetchedAt,base.source.fetchedAt);assert.equal(out.source.fetchedAt,fresh.source.fetchedAt);assert.equal(fresh.startTime,null);
});
test('retention never crosses a date, game, home/away identity, or overwrites a reschedule',()=>{
 const fresh={...base,startTime:null,source:{...base.source,fetchedAt:'2026-09-22T06:00:00Z'}};
 for(const changed of [{date:'2026-09-23'},{id:'other'},{key:'other'},{away:{id:'6'},home:{id:'1'}},{source:{fetchedAt:'2026-09-22T03:00:00Z'}}])assert.equal(retainFixtureStart({...fresh,...changed},base).startTime,null);
 assert.equal(retainFixtureStart({...fresh,startTime:'2026-09-22T07:00:00Z'},base).startTime,'2026-09-22T07:00:00Z');
});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(getLive,getPregame=async()=>({})){
 let clock=Date.parse('2026-09-22T06:00:00Z');const jobs=[],cancelled=new Set();
 const loop=createBaseballRefreshLoops({getLive,getPregame,day:()=> '2026-09-22',now:()=>clock,
  schedule:(fn,delay)=>{const job={fn,delay};jobs.push(job);return job;},cancel:job=>cancelled.add(job),staggerMs:0});
 return {loop,jobs,cancelled,advance:ms=>clock+=ms};
}
const feed=league=>({league,date:'2026-09-22',status:'ok',games:[{status:'live',startTime:'2026-09-22T05:00:00Z'}]});
test('three independent loops run; a delayed CPBL request cannot block NPB or KBO',async()=>{
 let release;const called=[];const h=harness(async league=>{called.push(league);if(league==='CPBL')await new Promise(r=>release=r);return feed(league);});
 h.loop.start();h.loop.start();assert.equal(h.jobs.length,3);
 for(const job of h.jobs.splice(0))job.fn();await flush();
 assert.deepEqual(called,['CPBL','NPB','KBO']);assert.equal(h.jobs.length,2);assert.ok(h.jobs.every(j=>j.delay===60000));
 h.loop.stop();release();await flush();assert.equal(h.loop.snapshot().enabled,false);assert.equal(h.jobs.length,2);
});
test('source failures back off in only that league, and stop cancels pending checks',async()=>{
 const h=harness(async league=>{if(league==='CPBL')throw Error('test failure');return feed(league);});h.loop.start();
 for(const job of h.jobs.splice(0))job.fn();await flush();
 assert.equal(h.loop.snapshot().leagues.find(s=>s.league==='CPBL').status,'unavailable');
 assert.equal(h.loop.snapshot().leagues.find(s=>s.league==='KBO').status,'ok');
 const retry=h.jobs.find(j=>j.delay===60000);h.advance(60000);retry.fn();await flush();
 assert.ok(h.jobs.some(j=>j.delay===120000));h.loop.stop();assert.ok(h.cancelled.size>=3);
});
test('pregame statistics refresh on their own cadence and never run for live-only games',async()=>{
 const calls=[];const h=harness(async league=>({...feed(league),games:league==='NPB'?[{status:'pregame',startTime:'2026-09-22T06:10:00Z'}]:feed(league).games}),async league=>calls.push(league));
 h.loop.start();for(const job of h.jobs.splice(0))job.fn();await flush();assert.deepEqual(calls,['NPB']);
 h.advance(60000);for(const job of h.jobs.splice(0))job.fn();await flush();assert.deepEqual(calls,['NPB']);h.loop.stop();
});
test('today and tomorrow caches coexist, and retained clocks are persisted',async()=>{
 let calls=0,saved;const now=Date.parse('2026-09-22T06:00:00Z');
 const get=createLiveFeed({day:()=>base.date,now:()=>now,read:async()=>[base],write:async x=>{saved=x;return {written:x.games.length};},collect:async(league,{date})=>{calls++;return {league,date,games:[{...base,date,startTime:null,status:'live',source:{...base.source,fetchedAt:new Date(now).toISOString()}}]};}});
 const first=await get('NPB',base.date);assert.equal(first.games[0].startTime,base.startTime);assert.equal(saved.games[0].startTime,base.startTime);
 await get('NPB','2026-09-23');await get('NPB',base.date);assert.equal(calls,2);
});
test('NPB probable-starter label enables only verified future fixtures',()=>{
 const g={...base,startTime:'2026-09-23T09:00:00Z',date:'2026-09-23',status:'unknown',rawStatus:'日本ハム 18:00 予告先発 楽天',away:{score:null},home:{score:null}};
 assert.equal(recoverNpbPregameState(structuredClone(g)).status,'pregame');
 assert.equal(recoverNpbPregameState({...structuredClone(g),source:{fetchedAt:'2026-09-23T10:00:00Z'}}).status,'unknown');
 assert.equal(recoverNpbPregameState({...structuredClone(g),away:{score:1}}).status,'unknown');
 assert.equal(recoverNpbPregameState({...structuredClone(g),status:'live'}).status,'live');
});
