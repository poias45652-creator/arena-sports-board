import assert from 'node:assert/strict';
const origin=process.env.RENDER_SMOKE_ORIGIN||'http://localhost:3027';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Smoke tests must target the isolated local fixture');
const cookie='__Host-arena_tz='+'f'.repeat(64);
let checks=0;
async function request(path,status,options={}){
 const response=await fetch(origin+path,{redirect:'manual',...options});
 assert.equal(response.status,status,`${path}: ${await response.clone().text()}`);checks++;return response;
}
const login=await request('/login',200);const loginHtml=await login.text();assert.match(loginHtml,/聯繫作者/);assert.match(loginHtml,/href="\/free-trial"[^>]*>免費推薦<\/a>/);
const trial=await request('/free-trial',200);const trialHtml=await trial.text();assert.match(trialHtml,/免費推薦/);
for(const html of [loginHtml,trialHtml]){
 assert.match(html,/<title>[^<]*星準<\/title>/);
 assert.doesNotMatch(html,/YJ體育分析|YJ SPORTS ANALYTICS|src="\/yj-logo\.png"/);
 assert.match(html,/name="apple-mobile-web-app-title" content="星準"/);
 assert.match(html,/rel="apple-touch-icon"[^>]*href="\/brand\/xingzhun-icon-180-v1\.png"/);
 assert.match(html,/property="og:image"[^>]*xingzhun-cover-v1\.jpg/);
}
for(const [path,size] of [
 ['/brand/xingzhun-icon-32-v1.png',32],['/brand/xingzhun-icon-180-v1.png',180],
 ['/brand/xingzhun-icon-192-v1.png',192],['/brand/xingzhun-icon-512-v1.png',512],
 ['/apple-touch-icon.png',180],['/apple-touch-icon-precomposed.png',180],['/yj-app-icon.png',180],
]){
 const response=await request(path,200);assert.match(response.headers.get('content-type'),/image\/png/);
 const png=Buffer.from(await response.arrayBuffer());assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
}
const manifest=await (await request('/manifest.webmanifest',200)).json();
assert.equal(manifest.name,'星準');assert.equal(manifest.short_name,'星準');
assert.ok(manifest.icons.every(icon=>icon.src.startsWith('/brand/xingzhun-')));
await request('/brand/xingzhun-cover-v1.jpg',200);
await request('/favicon.ico',200);
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
const adminPage=await request('/admin/accounts',200,{headers:{cookie}});assert.match(await adminPage.text(),/直接開通帳號/);
await request('/api/admin/accounts',200,{method:'PATCH',headers,body:JSON.stringify({memberId:'tz:2',note:'HTTP 備註測試'})});
const noted=(await (await request('/api/admin/accounts',200,{headers:{cookie}})).json()).accounts.find(x=>x.memberId==='tz:2');assert.equal(noted.note,'HTTP 備註測試');assert.equal(noted.accessState,'pending');
await request('/api/admin/accounts',403,{method:'PATCH',headers:{...headers,origin:'https://attacker.test'},body:JSON.stringify({memberId:'tz:2',enabled:true,expiresAt:null})});
await request('/api/admin/accounts',200,{method:'PATCH',headers,body:JSON.stringify({memberId:'tz:2',enabled:true,expiresAt:null})});
await request('/api/admin/accounts',409,{method:'DELETE',headers,body:JSON.stringify({memberId:'tz:1',confirmUsername:'render-test-admin'})});
await request('/api/admin/accounts',200,{method:'DELETE',headers,body:JSON.stringify({memberId:'tz:2',confirmUsername:'pending-test-user'})});
const remaining=await request('/api/admin/accounts',200,{headers:{cookie}});assert.equal((await remaining.json()).accounts.length,1);
const expiry=Math.floor(Date.now()/1000)*1000+86400000;
await request('/api/admin/accounts',200,{method:'POST',headers,body:JSON.stringify({username:'pre-http-user',expiresAt:expiry,note:'尚未登入的新客戶'})});
let pre=(await (await request('/api/admin/accounts',200,{headers:{cookie}})).json()).accounts.find(x=>x.username==='pre-http-user');
assert.equal(pre.memberId,null);assert.equal(pre.expiresAt,expiry);assert.equal(pre.note,'尚未登入的新客戶');assert.equal(pre.accessState,'active');
await request('/api/admin/accounts',409,{method:'POST',headers,body:JSON.stringify({username:'PRE-HTTP-USER',expiresAt:null})});
await request('/api/admin/accounts',200,{method:'PATCH',headers,body:JSON.stringify({pendingUsername:'pre-http-user',note:'改過的備註'})});
pre=(await (await request('/api/admin/accounts',200,{headers:{cookie}})).json()).accounts.find(x=>x.username==='pre-http-user');assert.equal(pre.note,'改過的備註');assert.equal(pre.expiresAt,expiry);
await request('/api/admin/accounts',200,{method:'DELETE',headers,body:JSON.stringify({pendingUsername:'pre-http-user',confirmUsername:'pre-http-user'})});
assert.equal((await (await request('/api/admin/accounts',200,{headers:{cookie}})).json()).accounts.length,1);
console.log(`${checks} HTTP checks passed against the production Next.js build with an isolated PostgreSQL fixture.`);
