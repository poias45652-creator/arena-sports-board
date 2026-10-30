import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveFeed} from '../server/baseball-live-feed.mjs';

const date='2026-10-12',observed=Date.parse(date+'T09:00:00Z');
const makeGame=(id,homeId,awayId,extra={})=>({
 key:`NPB:${id}`,id,league:'NPB',date,startTime:date+'T05:00:00.000Z',status:'pregame',
 home:{id:homeId,name:`主${homeId}`,score:null,hits:null,errors:null},
 away:{id:awayId,name:`客${awayId}`,score:null,hits:null,errors:null},
 inning:null,half:null,balls:null,strikes:null,outs:null,bases:null,
 innings:{away:[],home:[]},currentBatter:null,currentPitcher:null,
 source:{provider:'sportsnavi',url:`https://baseball.yahoo.co.jp/npb/game/${id}/top`,fetchedAt:new Date(observed-3600000).toISOString()},...extra
});
const conditional=()=>makeGame('2021040000','1','3');
const played=()=>makeGame('2021040001','7','8',{
 status:'final',home:{id:'7',name:'主7',score:1},away:{id:'8',name:'客8',score:4},
 source:{provider:'sportsnavi',url:'https://baseball.yahoo.co.jp/npb/game/2021040001/score',fetchedAt:new Date(observed).toISOString()}
});
const proof=()=>({
 schemaVersion:1,kind:'npb-dated-first-team-schedule',league:'NPB',date,
 source:{provider:'sportsnavi',url:`https://baseball.yahoo.co.jp/npb/schedule/?date=${date}`,fetchedAt:new Date(observed).toISOString()},
 listedGames:[{id:'2021040001',homeId:'7',awayId:'8'}],
 completedFirstStages:[{startDate:'2026-10-10',thirdGameDate:date,homeId:'1',awayId:'3',winnerId:'3',eliminatedId:'1',wins:[0,2],sourceUrl:'https://baseball.yahoo.co.jp/npb/schedule/first/cs?date=2026-10-10'}]
});
function setup({stored=[conditional()],scheduleProof=proof(),errors=[],extra=[]}={}){
 let now=observed,fail=false;const writes=[];
 const get=createLiveFeed({day:()=>date,now:()=>now,read:async()=>stored,write:async value=>{writes.push(value);return {written:value.games.length};},collect:async()=>{
  if(fail)throw Error('source outage');
  return {league:'NPB',date,collectedAt:new Date(now).toISOString(),status:errors.length?'partial':'ok',games:[played(),...extra],errors,warnings:[],scheduleProof};
 }});
 return {get,writes,advance:ms=>now+=ms,outage:()=>fail=true,stored};
}

test('completed 2–0 first stage retires only its unplayed third fixture and clears the false partial banner',async()=>{
 const x=setup(),feed=await x.get('NPB');
 assert.equal(feed.status,'ok');assert.equal(feed.error,undefined);assert.equal(feed.stale,false);
 assert.equal(feed.games.length,1);assert.equal(feed.games[0].id,'2021040001');
 assert.equal(feed.games[0].home.score,1);assert.equal(feed.games[0].away.score,4);
 assert.equal(feed.games[0].source.fetchedAt,new Date(observed).toISOString());
 assert.equal(feed.retiredFixtures[0].id,'2021040000');assert.equal(feed.retiredFixtures[0].reason,'npb_first_stage_completed');
 assert.equal(x.stored[0].status,'pregame');assert.equal(x.writes.length,1);
 assert.deepEqual(x.writes[0].games.map(g=>g.id),['2021040001']);
});

test('an absent fixture without complete schedule and series proof remains stale',async()=>{
 const x=setup({scheduleProof:null}),feed=await x.get('NPB');
 assert.equal(feed.status,'partial');assert.equal(feed.games.length,2);
 assert.equal(feed.games.find(g=>g.id==='2021040000').sourceStale,true);
 assert.deepEqual(feed.retiredFixtures,[]);
});

