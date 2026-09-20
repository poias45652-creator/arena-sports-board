import assert from 'node:assert/strict';
const origin=process.env.RENDER_SMOKE_ORIGIN||'http://localhost:3027';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Smoke tests must target the isolated local fixture');
const cookie='__Host-arena_tz='+'f'.repeat(64);
let checks=0;
async function request(path,status,options={}){
 const response=await fetch(origin+path,{redirect:'manual',...options});
 assert.equal(response.status,status,`${path}: ${await response.clone().text()}`);checks++;return response;
}
const login=await request('/login',200);assert.match(await login.text(),/聯繫作者/);
await request('/yj-logo.png',200);
await request('/api/health',200);
const session=await request('/api/session',200);assert.equal((await session.json()).signedIn,false);
for(const path of ['/','/admin','/teams','/players/1'])await request(path,307);
for(const path of ['/api/admin/accounts','/api/baseball','/api/member-odds'])await request(path,401,{headers:{'oai-authenticated-user-email':'owner@example.invalid','oai-authenticated-user-id':'tz:1',cookie:'arena_session=old-cookie'}});
await request('/api/session',403,{method:'POST',headers:{origin:'https://attacker.test','content-type':'application/json'},body:'{}'});
await request('/api/session',400,{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'});
const accounts=await request('/api/admin/accounts',200,{headers:{cookie}});
assert.equal((await accounts.json()).accounts.find(x=>x.memberId==='tz:2').accessState,'pending');
const headers={cookie,origin,'content-type':'application/json'};
await request('/api/admin/accounts',403,{method:'PATCH',headers:{...headers,origin:'https://attacker.test'},body:JSON.stringify({memberId:'tz:2',enabled:true,expiresAt:null})});
await request('/api/admin/accounts',200,{method:'PATCH',headers,body:JSON.stringify({memberId:'tz:2',enabled:true,expiresAt:null})});
await request('/api/admin/accounts',409,{method:'DELETE',headers,body:JSON.stringify({memberId:'tz:1',confirmUsername:'render-test-admin'})});
await request('/api/admin/accounts',200,{method:'DELETE',headers,body:JSON.stringify({memberId:'tz:2',confirmUsername:'pending-test-user'})});
const remaining=await request('/api/admin/accounts',200,{headers:{cookie}});assert.equal((await remaining.json()).accounts.length,1);
console.log(`${checks} HTTP checks passed against the production Next.js build with an isolated PostgreSQL fixture.`);
