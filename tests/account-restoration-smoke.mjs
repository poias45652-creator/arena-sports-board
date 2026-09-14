import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';

// Uses a local fixture only; never connects to the deployed database.
const root=fileURLToPath(new URL('..',import.meta.url));
const temp=await mkdtemp(join(tmpdir(),'arena-navigation-'));
const hook=join(temp,'session-fixture.mjs');
await writeFile(hook, `import {createHash} from 'node:crypto';
const hash=v=>createHash('sha256').update(v).digest('hex');
const users=new Map();
const sessions=new Map([
 [hash('A'.repeat(43)),{id:'test-admin',username:'fixture.admin',role:'admin'}],
 [hash('B'.repeat(43)),{id:'test-member',username:'fixture.member',role:'member'}]
]);
globalThis.__arenaPool={async connect(){return {query:this.query.bind(this),release(){}};},async query(sql,params){
 if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return {rows:[]};
 if(sql.startsWith('SELECT EXISTS'))return {rows:[{exists:true}]};
 if(sql.startsWith('INSERT INTO arena_auth_attempts'))return {rows:[{attempts:1}]};
 if(sql==='SELECT * FROM arena_users WHERE username=$1')return {rows:users.has(params[0])?[users.get(params[0])]:[]};
 if(sql.startsWith('INSERT INTO arena_users')){
  if(users.has(params[1]))throw Object.assign(new Error('duplicate'),{code:'23505'});
  if(!/^[a-f0-9]{128}$/.test(params[3]))throw new Error('Password must be hashed');
  users.set(params[1],{id:params[0],username:params[1],password_salt:params[2],password_hash:params[3],role:'member'});return {rows:[],rowCount:1};
 }
 if(sql.startsWith('INSERT INTO arena_sessions')){const user=[...users.values()].find(u=>u.id===params[1]);sessions.set(params[0],user);return {rows:[],rowCount:1};}
 if(sql.startsWith('SELECT u.id,u.username,u.role FROM arena_sessions'))return {rows:sessions.has(params[0])?[sessions.get(params[0])]:[]};
 if(sql==='DELETE FROM arena_sessions WHERE token_hash=$1'){sessions.delete(params[0]);return {rows:[],rowCount:1};}
 throw new Error('Unexpected fixture query');
}};
`);
const base='http://127.0.0.1:19192';
const child=spawn(process.execPath,['--import',hook,'.next/standalone/server.js'],{
 cwd:root,env:{...process.env,PORT:'19192',HOSTNAME:'127.0.0.1',NODE_ENV:'production',DATABASE_URL:'postgresql://fixture@127.0.0.1:1/unused_navigation_check',APP_ORIGIN:base,RENDER_EXTERNAL_URL:base},stdio:['ignore','pipe','pipe']
});
let logs='';for(const pipe of [child.stdout,child.stderr])pipe.on('data',v=>{logs+=v;});
async function request(path,token,options={}){
 return fetch(base+path,{redirect:'manual',...options,headers:{...(token?{Cookie:'arena_session='+token.repeat(43)}:{}),...options.headers},signal:AbortSignal.timeout(10000)});
}
try{
 let ready=false;
 for(let i=0;i<100;i++){
  if(child.exitCode!==null)throw new Error('server exited: '+logs);
  try{const r=await request('/login');if(r.status===200){ready=true;break;}}catch{}
  await delay(100);
 }
 assert.ok(ready,'production server starts');
 const login=await request('/login');const loginHTML=await login.text();
 assert.match(loginHTML,/YJ體育分析/);assert.match(loginHTML,/登入 YJ體育分析/);assert.match(loginHTML,/type="password"/);assert.doesNotMatch(loginHTML,/ARENA|Arena 帳號|建立帳號/);const videoTag=loginHTML.match(/<video[^>]*>/)?.[0]||'';for(const attr of ['autoPlay','muted','loop','playsInline'])assert.ok(videoTag.includes(attr),attr);assert.match(loginHTML,/src="\/0912-bg\.mp4"/);
 const video=await request('/0912-bg.mp4',undefined,{headers:{Range:'bytes=0-63'}});assert.equal(video.status,206);assert.match(video.headers.get('content-type'),/video\/mp4/);const bytes=Buffer.from(await video.arrayBuffer());assert.equal(bytes.length,64);assert.equal(bytes.subarray(4,8).toString(),'ftyp');
 for(const path of ['/','/admin']){
  const r=await request(path);assert.equal(r.status,307);const location=new URL(r.headers.get('location'),base);assert.equal(location.pathname,'/login');assert.equal(location.searchParams.get('return_to'),path);
 }
 const memberHome=await request('/','B');assert.equal(memberHome.status,200);const memberHTML=await memberHome.text();
 assert.doesNotMatch(memberHTML,/href="\/admin"/);assert.match(memberHTML,/登出/);
 const adminHome=await request('/','A');assert.equal(adminHome.status,200);const adminHTML=await adminHome.text();
 assert.match(adminHTML,/href="\/admin"/);assert.match(adminHTML,/管理後台/);assert.match(adminHTML,/登出/);
 const memberAdmin=await request('/admin','B');const denied=await memberAdmin.text();
 assert.match(denied,/目前登入的帳號沒有後台權限/);assert.doesNotMatch(denied,/Arena 管理後台/);
 const memberOps=await request('/api/operations','B');assert.equal(memberOps.status,403);
 const adminPage=await request('/admin','A');assert.equal(adminPage.status,200);const adminPageHTML=await adminPage.text();
 assert.match(adminPageHTML,/Arena 管理後台/);assert.match(adminPageHTML,/返回前台/);assert.match(adminPageHTML,/登出/);assert.match(adminPageHTML,/新增會員帳號/);assert.match(adminPageHTML,/name="username"/);assert.match(adminPageHTML,/name="password"/);
 const account={username:'restored.member',password:'Fixture-password-123!',role:'admin'};
 const post=(path,token,body=account,origin=base)=>request(path,token,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await post('/api/meta')).status,403);
 assert.equal((await post('/api/meta','B')).status,403);
 assert.equal((await post('/api/meta','A',account,'https://different.invalid')).status,403);
 assert.equal((await post('/api/meta','A',{...account,password:'short'})).status,400);
 assert.equal((await post('/api/auth/register')).status,403);
 const created=await post('/api/meta','A');assert.equal(created.status,201);assert.equal(created.headers.get('set-cookie'),null);assert.deepEqual(await created.json(),{ok:true,username:account.username});
 const adminMe=await request('/api/auth/me','A');assert.equal((await adminMe.json()).user.role,'admin');
 assert.equal((await post('/api/meta','A')).status,409);
 assert.equal((await post('/api/auth/login',undefined,{...account,password:'Wrong-password-123!'})).status,401);
 const signedIn=await post('/api/auth/login');assert.equal(signedIn.status,200);const user=await signedIn.json();assert.equal(user.user.role,'member');
 const newCookie=signedIn.headers.get('set-cookie').split(';')[0];const newHome=await request('/',undefined,{headers:{Cookie:newCookie}});assert.equal(newHome.status,200);assert.doesNotMatch(await newHome.text(),/href="\/admin"/);
 const newMemberDenied=await request('/admin',undefined,{headers:{Cookie:newCookie}});assert.match(await newMemberDenied.text(),/目前登入的帳號沒有後台權限/);
 const forged=await request('/admin',undefined,{headers:{'oai-authenticated-user-id':'test-admin','oai-authenticated-user-email':'admin@example.invalid'}});assert.equal(forged.status,307);
 const logout=await request('/api/auth/logout','A',{method:'POST',headers:{Origin:base}});assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
 const revoked=await request('/admin','A');assert.equal(revoked.status,307);
 console.log(JSON.stringify({restoredLoginVideo:'served',adminAccountCreation:'passed',newMemberLogin:'passed',publicRegistration:'closed',adminSessionAfterCreation:'preserved',productionNavigation:'passed',adminEntry:'admin_only',memberDirectAccess:'denied',memberAdminAPI:403,spoofedHeader:'denied',adminLogout:'session_revoked',database:'isolated_fixture_only'}));
}catch(error){console.error(logs);throw error;}
finally{if(child.exitCode===null){child.kill('SIGTERM');await once(child,'exit');}await rm(temp,{recursive:true,force:true});}
