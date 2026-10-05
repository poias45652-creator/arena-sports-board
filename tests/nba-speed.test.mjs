import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {createNbaAnalysisCache}=await import(moduleUrl('lib/nba-analysis-cache.ts'));
const {compactNbaPage,createNbaPageCache}=await import(moduleUrl('lib/nba-official-cache.ts'));
const {parseOfficialTeam,parseOfficialPlayer}=await import(moduleUrl('lib/nba-official.ts'));
const ready=value=>value.status==='ready';
const value=()=>({status:'ready',capturedAt:'2026-10-05T12:00:00Z',probabilities:{home:.6,away:.4}});
const gate=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};

test('concurrent identical analyses share one computation and return isolated values',async()=>{
 const cache=createNbaAnalysisCache(),g=gate();let calls=0;
 const load=()=>{calls++;return g.promise;};
 const requests=Array.from({length:20},()=>cache.read('NBA:fixture:weights',load,ready));
 await Promise.resolve();assert.equal(calls,1);assert.equal(cache.sizes().pending,1);
 g.resolve(value());const results=await Promise.all(requests);
 assert.equal(results.filter(r=>r.cache==='miss').length,1);assert.equal(results.filter(r=>r.cache==='shared').length,19);
 results[0].value.probabilities.home=0;assert.equal(results[1].value.probabilities.home,.6);
 const cached=await cache.read('NBA:fixture:weights',load,ready);assert.equal(cached.cache,'hit');assert.equal(cached.value.probabilities.home,.6);assert.equal(calls,1);
});
test('a hit does not rewrite source timestamps or extend the computation TTL',async()=>{
 let now=1000,calls=0;const cache=createNbaAnalysisCache({clock:()=>now,ttl:100});
 const load=async()=>{calls++;return value();};
 await cache.read('key',load,ready);now=1099;const hit=await cache.read('key',load,ready);
 assert.equal(hit.cache,'hit');assert.equal(hit.value.capturedAt,value().capturedAt);
 now=1100;assert.equal((await cache.read('key',load,ready)).cache,'miss');assert.equal(calls,2);
});
test('waiting reports and rejected loads cannot poison successful-result cache',async()=>{
 const cache=createNbaAnalysisCache();let calls=0;
 for(let i=0;i<2;i++)await cache.read('wait',async()=>{calls++;return {status:'waiting'};},ready);
 assert.equal(calls,2);assert.equal(cache.sizes().entries,0);
 await assert.rejects(cache.read('failure',async()=>{throw Error('source failure');},ready),/source failure/);
 assert.equal(cache.sizes().pending,0);assert.equal((await cache.read('failure',async()=>value(),ready)).cache,'miss');
});
test('freshness invalidation is checked on cache hits',async()=>{
 const cache=createNbaAnalysisCache();let valid=true,calls=0;const load=async()=>{calls++;return value();};
 await cache.read('key',load,()=>valid);valid=false;
 assert.equal((await cache.read('key',load,()=>valid)).cache,'miss');assert.equal(calls,2);assert.equal(cache.sizes().entries,0);
});
test('league fixture weights and venue identities use separate cache keys',async()=>{
 const cache=createNbaAnalysisCache();let calls=0;
 for(const key of ['NBA:a:20','NBA:a:40','NBA:b:20','WNBA:a:20','NBA:a:20:neutral'])await cache.read(key,async()=>{calls++;return value();},ready);
 assert.equal(calls,5);assert.equal(cache.sizes().entries,5);
});
test('successful cache is LRU-bounded and excess pending computations are rejected',async()=>{
 const cache=createNbaAnalysisCache({maxEntries:2,maxPending:1}),load=async()=>value();
 await cache.read('a',load,ready);await cache.read('b',load,ready);await cache.read('a',load,ready);await cache.read('c',load,ready);
 assert.equal(cache.sizes().entries,2);assert.equal((await cache.read('b',load,ready)).cache,'miss');
 const g=gate(),pending=cache.read('pending',()=>g.promise,ready);
 await assert.rejects(cache.read('another',load,ready),/忙碌/);g.resolve(value());await pending;
 assert.equal(cache.sizes().pending,0);
});
test('a shared rejection is released for retry and clock rollback evicts successes',async()=>{
 let now=100;const cache=createNbaAnalysisCache({clock:()=>now}),g=gate();
 const rows=[cache.read('x',()=>g.promise,ready),cache.read('x',()=>g.promise,ready)];
 const settled=Promise.allSettled(rows);g.reject(Error('failed'));assert.ok((await settled).every(r=>r.status==='rejected'));assert.equal(cache.sizes().pending,0);
 await cache.read('x',async()=>value(),ready);now=99;assert.equal((await cache.read('x',async()=>value(),ready)).cache,'miss');
});
test('invalid cache configuration is rejected',()=>{
 for(const option of [{ttl:0},{maxEntries:0},{maxPending:NaN}])assert.throws(()=>createNbaAnalysisCache(option));
 for(const option of [{ttl:0},{maxEntries:0},{maxBytes:NaN}])assert.throws(()=>createNbaPageCache(option));
});