test('stored pre-start empty batting totals are excluded without deleting or refreshing the original record',async()=>{
 const old=conditional(),row={id:null,name:'0',stats:{AT_BATS:0,RUNS:0,HITS:0,RBIS:0,HOME_RUNS:null,WALKS:0,STRIKEOUTS:0}};
 old.source.fetchedAt='2026-10-11T08:32:09.030Z';old.batting={home:[structuredClone(row)],away:[structuredClone(row)]};
 const before=structuredClone(old),x=setup({stored:[old]});
 let feed=await x.get('NPB');
 assert.equal(feed.status,'ok');assert.equal(feed.error,undefined);assert.equal(feed.games.length,1);
 assert.equal(feed.retiredFixtures[0].id,old.id);assert.deepEqual(x.stored[0],before);
 assert.deepEqual(x.writes[0].games.map(g=>g.id),['2021040001']);
 x.outage();x.advance(300001);feed=await x.get('NPB');
 assert.equal(feed.status,'stale');assert.equal(feed.games.length,1);assert.equal(feed.retiredFixtures[0].id,old.id);
 assert.deepEqual(x.stored[0],before);
});

test('a missing played final is retained all day even if the same teams won their series',async()=>{
 const old=conditional();old.status='final';old.home.score=1;old.away.score=4;
 const x=setup({stored:[old]}),feed=await x.get('NPB');
 assert.equal(feed.status,'partial');assert.equal(feed.games.length,2);
 const retained=feed.games.find(g=>g.id===old.id);assert.equal(retained.sourceStale,true);
 assert.equal(retained.source.fetchedAt,old.source.fetchedAt);assert.equal(retained.away.score,4);
 assert.deepEqual(feed.retiredFixtures,[]);
});

test('a retired conditional fixture cannot mask an independent score fetch failure',async()=>{
 const x=setup({errors:['2021040002: score unavailable']}),feed=await x.get('NPB');
 assert.equal(feed.status,'partial');assert.ok(feed.error);
 assert.deepEqual(feed.sourceErrors,['2021040002: score unavailable']);assert.equal(feed.retiredFixtures.length,1);
});

test('current verified game data wins over a contradictory retirement proof',async()=>{
 const resumed=conditional();resumed.source.fetchedAt=new Date(observed).toISOString();
 const x=setup({extra:[resumed]}),feed=await x.get('NPB');
 assert.equal(feed.games.length,2);assert.deepEqual(feed.retiredFixtures,[]);
 assert.equal(feed.games.find(g=>g.id===resumed.id).sourceStale,false);
});

test('source outages preserve the last visible result without resurrecting an unchanged retired row',async()=>{
 const x=setup();await x.get('NPB');x.outage();x.advance(300001);
 let feed=await x.get('NPB');assert.equal(feed.status,'stale');assert.equal(feed.games.length,1);
 assert.equal(feed.games[0].sourceStale,true);assert.equal(feed.retiredFixtures.length,1);
 assert.equal(feed.games[0].source.fetchedAt,new Date(observed).toISOString());
 x.advance(3600000);feed=await x.get('NPB');
 assert.equal(feed.games.length,1);assert.equal(feed.retiredFixtures.length,1);
 assert.equal(feed.games[0].source.fetchedAt,new Date(observed).toISOString());
});

test('newer evidence in storage invalidates a prior retirement during an outage',async()=>{
 const x=setup();await x.get('NPB');x.outage();x.advance(300001);
 x.stored[0]={...conditional(),source:{...conditional().source,fetchedAt:new Date(observed+1000).toISOString()}};
 const feed=await x.get('NPB');assert.equal(feed.status,'stale');assert.equal(feed.games.length,2);
 assert.deepEqual(feed.retiredFixtures,[]);
});

test('responsive displays do not resurrect retired rows while a shared refresh is running',async()=>{
 const x=setup();await x.get('NPB');x.outage();x.advance(300001);
 const retained=await x.get('NPB',undefined,{preferCached:true});
 assert.equal(retained.refreshing,true);assert.equal(retained.games.length,1);
 assert.equal(retained.games[0].sourceStale,true);assert.equal(retained.games[0].source.fetchedAt,new Date(observed).toISOString());
 const completed=await x.get('NPB');assert.equal(completed.games.length,1);assert.equal(completed.retiredFixtures.length,1);
});
