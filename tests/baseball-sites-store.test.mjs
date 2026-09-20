import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {readLiveSnapshot,writeLiveSnapshot} from '../server/baseball-sites-store.mjs';
export function testDb(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync('drizzle/0008_absurd_korg.sql','utf8'));
 return {prepare(query){const s=sql.prepare(query);let args=[];return {bind(...a){args=a;return this},async all(){return {results:s.all(...args)}},async run(){return {meta:s.run(...args)}}}},async batch(ss){sql.exec('BEGIN');try{const r=await Promise.all(ss.map(s=>s.run()));sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};
}
test('Sites SQL preserves newer results and isolates league/date',async()=>{
 const db=testDb(),g={key:'NPB:1',league:'NPB',date:'2026-09-15',status:'final',home:{score:3},away:{score:2},source:{fetchedAt:'2026-09-15T12:00:00Z'}};
 const put=game=>writeLiveSnapshot(db,{league:game.league,date:game.date,games:[game]});
 assert.equal((await put(g)).written,1);
 await put({...g,status:'pregame',source:{fetchedAt:'2026-09-15T12:01:00Z'}});
 await put({...g,home:{score:0},source:{fetchedAt:'2026-09-15T11:00:00Z'}});
 assert.deepEqual(await readLiveSnapshot(db,'NPB','2026-09-15'),[g]);
 assert.deepEqual(await readLiveSnapshot(db,'KBO','2026-09-15'),[]);
 assert.deepEqual(await readLiveSnapshot(db,'NPB','2026-09-16'),[]);
});
