import test from 'node:test';import assert from 'node:assert/strict';import ts from 'typescript';import{readFileSync}from'node:fs';
const url=c=>'data:text/javascript;base64,'+Buffer.from(c).toString('base64');
const mocks={"'./chatgpt-auth'":url('export async function getChatGPTUser(){return globalThis.adminTestUser}'),"'next/headers'":url("export async function headers(){return new Headers({cookie:'test',username:'render-test-admin'})}"),"'@/db'":url('export function getRawDb(){return {}}'),"'@/lib/arena-session'":url("export const PLATFORM_ADMIN_USERNAME='render-test-admin';export async function readSession(){if(globalThis.adminTestFail)throw new Error();return globalThis.adminTestSession}")};
let source=ts.transpileModule(readFileSync('app/admin-access.ts','utf8'),{compilerOptions:{module:99,target:9}}).outputText;for(const[k,v]of Object.entries(mocks))source=source.replace(k,JSON.stringify(v));
const {adminIdentity}=await import(url(source));
test('only the verified configured platform administrator authorizes administration',async()=>{
 globalThis.adminTestUser=null;globalThis.adminTestSession=null;assert.equal(await adminIdentity(),null);
 globalThis.adminTestSession={username:'member01'};assert.equal(await adminIdentity(),null);
 globalThis.adminTestSession={username:'RENDER-TEST-ADMIN'};assert.equal(await adminIdentity(),null);
 globalThis.adminTestSession={memberId:'tz:admin',username:'RENDER-TEST-ADMIN'};assert.equal(await adminIdentity(),'tz');
 globalThis.adminTestSession={memberId:'ofa:member',username:'RENDER-TEST-ADMIN'};assert.equal(await adminIdentity(),null);
 globalThis.adminTestSession={memberId:'ofa:admin',username:'dvp0322'};assert.equal(await adminIdentity(),'ofa');
 globalThis.adminTestSession={memberId:'tz:member',username:'dvp0322'};assert.equal(await adminIdentity(),null);
 globalThis.adminTestSession=null;assert.equal(await adminIdentity(),null);
 globalThis.adminTestSession={memberId:'tz:admin',username:'render-test-admin'};globalThis.adminTestFail=true;assert.equal(await adminIdentity(),null);
 globalThis.adminTestUser={email:'owner@example.invalid'};assert.equal(await adminIdentity(),null);globalThis.adminTestFail=false;
});

test('OFA administrators require a verified OFA session, including dvp03068 and tzt05',async()=>{
 globalThis.adminTestFail=false;
 try{
  for(const username of ['dvp0322','dvp038','dvp03068','DVP03068','tzt05','TZT05']){
   globalThis.adminTestSession={memberId:'ofa:verified',username};assert.equal(await adminIdentity(),'ofa');
   globalThis.adminTestSession={memberId:'tz:verified',username};assert.equal(await adminIdentity(),null);
   globalThis.adminTestSession={username};assert.equal(await adminIdentity(),null);
  }
  globalThis.adminTestSession={memberId:'ofa:verified',username:'ordinary-member'};assert.equal(await adminIdentity(),null);
  globalThis.adminTestSession={memberId:'ofa:verified',username:'dvp03068'};globalThis.adminTestFail=true;assert.equal(await adminIdentity(),null);
 }finally{globalThis.adminTestSession=null;globalThis.adminTestFail=false;}
});

test('OFA routing, verified identity checks and access bootstrap use the same explicit administrators',()=>{
 const expected=['dvp0322','dvp038','dvp03068','tzt05','vrv01'];
 for(const [file,count] of [['app/admin-access.ts',1],['lib/tz-login.ts',4]]){
  const parsed=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  const lists=[];
  function visit(node){
   if(ts.isArrayLiteralExpression(node)&&node.elements.some(e=>ts.isStringLiteral(e)&&e.text==='dvp0322'))lists.push(node.elements.map(e=>e.text));
   ts.forEachChild(node,visit);
  }
  visit(parsed);assert.equal(lists.length,count);
  for(const list of lists)assert.deepEqual(list,expected);
 }
});

