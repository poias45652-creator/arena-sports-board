import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {migrate,createDatabase} from '../server/database.mjs';
import {moduleUrl} from './profile-loader.mjs';
const {issueTableOnlySession,platformIdentity,forgetPortal}=await import(moduleUrl('lib/platform-access.ts'));
const {readSession,hash,sessionCookie}=await import(moduleUrl('lib/arena-session.ts'));
test('verified members get independent sports and baccarat access, and a table-only cookie never grants access to sports',async()=>{
  const pg=new PGlite();
  const client={query:async(sql,values)=>sql.includes('CREATE TABLE')?pg.exec(sql):pg.query(sql,values),release(){}};
  const pool={...client,connect:async()=>client};
  await migrate(pool);
  await pg.exec('SET search_path TO yj_platform_v1,public');
  const db=createDatabase(pool);
  const oldFetch=globalThis.fetch,oldKey=process.env.XZ_PLATFORM_BRIDGE_KEY;
  process.env.XZ_PLATFORM_BRIDGE_KEY='t'.repeat(64);
  let table=false;
  globalThis.fetch=async()=>Response.json({allowed:table},{status:table?200:403});
  try{
    const now=Date.now(),member='tz:3',expiration=now+900000;
    await db.prepare('INSERT INTO tz_bindings(member_id,source_user_id,username,device_id,encrypted_token,expires_at,verified_at) VALUES(?,?,?,?,?,?,?)').bind(member,'3','fixture','device','encrypted',expiration,now).run();
    assert.equal(await issueTableOnlySession(db,member,'fixture',expiration),null);
    table=true;
    const cookie=(await issueTableOnlySession(db,member,'fixture',expiration)).split(';')[0];
    assert.deepEqual(await platformIdentity(db,cookie),{username:'fixture',sports:false,canCheckTable:true});
    assert.equal(await readSession(db,cookie),null);
    const sportsToken='a'.repeat(64);
    await db.prepare('INSERT INTO account_access(member_id,enabled,updated_at) VALUES(?,1,?)').bind(member,now).run();
    await db.prepare('INSERT INTO arena_sessions(token_hash,member_id,expires_at) VALUES(?,?,?)').bind(await hash(sportsToken),member,expiration).run();
    const sportsCookie=sessionCookie(sportsToken,60);
    assert.equal((await platformIdentity(db,sportsCookie)).sports,true);
    await db.prepare('UPDATE account_access SET enabled=0 WHERE member_id=?').bind(member).run();
    assert.equal(await readSession(db,sportsCookie),null);
    assert.equal((await platformIdentity(db,cookie)).sports,false);
    await forgetPortal(db,cookie);
    assert.equal(await platformIdentity(db,cookie),null);
    assert.equal(await issueTableOnlySession(db,'ofa:3','fixture',expiration),null);
  }finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.XZ_PLATFORM_BRIDGE_KEY;else process.env.XZ_PLATFORM_BRIDGE_KEY=oldKey;await pg.close();}
});
