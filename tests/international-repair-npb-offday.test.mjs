import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {collectLeague} from '../server/baseball-current.mjs';
import {createLiveFeed} from '../server/baseball-live-feed.mjs';
import {npbOfficialOffday,isVerifiedNpbOffday} from '../server/baseball-npb-schedule.mjs';

const date='2026-11-07';
const url='https://npb.jp/games/2026/schedule_11_detail.html';
const yahooUrl='https://baseball.yahoo.co.jp/npb/schedule/?date='+date;
// Verbatim schedule excerpts (only whitespace and unrelated rows removed).
const read=name=>readFileSync(new URL('./fixtures/npb-live/'+name,import.meta.url),'utf8');
const official=read('official-202611-calendar-excerpt.html');
const yahoo=read('sportsnavi-20261107-excerpt.html');
const fetchedAt=new Date().toISOString();

test('official blank row proves the requested off day but not a game with an unreported score',()=>{
 const page={url,text:official,fetchedAt},proof=npbOfficialOffday(page,date);
 assert.equal(proof.source.provider,'npb-official');
 assert.equal(isVerifiedNpbOffday(proof,date,Date.parse(fetchedAt)),true);
 assert.equal(isVerifiedNpbOffday(proof,date,Date.parse(fetchedAt)+16*60000),false);
 for(const other of ['2026-11-01','2026-11-02','2025-11-07'])assert.equal(npbOfficialOffday(page,other),null);
 for(const text of [official.replace('11/7（土）','11/7（日）'),official.replace('date1107','date1101'),official.replace('schedule_11_detail','schedule_10_detail'),official.replace(/(11\/7[^<]*<\/th>\s*<td>)[^<]+/,'$1<img>'),official.replace('対戦カード','')]){
  assert.equal(npbOfficialOffday({...page,text},date),null);
 }
});

test('wrong-day Sportsnavi page or HTTP failure uses the official date without importing the October game',async()=>{
 for(const status of [200,503]){
  const seen=[];
  const collect=(league,options)=>collectLeague(league,{...options,fetcher:async target=>{
   seen.push(target);
   if(target===yahooUrl)return new Response(yahoo,{status});
   assert.equal(target,url);return new Response(official);
  }});
  const feed=await createLiveFeed({collect,read:async()=>[],write:async()=>{},day:()=>date})('NPB',date);
  assert.deepEqual(seen,[yahooUrl,url]);
  assert.equal(feed.status,'ok');assert.equal(feed.noGames,true);assert.deepEqual(feed.games,[]);
 }
});

test('a missing official row leaves the date unconfirmed',async()=>{
 const get=createLiveFeed({day:()=>date,read:async()=>[],write:async()=>{},collect:(league,options)=>
  collectLeague(league,{...options,fetcher:async target=>new Response(target===yahooUrl?yahoo:official.replace('date1107','unknown'))})});
 const feed=await get('NPB',date);
 assert.equal(feed.status,'unavailable');assert.notEqual(feed.noGames,true);
});
