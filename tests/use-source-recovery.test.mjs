import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {moduleUrl} from './profile-loader.mjs';
const client=await import(moduleUrl('lib/member-odds-client.ts'));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

function mount(readMemberOdds){
 const slots=[],effects=[];let cursor=0;
 const hooks={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},
  useRef(initial){const i=cursor++;return slots[i]??={current:initial};},
  useCallback(fn,deps){const i=cursor++;if(!slots[i]||deps.some((v,j)=>v!==slots[i].deps[j]))slots[i]={deps,fn};return slots[i].fn;},
  useEffect(run,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){slots[i]={deps,cleanup:old?.cleanup};effects.push(()=>{slots[i].cleanup?.();slots[i].cleanup=run();});}}
 };
 const code=ts.transpileModule(readFileSync('app/use-source.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports',code)(key=>key==='react'?hooks:key==='@/lib/member-odds-client'?{...client,readMemberOdds}:assert.fail(key),exports);
 return {render(){cursor=0;const result=exports.useSource('member-odds',60000);effects.splice(0).forEach(run=>run());return result;},dispose(){for(const slot of slots)if(slot?.cleanup){slot.cleanup();slot.cleanup=undefined;}}};
}
function environment(t){
 const oldWindow=globalThis.window,oldDocument=globalThis.document;
 const window=new EventTarget(),document=new EventTarget();document.visibilityState='visible';globalThis.window=window;globalThis.document=document;
 const timers=new Map(),intervals=new Map(),cleanups=[];let id=0;
 t.mock.method(globalThis,'setTimeout',(fn,ms)=>{timers.set(++id,{fn,ms});return id;});t.mock.method(globalThis,'clearTimeout',id=>timers.delete(id));
 t.mock.method(globalThis,'setInterval',(fn,ms)=>{intervals.set(++id,{fn,ms});return id;});t.mock.method(globalThis,'clearInterval',id=>intervals.delete(id));
 t.after(()=>{for(const cleanup of cleanups)cleanup();globalThis.window=oldWindow;globalThis.document=oldDocument;});
 return {window,document,timers,intervals,cleanups,run(ms){const found=[...timers].find(([,v])=>v.ms===ms);assert.ok(found,'expected retry '+ms);timers.delete(found[0]);found[1].fn();}};
}
test('failed market reads retry promptly, recover data, and refresh on visibility, online and page restore',async t=>{
 const env=environment(t),calls=[];const hook=mount(()=>{const task=deferred();calls.push(task);return task.promise;});env.cleanups.push(()=>hook.dispose());
 hook.render();assert.equal(calls.length,1);
 calls[0].reject(new TypeError('Load failed'));await flush();
 assert.match(hook.render().error,/玩法資料傳輸中斷/);assert.equal(hook.render().data,null);
 env.run(15000);assert.equal(calls.length,2);assert.equal(hook.render().error,'');assert.equal(hook.render().loading,true);
 calls[1].reject(new TypeError('Load failed'));await flush();env.run(30000);assert.equal(calls.length,3);
 const snapshot={fetchedAt:'2026-10-13T17:26:00Z',sportGames:[{id:25092679}]};calls[2].resolve(snapshot);await flush();
 assert.equal(hook.render().data,snapshot);assert.equal(hook.render().error,'');assert.equal(hook.render().loading,false);assert.equal(env.timers.size,0);
 env.document.visibilityState='hidden';env.document.dispatchEvent(new Event('visibilitychange'));for(const timer of env.intervals.values())timer.fn();assert.equal(calls.length,3);
 env.document.visibilityState='visible';env.document.dispatchEvent(new Event('visibilitychange'));assert.equal(calls.length,4);
 env.window.dispatchEvent(new Event('pageshow'));env.window.dispatchEvent(new Event('online'));assert.equal(calls.length,4,'resume events share the active refresh');
 calls[3].resolve(snapshot);await flush();env.window.dispatchEvent(new Event('online'));assert.equal(calls.length,5);
 calls[4].resolve(snapshot);await flush();env.window.dispatchEvent(new Event('pageshow'));assert.equal(calls.length,6);
 calls[5].resolve(snapshot);await flush();
 hook.dispose();env.window.dispatchEvent(new Event('online'));env.document.dispatchEvent(new Event('visibilitychange'));assert.equal(calls.length,6);assert.equal(env.intervals.size,0);
});
test('authorization errors clear quotes without a fast retry; manual recovery clears the error and unmount ignores late results',async t=>{
 const env=environment(t),calls=[];const hook=mount(()=>{const task=deferred();calls.push(task);return task.promise;});env.cleanups.push(()=>hook.dispose());
 hook.render();calls[0].resolve({fetchedAt:'old',sportGames:[]});await flush();
 env.window.dispatchEvent(new Event('online'));calls[1].reject(new client.MemberOddsError('授權已失效，請重新驗證帳號。'));await flush();
 assert.equal(hook.render().data,null);assert.match(hook.render().error,/授權已失效/);assert.equal(env.timers.size,0);
 env.window.dispatchEvent(new Event('arena-odds-change'));assert.equal(calls.length,3);assert.equal(hook.render().error,'');
 const before=hook.render();hook.dispose();calls[2].resolve({fetchedAt:'late',sportGames:[]});await flush();assert.deepEqual(hook.render(),before);
 assert.equal(env.timers.size,0);assert.equal(env.intervals.size,0);
});
