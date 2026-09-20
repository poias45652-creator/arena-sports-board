import test from 'node:test';import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const code=f=>ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:99,target:9}}).outputText;
const credentials=url(code('lib/tz-credentials.ts'));
const settings=url(code('lib/turnstile-settings.ts').replace("'./tz-credentials'",JSON.stringify(credentials)));
const {readTurnstileSettings,saveTurnstileSettings}=await import(settings);
const key=Buffer.alloc(32,4).toString('base64');
const sql=new DatabaseSync(':memory:');sql.exec(readFileSync('drizzle/0007_huge_stature.sql','utf8'));
const db={prepare(q){const s=sql.prepare(q);let a=[];return {bind(...v){a=v;return this},async first(){return s.get(...a)},async run(){return s.run(...a)}}}};
test('settings default off, encrypt at rest, enable and disable; corrupted secret never fails open',async()=>{
 assert.equal((await readTurnstileSettings(db,key)).enabled,false);
 await saveTurnstileSettings(db,key,'private-test-value');
 assert.ok(!JSON.stringify(sql.prepare('SELECT * FROM turnstile_settings').all()).includes('private-test-value'));
 assert.deepEqual(await readTurnstileSettings(db,key),{enabled:true,secret:'private-test-value'});
 await assert.rejects(()=>readTurnstileSettings(db,Buffer.alloc(32,5).toString('base64')));
 sql.prepare('UPDATE turnstile_settings SET enabled=0').run();assert.equal((await readTurnstileSettings(db,key)).enabled,false);
});
let admin=false;
globalThis.tsSettingsDb=db;globalThis.tsSettingsAdmin=()=>admin;
let source=code('app/api/admin/turnstile/route.ts');
for(const [name,value] of Object.entries({"'cloudflare:workers'":url(`export const env={TZ_BINDING_KEY:${JSON.stringify(key)}}`),"'@/db'":url('export const getRawDb=()=>globalThis.tsSettingsDb'),"'@/app/admin-access'":url('export const isSiteAdmin=async()=>globalThis.tsSettingsAdmin()'),"'@/lib/turnstile'":url('export const verifyTurnstile=async()=>false'),"'@/lib/turnstile-settings'":settings}))source=source.replace(name,JSON.stringify(value));
const route=await import(url(source));
const request=(origin='https://site.test',body={secret:'incorrect-secret',token:'invalid'})=>new Request('https://site.test/api/admin/turnstile',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('admin route rejects nonadmins, cross-site writes and wrong keys without exposing secrets',async()=>{
 assert.equal((await route.GET()).status,403);assert.equal((await route.POST(request())).status,403);
 admin=true;assert.equal((await route.POST(request('https://attacker.test'))).status,403);
 assert.equal((await route.POST(request())).status,400);
 assert.deepEqual(await (await route.GET()).json(),{enabled:false});
});