test('compacted team hydration preserves full roster, profile and dated news',()=>{
 const team={id:1610612738,info:{TEAM_ID:1610612738,SEASON_YEAR:'2025-26',W:56,L:26,TEAM_CITY:'Boston'},roster:[{TeamID:1610612738,SEASON:'2026',PLAYER_ID:1628369,PLAYER:'Jayson Tatum',NUM:'0',PLAYER_SLUG:'jayson-tatum'}],background:{HEADCOACH:'Coach'},ranks:{PTS_PG:114.9},awards:{champ:[{YEARAWARDED:'2024'}]},fantasyNews:[{nbaId:1628369,date:1791200000000,injuredStatus:'OUT'}],unrelated:'z'.repeat(100000)};
 const original={buildId:'build',props:{pageProps:{team,navigation:'x'.repeat(100000)}}};
 const slim=compactNbaPage(original,'team/1610612738/celtics');
 assert.deepEqual(parseOfficialTeam(slim,'2'),parseOfficialTeam(original,'2'));assert.deepEqual(slim.props.pageProps.team.fantasyNews,team.fantasyNews);
 assert.equal(original.props.pageProps.team.unrelated.length,100000);assert.ok(JSON.stringify(slim).length<JSON.stringify(original).length/100);
});
test('compacted player hydration preserves statistics, games, awards and availability',()=>{
 const player={info:{PERSON_ID:1628369,DISPLAY_FIRST_LAST:'Jayson Tatum',TEAM_ID:1610612738,PLAYER_SLUG:'jayson-tatum'},stats:{PLAYER_ID:1628369,TimeFrame:'2025-26',PTS:21.8},gameLogs:[{Player_ID:1628369,GAME_STATUS:3,PTS:17}],awards:[{name:'Award',count:1}],latestNews:[{nbaId:1628369,date:1791200000000,update:'out'}],ads:'x'.repeat(100000)};
 const original={props:{pageProps:{player,irrelevant:'y'.repeat(100000)}}},slim=compactNbaPage(original,'player/1628369/jayson-tatum');
 assert.deepEqual(parseOfficialPlayer(slim,1628369),parseOfficialPlayer(original,1628369));assert.deepEqual(slim.props.pageProps.player.latestNews,player.latestNews);
 const wrong=structuredClone(slim);wrong.props.pageProps.player.info.PERSON_ID=1;assert.throws(()=>parseOfficialPlayer(wrong,1628369));
});
test('directory fields stay intact and invalid hydration cannot fabricate a profile',()=>{
 const players=[{PERSON_ID:1,PLAYER_SLUG:'first-player',TEAM_ID:2,COUNTRY:'Country'}];
 assert.deepEqual(compactNbaPage({props:{pageProps:{players,extra:'unused'}}},'players'),{props:{pageProps:{players}}});
 assert.throws(()=>compactNbaPage({},'players'));assert.throws(()=>compactNbaPage({props:{pageProps:{}}},'unknown'));
 assert.throws(()=>parseOfficialTeam(compactNbaPage({props:{pageProps:{team:null}}},'team/1/a'),'2'));
});
test('public page cache observes both byte and entry budgets, including oversize rows',()=>{
 const cache=createNbaPageCache({maxEntries:2,maxBytes:100}),row={value:'x'.repeat(30)};
 cache.set('a',row);cache.set('b',row);cache.get('a');cache.set('c',row);
 assert.equal(cache.get('b'),undefined);assert.ok(cache.stats().bytes<=100);assert.equal(cache.stats().entries,2);
 assert.equal(cache.set('large',{value:'x'.repeat(101)}),false);assert.equal(cache.get('large'),undefined);
 cache.set('a',{value:'short'});assert.ok(cache.stats().bytes<=100);
});
test('page cache expires at the original time and cleans up backwards clock entries',()=>{
 let now=0;const cache=createNbaPageCache({ttl:100,clock:()=>now});cache.set('a',{id:1});now=99;assert.deepEqual(cache.get('a'),{id:1});now=100;assert.equal(cache.get('a'),undefined);assert.equal(cache.stats().bytes,0);
 cache.set('b',{id:2});now=99;assert.equal(cache.get('b'),undefined);assert.equal(cache.stats().bytes,0);
});
test('source integration checks the current fixture before cache and preserves original safety gates',()=>{
 const source=readFileSync('lib/nba-source.ts','utf8'),model=readFileSync('lib/basketball-player-strength.ts','utf8');
 assert.ok(source.indexOf('schedule=await nbaSchedule(day)')<source.indexOf('analyses.read('));
 assert.match(source,/nbaFixtureKey\(game\).*expectedWeights/);assert.match(source,/readyNbaAnalysis\(game,report,now,false,expectedWeights\)/);
 assert.match(source,/\[baseline,evidence\]=await Promise\.all/);assert.match(source,/stats<=now&&now-stats<=36\*3600000/);
 for(const gate of ['36*3600000','insufficient_individual_minutes_coverage','outside_availability_window'])assert.ok(model.includes(gate));
});
