import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
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

test('NBA and WNBA routes return waiting analysis without throwing on absent probabilities or saving a pick',async()=>{
 const presentation=await import(moduleUrl('lib/nba-analysis.ts')),efficiency=await import(moduleUrl('lib/basketball-efficiency.ts'));
 for(const league of ['nba','wnba'])for(const state of ['scheduled','final']){
  const result={game:{...game,state},analysis:{status:'waiting',model:`${league}-efficiency-monte-carlo-v2`},sourceFetchedAt:new Date().toISOString()};
  const dependencies={
   '@/lib/basketball-efficiency':efficiency,'@/lib/nba-model-weights':await import(moduleUrl('lib/nba-model-weights.ts')),'@/lib/nba-analysis':presentation,
   '@/db':{getRawDb(){throw Error('Waiting report must not read database');}},'@/lib/daily-win-rate':{saveDailyForecast(){throw Error('Waiting report must not save pick');}},
   '@/lib/nba-official':{},'@/lib/wnba-roster':{},
   [`@/lib/${league}`]:{[`${league}Day`]:()=> '2026-10-14',[`valid${league==='nba'?'Nba':'Wnba'}Day`]:()=>true},
   [`@/lib/${league}-source`]:{[`${league}GameAnalysis`]:async()=>result}
  };
  const code=ts.transpileModule(readFileSync(`app/api/${league}/route.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};new Function('require','exports',code)(key=>{assert.ok(key in dependencies,key);return dependencies[key];},exports);
  const response=await exports.GET(new Request(`https://example.test/api/${league}?kind=analysis&date=2026-10-14&game=${game.id}`));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{...result,dailySaved:false});
 }
});


test('custom NBA forecasts cannot overwrite the shared daily ledger; equivalent default ratios still save',async()=>{
 const efficiency=await import(moduleUrl('lib/basketball-efficiency.ts')),settings=await import(moduleUrl('lib/nba-model-weights.ts'));
 let saved=0,queries=[];
 const result={game,analysis:base};
 const dependencies={
  '@/lib/basketball-efficiency':efficiency,'@/lib/nba-model-weights':settings,'@/lib/nba-analysis':{nbaPick:()=>({})},
  '@/db':{getRawDb:()=>({})},'@/lib/daily-win-rate':{saveDailyForecast:async()=>{saved++;return true;}},
  '@/lib/nba-official':{},'@/lib/nba':{nbaDay:()=> '2026-10-14',validNbaDay:()=>true},
  '@/lib/nba-source':{nbaGameAnalysis:async(day,id,weights)=>{queries.push(weights);return result;}}
 };
 const code=ts.transpileModule(readFileSync('app/api/nba/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports',code)(key=>{assert.ok(key in dependencies,key);return dependencies[key];},exports);
 for(const [weights,expected] of [['80,10,5,5,0',false],['20,20,20,20,20',true],['10,10,10,10,10',true]]){
  const response=await exports.GET(new Request(`https://example.test/api/nba?kind=analysis&date=2026-10-14&game=${game.id}&weights=${weights}`));
  assert.equal(response.status,200);assert.equal((await response.json()).dailySaved,expected);
 }
 assert.equal(saved,2);assert.deepEqual(queries[0],[80,10,5,5,0]);
 const response=await exports.GET(new Request(`https://example.test/api/nba?kind=analysis&date=2026-10-14&game=${game.id}&weights=0,0,0,0,0`));
 assert.equal(response.status,400);assert.equal(queries.length,3);
});
