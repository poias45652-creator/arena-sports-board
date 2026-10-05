import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {createNbaSeedReader}=await import(moduleUrl('lib/nba-public-cache-seed.ts'));
const {createNbaPageCache}=await import(moduleUrl('lib/nba-official-cache.ts'));
const hash=data=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
const entry=(patch={})=>{const data={props:{pageProps:{players:[{PERSON_ID:1}]}}};return {kind:'official',key:'players',capturedAt:1000,data,sha256:hash(data),...patch};};
const reader=(rows,now=1050)=>createNbaSeedReader({schema:1,entries:rows},()=>now);
test('seed preserves the original source time and consumes a row only once',()=>{
 const read=reader([entry()]);assert.equal(read('official','players',100).capturedAt,1000);assert.equal(read('official','players',100),null);
});
test('stale future wrong-schema duplicate and corrupt sources are not reused',()=>{
 assert.equal(reader([entry()],1100)('official','players',100),null);
 assert.equal(reader([entry()],999)('official','players',100),null);
 assert.equal(reader([entry(),entry()])('official','players',100),null);
 assert.equal(reader([entry({sha256:'0'.repeat(64)})])('official','players',100),null);
 assert.equal(createNbaSeedReader({schema:2,entries:[entry()]},()=>1050)('official','players',100),null);
});
test('seeds exclude member routes, foreign leagues and untrusted paths',()=>{
 for(const row of [entry({key:'https://evil.example/players'}),entry({key:'../players'}),entry({kind:'member',key:'players'}),entry({kind:'efficiency',key:'WNBA:1'})]){
  assert.equal(reader([row])(row.kind,row.key,100),null);
 }
 assert.equal(reader([entry()])('efficiency','NBA:players',100),null);
});
test('changed fixture or final score cannot address another efficiency seed',()=>{
 const row=entry({kind:'efficiency',key:'NBA:1:home:away:100:90'}),read=reader([row]);
 assert.equal(read('efficiency','NBA:1:home:away:101:90',100),null);
 assert.equal(read('efficiency','NBA:1:away:home:100:90',100),null);
 assert.ok(read('efficiency',row.key,100));
});
test('full-roster page count no longer thrashes at 160 while byte budget remains',()=>{
 const cache=createNbaPageCache();for(let i=0;i<220;i++)cache.set('test-'+i,{name:'Player '+i});
 assert.equal(cache.stats().entries,220);assert.ok(cache.get('test-0'));assert.ok(cache.stats().bytes<=12*1024*1024);
});
test('production integration keeps all source TTLs and reruns original box validation',()=>{
 const efficiency=readFileSync('lib/basketball-efficiency-source.ts','utf8');
 assert.match(efficiency,/parseEfficiencyBox\(seed.data,game,league\)/);
 assert.match(efficiency,/seed.capturedAt\+24\*3600000/);
 const pages=readFileSync('lib/nba-official-cache.ts','utf8');assert.match(pages,/Math.min\(ttl,15\*60000\)/);assert.match(pages,/seed.capturedAt/);
 const source=readFileSync('lib/nba-source.ts','utf8');assert.match(source,/schedule=await nbaSchedule\(day\)/);
 const build=readFileSync('scripts/render-prepare.mjs','utf8');assert.match(build,/RENDER_SERVICE_ID==='srv-dahruorm8hqs73d57edg'/);
});
