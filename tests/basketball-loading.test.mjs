import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {moduleUrl} from './profile-loader.mjs';
const refreshPolicy=await import(moduleUrl('app/basketball-report-refresh.ts'));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const requestModule=()=>import(moduleUrl('app/nba-request.ts')+'#'+Math.random());

test('board and LIVE badge share one fetch; one cancelled reader does not cancel the other',async t=>{
 const reply=deferred();let calls=0,upstream;
 t.mock.method(globalThis,'fetch',async(url,{signal})=>{calls++;upstream=signal;return reply.promise;});
 const {nbaRequest}=await requestModule(),a=new AbortController(),b=new AbortController();
 const first=nbaRequest('/api/nba?date=2026-10-05',a.signal),second=nbaRequest('/api/nba?date=2026-10-05',b.signal);
 const cancelled=assert.rejects(first,{name:'AbortError'});a.abort();await cancelled;
 assert.equal(calls,1);assert.equal(upstream.aborted,false);
 reply.resolve(Response.json({day:'2026-10-05',games:[]}));assert.equal((await second).day,'2026-10-05');
 await nbaRequest('/api/nba?date=2026-10-05',b.signal);assert.equal(calls,1);
});

test('last reader aborts transport; failure is retried and league/date caches stay separate',async t=>{
 let calls=0;const signals=[];
 t.mock.method(globalThis,'fetch',async(url,{signal})=>{
  calls++;signals.push(signal);
  if(calls===1)return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
  if(calls===2)return Response.json({error:'offline'},{status:502});
  return Response.json({url});
 });
 const {nbaRequest}=await requestModule(),first=new AbortController(),signal=new AbortController().signal;
 const cancelled=assert.rejects(nbaRequest('/api/nba?date=2026-10-05',first.signal),{name:'AbortError'});
 first.abort();await cancelled;assert.equal(signals[0].aborted,true);
 await assert.rejects(nbaRequest('/api/nba?date=2026-10-05',signal),/offline/);
 for(const url of ['/api/nba?date=2026-10-05','/api/wnba?date=2026-10-05','/api/nba?date=2026-10-06'])assert.equal((await nbaRequest(url,signal)).url,url);
 assert.equal(calls,5);
});

// Execute real component effects with deterministic hook slots and event targets.
// No API, network, browser or account is needed for lifecycle regressions.
function mountBoard(request){
 const slots=[],effects=[];let cursor=0;
 const hooks={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},
  useRef(initial){const i=cursor++;return slots[i]??=( {current:initial} );},
  useEffect(run,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){slots[i]={deps,cleanup:old?.cleanup};effects.push(()=>{slots[i].cleanup?.();slots[i].cleanup=run();});}}
 };
 const nba={nbaDay:()=> '2026-10-05',validNbaDay:()=>true,shiftNbaDay:day=>day,NBA_TEAMS:[],nbaFixtureKey:g=>g.id};
 const dependencies={react:hooks,'lucide-react':{},'@/lib/nba':nba,'@/lib/wnba':{WNBA_TEAMS:[]},'@/lib/basketball-efficiency':{DEFAULT_WEIGHTS:[20,20,20,20,20],weightKey:w=>w.join(','),normalizedWeights:w=>w},'@/lib/nba-analysis':{nbaEligible:()=>false,nbaSourceStale:()=>false},'./nba-match':{nbaTime:v=>v},'./nba-recommendations':{},'./nba-request':{nbaRequest:request},'./basketball-report-refresh':refreshPolicy,'./sport-markets':{},'./use-source':{useSource:()=>({data:null,error:''})}};
 const code=ts.transpileModule(readFileSync('app/nba-board.tsx','utf8'),{fileName:'board.tsx',compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports','React',code)(key=>{if(key.endsWith('.css'))return {};assert.ok(key in dependencies,key);return dependencies[key];},exports,React);
 return {render(props={}){cursor=0;const tree=exports.default({view:'live',onViewChange(){},...props});effects.splice(0).forEach(run=>run());return tree;},dispose(){for(const slot of slots)slot?.cleanup?.();}};
}
function elements(tree,predicate){if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(x=>elements(x,predicate));return [...(predicate(tree)?[tree]:[]),...elements(tree.props?.children,predicate)];}

test('refresh retains cards, failures retain last success, hidden polls pause and old dates cannot overwrite',async t=>{
 const originalWindow=globalThis.window,originalDocument=globalThis.document;
 const window=new EventTarget(),document=new EventTarget();window.location={search:''};window.history={replaceState(){}};document.hidden=false;
 globalThis.window=window;globalThis.document=document;
 const timers=new Map();let timerId=0;
 t.mock.method(globalThis,'setTimeout',(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;});
 t.mock.method(globalThis,'clearTimeout',id=>timers.delete(id));
 t.mock.method(globalThis,'setInterval',()=>0);t.mock.method(globalThis,'clearInterval',()=>{});
 const calls=[],board=mountBoard((url,signal)=>{const task=deferred();calls.push({...task,url,signal});return task.promise;});
 const snapshot=(day,id)=>({day,games:[{id,state:'scheduled'}],fetchedAt:new Date().toISOString()});
 const cards=tree=>elements(tree,e=>e.type?.name==='NbaCard').map(e=>e.props.game.id);
 try{
  board.render();assert.equal(calls.length,1);calls[0].resolve(snapshot('2026-10-05','first'));await flush();assert.deepEqual(cards(board.render()),['first']);
  window.dispatchEvent(new Event('arena-refresh-all'));assert.equal(calls.length,2);assert.deepEqual(cards(board.render()),['first']);
  window.dispatchEvent(new Event('arena-refresh-all'));assert.equal(calls.length,2);
  calls[1].reject(Error('offline'));await flush();assert.deepEqual(cards(board.render()),['first']);
  document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('arena-refresh-all'));assert.equal(calls.length,2);
  assert.ok(![...timers.values()].some(t=>t.ms===30000));
  document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));assert.equal(calls.length,3);
  const input=elements(board.render(),e=>e.type==='input'&&e.props.type==='date')[0];input.props.onChange({target:{value:'2026-10-06'}});
  board.render();assert.equal(calls[2].signal.aborted,true);assert.equal(calls[3].url,'/api/nba?date=2026-10-06');
  calls[3].resolve(snapshot('2026-10-06','new-day'));await flush();calls[2].resolve(snapshot('2026-10-05','old-day'));await flush();assert.deepEqual(cards(board.render()),['new-day']);
  window.dispatchEvent(new Event('online'));assert.equal(calls.length,5);
 }finally{board.dispose();globalThis.window=originalWindow;globalThis.document=originalDocument;}
});

test('manual update dispatches schedules before waiting for SUPER',async()=>{
 const source=ts.createSourceFile('page.tsx',readFileSync('app/page.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let fn;function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='updateAll')fn=node;ts.forEachChild(node,visit);}visit(source);
 const code=ts.transpileModule(fn.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const events=[],reply=deferred(),scope={updateLock:{current:false},setUpdatingAll(){},setUpdateNotice(){},league:'NBA',window:{dispatchEvent:e=>events.push(e.type)},fetch:()=>reply.promise,Event,AbortSignal};
 const update=new Function(...Object.keys(scope),code+';return updateAll;')(...Object.values(scope));
 const task=update();assert.deepEqual(events,['arena-refresh-all']);reply.resolve(Response.json({}));await task;assert.deepEqual(events,['arena-refresh-all','arena-odds-change']);
});
