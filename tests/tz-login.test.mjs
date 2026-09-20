import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const code=f=>ts.transpileModule(readFileSync('lib/'+f,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const credentials=url(code('tz-credentials.ts')),session=url(code('arena-session.ts')),binding=url(code('tz-binding-service.ts').replace("'./tz-credentials'",JSON.stringify(credentials)));
const {tzLogin}=await import(url(code('tz-login.ts').replace("'./turnstile'",JSON.stringify(url(code('turnstile.ts')))).replace("'./arena-session'",JSON.stringify(session)).replace("'./tz-binding-service'",JSON.stringify(binding)).replace("'./tz-credentials'",JSON.stringify(credentials))));
const {readSession}=await import(session);
function db({approved=true}={}){const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of ['0002_empty_spot','0003_steady_professor_monster','0004_magical_dagger','0005_smiling_wolverine','0006_wide_nightcrawler'])sql.exec(readFileSync('drizzle/'+f+'.sql','utf8'));if(approved)sql.prepare('INSERT INTO account_access VALUES (?,?,?,?)').run('tz:123',1,null,Date.now());return {sql,prepare(q){const s=sql.prepare(q);let a=[];return {bind(...v){a=v;return this},async first(){return s.get(...a)||null},async all(){return {results:s.all(...a)}},async run(){return s.run(...a)}}},async batch(ss){sql.exec('BEGIN');try{const values=[];for(const s of ss)values.push(await s.run());sql.exec('COMMIT');return values;}catch(e){sql.exec('ROLLBACK');throw e;}}};}
const secret=Buffer.alloc(32,8).toString('base64');
const request=(method='POST',cookie='',origin='https://site.test')=>new Request('https://site.test/api/session',{method,headers:{origin,'Content-Type':'application/json',cookie},...(method==='POST'?{body:JSON.stringify({username:'test-user',password:'test-password'})}:{})});
const source=async()=>Response.json({code:200,data:{user_id:123,username:'test-user',token:'a.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+7200})).toString('base64url')+'.b'}});
test('tz verified identity, encrypted authorization, secure session, and logout revocation',async()=>{const d=db();const r=await tzLogin(request(),d,secret,source);assert.equal(r.status,200);const cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly; Secure; SameSite=Lax/);const sessionCookie=cookie.split(';')[0];const s=await readSession(d,sessionCookie);assert.equal(s.memberId,'tz:123');const b=d.sql.prepare('SELECT * FROM tz_bindings').all();assert.equal(b.length,1);assert.equal(b[0].game_url,'https://hr9988.net/#/Games');assert.ok(!JSON.stringify(b).includes('test-password'));assert.equal(d.sql.prepare('SELECT * FROM arena_sessions').all().length,1);const out=await tzLogin(request('DELETE',sessionCookie),d,secret,source);assert.equal(out.status,200);assert.equal(await readSession(d,sessionCookie),null);});
test('invalid credentials and cross-site login never create sessions',async()=>{const d=db();const wrong=await tzLogin(request(),d,secret,async()=>new Response('',{status:401}));assert.equal(wrong.status,422);assert.equal(wrong.headers.get('set-cookie'),null);assert.equal(d.sql.prepare('SELECT * FROM arena_sessions').all().length,0);assert.equal(d.sql.prepare('SELECT * FROM tz_bindings').all().length,0);const cross=await tzLogin(request('POST','','https://other.test'),d,secret,source);assert.equal(cross.status,403);});
test('expired source authorization invalidates otherwise valid session',async()=>{const d=db();const r=await tzLogin(request(),d,secret,source);const cookie=r.headers.get('set-cookie').split(';')[0];d.sql.prepare('UPDATE tz_bindings SET expires_at=0').run();assert.equal(await readSession(d,cookie),null);assert.equal(await readSession(d,'__Host-arena_tz=forged'),null);});

test('disabled accounts lose existing sessions and cannot sign in again',async()=>{
 const d=db();const login=await tzLogin(request(),d,secret,source);const cookie=login.headers.get('set-cookie').split(';')[0];
 d.sql.prepare('UPDATE account_access SET enabled=0 WHERE member_id=?').run('tz:123');
 assert.equal(await readSession(d,cookie),null);
 d.sql.prepare('DELETE FROM tz_binding_attempts').run();const denied=await tzLogin(request(),d,secret,source);assert.equal(denied.status,403);
 assert.equal(d.sql.prepare("SELECT COUNT(*) AS n FROM tz_bindings WHERE member_id LIKE 'login-candidate:%'").get().n,0);
});
test('usage expiry is independent of source authorization and can be extended',async()=>{
 const d=db();const login=await tzLogin(request(),d,secret,source);const cookie=login.headers.get('set-cookie').split(';')[0];
 d.sql.prepare('UPDATE account_access SET expires_at=? WHERE member_id=?').run(Date.now()-1,'tz:123');assert.equal(await readSession(d,cookie),null);
 d.sql.prepare('UPDATE account_access SET expires_at=?').run(Date.now()+3600000);assert.equal((await readSession(d,cookie)).memberId,'tz:123');
});
const adminStub=url('export async function isSiteAdmin(){return globalThis.accountTestAdmin===true}');
const dbStub=url('export function getRawDb(){return globalThis.accountTestDb}');
const adminSource=ts.transpileModule(readFileSync('app/api/admin/accounts/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const adminRoute=await import(url(adminSource.replace("'@/app/admin-access'",JSON.stringify(adminStub)).replace("'@/db'",JSON.stringify(dbStub)).replace("'@/lib/arena-session'",JSON.stringify(session))));
test('account management rejects non-admin users and cross-site changes',async()=>{
 globalThis.accountTestAdmin=false;globalThis.accountTestDb=undefined;
 assert.equal((await adminRoute.GET()).status,403);
 assert.equal((await adminRoute.PATCH(new Request('https://site.test/api/admin/accounts',{method:'PATCH'}))).status,403);
 globalThis.accountTestAdmin=true;
 assert.equal((await adminRoute.PATCH(new Request('https://site.test/api/admin/accounts',{method:'PATCH',headers:{origin:'https://other.test'}}))).status,403);
});
test('admin disable persists and revokes only the targeted member sessions',async()=>{
 const d=db();await tzLogin(request(),d,secret,source);globalThis.accountTestAdmin=true;globalThis.accountTestDb=d;
 const r=await adminRoute.PATCH(new Request('https://site.test/api/admin/accounts',{method:'PATCH',headers:{origin:'https://site.test','Content-Type':'application/json'},body:JSON.stringify({memberId:'tz:123',enabled:false,expiresAt:null})}));
 assert.equal(r.status,200);assert.equal(d.sql.prepare('SELECT enabled FROM account_access').get().enabled,0);assert.equal(d.sql.prepare('SELECT COUNT(*) AS n FROM arena_sessions').get().n,0);
});

test('Turnstile rejects missing tokens and missing configuration before contacting tz',async()=>{const d=db();const fetcher=async()=>{throw new Error('must not contact source')};assert.equal((await tzLogin(request(),d,secret,fetcher,'private-key',true)).status,403);assert.equal((await tzLogin(request(),d,secret,fetcher,undefined,true)).status,503);assert.equal(d.sql.prepare('SELECT * FROM arena_sessions').all().length,0);});
const {verifyTurnstile}=await import(url(code('turnstile.ts')));
test('Turnstile requires successful verification, exact hostname and login action',async()=>{
 const good={success:true,hostname:'arena-sports-board.poias45652.chatgpt.site',action:'login'};
 assert.equal(await verifyTurnstile('token','secret',async()=>Response.json(good)),true);
 for(const result of [{...good,success:false},{...good,hostname:'attacker.test'},{...good,action:'signup'}])assert.equal(await verifyTurnstile('token','secret',async()=>Response.json(result)),false);
 assert.equal(await verifyTurnstile('token','secret',async()=>{throw new Error('offline')}),false);
});

test('new verified platform account stays pending until administrator grants access',async()=>{
 const d=db({approved:false});
 const pending=await tzLogin(request(),d,secret,source);
 assert.equal(pending.status,403);assert.equal((await pending.json()).code,'approval_required');
 assert.match(pending.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal(d.sql.prepare('SELECT COUNT(*) AS n FROM arena_sessions').get().n,0);
 assert.equal(d.sql.prepare('SELECT COUNT(*) AS n FROM account_access').get().n,0);
 assert.equal(d.sql.prepare('SELECT COUNT(*) AS n FROM tz_bindings').get().n,1);
 globalThis.accountTestAdmin=true;globalThis.accountTestDb=d;
 const listing=await adminRoute.GET();assert.equal(listing.status,200);
 const accounts=(await listing.json()).accounts;assert.equal(accounts[0].accessState,'pending');assert.equal(accounts[0].enabled,0);
 assert.equal(accounts[0].encrypted_token,undefined);
 const grant=await adminRoute.PATCH(new Request('https://site.test/api/admin/accounts',{method:'PATCH',headers:{origin:'https://site.test','Content-Type':'application/json'},body:JSON.stringify({memberId:accounts[0].memberId,enabled:true,expiresAt:Date.now()+3600000})}));
 assert.equal(grant.status,200);
 d.sql.prepare('DELETE FROM tz_binding_attempts').run();
 const signed=await tzLogin(request(),d,secret,source);assert.equal(signed.status,200);
 assert.equal((await readSession(d,signed.headers.get('set-cookie').split(';')[0])).memberId,'tz:123');
 assert.equal((await (await adminRoute.GET()).json()).accounts[0].accessState,'active');
});

test('repeated verification does not duplicate pending accounts or override a rejection',async()=>{
 const d=db({approved:false});
 for(let i=0;i<2;i++){d.sql.prepare('DELETE FROM tz_binding_attempts').run();assert.equal((await tzLogin(request(),d,secret,source)).status,403);}
 assert.equal(d.sql.prepare('SELECT COUNT(*) AS n FROM tz_bindings').get().n,1);
 d.sql.prepare('INSERT INTO account_access VALUES (?,?,?,?)').run('tz:123',0,null,Date.now());
 d.sql.prepare('DELETE FROM tz_binding_attempts').run();
 const denied=await tzLogin(request(),d,secret,source);assert.equal((await denied.json()).code,'access_disabled');
 assert.equal(d.sql.prepare('SELECT enabled FROM account_access').get().enabled,0);
 assert.equal(d.sql.prepare('SELECT COUNT(*) AS n FROM arena_sessions').get().n,0);
});

test('missing authorization invalidates legacy cookies and concurrent grant removal cannot issue a session',async()=>{
 const d=db();const logged=await tzLogin(request(),d,secret,source);const cookie=logged.headers.get('set-cookie').split(';')[0];
 d.sql.prepare('DELETE FROM account_access').run();assert.equal(await readSession(d,cookie),null);
 d.sql.prepare('INSERT INTO account_access VALUES (?,?,?,?)').run('tz:123',1,null,Date.now());
 d.sql.prepare('DELETE FROM tz_binding_attempts').run();
 const original=d.prepare.bind(d);
 d.prepare=q=>{const stmt=original(q);if(q.startsWith('SELECT enabled,expires_at FROM account_access')){const first=stmt.first;stmt.first=async()=>{const row=await first();d.sql.prepare('DELETE FROM account_access').run();return row;};}return stmt;};
 const raced=await tzLogin(request(),d,secret,source);assert.equal(raced.status,403);
 assert.match(raced.headers.get('set-cookie'),/Max-Age=0/);assert.equal(d.sql.prepare('SELECT COUNT(*) AS n FROM arena_sessions').get().n,0);
});

test('authorization follows the verified platform ID and cannot transfer by matching username',async()=>{
 const d=db();
 const sameNameNewID=async()=>Response.json({code:200,data:{...(await source().then(r=>r.json())).data,user_id:999}});
 const denied=await tzLogin(request(),d,secret,sameNameNewID);assert.equal(denied.status,403);assert.equal((await denied.json()).code,'approval_required');
 assert.equal(d.sql.prepare('SELECT COUNT(*) AS n FROM arena_sessions').get().n,0);
});

test('primary administrator bootstrap requires upstream verification and cannot overwrite explicit restrictions',async()=>{
 const d=db({approved:false});
 const ownerRequest=()=>new Request('https://site.test/api/session',{method:'POST',headers:{origin:'https://site.test','Content-Type':'application/json'},body:JSON.stringify({username:'your_admin_username',password:'synthetic-owner-password'})});
 const ownerSource=async()=>Response.json({code:200,data:{...(await source().then(r=>r.json())).data,user_id:456,username:'your_admin_username'}});
 assert.equal((await tzLogin(ownerRequest(),d,secret,source)).status,502);
 assert.equal(d.sql.prepare('SELECT COUNT(*) AS n FROM account_access').get().n,0);
 d.sql.prepare('DELETE FROM tz_binding_attempts').run();
 assert.equal((await tzLogin(ownerRequest(),d,secret,ownerSource)).status,200);
 assert.equal(d.sql.prepare('SELECT enabled FROM account_access WHERE member_id=?').get('tz:456').enabled,1);
 globalThis.accountTestAdmin=true;globalThis.accountTestDb=d;
 for(const grant of [{enabled:false,expiresAt:null},{enabled:true,expiresAt:Date.now()+3600000}]){
  const r=await adminRoute.PATCH(new Request('https://site.test/api/admin/accounts',{method:'PATCH',headers:{origin:'https://site.test','Content-Type':'application/json'},body:JSON.stringify({memberId:'tz:456',...grant})}));assert.equal(r.status,409);
 }
 d.sql.prepare('UPDATE account_access SET enabled=0').run();d.sql.prepare('DELETE FROM tz_binding_attempts').run();
 assert.equal((await tzLogin(ownerRequest(),d,secret,ownerSource)).status,403);
 assert.equal(d.sql.prepare('SELECT enabled FROM account_access').get().enabled,0);
});

const deleteRequest=(memberId='tz:123',confirmUsername='test-user',origin='https://site.test')=>new Request('https://site.test/api/admin/accounts',{method:'DELETE',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({memberId,confirmUsername})});
test('account deletion requires admin, same-origin confirmation, and protects primary administrator',async()=>{
 globalThis.accountTestAdmin=false;globalThis.accountTestDb=undefined;
 assert.equal((await adminRoute.DELETE(deleteRequest())).status,403);
 globalThis.accountTestAdmin=true;
 assert.equal((await adminRoute.DELETE(deleteRequest('tz:123','test-user','https://other.test'))).status,403);
 const d=db();await tzLogin(request(),d,secret,source);globalThis.accountTestDb=d;
 assert.equal((await adminRoute.DELETE(deleteRequest('tz:123','wrong-user'))).status,409);
 assert.equal((await adminRoute.DELETE(deleteRequest('tz:999','test-user'))).status,404);
 assert.equal((await adminRoute.DELETE(deleteRequest('login-candidate:123','test-user'))).status,400);
 d.sql.prepare('UPDATE tz_bindings SET username=? WHERE member_id=?').run('your_admin_username','tz:123');
 assert.equal((await adminRoute.DELETE(deleteRequest('tz:123','your_admin_username'))).status,409);
 assert.equal(d.sql.prepare('SELECT COUNT(*) AS n FROM tz_bindings').get().n,1);
});

test('deletion removes only the selected member, revokes cookies and requires fresh approval on return',async()=>{
 const d=db();const logged=await tzLogin(request(),d,secret,source);const cookie=logged.headers.get('set-cookie').split(';')[0];
 d.sql.prepare('INSERT INTO tz_bindings SELECT ?,source_user_id,?,device_id,encrypted_token,expires_at,verified_at,game_url FROM tz_bindings WHERE member_id=?').run('tz:other','other-user','tz:123');
 d.sql.prepare('INSERT INTO account_access VALUES (?,?,?,?)').run('tz:other',1,null,Date.now());
 d.sql.prepare('INSERT INTO arena_sessions VALUES (?,?,?)').run('other-cookie-hash','tz:other',Date.now()+3600000);
 d.sql.prepare('INSERT INTO hr_connections (member_id,binding_version,busy_until,operation_id) VALUES (?,?,?,?)').run('tz:123',Date.now(),0,'test-operation');
 globalThis.accountTestAdmin=true;globalThis.accountTestDb=d;
 assert.equal((await adminRoute.DELETE(deleteRequest())).status,200);
 for(const table of ['tz_bindings','account_access','arena_sessions','hr_connections'])assert.equal(d.sql.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE member_id=?`).get('tz:123').n,0);
 assert.equal(await readSession(d,cookie),null);
 assert.equal(d.sql.prepare('SELECT COUNT(*) AS n FROM arena_sessions WHERE member_id=?').get('tz:other').n,1);
 assert.equal(d.sql.prepare('SELECT enabled FROM account_access WHERE member_id=?').get('tz:other').enabled,1);
 d.sql.prepare('DELETE FROM tz_binding_attempts').run();
 const again=await tzLogin(request(),d,secret,source);assert.equal(again.status,403);assert.equal((await again.json()).code,'approval_required');
 assert.equal(d.sql.prepare('SELECT COUNT(*) AS n FROM arena_sessions WHERE member_id=?').get('tz:123').n,0);
});

test('failed deletion rolls back all credential and authorization changes',async()=>{
 const d=db();const logged=await tzLogin(request(),d,secret,source);const cookie=logged.headers.get('set-cookie').split(';')[0];
 d.sql.exec("CREATE TRIGGER reject_delete BEFORE DELETE ON tz_bindings BEGIN SELECT RAISE(ABORT,'test failure'); END");
 globalThis.accountTestAdmin=true;globalThis.accountTestDb=d;
 assert.equal((await adminRoute.DELETE(deleteRequest())).status,400);
 assert.equal((await readSession(d,cookie)).memberId,'tz:123');
 assert.equal(d.sql.prepare('SELECT enabled FROM account_access').get().enabled,1);
});
