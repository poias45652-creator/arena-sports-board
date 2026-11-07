import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';

const {basketballPlayerProfile}=await import(moduleUrl('lib/basketball-player-profile.ts'));
const directory=JSON.parse(readFileSync('tests/fixtures/wnba/official-players.json','utf8')).props.pageProps;

test('WNBA 全名單在來源中斷仍能開啟，並保留所選球季與賽事',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('',{status:403}));
 for(const row of directory.currentPlayersData){
  const profile=await basketballPlayerProfile(String(row[0]),'WNBA',2025,'3');
  assert.equal(profile.name,row[2]+' '+row[1]);
  assert.ok(profile.photo);
  assert.equal(profile.season,2025);
  assert.equal(profile.phase,'3');
  assert.deepEqual(profile.summary,{});
 }
 const mapped=await basketballPlayerProfile('4432832','WNBA',2026,'2','espn');
 assert.equal(mapped.id,'4432832');
 assert.equal(mapped.name,'Zia Cooke');
 await assert.rejects(basketballPlayerProfile('999999999','WNBA',2026));
});

test('官方個人頁回傳不同球員時，捨棄該筆成績及照片',async t=>{
 t.mock.method(globalThis,'fetch',async url=>{
  if(String(url).endsWith('/zia-cooke')){
   const player={pid:1641660,info:{PERSON_ID:1641660,DISPLAY_FIRST_LAST:'Other Athlete'},stats:{PTS:99,TimeFrame:'2026'}};
   return new Response('<script id="__NEXT_DATA__">'+JSON.stringify({props:{pageProps:{player}}})+'</script>');
  }
  return new Response('',{status:403});
 });
 const p=await basketballPlayerProfile('1641660','WNBA',2026);
 assert.equal(p.name,'Zia Cooke');
 assert.deepEqual(p.summary,{});
});
