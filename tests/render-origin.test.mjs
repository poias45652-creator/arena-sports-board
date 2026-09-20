import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const code=ts.transpileModule(readFileSync('lib/request-origin.ts','utf8'),{compilerOptions:{module:99,target:9}}).outputText;
const {requestOrigin}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('public origin survives Render TLS forwarding and ignores forged host headers',()=>{
 process.env.APP_ORIGIN='https://public.example';
 const request=new Request('http://localhost:10000/api/session',{headers:{'x-forwarded-host':'attacker.example','x-forwarded-proto':'http',host:'attacker.example'}});
 assert.equal(requestOrigin(request),'https://public.example');
});
test('Render external URL is used without a custom domain; invalid configuration fails closed',()=>{
 delete process.env.APP_ORIGIN;process.env.RENDER_EXTERNAL_URL='https://app.onrender.com';
 assert.equal(requestOrigin(new Request('http://localhost:10000/')),'https://app.onrender.com');
 process.env.APP_ORIGIN='invalid';assert.equal(requestOrigin(new Request('http://localhost:10000/')),'');
});
