import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleUrl} from './profile-loader.mjs';
const {nbaPage,BasketballSourceUnavailable}=await import(moduleUrl('lib/wnba-fetch.ts'));
const {enrichNbaPlayerStrength}=await import(moduleUrl('lib/nba-player-strength-source.ts'));
const {officialAnalysisPlayer}=await import(moduleUrl('lib/nba-official.ts'));
const {nbaTeam}=await import(moduleUrl('lib/nba.ts'));
const game={id:'401898402',home:nbaTeam('1'),away:nbaTeam('25'),phase:1,season:2027,state:'scheduled',timeConfirmed:true,neutral:false,start:new Date(Date.now()+86400000).toISOString()};
const base={status:'ready',capturedAt:new Date().toISOString(),homeForm:{games:20},awayForm:{games:20},expected:{home:110,away:108,total:218,margin:2},probabilities:{home:.55,away:.45},model:'nba-efficiency-monte-carlo-v2'};
test('NBA transport retries transient failures but never forbidden requests',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>++calls===1?new Response('',{status:503}):new Response('ok'));
 assert.equal(await nbaPage('https://example.test/nba'),'ok');assert.equal(calls,2);
 calls=0;globalThis.fetch=async()=>{calls++;return new Response('',{status:403});};
 await assert.rejects(nbaPage('https://example.test/nba'),BasketballSourceUnavailable);assert.equal(calls,1);
});
test('NBA official outage retains validated team analysis and disables player recommendations',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('<html>Unavailable</html>'));
 const result=await enrichNbaPlayerStrength(game,base);
 assert.equal(result.status,'ready');assert.deepEqual(result.expected,base.expected);
 assert.equal(result.playerContext.status,'unavailable');assert.equal(result.playerContext.recommendationEligible,false);
});
test('NBA present but invalid official identities are discarded without erasing independently validated team data',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('<script id="__NEXT_DATA__">{"props":{"pageProps":{"team":{"id":999}}}}</script>'));
 const result=await enrichNbaPlayerStrength(game,base);
 assert.equal(result.status,'ready');assert.deepEqual(result.expected,base.expected);assert.equal(result.playerContext.recommendationEligible,false);
});
test('expired NBA optional-player budget performs no network request',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('unexpected network');});
 await assert.rejects(officialAnalysisPlayer(123,Date.now()-1),BasketballSourceUnavailable);assert.equal(calls,0);
});
