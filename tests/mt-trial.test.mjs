import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {createMtTrialService,mtTrialGameUrl}=await import(moduleUrl('lib/mt-trial.ts'));
process.env.APP_ORIGIN='https://site.test';
const config={enabled:'true',password:'test-secret-only'};
const request=(origin='https://site.test',method='POST')=>new Request('https://site.test/mt-trial/launch',{method,headers:{origin,cookie:'admin-cookie-must-not-be-forwarded'}});
const jwt=expiry=>'fixture.'+Buffer.from(JSON.stringify({exp:expiry})).toString('base64url')+'.fixture';
function fixture(){let now=1800000000000,calls=[];const fetcher=async(url,init)=>{calls.push({url,init});if(url.endsWith('/api/v1/login'))return Response.json({code:200,data:{username:'dvp0322',token:jwt(Math.floor(now/1000)+3600)}});return Response.json({code:200,data:{game_url:'https://gsa.ofalive99.net/?token=game-only'}});};return {calls,service:createMtTrialService(fetcher,()=>now),advance:ms=>now+=ms};}
test('disabled, missing password, cross-site and non-POST requests never contact OFA',async()=>{
 const f=fixture();for(const c of [{},config.enabled?{enabled:'true'}:{}, {password:'x'}])assert.equal((await f.service(request(),c)).status,503);
 assert.equal((await f.service(request('https://evil.test'),config)).status,403);assert.equal((await f.service(request('https://site.test','GET'),config)).status,405);assert.equal(f.calls.length,0);
});
test('trial returns only game-scoped authorization and never site/admin login state',async()=>{
 const f=fixture(),r=await f.service(request(),config),body=await r.json();assert.equal(r.status,200);assert.equal(body.gameUrl,'https://gsa.ofalive99.net/?token=game-only');assert.equal(r.headers.get('set-cookie'),null);assert.match(r.headers.get('cache-control'),/no-store/);
 assert.equal(f.calls.length,2);assert.deepEqual(JSON.parse(f.calls[0].init.body).username,'dvp0322');for(const c of f.calls)assert.equal(c.init.headers.Cookie,undefined);
 assert.ok(!JSON.stringify(body).includes(config.password));assert.ok(!JSON.stringify(body).includes('fixture.'));assert.ok(!JSON.stringify(body).includes('admin-cookie'));
 assert.ok(!readFileSync('lib/mt-trial.ts','utf8').includes('arena_sessions WHERE'));
});
test('parallel visitors share one upstream login and game launch; expiry reauthenticates',async()=>{
 const f=fixture();const rs=await Promise.all(Array.from({length:8},()=>f.service(request(),config)));assert.ok(rs.every(r=>r.status===200));await Promise.all(rs.map(r=>r.json()));assert.equal(f.calls.length,2);
 f.advance(6*60000);assert.equal((await f.service(request(),config)).status,200);assert.equal(f.calls.length,3);
 f.advance(60*60000);assert.equal((await f.service(request(),config)).status,200);assert.equal(f.calls.length,5);
});
test('upstream failures are redacted and backed off, not leaked or retried in a loop',async()=>{
 let n=0;const service=createMtTrialService(async()=>{n++;throw Error('secret-upstream-credentials');});
 const r=await service(request(),config);assert.equal(r.status,503);assert.ok(!(await r.text()).includes('secret-upstream'));
 assert.equal((await service(request(),config)).status,503);assert.equal(n,1);
});
test('wrong upstream identity never gets access to game launch',async()=>{
 let calls=0;const service=createMtTrialService(async()=>{calls++;return Response.json({code:200,data:{username:'another-account',token:jwt(Math.floor(Date.now()/1000)+3600)}});});assert.equal((await service(request(),config)).status,503);assert.equal(calls,1);
});
test('game URLs require exact allowed HTTPS host and a token',()=>{
 for(const url of ['https://evil.test/?token=x','https://gsa.ofalive99.net.evil.test/?token=x','http://gsa.ofalive99.net/?token=x','https://user:pass@gsa.ofalive99.net/?token=x','https://gsa.ofalive99.net:444/?token=x','https://gsa.ofalive99.net/'])assert.equal(mtTrialGameUrl({data:{url}}),null);
 assert.equal(mtTrialGameUrl({data:{url:'https://gs1.ofalive99.net/?token=x'}}),'https://gs1.ofalive99.net/?token=x');
});