// Exercise source selection without making network requests or accepting a login.
const routingMocks={
 "'./request-origin'":url("export const requestOrigin=r=>new URL(r.url).origin;"),
 "'./turnstile'":url("export async function verifyTurnstile(){return false;}"),
 "'./arena-session'":url("export const PLATFORM_ADMIN_USERNAME='render-test-admin';export const hash=async v=>v;export const sessionToken=()=>null;export const sessionCookie=()=>'';export async function readSession(){return null;}"),
 "'./tz-binding-service'":url("export async function handleTzBinding(request,memberId){globalThis.ofaRoutingCalls.push({memberId,username:(await request.json()).username});return Response.json({message:'synthetic upstream rejection'},{status:422});}"),
 "'./tz-credentials'":url("export const credentialKey=async()=>{throw new Error('must not grant access');};export const decryptToken=credentialKey;export const encryptToken=credentialKey;")
};
let loginSource=ts.transpileModule(readFileSync('lib/tz-login.ts','utf8'),{compilerOptions:{module:99,target:9}}).outputText;
for(const[k,v]of Object.entries(routingMocks))loginSource=loginSource.replace(k,JSON.stringify(v));
const {tzLogin}=await import(url(loginSource));
const routingDb={
 prepare(sql){return {bind(){return this;},async first(){assert.match(sql,/^INSERT INTO tz_binding_attempts/);return {member_id:'test-throttle'};},async run(){assert.match(sql,/^DELETE FROM tz_(bindings|binding_attempts)/);}};},
 async batch(statements){for(const statement of statements)await statement.run();}
};
const loginRequest=(username,extra={})=>new Request('https://site.test/api/session',{method:'POST',headers:{origin:'https://site.test','Content-Type':'application/json'},body:JSON.stringify({username,password:'synthetic-test-password',...extra})});
test('new and existing OFA administrators reach OFA verification, never TZ or a password bypass',async()=>{
 globalThis.ofaRoutingCalls=[];
 try{
  for(const username of ['dvp0322','dvp038','dvp03068',' DVP03068 ','tzt05',' TZT05 ']){
   const r=await tzLogin(loginRequest(username),routingDb,'synthetic-key');
   assert.equal(r.status,422);assert.equal(r.headers.get('set-cookie'),null);
   const call=globalThis.ofaRoutingCalls.at(-1);assert.match(call.memberId,/^ofa-login-candidate:/);assert.equal(call.username,username.trim());
  }
  const ordinary=await tzLogin(loginRequest('ordinary-member'),routingDb,'synthetic-key');
  assert.equal(ordinary.status,422);assert.match(globalThis.ofaRoutingCalls.at(-1).memberId,/^login-candidate:/);
  assert.equal(globalThis.ofaRoutingCalls.length,7);
 }finally{delete globalThis.ofaRoutingCalls;}
});
test('new OFA administrator still requires Turnstile and cannot choose an identity source',async()=>{
 globalThis.ofaRoutingCalls=[];
 try{
  for(const username of ['dvp03068','tzt05','vrv01','vrvtest01']){
   const captcha=await tzLogin(loginRequest(username),routingDb,'synthetic-key',fetch,'synthetic-turnstile-key',true);
   assert.equal(captcha.status,403);assert.equal(captcha.headers.get('set-cookie'),null);
   const suppliedSource=await tzLogin(loginRequest(username,{source:'ofa'}),routingDb,'synthetic-key');
   assert.equal(suppliedSource.status,400);assert.equal(suppliedSource.headers.get('set-cookie'),null);
  }
  assert.deepEqual(globalThis.ofaRoutingCalls,[]);
 }finally{delete globalThis.ofaRoutingCalls;}
});

test('tzt05 administrator matching is exact and session failures deny access',async()=>{
 globalThis.adminTestFail=false;
 try{
  for(const username of ['tzt050','pretzt05','tzt05-suffix']){
   globalThis.adminTestSession={memberId:'ofa:verified',username};assert.equal(await adminIdentity(),null);
  }
  globalThis.adminTestSession={memberId:'ofa:verified',username:'tzt05'};globalThis.adminTestFail=true;
  assert.equal(await adminIdentity(),null);
 }finally{globalThis.adminTestSession=null;globalThis.adminTestFail=false;}
});

test('vrvtest01 is TZ-only and vrv01 is OFA-only, with exact verified identities',async()=>{
 globalThis.adminTestFail=false;
 try{
  for(const [username,provider] of [['vrvtest01','tz'],['VRVTEST01','tz'],['vrv01','ofa'],['VRV01','ofa']]){
   globalThis.adminTestSession={memberId:provider+':verified',username};assert.equal(await adminIdentity(),provider);
   globalThis.adminTestSession={memberId:(provider==='tz'?'ofa':'tz')+':verified',username};assert.equal(await adminIdentity(),null);
   globalThis.adminTestSession={username};assert.equal(await adminIdentity(),null);
   globalThis.adminTestSession={memberId:provider+':verified',username};globalThis.adminTestFail=true;assert.equal(await adminIdentity(),null);globalThis.adminTestFail=false;
  }
  for(const username of ['vrvtest010','prevrvtest01','vrv010','prevrv01'])for(const provider of ['tz','ofa']){
   globalThis.adminTestSession={memberId:provider+':verified',username};assert.equal(await adminIdentity(),null);
  }
 }finally{globalThis.adminTestSession=null;globalThis.adminTestFail=false;}
});

