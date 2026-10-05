import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {createNbaSeedReader}=await import(moduleUrl('lib/nba-public-cache-seed.ts'));
const now=Date.now(),data={header:{id:'401918297'},boxscore:{teams:[]}};
const make=(key='WNBA:fixture:86:80',capturedAt=now-1000)=>({kind:'efficiency',key,capturedAt,data,sha256:createHash('sha256').update(JSON.stringify(data)).digest('hex')});
const reader=(entries)=>createNbaSeedReader({schema:1,entries},()=>now);
test('WNBA historical seeds retain source time, are single-use and do not match NBA keys',()=>{
 const row=make(),read=reader([row]);assert.equal(read('efficiency','NBA:fixture:86:80',86400000),null);
 const hit=read('efficiency',row.key,86400000);assert.deepEqual(hit,{data,capturedAt:row.capturedAt});assert.equal(read('efficiency',row.key,86400000),null);
});
test('WNBA seed corruption, duplicate identities, future dates and expiry fail closed',()=>{
 for(const rows of [[{...make(),sha256:'bad'}],[make(),make()],[make(undefined,now+1)],[make(undefined,now-86400000)]])assert.equal(reader(rows)('efficiency','WNBA:fixture:86:80',86400000),null);
 for(const key of ['wnba:fixture','NBAWNBA:fixture','football:fixture'])assert.equal(reader([make(key)])('efficiency',key,86400000),null);
});
test('a corrected fixture score does not reuse the previous score seed',()=>{
 assert.equal(reader([make()])('efficiency','WNBA:fixture:87:80',86400000),null);
});
test('WNBA preparation has separate output, bounded work and no private-data requests',()=>{
 const src=readFileSync('scripts/prepare-wnba-public-cache.mjs','utf8');
 assert.match(src,/data\/wnba-public-cache-seed\.json/);assert.match(src,/timeout:120000/);assert.match(src,/slice\(0,6\)/);assert.match(src,/4\*1024\*1024/);
 assert.doesNotMatch(src,/api\/member|credentials|Bearer|TOKEN|setInterval/);
 const build=readFileSync('scripts/render-prepare.mjs','utf8');assert.match(build,/RENDER_SERVICE_ID==='srv-dahruorm8hqs73d57edg'/);
});
