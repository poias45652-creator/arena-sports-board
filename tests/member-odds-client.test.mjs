import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync('lib/member-odds-client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createMemberOddsReader,scopeMemberOdds}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('simultaneous MLB and international panels share one authenticated snapshot request',async()=>{
 let release,calls=0;const gate=new Promise(r=>release=r);
 const snapshot={games:[{id:1}],internationalGames:[{id:2,league:'CPBL'},{id:3,league:'KBO'}],fetchedAt:'2026-09-19T11:00:00Z'};
 const read=createMemberOddsReader(async path=>{assert.equal(path,'/api/member-odds');calls++;await gate;return Response.json(snapshot)});
 const mlb=read(),cpbl=read(),kbo=read();release();
 const results=await Promise.all([mlb,cpbl,kbo]);assert.equal(calls,1);
 assert.deepEqual(scopeMemberOdds(results[0],null).games,[{id:1}]);
 assert.deepEqual(scopeMemberOdds(results[1],'CPBL').games,[{id:2,league:'CPBL'}]);
 assert.equal(scopeMemberOdds(results[2],'KBO').fetchedAt,snapshot.fetchedAt);
 await read();assert.equal(calls,2,'settled snapshots are not kept in a private client cache');
});
test('temporary refresh locks retry and return the completed source response',async()=>{
 let calls=0,waits=0;const read=createMemberOddsReader(async()=>++calls===1?Response.json({code:'connection_busy',error:'資料正在更新'},{status:429}):Response.json({games:[],internationalGames:[],fetchedAt:'original'}),async()=>{waits++});
 assert.equal((await read()).fetchedAt,'original');assert.equal(calls,2);assert.equal(waits,1);
});
test('source rejection and expired authorization are shown without retrying or returning old quotes',async()=>{
 for(const code of ['tz_auth_expired','source_access_denied']){let calls=0;const read=createMemberOddsReader(async()=>{calls++;return Response.json({code,error:'授權已失效'},{status:403})},async()=>assert.fail('must not retry'));
 await assert.rejects(read(),/授權已失效/);assert.equal(calls,1);}
});
test('busy retries are bounded and the next refresh can recover',async()=>{
 let blocked=true,calls=0;const read=createMemberOddsReader(async()=>{calls++;return blocked?Response.json({code:'connection_busy',error:'資料正在更新'},{status:429}):Response.json({games:[]})},async()=>{});
 await assert.rejects(read(),/資料正在更新/);assert.equal(calls,5);blocked=false;assert.deepEqual(await read(),{games:[]});
});
test('MLB-only response is not misreported as connected international odds',()=>{
 assert.throws(()=>scopeMemberOdds({games:[]},'CPBL'),/只回傳美棒/);
 assert.throws(()=>scopeMemberOdds({internationalGames:[]},'UNKNOWN'),/不支援/);
});
test('Safari Load failed retries the shared GET and recovers the unchanged source snapshot',async()=>{
 let calls=0;const waits=[],snapshot={games:[],sportGames:[{id:25092679}],fetchedAt:'2026-10-13T17:26:00Z'};
 const read=createMemberOddsReader(async(path,options)=>{
  assert.equal(path,'/api/member-odds');assert.equal(options.cache,'no-store');assert.equal(options.method,undefined);
  if(++calls===1)throw new TypeError('Load failed');return Response.json(snapshot);
 },async ms=>{waits.push(ms);});
 const [football,nba]=await Promise.all([read(),read()]);assert.deepEqual(football,snapshot);assert.equal(nba,football);
 assert.equal(calls,2);assert.deepEqual(waits,[750]);
});
test('interrupted response body and temporary HTML gateway responses recover',async()=>{
 for(const first of [()=>({ok:true,status:200,json:async()=>{throw new TypeError('Load failed');}}),()=>new Response('<html>temporarily unavailable</html>',{status:502})]){
  let calls=0;const read=createMemberOddsReader(async()=>++calls===1?first():Response.json({games:[],fetchedAt:'actual'}),async()=>{});
  assert.equal((await read()).fetchedAt,'actual');assert.equal(calls,2);
 }
});
test('transport retries end with a localized recoverable error, release the shared task, and never return old data',async()=>{
 let offline=true,calls=0;const read=createMemberOddsReader(async()=>{calls++;if(offline)throw new TypeError('Load failed');return Response.json({games:[],fetchedAt:'new'});},async()=>{});
 await assert.rejects(read(),error=>error.retryable&&/玩法資料傳輸中斷/.test(error.message)&&!error.message.includes('Load failed'));
 assert.equal(calls,3);offline=false;assert.equal((await read()).fetchedAt,'new');assert.equal(calls,4);
});
test('HTTP 502 source authorization and source-format failures are not retried',async()=>{
 for(const code of ['source_auth_expired','source_access_denied','source_format_changed','launch_format_changed']){
  let calls=0;const read=createMemberOddsReader(async()=>{calls++;return Response.json({code,error:'需要重新確認來源'}, {status:502});},async()=>assert.fail('must not retry'));
  await assert.rejects(read(),error=>!error.retryable&&error.message==='需要重新確認來源');assert.equal(calls,1);
 }
});
