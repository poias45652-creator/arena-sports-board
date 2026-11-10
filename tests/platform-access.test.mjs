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

test('OFA table access is scoped to the requested verified identities and uses their own issuer',async t=>{
  t.mock.method(globalThis,'fetch',async()=>Response.json({allowed:true}));
  const previousBridge=process.env.XZ_PLATFORM_BRIDGE_KEY, previousBinding=process.env.TZ_BINDING_KEY;
  process.env.XZ_PLATFORM_BRIDGE_KEY='t'.repeat(64);
  process.env.TZ_BINDING_KEY=Buffer.alloc(32,9).toString('base64');
  try {
    const cookie=sessionCookie('c'.repeat(64),60);
    const origin=process.env.APP_ORIGIN||process.env.RENDER_EXTERNAL_URL||'https://arena-sports-board.onrender.com';
    for (const username of ['dvp038','DVP03068','tzt05','tzt050','other']) {
      const memberId='ofa:7';
      const token=await encryptToken('ofa-fixture',memberId,await credentialKey(process.env.TZ_BINDING_KEY));
      const db={prepare:sql=>({bind:()=>({first:async()=>sql.startsWith('SELECT encrypted_token')?{encrypted_token:token}:{memberId,username}})})};
      const allowed=['dvp038','DVP03068','tzt05'].includes(username);
      const user=await platformIdentity(db,cookie);
      assert.equal(user.sports,true);
      assert.equal(user.canCheckTable,allowed);
      for(const platform of ['DG','MT']){
        const request=new Request(origin+'/baccarat/game',{method:'POST',headers:{origin,'content-type':'application/json',cookie},body:JSON.stringify({platform})});
        let launches=0;
        const response=await openBaccaratGame(request,db,async(url,init)=>{
          launches++;
          assert.equal(url,'https://www.ofa1188.net/api/v2/game/'+(platform==='DG'?'DGLI':'MTLI')+'/login');
          assert.equal(init.headers.Authorization,'Bearer ofa-fixture');
          assert.equal(JSON.parse(init.body).game_kind,'LIVE');
          return Response.json({data:{game_url:'https://gsa.ofalive99.net/launch?token=fixture'}});
        });
        assert.equal(response.status,allowed?200:403);
        assert.equal(launches,allowed?1:0);
      }
    }
    assert.equal(await issueTableOnlySession({},'tz:7','DVP038',Date.now()+60000),null);
  }finally{
    if(previousBridge===undefined)delete process.env.XZ_PLATFORM_BRIDGE_KEY;else process.env.XZ_PLATFORM_BRIDGE_KEY=previousBridge;
    if(previousBinding===undefined)delete process.env.TZ_BINDING_KEY;else process.env.TZ_BINDING_KEY=previousBinding;
  }
});

test('TZ access checks recover from a temporary outage and never retry a denial or ticket',async t=>{
  const {tableAccess}=await import(moduleUrl('lib/platform-access.ts'));
  const key=process.env.XZ_PLATFORM_BRIDGE_KEY;
  process.env.XZ_PLATFORM_BRIDGE_KEY='t'.repeat(64);
  let responses=[];
  t.mock.method(globalThis,'fetch',async()=>{
    const next=responses.shift();
    assert.ok(next,'unexpected extra access request');
    if(next instanceof Error)throw next;
    return next;
  });
  try {
    for(const failure of [new Response('',{status:502}),new DOMException('timeout','TimeoutError')]){
      responses=[failure,Response.json({allowed:true})];
      assert.equal((await tableAccess('tz-fixture')).allowed,true);
      assert.equal(responses.length,0);
    }
    responses=[Response.json({allowed:false},{status:403})];
    assert.equal((await tableAccess('tz-fixture')).allowed,false);
    responses=[new Response('Forbidden',{status:403})];
    await assert.rejects(tableAccess('tz-fixture'));
    responses=[new Response('',{status:503})];
    await assert.rejects(tableAccess('tz-fixture','MT'));
  }finally{if(key===undefined)delete process.env.XZ_PLATFORM_BRIDGE_KEY;else process.env.XZ_PLATFORM_BRIDGE_KEY=key;}
});
