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
