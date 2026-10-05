import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBoundedCache,createRequestCache} from '../server/runtime-cache.mjs';
import {readTextBounded,createTaskGate,createPublicTextSource} from '../server/source-resilience.mjs';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('concurrent cold and expired score requests share one upstream task',async()=>{
 let clock=0,calls=0;const cache=createRequestCache({now:()=>clock});
 const load=async()=>{calls++;await wait(5);return {games:[{id:1}],fetchedAt:'original'};};
 const first=await Promise.all(Array.from({length:30},()=>cache.get('scores:2026-10-05',10,load)));
 assert.equal(calls,1);assert.ok(first.every(x=>x===first[0]));assert.equal(first[0].fetchedAt,'original');
 clock=11;await Promise.all(Array.from({length:30},()=>cache.get('scores:2026-10-05',10,load)));assert.equal(calls,2);
});
test('failed shared tasks are released, not cached as empty schedules or fresh successes',async()=>{
 const cache=createRequestCache();let calls=0;
 const results=await Promise.allSettled(Array.from({length:8},()=>cache.get('schedule:today',50,async()=>{calls++;throw Error('upstream offline');})));
 assert.equal(calls,1);assert.ok(results.every(r=>r.status==='rejected'));assert.equal(cache.snapshot().pending,0);
 assert.equal(await cache.get('schedule:today',50,async()=>42),42);
});
test('admission limits new work but existing subscribers still share their request',async()=>{
 const cache=createRequestCache({maxPending:1});let release;const task=cache.get('a',10,()=>new Promise(r=>release=r));
 const shared=cache.get('a',10,()=>assert.fail('must share'));await assert.rejects(cache.get('b',10,async()=>1),/繁忙/);
 release(3);assert.deepEqual(await Promise.all([task,shared]),[3,3]);
});
test('HTML cache is bounded by bytes and entries and purges expired values',()=>{
 let clock=0;const cache=createBoundedCache({now:()=>clock,maxEntries:2,maxBytes:30,sizeOf:x=>x.length});
 cache.set('a','a'.repeat(12),10);cache.set('b','b'.repeat(12),10);cache.get('a');cache.set('c','c'.repeat(12),10);
 assert.equal(cache.get('b'),undefined);assert.equal(cache.get('a'),'a'.repeat(12));assert.ok(cache.snapshot().bytes<=30);
 assert.equal(cache.set('huge','x'.repeat(31),10),false);clock=10;assert.deepEqual(cache.snapshot(),{entries:0,bytes:0,maxEntries:2,maxBytes:30});
});
test('bounded body reading cancels streams before downloading the entire oversized page',async()=>{
 let cancelled=false,pulls=0;const response=new Response(new ReadableStream({pull(c){pulls++;c.enqueue(new Uint8Array(8));},cancel(){cancelled=true;}}));
 await assert.rejects(readTextBounded(response,12),/超出上限/);assert.ok(cancelled);assert.ok(pulls<=4);
});
test('streaming UTF-8 decoding preserves characters across chunk boundaries',async()=>{
 const bytes=new TextEncoder().encode('中職資料');let i=0;
 const response=new Response(new ReadableStream({pull(c){if(i<bytes.length)c.enqueue(bytes.slice(i,++i));else c.close();}}));
 assert.equal(await readTextBounded(response,20),'中職資料');
});
test('task gate caps active work and releases slots on errors',async()=>{
 const gate=createTaskGate(2,12);let active=0,peak=0;
 const values=await Promise.allSettled(Array.from({length:10},(_,i)=>gate(async()=>{active++;peak=Math.max(active,peak);await wait(2);active--;if(i===3)throw Error('expected');return i;})));
 assert.equal(peak,2);assert.equal(values.filter(x=>x.status==='fulfilled').length,9);assert.equal(await gate(async()=>11),11);
});
test('queued cancellation prevents a network request and does not consume a slot',async()=>{
 const gate=createTaskGate(1,2);let release,calls=0;
 const first=gate(()=>new Promise(r=>release=r));await wait(0);const controller=new AbortController();
 const second=gate(async()=>{calls++;},controller.signal);controller.abort();await assert.rejects(second);release();await first;
 assert.equal(calls,0);assert.equal(await gate(async()=>12),12);
});
test('provider 403 stops queued leagues and bodies are cancelled; recovery is retried after cooldown',async()=>{
 let clock=0,calls=0,cancelled=false;
 const read=createPublicTextSource({origin:'https://www.playsport.cc',label:'玩運彩',now:()=>clock,cooldownMs:50,maxConcurrent:1,
  fetcher:async()=>{calls++;return calls===1?new Response(new ReadableStream({cancel(){cancelled=true;}}),{status:403}):new Response('recovered');}});
 const results=await Promise.allSettled(['/npb','/kbo','/cpbl'].map(p=>read('https://www.playsport.cc'+p)));
 assert.ok(results.every(x=>x.status==='rejected'));assert.equal(calls,1);assert.ok(cancelled);
 await assert.rejects(read('https://www.playsport.cc/next'),/403/);assert.equal(calls,1);
 clock=51;assert.equal(await read('https://www.playsport.cc/next'),'recovered');assert.equal(calls,2);
});
test('provider Retry-After is honored and unsupported origins never reach fetch',async()=>{
 let clock=0,calls=0;const read=createPublicTextSource({origin:'https://www.playsport.cc',label:'玩運彩',now:()=>clock,cooldownMs:10,
  fetcher:async()=>{calls++;return new Response('',{status:429,headers:{'retry-after':'120'}});}});
 await assert.rejects(read('https://evil.example/'));assert.equal(calls,0);
 await assert.rejects(read('https://www.playsport.cc/a'));clock=110000;
 await assert.rejects(read('https://www.playsport.cc/b'));assert.equal(calls,1);
});
test('duplicate provider URLs share the complete body, not a consumed Response',async()=>{
 let calls=0;const read=createPublicTextSource({origin:'https://www.playsport.cc',label:'玩運彩',fetcher:async()=>{calls++;await wait(2);return new Response('source html');}});
 const values=await Promise.all(Array.from({length:12},()=>read('https://www.playsport.cc/a')));
 assert.equal(calls,1);assert.ok(values.every(x=>x==='source html'));
});
test('production call sites use the bounded helpers and do not warm unused Covers histories',()=>{
 const api=readFileSync('app/api/baseball/route.ts','utf8'),client=readFileSync('app/game-context.tsx','utf8'),profile=readFileSync('lib/international-profile-source.ts','utf8');
 assert.match(api,/get:cached}=createRequestCache/);assert.doesNotMatch(api,/key\.startsWith\('scores:'/);
 assert.doesNotMatch(client,/covers-history/);assert.match(profile,/maxBytes:12\*1024\*1024/);assert.match(profile,/readTextBounded\(r,8_000_000\)/);
});
