import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveFeed} from '../server/baseball-live-feed.mjs';

const date='2026-10-29',at=Date.parse(date+'T10:00:00Z');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const display={preferCached:true};
const game=(league='NPB',patch={})=>({key:league+':one',id:'one',league,date,status:'live',
 home:{id:'1',name:'主隊',score:2},away:{id:'2',name:'客隊',score:1},source:{fetchedAt:new Date(at).toISOString()},...patch});
const feed=(league='NPB',games=[game(league)])=>({league,date,games,errors:[],status:'ok'});

test('expired memory returns immediately while 100 displays and a fresh reader share one refresh',async()=>{
 let now=at,reads=0,calls=0,writes=0;const refresh=deferred();
 const get=createLiveFeed({day:()=>date,now:()=>now,read:async()=>{reads++;return [];},
  write:async()=>{writes++;return {written:1};},collect:async()=>++calls===1?feed():refresh.promise});
 const first=await get('NPB');now+=60001;
 const results=await Promise.all(Array.from({length:100},()=>get('NPB',date,display)));
 assert.equal(calls,2);assert.equal(reads,2);assert.equal(writes,1);
 for(const result of results){
  assert.equal(result.status,'stale');assert.equal(result.refreshing,true);assert.equal(result.pollAfterMs,5000);
  assert.equal(result.games[0].sourceStale,true);assert.equal(result.games[0].source.fetchedAt,first.games[0].source.fetchedAt);
  assert.equal(result.checkedAt,first.checkedAt);assert.equal(result.noGames,undefined);
 }
 assert.equal(first.stale,false);assert.equal(first.games[0].sourceStale,false,'retention must not mutate cached success');
 let freshFinished=false;const fresh=get('NPB',date).then(value=>{freshFinished=true;return value;});
 await flush();assert.equal(freshFinished,false,'analysis and background callers still wait for verified fresh data');
 refresh.resolve(feed('NPB',[game('NPB',{home:{id:'1',name:'主隊',score:3},source:{fetchedAt:new Date(now).toISOString()}})]));
 const updated=await fresh;assert.equal(updated.games[0].home.score,3);assert.equal(updated.refreshing,undefined);
 assert.equal(updated.stale,false);assert.equal(await get('NPB',date,display),updated);
 assert.equal(calls,2);assert.equal(writes,2);
});

test('cold display uses same-day stored data before the provider responds, without extra reads',async()=>{
 const upstream=deferred(),stored=game();let calls=0,reads=0;
 const get=createLiveFeed({day:()=>date,now:()=>at,read:async()=>{reads++;return [stored];},
  write:async()=>({written:1}),collect:async()=>{calls++;return upstream.promise;}});
 const results=await Promise.all([get('NPB',date,display),get('NPB',date,display)]);
 assert.equal(reads,1);assert.equal(calls,1);
 assert.equal(results[0].games[0].source.fetchedAt,stored.source.fetchedAt);
 assert.equal(results[0].checkedAt,undefined);assert.equal(results[0].refreshing,true);
 assert.equal(stored.sourceStale,undefined);
 upstream.resolve(feed());await get('NPB');assert.equal((await get('NPB',date,display)).status,'ok');
});

test('a stalled storage read cannot hold an empty display beyond the 2-second data budget',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const storage=deferred(),upstream=deferred();let reads=0,calls=0,finished=false;
 const get=createLiveFeed({day:()=>date,now:()=>at,read:async()=>{reads++;return storage.promise;},
  write:async()=>({written:1}),collect:async()=>{calls++;return upstream.promise;}});
 const waiting=get('NPB',date,display).then(value=>{finished=true;return value;});
 await flush();t.mock.timers.tick(1999);await flush();assert.equal(finished,false);
 t.mock.timers.tick(1);const result=await waiting;
 assert.equal(result.status,'unavailable');assert.equal(result.refreshing,true);
 assert.deepEqual(result.games,[]);assert.equal(result.noGames,undefined);assert.equal(result.checkedAt,undefined);
 assert.match(result.error,/不代表今日沒有比賽/);assert.equal(calls,0);
 const again=get('NPB',date,display);await flush();t.mock.timers.tick(2000);await again;assert.equal(reads,1);
 storage.resolve([]);await flush();assert.equal(calls,1);upstream.resolve(feed());await get('NPB');
 assert.equal((await get('NPB',date,display)).status,'ok');
});

test('a fast first collection wins before the display budget without being marked stale',async()=>{
 const get=createLiveFeed({day:()=>date,now:()=>at,read:async()=>[],write:async()=>({written:1}),collect:async()=>feed()});
 const result=await get('NPB',date,display);assert.equal(result.status,'ok');assert.equal(result.stale,false);
 assert.equal(result.refreshing,undefined);
});

