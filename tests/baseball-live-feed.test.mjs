import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveFeed} from '../server/baseball-live-feed.mjs';
let time=Date.parse('2026-09-15T07:00:00Z');
const game=(id='a',extra={})=>({key:'NPB:'+id,id,league:'NPB',date:'2026-09-15',status:'pregame',away:{name:'客',score:null},home:{name:'主',score:null},source:{fetchedAt:new Date(time).toISOString()},...extra});
function setup(options={}){
 let calls=0,writes=0;const clock={now:time,date:'2026-09-15'};
 const get=createLiveFeed({day:()=>clock.date,now:()=>clock.now,read:async()=>[],write:async()=>{writes++;return{written:1}},collect:async()=>{calls++;return{schemaVersion:1,league:'NPB',date:clock.date,collectedAt:new Date(clock.now).toISOString(),games:[game()],errors:[]}},...options});
 return{get,clock,calls:()=>calls,writes:()=>writes};
}
test('feed shares cache and does not fabricate pregame scores',async()=>{const x=setup(),a=await x.get('NPB'),b=await x.get('NPB');assert.equal(a,b);assert.equal(x.calls(),1);assert.equal(x.writes(),1);assert.equal(a.games[0].home.score,null);assert.equal(a.pollAfterMs,300000);assert.equal(a.automaticBackgroundSync,false)});
test('simultaneous clients share one source request',async()=>{const x=setup();await Promise.all(Array.from({length:10},()=>x.get('NPB')));assert.equal(x.calls(),1)});
test('cache expiration refreshes the source',async()=>{const x=setup();await x.get('NPB');x.clock.now+=300001;await x.get('NPB');assert.equal(x.calls(),2)});
test('new game date never serves yesterday cache',async()=>{const x=setup();await x.get('NPB');x.clock.date='2026-09-16';const a=await x.get('NPB');assert.equal(a.games.length,0);assert.equal(a.status,'unavailable')});
test('source failure keeps original timestamp and marks data stale',async()=>{const g=game();const x=setup({read:async()=>[g],collect:async()=>{throw Error('blocked')}});const a=await x.get('NPB');assert.equal(a.status,'stale');assert.equal(a.games[0].source.fetchedAt,g.source.fetchedAt);assert.equal(a.games[0].sourceStale,true);assert.equal(x.writes(),0)});
test('partial failure retains missing games without freshening timestamps',async()=>{const old=game('b');const x=setup({read:async()=>[old]});const a=await x.get('NPB');assert.equal(a.status,'partial');assert.equal(a.games.length,2);assert.equal(a.games.find(g=>g.id==='b').sourceStale,true)});
test('no games is not falsely treated as a verified off-day',async()=>{const x=setup({collect:async()=>({league:'NPB',date:'2026-09-15',games:[],errors:[]})});assert.equal((await x.get('NPB')).status,'unavailable')});
test('database write error is visible without dropping fresh source data',async()=>{const x=setup({write:async()=>{throw Error('db')}});const a=await x.get('NPB');assert.equal(a.games.length,1);assert.ok(a.persistence.error)});
test('arbitrary leagues are rejected before collection',async()=>{const x=setup();await assert.rejects(()=>x.get('http://localhost/'),/Invalid league/);assert.equal(x.calls(),0)});
test('a final result does not regress into pregame',async()=>{const x=setup({read:async()=>[game('a',{status:'final',home:{score:4},away:{score:1}})]});const a=await x.get('NPB');assert.equal(a.games[0].status,'final');assert.equal(a.games[0].sourceStale,true)});
test('old source samples are rejected rather than refreshed artificially',async()=>{const x=setup({collect:async()=>({league:'NPB',date:'2026-09-15',games:[game('a',{source:{fetchedAt:'2026-09-14T07:00:00Z'}})],errors:[]})});assert.equal((await x.get('NPB')).status,'unavailable');assert.equal(x.writes(),0)});
test('live cache refresh cadence is 60 seconds, not five minutes',async()=>{const x=setup({collect:async()=>({league:'NPB',date:'2026-09-15',games:[game('a',{status:'live'})],errors:[]})});assert.equal((await x.get('NPB')).pollAfterMs,60000)});

test('an older database snapshot cannot overwrite a newer cached game on failure',async()=>{let fail=false;const older=game('a',{source:{fetchedAt:new Date(time-60000).toISOString()}});const x=setup({read:async()=>[older],collect:async()=>{if(fail)throw Error('blocked');return{league:'NPB',date:'2026-09-15',games:[game()],errors:[]}}});await x.get('NPB');fail=true;x.clock.now+=300001;const a=await x.get('NPB');assert.equal(a.games[0].source.fetchedAt,new Date(time).toISOString());assert.equal(a.stale,true)});
