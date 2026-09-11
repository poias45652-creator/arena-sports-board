import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const moduleUrl=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const transpile=name=>ts.transpileModule(readFileSync(new URL('../lib/'+name,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const credentialUrl=moduleUrl(transpile('tz-credentials.ts'));
const {credentialKey,decryptToken}=await import(credentialUrl);
const {handleTzBinding}=await import(moduleUrl(transpile('tz-binding-service.ts').replace("'./tz-credentials'",JSON.stringify(credentialUrl))));
const secret=Buffer.alloc(32,7).toString('base64');
const token=exp=>'test.'+Buffer.from(JSON.stringify({exp})).toString('base64url')+'.test';
const validToken=token(Math.floor(Date.now()/1000)+3600);
const origin='https://arena.example';
const req=(method='GET',body,other={})=>new Request(origin+'/api/tz-binding',{method,headers:{origin,'content-type':'application/json',...other},body:body===undefined?undefined:JSON.stringify(body)});
function setup(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(readFileSync(new URL('../drizzle/0002_empty_spot.sql',import.meta.url),'utf8'));
 sqlite.exec(readFileSync(new URL('../drizzle/0003_steady_professor_monster.sql',import.meta.url),'utf8'));
 const db={prepare(sql){const s=sqlite.prepare(sql);let args=[];const query={bind(...v){args=v;return query;},async first(){return s.get(...args)??null;},async run(){return s.run(...args);}};return query;},async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 const run=(request,member='member-a',fetcher=async()=>Response.json({code:200,data:{user_id:12,username:'fixture-user',token:validToken}}))=>handleTzBinding(request,member,()=>db,secret,fetcher);
 return {sqlite,db,run};
}
const credentials={username:'fixture-user',password:'synthetic-test-password'};
test('anonymous and cross-origin requests cannot access storage or login',async()=>{
 let touched=false;const database=()=>{touched=true;throw Error('must not run');};
 assert.equal((await handleTzBinding(req(),null,database,secret)).status,401);
 assert.equal((await handleTzBinding(req('POST',credentials,{origin:'https://evil.example'}),'member-a',database,secret)).status,403);
 assert.equal(touched,false);
});
test('successful login sends observed fields, persists encrypted owner-bound token, never sends token to browser',async()=>{
 const {sqlite,run}=setup();let sent;
 const r=await run(req('POST',credentials),'member-a',async(url,options)=>{assert.equal(url,'https://www.tz6868.com/api/v1/login');assert.equal(options.redirect,'manual');sent=JSON.parse(options.body);return Response.json({code:200,data:{user_id:12,username:credentials.username,token:validToken}});});
 assert.equal(r.status,200);const result=await r.json();assert.equal(result.status,'bound');
 assert.deepEqual(Object.keys(sent).sort(),['device_id','password','username']);assert.match(sent.device_id,/^[a-f0-9]{32}$/);
 const row=sqlite.prepare('SELECT * FROM tz_bindings').get();assert.notEqual(row.encrypted_token,validToken);
 const key=await credentialKey(secret);assert.equal(await decryptToken(row.encrypted_token,'member-a',key),validToken);
 await assert.rejects(()=>decryptToken(row.encrypted_token,'member-b',key));
 for(const value of [JSON.stringify(row),JSON.stringify(result)])assert.ok(!value.includes(credentials.password)&&!value.includes(validToken));
});
test('member status and unlink are isolated; repeated login is rate limited',async()=>{
 const {run}=setup();await run(req('POST',credentials));
 assert.equal((await (await run(req(),'member-b')).json()).status,'unbound');
 await run(req('DELETE'),'member-b');assert.equal((await (await run(req())).json()).status,'bound');
 assert.equal((await run(req('POST',credentials))).status,429);
 await run(req('DELETE'));assert.equal((await (await run(req())).json()).status,'unbound');
});
test('invalid credentials, source blocks, malformed responses and expired tokens never create a binding',async()=>{
 for(const upstream of [()=>new Response('',{status:403}),()=>Response.json({code:401,message:'private detail'}),()=>new Response('<html>challenge</html>'),()=>Response.json({code:200,data:{user_id:12,username:'fixture-user',token:token(1)}}),()=>{throw Error('network');}]){
  const {run,sqlite}=setup();const r=await run(req('POST',credentials),'member-a',async()=>upstream());assert.notEqual(r.status,200);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM tz_bindings').get().n,0);assert.ok(!(await r.text()).includes('private detail'));
 }
});
test('failed rebind preserves old credential and expiry is reported',async()=>{
 const {run,sqlite}=setup();await run(req('POST',credentials));const before=sqlite.prepare('SELECT encrypted_token FROM tz_bindings').get();
 sqlite.exec('UPDATE tz_binding_attempts SET allowed_at=0');
 await run(req('POST',credentials),'member-a',async()=>Response.json({code:401}));
 assert.deepEqual(sqlite.prepare('SELECT encrypted_token FROM tz_bindings').get(),before);
 sqlite.exec('UPDATE tz_bindings SET expires_at=1');assert.equal((await (await run(req())).json()).status,'expired');
});
test('unlink cancels an in-flight bind so a late source response cannot restore the credential',async()=>{
 const {run,sqlite}=setup();let entered,release;const waiting=new Promise(r=>entered=r);const gate=new Promise(r=>release=r);
 const pending=run(req('POST',credentials),'member-a',async()=>{entered();await gate;return Response.json({code:200,data:{user_id:12,username:'fixture-user',token:validToken}});});
 await waiting;await run(req('DELETE'));release();assert.equal((await pending).status,409);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM tz_bindings').get().n,0);
});
test('malformed, oversized and missing credentials do not call source',async()=>{
 const {run}=setup();let called=false;const source=async()=>{called=true;throw Error('unexpected');};
 for(const body of [null,{}, {username:'a',password:''},{username:'a'.repeat(5000),password:'b'}])assert.ok((await run(req('POST',body),'member-a',source)).status>=400);
 assert.equal(called,false);
});
test('missing encryption configuration fails before source login; missing storage returns recoverable error',async()=>{
 const {db}=setup();let called=false;
 const r=await handleTzBinding(req('POST',credentials),'member-a',()=>db,undefined,async()=>{called=true;throw Error('unexpected');});assert.equal(r.status,503);assert.equal(called,false);
 assert.equal((await handleTzBinding(req(),'member-a',()=>{throw Error('private db details');},secret)).status,503);
});

test('game URL is saved per member, requires valid tz binding, and is never marked connected',async()=>{
 const {run,sqlite}=setup();const url='https://hr9988.net/#/Games';
 assert.equal((await run(req('PATCH',{gameUrl:url}))).status,409);
 await run(req('POST',credentials));
 const saved=await (await run(req('PATCH',{gameUrl:url}))).json();
 assert.equal(saved.gameUrl,url);assert.equal(saved.gameConnectionStatus,'url_saved');
 assert.equal((await (await run(req())).json()).gameUrl,url);
 assert.equal((await (await run(req(),'member-b')).json()).gameUrl,undefined);
 sqlite.exec('UPDATE tz_bindings SET expires_at=1');
 assert.equal((await run(req('PATCH',{gameUrl:url}))).status,409);
});
test('game URL rejects other hosts, embedded credentials and authorization parameters; same-account renewal keeps the setting',async()=>{
 const {run,sqlite}=setup();await run(req('POST',credentials));
 for(const gameUrl of ['http://hr9988.net/#/Games','https://hr9988.net.evil.example/#/Games','https://user:secret@hr9988.net/#/Games','https://hr9988.net/?token=secret#/Games','https://hr9988.net:8443/#/Games'])assert.equal((await run(req('PATCH',{gameUrl}))).status,400);
 await run(req('PATCH',{gameUrl:'https://hr9988.net/#/Games'}));
 sqlite.exec('UPDATE tz_binding_attempts SET allowed_at=0');
 assert.equal((await (await run(req('POST',credentials))).json()).gameUrl,'https://hr9988.net/#/Games');
 sqlite.exec('UPDATE tz_binding_attempts SET allowed_at=0');
 const result=await run(req('POST',credentials),'member-a',async()=>Response.json({code:200,data:{user_id:99,username:'fixture-user',token:validToken}}));
 assert.equal((await result.json()).gameUrl,null);
});
