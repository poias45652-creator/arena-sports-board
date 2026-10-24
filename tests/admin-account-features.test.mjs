import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {createDatabase,migrate} from '../server/database.mjs';
import {moduleUrl} from './profile-loader.mjs';
process.env.APP_ORIGIN='https://site.test';
process.env.PLATFORM_ADMIN_USERNAME='render-test-admin';
const asModule=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const {tzLogin}=await import(moduleUrl('lib/tz-login.ts'));
const {readSession}=await import(moduleUrl('lib/arena-session.ts'));
let code=ts.transpileModule(readFileSync('app/api/admin/accounts/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
for(const [name,value] of Object.entries({
 '@/lib/request-origin':moduleUrl('lib/request-origin.ts'),
 '@/lib/arena-session':moduleUrl('lib/arena-session.ts'),
 '@/app/admin-access':asModule('export const isSiteAdmin=async()=>globalThis.featureAdmin===true;'),
 '@/db':asModule('export const getRawDb=()=>globalThis.featureDb;')
}))code=code.replaceAll(`'${name}'`,JSON.stringify(value));
const route=await import(asModule(code));
const request=(method,body={},origin='https://site.test',extra={})=>new Request('https://site.test/api/admin/accounts',{method,headers:{origin,'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
const key=Buffer.alloc(32,7).toString('base64');
const source=(name='direct-member',id=123)=>async()=>Response.json({code:200,data:{user_id:id,username:name,token:'a.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.b'}});
const login=(db,name='direct-member',fetcher=source(name))=>tzLogin(new Request('https://site.test/api/session',{method:'POST',headers:{origin:'https://site.test','Content-Type':'application/json'},body:JSON.stringify({username:name,password:'synthetic-password'})}),db,key,fetcher);
const expectStatus=async(response,status)=>{assert.equal(response.status,status,await response.clone().text());return response.json();};

test('administrator notes and direct grants on the production PostgreSQL adapter',async t=>{
 const pg=new PGlite({parsers:{20:Number,114:s=>s,3802:s=>s}});
 const query=async(sql,values=[])=>{if(sql.startsWith('-- Additive')){await pg.exec(sql);return {rows:[],rowCount:0};}const result=await pg.query(sql,values);return {...result,rowCount:result.affectedRows};};
 const pool={query,connect:async()=>({query,release(){}})},db=createDatabase(pool);
 const reset=async()=>{await pg.exec('TRUNCATE account_preapprovals,account_notes,account_access,tz_bindings,tz_binding_attempts CASCADE');globalThis.featureAdmin=true;globalThis.featureDb=db;};
 const clearThrottle=()=>db.prepare('DELETE FROM tz_binding_attempts').run();
 const list=async()=>{const response=await route.GET();return (await expectStatus(response,200)).accounts;};
 try{
  await migrate(pool);await migrate(pool);await pg.exec('SET search_path TO yj_platform_v1, pg_catalog');
  await t.test('note-only save, reload and clear never grants a pending account access',async()=>{
   await reset();assert.equal((await login(db)).status,403);
   const note='客戶小陳\n週六聯絡 <script>alert(1)</script>';
   await expectStatus(await route.PATCH(request('PATCH',{memberId:'tz:123',note})),200);
   const rows=await list();assert.equal(rows[0].note,note);assert.equal(rows[0].accessState,'pending');
   assert.equal(await db.prepare('SELECT * FROM account_access').first(),null);
   await expectStatus(await route.PATCH(request('PATCH',{memberId:'tz:123',note:''})),200);assert.equal((await list())[0].note,'');
  });
  await t.test('direct username grant uses the verified member ID and exact expiry',async()=>{
   await reset();assert.equal((await login(db)).status,403);
   const expiresAt=Math.floor(Date.now()/1000)*1000+3600000;
   await expectStatus(await route.POST(request('POST',{username:' DIRECT-MEMBER ',expiresAt,note:'固定客戶'})),200);
   const row=(await list())[0];assert.equal(row.memberId,'tz:123');assert.equal(row.expiresAt,expiresAt);assert.equal(row.note,'固定客戶');assert.equal(row.accessState,'active');
   await expectStatus(await route.POST(request('POST',{username:'direct-member',expiresAt:null,note:'不得覆蓋'})),409);
   assert.equal((await list())[0].note,'固定客戶');assert.equal((await list())[0].expiresAt,expiresAt);
   await clearThrottle();const response=await login(db);await expectStatus(response,200);assert.equal((await readSession(db,response.headers.get('set-cookie').split(';')[0])).memberId,'tz:123');
   await expectStatus(await route.PATCH(request('PATCH',{memberId:'tz:123',enabled:false,expiresAt,note:'已暫停'})),200);
   assert.equal(await readSession(db,response.headers.get('set-cookie').split(';')[0]),null);
   await expectStatus(await route.POST(request('POST',{username:'direct-member',expiresAt:null})),200);assert.equal((await list())[0].note,'已暫停');
  });
  await t.test('unseen username is visible immediately and claims only after successful verification',async()=>{
   await reset();const expiresAt=Date.now()+3600000;
   await expectStatus(await route.POST(request('POST',{username:'Direct-Member',expiresAt,note:'新客戶'})),200);
   let rows=await list();assert.equal(rows.length,1);assert.equal(rows[0].memberId,null);assert.equal(rows[0].note,'新客戶');assert.equal(rows[0].signedIn,0);assert.equal(rows[0].accessState,'active');
   assert.equal(await db.prepare('SELECT * FROM tz_bindings').first(),null);assert.equal(await db.prepare('SELECT * FROM arena_sessions').first(),null);
   await expectStatus(await route.POST(request('POST',{username:'DIRECT-MEMBER',expiresAt:null})),409);
   assert.equal((await login(db,'direct-member',async()=>new Response('',{status:401}))).status,422);
   assert.equal((await db.prepare('SELECT claimed_member_id FROM account_preapprovals').first()).claimed_member_id,null);
   await clearThrottle();const response=await login(db);await expectStatus(response,200);
   rows=await list();assert.equal(rows.length,1);assert.equal(rows[0].memberId,'tz:123');assert.equal(rows[0].note,'新客戶');assert.equal(rows[0].expiresAt,expiresAt);assert.equal(rows[0].signedIn,1);
   assert.equal((await db.prepare('SELECT claimed_member_id FROM account_preapprovals').first()).claimed_member_id,'tz:123');
   const cookie=response.headers.get('set-cookie').split(';')[0],publicStatus=await tzLogin(new Request('https://site.test/api/session',{headers:{cookie}}),db,key);
   assert.doesNotMatch(await publicStatus.text(),/新客戶|note/);
   await expectStatus(await route.PATCH(request('PATCH',{pendingUsername:'Direct-Member',note:'stale edit'})),409);
  });
  await t.test('preapproval notes and expiry can be edited before first login; disabled and expired grants stay blocked',async()=>{
   for(const expires of [false,true]){
    await reset();await expectStatus(await route.POST(request('POST',{username:'direct-member',expiresAt:null,note:'原備註'})),200);
    await expectStatus(await route.PATCH(request('PATCH',{pendingUsername:'direct-member',note:'已更新'})),200);
    const expiresAt=expires?Date.now()-1000:null;
    await expectStatus(await route.PATCH(request('PATCH',{pendingUsername:'direct-member',enabled:expires,expiresAt})),200);
    assert.equal((await list())[0].note,'已更新');
    const response=await login(db);assert.equal((await expectStatus(response,403)).code,expires?'access_expired':'access_disabled');
    const row=(await list())[0];assert.equal(row.memberId,'tz:123');assert.equal(row.note,'已更新');assert.equal(row.accessState,expires?'expired':'disabled');
    assert.equal(await db.prepare('SELECT * FROM arena_sessions').first(),null);
   }
  });
  await t.test('cancelled preapproval and deleted member never regain access automatically',async()=>{
   await reset();await route.POST(request('POST',{username:'direct-member',expiresAt:null,note:'待取消'}));
   await expectStatus(await route.DELETE(request('DELETE',{pendingUsername:'direct-member',confirmUsername:'direct-member'})),200);
   assert.equal((await list()).length,0);assert.equal((await login(db)).status,403);
   await route.POST(request('POST',{username:'direct-member',expiresAt:null,note:'正式客戶'}));await clearThrottle();assert.equal((await login(db)).status,200);
   await expectStatus(await route.DELETE(request('DELETE',{memberId:'tz:123',confirmUsername:'direct-member'})),200);
   for(const table of ['account_notes','account_preapprovals','account_access','arena_sessions','tz_bindings'])assert.equal(await db.prepare(`SELECT * FROM ${table}`).first(),null,table);
   await clearThrottle();assert.equal((await login(db)).status,403);
  });
  await t.test('claim is single-use, including repeated logins at the same millisecond and recycled usernames',async()=>{
   await reset();const realNow=Date.now,frozen=realNow();Date.now=()=>frozen;
   try{
    await route.POST(request('POST',{username:'direct-member',expiresAt:null,note:'單次授權'}));assert.equal((await login(db)).status,200);
    await db.prepare('DELETE FROM account_access').run();await clearThrottle();assert.equal((await login(db)).status,403);
    await clearThrottle();assert.equal((await login(db,'direct-member',source('direct-member',999))).status,403);
    assert.equal(await db.prepare('SELECT * FROM account_access').first(),null);
    assert.equal((await db.prepare('SELECT claimed_member_id FROM account_preapprovals').first()).claimed_member_id,'tz:123');
    await expectStatus(await route.POST(request('POST',{username:'direct-member',expiresAt:null})),409);
   }finally{Date.now=realNow;}
  });
  await t.test('grant and note transfer roll back together on database failure',async()=>{
   await reset();await route.POST(request('POST',{username:'direct-member',expiresAt:null,note:'保留備註'}));
   const faulty={...db,batch(statements){if(statements.some(statement=>statement.sql.startsWith('UPDATE account_preapprovals')))statements.push(db.prepare('SELECT * FROM nonexistent_test_table'));return db.batch(statements);}};
   assert.equal((await login(faulty)).status,503);
   assert.equal((await db.prepare('SELECT claimed_member_id FROM account_preapprovals').first()).claimed_member_id,null);assert.equal(await db.prepare('SELECT * FROM account_access').first(),null);
   await clearThrottle();assert.equal((await login(db)).status,200);assert.equal((await list())[0].note,'保留備註');
  });
  await t.test('admin-only and same-origin rules cover direct grants and private notes',async()=>{
   await reset();globalThis.featureAdmin=false;
   for(const method of ['POST','PATCH','DELETE'])await expectStatus(await route[method](request(method,{username:'direct-member',expiresAt:null,note:'私密'})),403);
   await expectStatus(await route.GET(),403);globalThis.featureAdmin=true;
   for(const method of ['POST','PATCH','DELETE']){
    await expectStatus(await route[method](request(method,{},'https://other.test')),403);
    await expectStatus(await route[method](request(method,{},'https://site.test',{'sec-fetch-site':'cross-site'})),403);
   }
   assert.equal(await db.prepare('SELECT * FROM account_preapprovals').first(),null);
  });
  await t.test('invalid requests and administrator restrictions never create unintended grants',async()=>{
   await reset();
   for(const body of [null,{username:'',expiresAt:null},{username:'two names',expiresAt:null},{username:'direct-member',expiresAt:Date.now()-1},{username:'direct-member',expiresAt:null,note:'字'.repeat(1001)},{username:'direct-member',expiresAt:null,note:123}])await expectStatus(await route.POST(request('POST',body)),400);
   await expectStatus(await route.POST(request('POST',{username:'vrv01',expiresAt:null})),409);
   await expectStatus(await route.POST(request('POST',{username:'render-test-admin',expiresAt:Date.now()+100000})),409);
   await expectStatus(await route.POST(request('POST',{username:'render-test-admin',expiresAt:null,note:'尚未登入的管理員'})),409);
   assert.equal(await db.prepare('SELECT * FROM account_preapprovals').first(),null);
   assert.equal((await login(db,'render-test-admin',source('render-test-admin',888))).status,200);
   await expectStatus(await route.PATCH(request('PATCH',{memberId:'tz:888',note:'管理員備註'})),200);
   await expectStatus(await route.PATCH(request('PATCH',{memberId:'tz:888',enabled:false,expiresAt:null})),409);
   assert.equal((await list())[0].note,'管理員備註');assert.equal((await list())[0].enabled,1);
  });
 }finally{delete globalThis.featureAdmin;delete globalThis.featureDb;await pg.close();}
});
