import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {migrate,createDatabase} from '../server/database.mjs';
import {moduleUrl} from './profile-loader.mjs';
const {issueTableOnlySession,platformIdentity,forgetPortal}=await import(moduleUrl('lib/platform-access.ts'));
const {openBaccaratGame}=await import(moduleUrl('lib/baccarat-game.ts'));
const {encryptToken,credentialKey}=await import(moduleUrl('lib/tz-credentials.ts'));
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
  const oldBindingKey=process.env.TZ_BINDING_KEY;
  process.env.TZ_BINDING_KEY=Buffer.alloc(32,9).toString('base64');
  let table=false;
  globalThis.fetch=async()=>Response.json({allowed:table},{status:table?200:403});
  try{
    const now=Date.now(),member='tz:3',expiration=now+900000;
    const vendorToken='test-member-vendor-token';
    const encrypted=await encryptToken(vendorToken,member,await credentialKey(process.env.TZ_BINDING_KEY));
    await db.prepare('INSERT INTO tz_bindings(member_id,source_user_id,username,device_id,encrypted_token,expires_at,verified_at) VALUES(?,?,?,?,?,?,?)').bind(member,'3','fixture','device',encrypted,expiration,now).run();
    assert.equal(await issueTableOnlySession(db,member,'fixture',expiration),null);
    table=true;
    const cookie=(await issueTableOnlySession(db,member,'fixture',expiration)).split(';')[0];
    assert.deepEqual(await platformIdentity(db,cookie),{memberId:member,username:'fixture',sports:false,canCheckTable:true});
    assert.equal(await readSession(db,cookie),null);
    const sportsToken='a'.repeat(64);
    await db.prepare('INSERT INTO account_access(member_id,enabled,updated_at) VALUES(?,1,?)').bind(member,now).run();
    await db.prepare('INSERT INTO arena_sessions(token_hash,member_id,expires_at) VALUES(?,?,?)').bind(await hash(sportsToken),member,expiration).run();
    const sportsCookie=sessionCookie(sportsToken,60);
    assert.equal((await platformIdentity(db,sportsCookie)).sports,true);
    const origin=process.env.APP_ORIGIN||process.env.RENDER_EXTERNAL_URL||'https://arena-sports-board.onrender.com';
    const launch=(cookie,platform)=>new Request(new URL('/baccarat/game',origin),{method:'POST',headers:{origin:new URL(origin).origin,cookie,'content-type':'application/json'},body:JSON.stringify({platform})});
    for(const [platform,provider] of [['DG','DGLI'],['MT','MTLI']]){
      for(const activeCookie of [cookie,sportsCookie]){
        let requests=0;
        const response=await openBaccaratGame(launch(activeCookie,platform),db,async(url,init)=>{
          requests++;
          assert.equal(new URL(url).pathname,'/api/v2/game/'+provider+'/login');
          assert.equal(init.headers.Authorization,'Bearer '+vendorToken);
          return Response.json({code:200,data:{game_url:'https://gsa.ofalive99.net/launch?token=fixture'}});
        });
        assert.equal(response.status,200);
        assert.deepEqual(await response.json(),{gameUrl:'https://gsa.ofalive99.net/launch?token=fixture'});
        assert.equal(requests,1);
      }
    }
    table=false;
    let calls=0;
    const unexpected=async()=>{calls++;throw Error('unauthorized game launch');};
    assert.equal((await openBaccaratGame(launch(sportsCookie,'DG'),db,unexpected)).status,403);
    assert.equal((await openBaccaratGame(launch('','DG'),db,unexpected)).status,401);
    assert.equal(calls,0);
    table=true;
    await db.prepare('UPDATE account_access SET enabled=0 WHERE member_id=?').bind(member).run();
    assert.equal(await readSession(db,sportsCookie),null);
    assert.equal((await platformIdentity(db,cookie)).sports,false);
    await forgetPortal(db,cookie);
    assert.equal(await platformIdentity(db,cookie),null);
    assert.equal(await issueTableOnlySession(db,'ofa:3','fixture',expiration),null);
  }finally{if(oldBindingKey===undefined)delete process.env.TZ_BINDING_KEY;else process.env.TZ_BINDING_KEY=oldBindingKey;globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.XZ_PLATFORM_BRIDGE_KEY;else process.env.XZ_PLATFORM_BRIDGE_KEY=oldKey;await pg.close();}
});
