import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeBaseballSync,syncBaseball} from '../server/baseball-sync.mjs';
test('background sync requires a configured strong token and rejects missing, wrong or Unicode credentials',()=>{
 const token='x'.repeat(64);
 assert.equal(authorizeBaseballSync(undefined,''),503);assert.equal(authorizeBaseballSync('short','Bearer short'),503);
 assert.equal(authorizeBaseballSync(token,null),401);assert.equal(authorizeBaseballSync(token,'Bearer '+'y'.repeat(64)),401);
 assert.equal(authorizeBaseballSync(token,'Bearer '+'中'.repeat(64)),401);assert.equal(authorizeBaseballSync(token,'Bearer '+token),200);
});
test('all leagues run independently; stale data or failed storage never count as successful background updates',async()=>{
 const seen=[],getPregame=async league=>({coverage:{teams:6},storageError:league==='NPB'?'database unavailable':null});
 const result=await syncBaseball({getLive:async league=>{seen.push(league);if(league==='KBO')throw Error('timeout');return {status:'ok',games:[],date:'2026-09-20',stale:false,persistence:{written:2}};},getPregame});
 assert.equal(result.status,'partial');assert.equal(result.results[0].healthy,true);assert.equal(result.results[1].stored,false);assert.equal(result.results[2].healthy,false);assert.equal(seen.length,3);
 const unavailable=await syncBaseball({getLive:async()=>({status:'stale',stale:true,games:[]}),getPregame});assert.equal(unavailable.status,'unavailable');
 const good=await syncBaseball({getLive:async()=>({status:'ok',stale:false,games:[],persistence:{written:1}}),getPregame:async()=>({coverage:{teams:6}})});assert.equal(good.status,'ok');
});
