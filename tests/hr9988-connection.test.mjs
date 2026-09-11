import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const code=f=>ts.transpileModule(readFileSync(new URL('../lib/'+f,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const credentialUrl=url(code('tz-credentials.ts')),parserUrl=url(code('hr9988.ts'));
const {credentialKey,encryptToken,decryptToken}=await import(credentialUrl);
const {hrConnection}=await import(url(code('hr9988-connection.ts').replace("'./tz-credentials'",JSON.stringify(credentialUrl)).replace("'./hr9988'",JSON.stringify(parserUrl))));
const secret=Buffer.alloc(32,9).toString('base64'),key=await credentialKey(secret);
const fixture=()=>JSON.parse(readFileSync(new URL('./fixtures/hr9988-game-detail.json',import.meta.url),'utf8'));
async function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const file of ['0002_empty_spot.sql','0003_steady_professor_monster.sql','0004_magical_dagger.sql'])sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const db={prepare(query){const s=sql.prepare(query);let args=[];const result={bind(...v){args=v;return result;},async first(){return s.get(...args)??null;},async run(){return s.run(...args);}};return result;}};
 async function add(member){sql.prepare('INSERT INTO tz_bindings (member_id,source_user_id,username,device_id,encrypted_token,expires_at,verified_at,game_url) VALUES (?,?,?,?,?,?,?,?)').run(member,member,'test-'+member,'device',await encryptToken('tz-test-'+member,member,key),Date.now()+3600000,1,'https://hr9988.net/#/Games');}
 await add('a');return {sql,db,add};
}
const exchange={code:200,data:{loginID:'test-hr-session',mb:{mbID:'TEST-MEMBER'},Lang:'tw'}};
function flow(calls,hook){return async(endpoint,options)=>{
 const request={endpoint,headers:options.headers,body:JSON.parse(options.body)};calls.push(request);
 assert.equal(options.redirect,'manual');
 if(hook){const result=await hook(request);if(result)return result;}
 if(endpoint.includes('/SUPER/login'))return Response.json({code:200,data:{game_method:'GET',game_url:'https://hr9988.net/#/APILogin?MemID=0123456789abcdef0123456789abcdef',game_post:{}}});
 if(endpoint.endsWith('/outApiLogin'))return Response.json(exchange);
 return Response.json(fixture());
};}
test('observed three-stage protocol yields private parsed odds, encrypts session, and cached refresh skips source calls',async()=>{
 const {db,sql}=await setup(),calls=[];
 const response=await hrConnection('a',db,secret,'connect',flow(calls));assert.equal(response.status,200);
 const result=await response.json();assert.equal(result.connection.status,'connected');assert.equal(result.games.length,4);assert.equal(result.source,'hr9988');assert.match(response.headers.get('cache-control'),/private/);
 assert.equal(calls.length,3);assert.equal(calls[0].headers.Authorization,'Bearer tz-test-a');assert.deepEqual(calls[0].body,{game_return_url:'https://www.tz6868.cc',game_kind:'',game_type:'',game_device:'Desktop'});
 assert.equal(calls[1].endpoint,'https://hr9988.net/api/mb/sin/outApiLogin');assert.equal(calls[1].body.MemID,'0123456789abcdef0123456789abcdef');assert.equal(calls[1].headers.Authorization,undefined);
 assert.deepEqual(calls[2].body,{GameType:3,CatID:888888,WagerTypeKey:888888});assert.equal(calls[2].headers.SSSToken,'test-hr-session');assert.equal(calls[2].headers.SSSMBID,'TEST-MEMBER');
 const row=sql.prepare('SELECT * FROM hr_connections').get();assert.ok(!JSON.stringify(row).includes('test-hr-session'));assert.equal(JSON.parse(await decryptToken(row.encrypted_session,'a:hr9988',key)).loginID,'test-hr-session');
 await assert.rejects(()=>decryptToken(row.encrypted_session,'b:hr9988',key));
 for(const secretValue of ['test-hr-session','tz-test-a','0123456789abcdef0123456789abcdef','TEST-MEMBER'])assert.ok(!JSON.stringify(result).includes(secretValue));
 await hrConnection('a',db,secret,'read',flow(calls));assert.equal(calls.length,3);
});
test('anonymous/unbound/expired members cannot use another member session',async()=>{
 const {db,sql,add}=await setup(),calls=[];await hrConnection('a',db,secret,'connect',flow(calls));
 assert.equal((await hrConnection(null,db,secret,'read',flow(calls))).status,401);
 assert.equal((await hrConnection('b',db,secret,'read',flow(calls))).status,409);
 await add('b');assert.equal((await (await hrConnection('b',db,secret,'status',flow(calls))).json()).status,'not_connected');
 await hrConnection('b',db,secret,'connect',flow(calls));assert.equal(calls[3].headers.Authorization,'Bearer tz-test-b');
 sql.prepare('UPDATE tz_bindings SET expires_at=1 WHERE member_id=?').run('b');assert.equal((await hrConnection('b',db,secret,'read',flow(calls))).status,409);assert.equal(calls.length,6);
});
test('known session expiry refreshes via tz once; ordinary access denial never retries or returns stale odds',async()=>{
 const {db,sql}=await setup();await hrConnection('a',db,secret,'connect',flow([]));sql.exec('UPDATE hr_connections SET fetched_at=1');
 const calls=[];let reject=true;
 const r=await hrConnection('a',db,secret,'read',flow(calls,request=>{if(request.endpoint.endsWith('/GameDetail')&&reject){reject=false;return Response.json({code:-101});}}));assert.equal(r.status,200);assert.equal(calls.length,4);
 sql.exec('UPDATE hr_connections SET fetched_at=1');const denied=[];
 const failure=await hrConnection('a',db,secret,'read',flow(denied,()=>new Response('private upstream error',{status:403})));
 assert.equal(failure.status,502);const body=await failure.json();assert.equal(body.code,'source_access_denied');assert.deepEqual(body.games,[]);assert.equal(body.fetchedAt,null);assert.equal(denied.length,1);
 assert.equal((await (await hrConnection('a',db,secret,'status')).json()).status,'error');
});
test('untrusted launch targets never receive the tz token or MemID',async()=>{
 const {db}=await setup(),calls=[];
 const r=await hrConnection('a',db,secret,'connect',flow(calls,()=>Response.json({code:200,data:{game_method:'GET',game_url:'https://evil.example/#/APILogin?MemID=0123456789abcdef0123456789abcdef'}})));
 assert.equal(r.status,502);assert.equal(calls.length,1);assert.equal((await r.json()).code,'wrong_game_destination');
});
test('in-flight bind invalidation and unlink cannot restore obsolete authorization',async()=>{
 for(const unlink of [false,true]){
  const {db,sql}=await setup();const r=await hrConnection('a',db,secret,'connect',flow([],request=>{if(request.endpoint.endsWith('/GameDetail'))sql.exec(unlink?'DELETE FROM tz_bindings':'UPDATE tz_bindings SET verified_at=2');}));assert.equal(r.status,409);
  if(unlink)assert.equal(sql.prepare('SELECT count(*) AS n FROM hr_connections').get().n,0);
  else assert.equal((await (await hrConnection('a',db,secret,'status')).json()).status,'not_connected');
 }
});
test('parallel connection is locked and a failed exchange never reports connected',async()=>{
 const {db}=await setup();let started,release;const waiting=new Promise(r=>started=r),gate=new Promise(r=>release=r);
 const task=hrConnection('a',db,secret,'connect',flow([],async request=>{if(request.endpoint.includes('/SUPER/login')){started();await gate;return Response.json({code:200,data:{}});}}));
 await waiting;assert.equal((await hrConnection('a',db,secret,'connect',flow([]))).status,429);release();assert.equal((await task).status,502);
 assert.equal((await (await hrConnection('a',db,secret,'status')).json()).status,'error');
});
