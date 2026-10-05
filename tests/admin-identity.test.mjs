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
 const expected=['dvp0322','dvp038','dvp03068','tzt05'];
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
  for(const username of ['dvp03068','tzt05']){
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
