import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';
import {createDatabase,migrate,postgresSql} from '../server/database.mjs';
process.env.PLATFORM_ADMIN_USERNAME='render-test-admin';
process.env.APP_ORIGIN='https://site.test';
const asModule=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const baseCode=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const originModule=asModule(baseCode('lib/request-origin.ts'));
const code=path=>baseCode(path).replace("'./request-origin'",JSON.stringify(originModule)).replace("'@/lib/request-origin'",JSON.stringify(originModule));
const credentials=asModule(code('lib/tz-credentials.ts'));
const session=asModule(code('lib/arena-session.ts'));
const binding=asModule(code('lib/tz-binding-service.ts').replace("'./tz-credentials'",JSON.stringify(credentials)));
const {tzLogin}=await import(asModule(code('lib/tz-login.ts').replace("'./turnstile'",JSON.stringify(asModule(code('lib/turnstile.ts')))).replace("'./arena-session'",JSON.stringify(session)).replace("'./tz-binding-service'",JSON.stringify(binding)).replace("'./tz-credentials'",JSON.stringify(credentials))));
const {readSession}=await import(session);
const {gateRequest}=await import(asModule(code('server/request-gate.ts').replace("'../lib/arena-session'",JSON.stringify(session))));
const key=Buffer.alloc(32,5).toString('base64');
const req=(username='ordinary-user')=>new Request('https://site.test/api/session',{method:'POST',headers:{origin:'https://site.test','content-type':'application/json'},body:JSON.stringify({username,password:'test-password'})});
const source=(username,id)=>async()=>Response.json({code:200,data:{user_id:id,username,token:'a.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.b'}});
test('Render PostgreSQL migration, sessions, authorization, rollback and analytics',async t=>{
 const pg=new PGlite({parsers:{20:Number,114:s=>s,3802:s=>s}});
 const query=async(sql,values=[])=>{
   if(sql.startsWith('-- Additive')){await pg.exec(sql);return {rows:[],rowCount:0};}
   const r=await pg.query(sql,values);return {...r,rowCount:r.affectedRows};
 };
 const pool={query,connect:async()=>({query,release(){}})};
 try{
  await pg.exec("CREATE TABLE public.arena_sessions (legacy text);INSERT INTO public.arena_sessions VALUES ('keep me');");
  await migrate(pool);await migrate(pool);
  await pg.exec('SET search_path TO yj_platform_v1, pg_catalog');
  const db=createDatabase(pool);
  await t.test('migration is idempotent and preserves old public accounts',async()=>{
    assert.equal((await pg.query('SELECT legacy FROM public.arena_sessions')).rows[0].legacy,'keep me');
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM account_access').first()).n,0);
  });
  await t.test('all literal application SQL prepares in PostgreSQL',async()=>{
    const errors=[];let total=0;
    function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const path=dir+'/'+e.name;if(e.isDirectory())walk(path);else if(/\.(ts|tsx|mjs)$/.test(path)){
      const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true);
      function visit(node){if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='prepare'){
        const a=node.arguments[0];if(a&&(ts.isStringLiteral(a)||ts.isNoSubstitutionTemplateLiteral(a)))queries.push({path,sql:a.text});
      }ts.forEachChild(node,visit);}visit(source);
    }}}
    const queries=[];for(const dir of ['app','lib','server'])walk(dir);
    for(const {path,sql} of queries){try{await pg.describeQuery(postgresSql(sql));total++;}catch(e){errors.push(path+': '+e.message+' | '+sql.slice(0,90));}}
    assert.ok(total>45);assert.deepEqual(errors,[]);
  });
  let memberCookie;
  await t.test('verified account is pending, grant allows login, disable immediately revokes',async()=>{
    const pending=await tzLogin(req(),db,key,source('ordinary-user',321));assert.equal(pending.status,403,await pending.clone().text());assert.equal((await pending.json()).code,'approval_required');
    await db.prepare('INSERT INTO account_access VALUES (?,1,NULL,?)').bind('tz:321',Date.now()).run();
    await db.prepare('DELETE FROM tz_binding_attempts').run();
    const login=await tzLogin(req(),db,key,source('ordinary-user',321));assert.equal(login.status,200,await login.clone().text());memberCookie=login.headers.get('set-cookie').split(';')[0];
    assert.equal((await readSession(db,memberCookie)).memberId,'tz:321');
    await db.prepare('UPDATE account_access SET enabled=0').run();assert.equal(await readSession(db,memberCookie),null);
    await db.prepare('UPDATE account_access SET enabled=1').run();
  });
  await t.test('primary administrator only bootstraps after source verification',async()=>{
    const login=await tzLogin(req('render-test-admin'),db,key,source('render-test-admin',999));assert.equal(login.status,200,await login.clone().text());
    assert.equal((await db.prepare('SELECT enabled FROM account_access WHERE member_id=?').bind('tz:999').first()).enabled,1);
  });
  await t.test('atomic failed batch rolls back changes',async()=>{
    await assert.rejects(db.batch([db.prepare('DELETE FROM account_access WHERE member_id=?').bind('tz:321'),db.prepare('SELECT * FROM nonexistent_table')]));
    assert.equal((await db.prepare('SELECT enabled FROM account_access WHERE member_id=?').bind('tz:321').first()).enabled,1);
  });
  await t.test('no forged identity headers or legacy cookies bypass page/API gates',async()=>{
    for(const path of ['/','/admin','/teams/npb/a','/players/1','/api/baseball','/api/admin/accounts']){
      const r=await gateRequest(new Request('https://site.test'+path,{headers:{'oai-authenticated-user-email':'owner@example.invalid','oai-authenticated-user-id':'tz:999',cookie:'arena_session=old-cookie'}}),db);
      assert.equal(r.status,path.startsWith('/api/')?401:307);
    }
    assert.equal(await gateRequest(new Request('https://site.test/api/baseball',{headers:{cookie:memberCookie}}),db),null);
    assert.equal(await gateRequest(new Request('https://site.test/api/session'),db),null);
    assert.equal(await gateRequest(new Request('https://site.test/api/international-sync',{method:'POST'}),db),null);
    assert.equal((await gateRequest(new Request('https://site.test/api/international-sync'),db)).status,401);
  });
  await t.test('forecast timestamps, JSON and case-sensitive aliases preserve D1 semantics',async()=>{
    const payload=JSON.stringify({startTime:'2026-09-20T10:00:00.000Z',game:{id:5},baseline:{markets:[]}});
    await db.prepare('INSERT INTO international_forecasts VALUES (?,?,?,?,?,?,?,?)').bind('a','NPB','fixture','2026-09-20','2026-09-20T10:00:00.000Z','2026-09-20T09:58:00.000Z','test',payload).run();
    const row=await db.prepare(`SELECT json_object('game',json_extract(payload,'$.game')) AS payload, captured_at AS capturedAt FROM international_forecasts WHERE captured_at<=strftime('%Y-%m-%dT%H:%M:%fZ',start_time,'-60 seconds')`).first();
    assert.deepEqual(JSON.parse(row.payload),{game:{id:5}});assert.equal(row.capturedAt,'2026-09-20T09:58:00.000Z');
  });
 }finally{await pg.close();}
});
