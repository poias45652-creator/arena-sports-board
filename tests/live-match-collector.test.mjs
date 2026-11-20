import assert from 'node:assert/strict';
import test from 'node:test';
import {createMatchCollector,saveCollectedMatch,collectedMatch} from '../server/live-match-collector.mjs';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('collects simultaneous games without page views, retries failures separately and checks the final reading',async()=>{
 let now=0,final=false,failed=false;
 const captured=[];
 const adapter={league:'TEST',interval:10000,
   fixtures:async()=>['a','b'].map(id=>({id,day:'2026-11-20',live:!final,final})),
   detail:async m=>{if(m.id==='a'&&!failed){failed=true;throw Error('temporary');}return {id:m.id,final:m.final};}};
 const c=createMatchCollector([adapter],{now:()=>now,record:(_league,_id,_day,x)=>captured.push(x)});
 c.start();
 try{
  await flush();c.tick();await flush();assert.deepEqual(captured,[{id:'b',final:false}]);
  now=11000;c.tick();await flush();assert.equal(captured.at(-1).id,'b');
  now=16500;c.tick();await flush();assert.equal(captured.at(-1).id,'a');
  now=61000;final=true;c.tick();await flush();c.tick();await flush();
  assert.deepEqual(new Set(captured.filter(x=>x.final).map(x=>x.id)),new Set(['a','b']));
  assert.equal(c.snapshot().leagues[0].tracked,0);
 }finally{c.stop();}
});
test('stored frames are isolated by sport, kickoff date, and fixture id',()=>{
 saveCollectedMatch('hkg.1','lm-nd','2026-11-20',{score:'2-0'});
 assert.equal(collectedMatch('hkg.1','lm-nd','2026-11-20').score,'2-0');
 assert.equal(collectedMatch('eng.1','lm-nd','2026-11-20'),null);
 assert.equal(collectedMatch('hkg.1','lm-nd','2026-11-21'),null);
});