test('new administrators use their requested provider and failed verification never issues a session',async()=>{
 globalThis.ofaRoutingCalls=[];
 try{
  for(const [username,pattern] of [['vrvtest01',/^login-candidate:/],[' VRVTEST01 ',/^login-candidate:/],['vrv01',/^ofa-login-candidate:/],[' VRV01 ',/^ofa-login-candidate:/]]){
   const r=await tzLogin(loginRequest(username),routingDb,'synthetic-key');
   assert.equal(r.status,422);assert.equal(r.headers.get('set-cookie'),null);
   assert.match(globalThis.ofaRoutingCalls.at(-1).memberId,pattern);
  }
 }finally{delete globalThis.ofaRoutingCalls;}
});

// Isolate database authorization from upstream transport and token encryption.
// All identities, grants and credentials in this harness are synthetic.
const grantMocks={...routingMocks,
 "'./arena-session'":url("export const PLATFORM_ADMIN_USERNAME='render-test-admin';export const hash=async v=>v;export const sessionToken=()=>null;export const sessionCookie=(v,age)=>'test='+v+'; Max-Age='+age;export async function readSession(db){return db.sessionIssued?{memberId:db.member,username:db.username}:null;}"),
 "'./tz-binding-service'":url("export async function handleTzBinding(request,candidate,getDb){const db=getDb(),{username}=await request.json();db.username=username;db.member=(candidate.startsWith('ofa-')?'ofa:':'tz:')+'synthetic-id';return Response.json({ok:true});}"),
 "'./tz-credentials'":url("export const credentialKey=async()=>null;export const decryptToken=async()=> 'synthetic-token';export const encryptToken=async()=> 'synthetic-ciphertext';")
};
let grantSource=ts.transpileModule(readFileSync('lib/tz-login.ts','utf8'),{compilerOptions:{module:99,target:9}}).outputText;
for(const[k,v]of Object.entries(grantMocks))grantSource=grantSource.replace(k,JSON.stringify(v));
const grantLogin=(await import(url(grantSource))).tzLogin;
function grantDb(access=null){
 const db={access,sessionIssued:false,member:null,username:null,prepare(sql){
  let args=[];return {bind(...values){args=values;return this;},async first(){
   if(sql.startsWith('INSERT INTO tz_binding_attempts'))return {member_id:'synthetic-rate'};
   if(sql==='SELECT * FROM tz_bindings WHERE member_id=?')return {username:db.username,source_user_id:'synthetic-id',device_id:'synthetic-device',encrypted_token:'synthetic-ciphertext',expires_at:Date.now()+3600000,verified_at:Date.now()};
   if(sql==='SELECT enabled,expires_at FROM account_access WHERE member_id=?')return db.access;
   throw new Error('Unexpected authorization query: '+sql);
  },async run(){
   if(sql.startsWith('INSERT INTO account_access')){assert.match(sql,/ON CONFLICT\(member_id\) DO NOTHING$/);db.access??={enabled:1,expires_at:null};}
   else if(sql.startsWith('INSERT INTO arena_sessions'))db.sessionIssued=db.access?.enabled===1&&(db.access.expires_at===null||db.access.expires_at>Date.now());
   else assert.match(sql,/^(INSERT INTO tz_bindings|DELETE FROM (tz_bindings|tz_binding_attempts|arena_sessions))/);
  }};
 },async batch(statements){for(const statement of statements)await statement.run();}};
 return db;
}

test('both new verified administrators bootstrap access without replacing the primary or existing OFA admins',async()=>{
 for(const [username,provider] of [['vrvtest01','tz'],['VRVTEST01','tz'],['vrv01','ofa'],['VRV01','ofa'],['render-test-admin','tz'],['dvp0322','ofa'],['dvp038','ofa'],['dvp03068','ofa'],['tzt05','ofa']]){
  const db=grantDb(),r=await grantLogin(loginRequest(username),db,'synthetic-key');
  assert.equal(r.status,200,username);assert.equal((await r.json()).source,provider);assert.equal(db.member,provider+':synthetic-id');
  assert.deepEqual(db.access,{enabled:1,expires_at:null});assert.equal(db.sessionIssued,true);
 }
 for(const username of ['ordinary-member','vrvtest010','vrv010']){
  const db=grantDb(),r=await grantLogin(loginRequest(username),db,'synthetic-key');
  assert.equal(r.status,403);assert.equal((await r.json()).code,'approval_required');assert.equal(db.access,null);assert.equal(db.sessionIssued,false);
 }
});

test('administrator bootstrap preserves explicit disabled, expired and time-limited grants',async()=>{
 for(const username of ['vrvtest01','vrv01'])for(const access of [{enabled:0,expires_at:null},{enabled:1,expires_at:Date.now()-1000},{enabled:1,expires_at:Date.now()+3600000}]){
  const original={...access},db=grantDb(access),r=await grantLogin(loginRequest(username),db,'synthetic-key');
  const allowed=access.enabled===1&&access.expires_at>Date.now();assert.equal(r.status,allowed?200:403);
  assert.deepEqual(db.access,original);assert.equal(db.sessionIssued,allowed);
 }
});