test('one stalled league does not block another league or leak yesterday into the next day',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const slow=deferred();let calls=[];
 const get=createLiveFeed({day:()=>date,now:()=>at,read:async()=>[game('NPB'),game('KBO',{date:'2026-10-28'})],
  write:async()=>({written:1}),collect:async(league,options)=>{calls.push(league+':'+options.date);return league==='KBO'?slow.promise:{...feed(league),date:options.date,games:[game(league,{date:options.date})]};}});
 const pending=get('KBO',date,display);await flush();t.mock.timers.tick(2000);
 const missing=await pending;assert.deepEqual(missing.games,[]);assert.equal(missing.noGames,undefined);
 const other=await get('CPBL',date,display);assert.equal(other.league,'CPBL');assert.equal(other.status,'ok');
 const tomorrow=await get('NPB','2026-10-30',display);assert.equal(tomorrow.date,'2026-10-30');
 assert.ok(tomorrow.games.every(g=>g.date==='2026-10-30'));assert.equal(tomorrow.refreshing,undefined);
 slow.reject(Error('offline'));const failed=await get('KBO');assert.equal(failed.refreshing,undefined);
 assert.deepEqual(calls,['KBO:'+date,'CPBL:'+date,'NPB:2026-10-30']);
});

test('failed refresh retains scores and source time, ends fast polling, and can recover later',async()=>{
 let now=at,calls=0;const outage=deferred();
 const get=createLiveFeed({day:()=>date,now:()=>now,read:async()=>[],write:async()=>({written:1}),
  collect:async()=>{calls++;return calls===2?outage.promise:feed('NPB',[game('NPB',{source:{fetchedAt:new Date(now).toISOString()}})]);}});
 await get('NPB');now+=60001;const retained=await get('NPB',date,display);assert.equal(retained.refreshing,true);
 outage.reject(Error('provider unavailable'));const failure=await get('NPB');
 assert.equal(failure.status,'stale');assert.equal(failure.refreshing,undefined);assert.equal(failure.pollAfterMs,60000);
 assert.equal(failure.games[0].home.score,2);assert.equal(failure.games[0].source.fetchedAt,new Date(at).toISOString());
 assert.equal(await get('NPB',date,display),failure);assert.equal(calls,2);
 now+=60001;await get('NPB',date,display);const recovered=await get('NPB');assert.equal(calls,3);assert.equal(recovered.status,'ok');
});

test('invalid or future-dated stored observations never appear as a retained display',async()=>{
 for(const patch of [{league:'KBO'},{date:'2026-10-28'},{source:{fetchedAt:'invalid'}},{source:{fetchedAt:new Date(at+120000).toISOString()}}]){
  const get=createLiveFeed({day:()=>date,now:()=>at,read:async()=>[game('NPB',patch)],
   write:async()=>assert.fail('unverified data cannot be written'),collect:async()=>{throw Error('offline');}});
  const result=await get('NPB',date,display);assert.deepEqual(result.games,[]);assert.equal(result.refreshing,undefined);
 }
});

test('an expired verified offday is not reused as new evidence while refreshing',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let now=at,calls=0;const slow=deferred();
 const proof={date,listedGames:0,teams:['1','2','5','6','7','8'].map(id=>({teamId:'cpbl.t.'+id,from:date,through:date,fetchedAt:new Date(at).toISOString()}))};
 const get=createLiveFeed({day:()=>date,now:()=>now,read:async()=>[],write:async()=>assert.fail('offdays have no rows'),
  collect:async()=>++calls===1?{league:'CPBL',date,games:[],errors:[],status:'ok',scheduleProof:proof}:slow.promise});
 assert.equal((await get('CPBL')).noGames,true);now+=300001;
 const wait=get('CPBL',date,display);await flush();t.mock.timers.tick(2000);
 const refreshing=await wait;assert.equal(refreshing.noGames,undefined);assert.equal(refreshing.refreshing,true);
 slow.reject(Error('offline'));await get('CPBL');
});

test('expired memory remains available even while the database is unresponsive',async()=>{
 let now=at,reads=0;const storage=deferred();
 const get=createLiveFeed({day:()=>date,now:()=>now,read:async()=>++reads===1?[]:storage.promise,
  write:async()=>({written:1}),collect:async()=>feed('NPB',[game('NPB',{source:{fetchedAt:new Date(now).toISOString()}})])});
 await get('NPB');now+=60001;const result=await get('NPB',date,display);
 assert.equal(result.games.length,1);assert.equal(result.refreshing,true);assert.equal(reads,2);
 storage.reject(Error('database unavailable'));assert.equal((await get('NPB')).status,'ok');
});
