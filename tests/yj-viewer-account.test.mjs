import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {createDatabase,migrate} from '../server/database.mjs';
import {moduleUrl} from './profile-loader.mjs';
const origin='https://arena-sports-board.onrender.com';
process.env.APP_ORIGIN=origin;
const {passwordDigest,viewerLogin}=await import(moduleUrl('lib/yj-viewer-account.ts'));
const {readSession,VIEWER_MEMBER_ID,viewerToken,hash}=await import(moduleUrl('lib/arena-session.ts'));
const {gateRequest}=await import(moduleUrl('server/request-gate.ts'));
const asModule=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
function routeModule(file,extra={}){
 let code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:99,target:9}}).outputText;
 for(const [name,value]of Object.entries({
  '@/app/admin-access':asModule('export const isSiteAdmin=async()=>globalThis.viewerAdmin===true;'),
  '@/db':asModule('export const getRawDb=()=>globalThis.viewerDb;'),
  '@/server/runtime':asModule("export const env={TZ_BINDING_KEY:'test'};"),
  '@/lib/turnstile-settings':asModule('export const readTurnstileSettings=async()=>({enabled:false});'),
  '@/lib/arena-session':moduleUrl('lib/arena-session.ts'),
  '@/lib/yj-viewer-account':moduleUrl('lib/yj-viewer-account.ts'),
  '@/lib/request-origin':moduleUrl('lib/request-origin.ts'),
  '@/lib/tz-login':moduleUrl('lib/tz-login.ts'),...extra
 }))code=code.replaceAll(`'${name}'`,JSON.stringify(value));
 return import(asModule(code));
}
const admin=await routeModule('app/api/admin/viewer-account/route.ts');
const session=await routeModule('app/api/session/route.ts');
const request=(path,method='GET',body,cookie='',site=origin)=>new Request(origin+path,{method,headers:{origin:site,'content-type':'application/json',cookie},...(body===undefined?{}:{body:JSON.stringify(body)})});
const expect=async(response,status)=>{assert.equal(response.status,status,await response.clone().text());return response;};
test('YJ viewer account with real PostgreSQL migrations, login, authorization and password rotation',async t=>{
 const pg=new PGlite({parsers:{20:Number,114:s=>s,3802:s=>s}});
 const query=async(sql,values=[])=>{if(sql.startsWith('-- Additive')){await pg.exec(sql);return {rows:[],rowCount:0};}const result=await pg.query(sql,values);return {...result,rowCount:result.affectedRows};};
 const pool={query,connect:async()=>({query,release(){}})},db=createDatabase(pool);
 const password='viewer-first-test-password',next='viewer-second-test-password';
 globalThis.viewerDb=db;globalThis.viewerAdmin=true;
 const clearThrottle=()=>db.prepare('DELETE FROM tz_binding_attempts').run();
 const login=async(secret=password)=>{await clearThrottle();return session.POST(request('/api/session','POST',{username:' AA3344 ',password:secret}));};
 const cookieOf=response=>response.headers.getSetCookie().find(s=>s.startsWith('__Host-yj_viewer=')).split(';')[0];
 let cookie;
 try{
  await migrate(pool);await pg.exec('SET search_path TO yj_platform_v1, pg_catalog');
  const initial=await db.prepare('SELECT * FROM yj_viewer_accounts').first();assert.equal(initial.username,'aa3344');assert.equal(initial.password_hash,'');
  process.env.YJ_VIEWER_BOOTSTRAP_HASH=await passwordDigest(password);await migrate(pool);
  assert.match((await db.prepare('SELECT password_hash FROM yj_viewer_accounts').first()).password_hash,/^scrypt:/);
  await db.prepare('UPDATE yj_viewer_accounts SET password_hash=?').bind(await passwordDigest(password)).run();
  await t.test('local login never calls external authentication and uses a separate secure cookie',async()=>{
   const fetchBefore=globalThis.fetch;let upstream=0;globalThis.fetch=async()=>{upstream++;throw Error('No external auth allowed');};
   try{const response=await expect(await login(),200);cookie=cookieOf(response);assert.equal((await response.json()).accessMode,'view_only');assert.equal(upstream,0);assert.match(response.headers.getSetCookie()[0],/HttpOnly; Secure; SameSite=Lax/);assert.equal((await readSession(db,cookie)).memberId,VIEWER_MEMBER_ID);assert.equal((await (await session.GET(request('/api/session','GET',undefined,cookie))).json()).accessMode,'view_only');}finally{globalThis.fetch=fetchBefore;}
   assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM tz_bindings').first()).n,0);
   assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM arena_sessions').first()).n,0);
  });
  await t.test('only viewing and navigation are allowed, including direct API and game URLs',async()=>{
   for(const path of ['/', '/?league=NBA','/teams','/players/nba/1','/api/baseball?kind=scores','/api/football?kind=analysis','/api/nba?weights=20,20,20,20,20','/api/viewer-analysis?gameId=1'])assert.equal(await gateRequest(request(path,'GET',undefined,cookie),db),null,path);
   for(const path of ['/admin','/admin/accounts','/api/admin/accounts','/api/admin/viewer-account','/ai-assistant','/api/ai-assistant','/api/hr9988','/api/tz-binding','/api/super-entry','/api/super007','/api/operations','/game-life','/game-life/index.html','/api/baseball?kind=super007','/api/nba?weights=80,5,5,5,5','/api/football?settings={}','/api/international?mode=refresh','/api/new-feature'])await expect(await gateRequest(request(path,'GET',undefined,cookie),db),403);
   for(const method of ['POST','PATCH','PUT','DELETE'])for(const path of ['/','/api/health','/api/free-trial','/api/analysis','/api/analysis/results','/api/international-sync','/api/baseball','/api/admin/viewer-account'])await expect(await gateRequest(request(path,method,{},cookie),db),403);
   const odds=await expect(await gateRequest(request('/api/member-odds','GET',undefined,cookie),db),200);assert.equal((await odds.json()).readOnly,true);
   assert.equal(await gateRequest(request('/api/session','DELETE',undefined,cookie),db),null);
  });
  await t.test('site restrictions cannot be overridden with cookies, username case, or forwarding headers',async()=>{
   process.env.RENDER_SERVICE_ID='srv-another-site';assert.equal(await readSession(db,cookie),null);await expect(await login(),403);
   delete process.env.RENDER_SERVICE_ID;process.env.APP_ORIGIN='https://maya-sports.onrender.com';assert.equal(await readSession(db,cookie),null);await expect(await login(),403);
   process.env.APP_ORIGIN=origin;
   await clearThrottle();await expect(await viewerLogin(request('/api/session','POST',{},'', 'https://other.test'),db,{password},{enabled:false}),403);
   await expect(await session.POST(request('/api/session','POST',{username:'aa3344',password,source:'tz'})),400);
  });
  await t.test('wrong passwords and rate limits cannot issue cookies',async()=>{
   const wrong=await expect(await login('wrong-password'),401);assert.equal(wrong.headers.get('set-cookie'),null);
   await expect(await session.POST(request('/api/session','POST',{username:'aa3344',password})),429);
   await clearThrottle();await expect(await viewerLogin(request('/api/session','POST',{}),db,{password},{enabled:true,secret:'test'},async()=>Response.json({success:false})),403);
  });
  await t.test('password changes require admin + same origin and cannot change the fixed role',async()=>{
   globalThis.viewerAdmin=false;await expect(await admin.GET(),403);await expect(await admin.PATCH(request('/api/admin/viewer-account','PATCH',{password:next})),403);
   globalThis.viewerAdmin=true;await expect(await admin.PATCH(request('/api/admin/viewer-account','PATCH',{password:next},'','https://other.test')),403);
   await expect(await admin.PATCH(request('/api/admin/viewer-account','PATCH',{password:next,role:'admin'})),400);
   await expect(await admin.PATCH(request('/api/admin/viewer-account','PATCH',{password:'short'})),400);
   const listing=await (await admin.GET()).json();assert.equal(listing.account.username,'aa3344');assert.equal(listing.account.password_hash,undefined);
  });
  await t.test('password rotation revokes sessions immediately and migration never resets it',async()=>{
   cookie=cookieOf(await expect(await login(),200));
   await expect(await admin.PATCH(request('/api/admin/viewer-account','PATCH',{password:next})),200);
   assert.equal(await readSession(db,cookie),null);await expect(await gateRequest(request('/api/baseball','GET',undefined,cookie),db),401);
   const stored=await db.prepare('SELECT password_hash FROM yj_viewer_accounts').first();await migrate(pool);assert.deepEqual(await db.prepare('SELECT password_hash FROM yj_viewer_accounts').first(),stored);
   await expect(await login(),401);cookie=cookieOf(await expect(await login(next),200));
  });
  await t.test('concurrent rotation between password verification and session insertion fails closed',async()=>{
   await clearThrottle();const originalBatch=db.batch.bind(db);
   db.batch=async statements=>{await db.prepare('UPDATE yj_viewer_accounts SET version=version+1').run();return originalBatch(statements);};
   try{await expect(await login(next),403);}finally{db.batch=originalBatch;}
  });
  await t.test('disable and logout revoke access without touching upstream accounts',async()=>{
   cookie=cookieOf(await expect(await login(next),200));
   await expect(await admin.PATCH(request('/api/admin/viewer-account','PATCH',{enabled:false})),200);assert.equal(await readSession(db,cookie),null);await expect(await login(next),401);
   await expect(await admin.PATCH(request('/api/admin/viewer-account','PATCH',{enabled:true})),200);cookie=cookieOf(await expect(await login(next),200));
   await expect(await session.DELETE(request('/api/session','DELETE',undefined,cookie)),200);assert.equal(await readSession(db,cookie),null);
   assert.equal(await db.prepare('SELECT token_hash FROM yj_viewer_sessions WHERE token_hash=?').bind(await hash(viewerToken(cookie))).first(),null);
  });
 }finally{delete process.env.YJ_VIEWER_BOOTSTRAP_HASH;delete process.env.RENDER_SERVICE_ID;process.env.APP_ORIGIN=origin;await pg.close();delete globalThis.viewerDb;delete globalThis.viewerAdmin;}
});