const {DatabaseSync}=await import('node:sqlite');
const accountMocks={
 "'@/lib/request-origin'":routingMocks["'./request-origin'"],
 "'@/app/admin-access'":url('export async function isSiteAdmin(){return globalThis.addedAdminAllowed===true}'),
 "'@/db'":url('export function getRawDb(){return globalThis.addedAdminDb}'),
 "'@/lib/arena-session'":url("export const PLATFORM_ADMIN_USERNAME='render-test-admin';")
};
let accountSource=ts.transpileModule(readFileSync('app/api/admin/accounts/route.ts','utf8'),{compilerOptions:{module:99,target:9}}).outputText;
for(const[k,v]of Object.entries(accountMocks))accountSource=accountSource.replace(k,JSON.stringify(v));
const accounts=await import(url(accountSource));
function accountDb(){
 const sql=new DatabaseSync(':memory:');
 sql.exec('CREATE TABLE tz_bindings(member_id TEXT PRIMARY KEY,username TEXT,verified_at INTEGER);CREATE TABLE account_access(member_id TEXT PRIMARY KEY,enabled INTEGER,expires_at INTEGER,updated_at INTEGER);CREATE TABLE arena_sessions(member_id TEXT);CREATE TABLE hr_connections(member_id TEXT);CREATE TABLE tz_binding_attempts(member_id TEXT);');
 for(const [id,username] of [['tz:primary','render-test-admin'],['tz:new','VRVTEST01'],['tz:member','ordinary-member'],['ofa:other','vrvtest01']]){
  sql.prepare('INSERT INTO tz_bindings VALUES (?,?,?)').run(id,username,Date.now());sql.prepare('INSERT INTO account_access VALUES (?,1,NULL,?)').run(id,Date.now());
 }
 return {sql,prepare(query){const statement=sql.prepare(query);let args=[];return {bind(...values){args=values;return this;},async first(){return statement.get(...args)||null;},async all(){return {results:statement.all(...args)};},async run(){return statement.run(...args);}};},async batch(statements){for(const statement of statements)await statement.run();}};
}
const adminRequest=(method,body,origin='https://site.test')=>new Request('https://site.test/api/admin/accounts',{method,headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('TZ account listing identifies the added administrator and preserves admin account protection',async()=>{
 const db=accountDb();globalThis.addedAdminDb=db;globalThis.addedAdminAllowed=true;
 try{
  const r=await accounts.GET();assert.equal(r.status,200);const rows=(await r.json()).accounts;
  assert.equal(rows.length,3);assert.equal(rows.find(row=>row.memberId==='tz:primary').isAdmin,1);
  assert.equal(rows.find(row=>row.memberId==='tz:new').isAdmin,1);assert.equal(rows.find(row=>row.memberId==='tz:member').isAdmin,0);
  for(const [memberId,username] of [['tz:primary','render-test-admin'],['tz:new','VRVTEST01']]){
   assert.equal((await accounts.PATCH(adminRequest('PATCH',{memberId,enabled:false,expiresAt:null}))).status,409);
   assert.equal((await accounts.PATCH(adminRequest('PATCH',{memberId,enabled:true,expiresAt:Date.now()+3600000}))).status,409);
   assert.equal((await accounts.DELETE(adminRequest('DELETE',{memberId,confirmUsername:username}))).status,409);
   assert.equal(db.sql.prepare('SELECT enabled FROM account_access WHERE member_id=?').get(memberId).enabled,1);
  }
  assert.equal((await accounts.PATCH(adminRequest('PATCH',{memberId:'tz:member',enabled:false,expiresAt:null}))).status,200);
  assert.equal(db.sql.prepare("SELECT enabled FROM account_access WHERE member_id='tz:member'").get().enabled,0);
 }finally{db.sql.close();delete globalThis.addedAdminDb;delete globalThis.addedAdminAllowed;}
});
test('account administration still rejects non-admin callers and cross-site changes',async()=>{
 globalThis.addedAdminAllowed=false;
 try{
  assert.equal((await accounts.GET()).status,403);
  assert.equal((await accounts.PATCH(adminRequest('PATCH',{}))).status,403);
  assert.equal((await accounts.DELETE(adminRequest('DELETE',{}))).status,403);
  globalThis.addedAdminAllowed=true;
  assert.equal((await accounts.PATCH(adminRequest('PATCH',{},'https://other.test'))).status,403);
  assert.equal((await accounts.DELETE(adminRequest('DELETE',{},'https://other.test'))).status,403);
 }finally{delete globalThis.addedAdminAllowed;}
});
