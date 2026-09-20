import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {importRows,importExistingResearch,listResearch} from '../server/baseball-research.mjs';
function database(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(readFileSync('drizzle/0008_absurd_korg.sql','utf8'));
 sql.exec(readFileSync('drizzle/0009_heavy_sinister_six.sql','utf8'));
 const db={prepare(q){const s=sql.prepare(q);let args=[];return {bind(...v){args=v;return this},async all(){return {results:s.all(...args)}},async run(){return {meta:s.run(...args)}}}},async batch(items){sql.exec('BEGIN');try{const out=[];for(const s of items)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 return {sql,db};
}
test('actual SQLite import/readback, repeat, newer preservation and live isolation',async()=>{
 const {db,sql}=database();
 sql.prepare('INSERT INTO baseball_current VALUES (?,?,?,?,?,?)').run('CPBL:260915282','CPBL','2026-09-15','2026-09-15T08:48:56.473Z','pregame','{"newer":true}');
 const first=await importExistingResearch(db);
 assert.equal(first.inserted,259);assert.equal(first.verified,259);assert.equal(first.quarantined,29);
 assert.deepEqual(first.bySection,{research:217,quarantine:29,archive:13});
 const research=await listResearch(db,'research');assert.equal(research.rows.length,217);
 assert.deepEqual(Object.fromEntries(['CPBL','NPB','KBO'].map(l=>[l,research.rows.filter(r=>r.league===l).length])),{CPBL:16,NPB:108,KBO:93});
 assert.equal((await listResearch(db,'quarantine')).rows.length,29);
 const archive=await listResearch(db,'archive');assert.equal(archive.rows.length,13);
 for(const r of archive.rows){assert.equal(r.payload.eligibleForCurrentFeed,false);assert.equal(r.observed_at,r.payload.sourceObservedAt);assert.equal(r.payload.observedGame.home.score,null);assert.equal(r.payload.observedGame.away.score,null);}
 const next=await importExistingResearch(db);assert.equal(next.inserted,0);assert.equal(next.skipped,259);assert.equal(next.verified,259);
 const key=importRows()[0].key,newer=JSON.stringify({newer:true});
 sql.prepare('UPDATE baseball_research SET payload=?,content_hash=?,observed_at=? WHERE key=?').run(newer,createHash('sha256').update(newer).digest('hex'),'2026-09-16',key);
 const again=await importExistingResearch(db);assert.equal(again.inserted,0);assert.equal(again.preservedDifferent,1);assert.equal(sql.prepare('SELECT payload FROM baseball_research WHERE key=?').get(key).payload,newer);
 assert.deepEqual(sql.prepare('SELECT payload,fetched_at FROM baseball_current').get(),Object.assign(Object.create(null),{payload:'{"newer":true}',fetched_at:'2026-09-15T08:48:56.473Z'}));
 sql.close();
});
test('missing storage cannot report successful completion',async()=>{
 await assert.rejects(importExistingResearch({batch:async()=>{throw Error('unavailable')},prepare:()=>({bind(){return this}})}),e=>e.receipt.verified===0&&e.receipt.readBackAt===null&&e.receipt.failed===259);
});
test('admin API protects reads and writes and enforces origin',()=>{
 const route=readFileSync('app/api/admin/baseball-research/route.ts','utf8');
 assert.equal((route.match(/if\(!await isSiteAdmin\(\)\)/g)||[]).length,2);
 assert.match(route,/request.headers.get\('origin'\)!==new URL\(request.url\).origin/);
});
