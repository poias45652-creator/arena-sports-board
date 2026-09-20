import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {GET}=await import(moduleUrl('app/api/international-team/route.ts'));
const snapshot=JSON.parse(readFileSync('data/international-profile-2026.json','utf8'));
test('all 28 teams retain verified source times when refresh fails, with no wrong-season fallback',async()=>{
 const originalFetch=globalThis.fetch,RealDate=globalThis.Date,log=console.error;let year=2026;
 try{
  globalThis.Date=class extends RealDate {constructor(...args){super(...(args.length?args:[`${year}-09-19T13:00:00Z`]));}static now(){return new RealDate(`${year}-09-19T13:00:00Z`).getTime();}};
  globalThis.fetch=async()=>({ok:false,status:403});console.error=()=>{};
  for(const [key,source] of Object.entries(snapshot.players)){
   const [league,team]=key.split(':');
   const response=await GET(new Request(`http://local/api/international-team?league=${league}&team=${team}&action=players`)),data=await response.json();
   assert.equal(response.status,200);assert.equal(data.status,'stale');assert.equal(data.fetchedAt,source.fetchedAt);assert.ok(data.warnings.length);assert.ok(data.bat.rows.length);assert.ok(data.pit.rows.length);
  }
  for(const [league,team] of [['CPBL','ADD'],['NPB','d'],['KBO','HH']]){
   const data=await (await GET(new Request(`http://local/api/international-team?league=${league}&team=${team}`))).json();assert.equal(data.fetchedAt,snapshot.games[league].fetchedAt);assert.equal(data.status,'stale');assert.ok(data.games.length);
  }
  assert.equal((await GET(new Request('http://local/api/international-team?league=MLB&team=ADD'))).status,400);
  year=2027;assert.equal((await GET(new Request('http://local/api/international-team?league=CPBL&team=ADD'))).status,503);
 }finally{globalThis.fetch=originalFetch;globalThis.Date=RealDate;console.error=log;}
});
