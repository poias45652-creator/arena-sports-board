import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
process.env.APP_ORIGIN='https://render.test';
delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
delete process.env.TURNSTILE_SECRET;
delete process.env.TURNSTILE_SECRET_KEY;
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const code=f=>ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:99,target:9}}).outputText;
const credentials=url(code('lib/tz-credentials.ts'));
const settings=url(code('lib/turnstile-settings.ts').replace("'./tz-credentials'",JSON.stringify(credentials)));
const {readTurnstileSettings,saveTurnstileSettings}=await import(settings);
const key=Buffer.alloc(32,4).toString('base64');
const siteKey='runtime-site-key-fixture';
const sql=new DatabaseSync(':memory:');
sql.exec(readFileSync('drizzle/0007_huge_stature.sql','utf8')+';ALTER TABLE turnstile_settings ADD COLUMN site_key TEXT;');
const db={prepare(q){const s=sql.prepare(q);let a=[];return {bind(...v){a=v;return this},async first(){return s.get(...a)},async run(){return s.run(...a)}}}};
globalThis.renderTurnstileDb=db;
globalThis.renderTurnstileAdmin=false;
const imports={
 "'@/lib/request-origin'":url(code('lib/request-origin.ts')),
 "'@/server/runtime'":url(`export const env={TZ_BINDING_KEY:${JSON.stringify(key)}}`),
 "'@/db'":url('export const getRawDb=()=>globalThis.renderTurnstileDb'),
 "'@/app/admin-access'":url('export const isSiteAdmin=async()=>globalThis.renderTurnstileAdmin'),
 "'@/lib/turnstile'":url("export const verifyTurnstile=async(token,secret)=>token==='verified-fixture'&&secret==='private-fixture-secret'"),
 "'@/lib/turnstile-settings'":settings,
 "'@/lib/tz-login'":url('export const tzLogin=async()=>Response.json({signedIn:false})')
};
function route(file){let source=code(file);for(const [from,to] of Object.entries(imports))source=source.replace(from,JSON.stringify(to));return import(url(source));}
const admin=await route('app/api/admin/turnstile/route.ts');
const session=await route('app/api/session/route.ts');
const req=(body,origin='https://render.test')=>new Request('https://render.test/api/admin/turnstile',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
test('Turnstile can be configured at runtime and never exposes its private key',async t=>{
 await t.test('missing configuration remains visibly disabled',async()=>{
  assert.deepEqual(await readTurnstileSettings(db,key),{enabled:false,secret:undefined,siteKey:''});
 });
 await t.test('admin authorization, same-origin and challenge verification are required before saving',async()=>{
  const input={siteKey,secret:'private-fixture-secret',token:'verified-fixture'};
  assert.equal((await admin.POST(req(input))).status,403);
  globalThis.renderTurnstileAdmin=true;
  assert.equal((await admin.POST(req(input,'https://attacker.test'))).status,403);
  assert.equal((await admin.POST(req({...input,siteKey:''}))).status,400);
  assert.equal((await admin.POST(req({...input,token:'bad-token'}))).status,400);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM turnstile_settings').get().n,0);
  assert.equal((await admin.POST(req(input))).status,200);
 });
 await t.test('both keys survive saving and the secret is encrypted at rest',async()=>{
  assert.deepEqual(await readTurnstileSettings(db,key),{enabled:true,secret:'private-fixture-secret',siteKey});
  assert.ok(!JSON.stringify(sql.prepare('SELECT * FROM turnstile_settings').all()).includes('private-fixture-secret'));
  await assert.rejects(()=>readTurnstileSettings(db,Buffer.alloc(32,8).toString('base64')));
 });
 await t.test('login gets only the public runtime site key; admin gets hostname but no secret',async()=>{
  const response=await session.GET(new Request('https://render.test/api/session'));
  assert.deepEqual(await response.json(),{signedIn:false,turnstileRequired:true,turnstileSiteKey:siteKey});
  assert.deepEqual(await (await admin.GET(new Request('https://render.test/api/admin/turnstile'))).json(),{enabled:true,siteKey,hostname:'render.test'});
 });
 await t.test('explicit disable survives environment fallback and hides the widget key on login',async()=>{
  assert.equal((await admin.POST(req({enabled:false}))).status,200);
  process.env.TURNSTILE_SECRET='environment-fixture-secret';
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY='environment-site-fixture';
  assert.equal((await readTurnstileSettings(db,key)).enabled,false);
  const response=await session.GET(new Request('https://render.test/api/session'));
  assert.deepEqual(await response.json(),{signedIn:false,turnstileRequired:false,turnstileSiteKey:''});
 });
 await t.test('enabled configuration with a missing site key fails closed',async()=>{
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  sql.exec("UPDATE turnstile_settings SET enabled=1,site_key=NULL");
  await assert.rejects(()=>readTurnstileSettings(db,key));
  assert.equal((await session.GET(new Request('https://render.test/api/session'))).status,503);
 });
 sql.close();
});
