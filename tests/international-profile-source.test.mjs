import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleUrl} from './profile-loader.mjs';
const {collectUpcoming}=await import(moduleUrl('lib/international-profile-source.ts'));
test('profile requests work on edge runtimes and reject redirects without forwarding form cookies',async()=>{
 const original=globalThis.fetch,log=console.error;let count=0;
 try{
  globalThis.fetch=async(url,options)=>{count++;assert.equal(options.redirect,'manual');return {ok:true,text:async()=>'',headers:{getAll:name=>{assert.equal(name,'Set-Cookie');return [];}}};};
  const data=await collectUpcoming('ADD',2026);assert.deepEqual(data.games,[]);assert.equal(count,1);
  globalThis.fetch=async(url,options)=>{count++;assert.equal(options.redirect,'manual');return {ok:false,status:302};};console.error=()=>{};
  await assert.rejects(collectUpcoming('ACN',2026),/HTTP 302/);assert.equal(count,2);
 }finally{globalThis.fetch=original;console.error=log;}
});
