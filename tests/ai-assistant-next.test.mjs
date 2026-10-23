import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {moduleUrl} from './profile-loader.mjs';
const core=await import(moduleUrl('lib/ai-assistant.ts'));
const shift=(day,n)=>new Date(Date.parse(day)+n*86400000).toISOString().slice(0,10);
const today=core.aiDay(),later=shift(today,20);
const match=(league,day,id='first')=>({id,league,day,start:day+'T12:00:00+08:00',home:'主隊',away:'客隊'});
const signal=()=>new AbortController().signal;
function compile(file,dependencies){
 const code=ts.transpileModule(readFileSync(file,'utf8'),{fileName:file,compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports','React',code)(key=>{assert.ok(key in dependencies,key);return dependencies[key];},exports,React);return exports;
}
function nextModule(overrides={}){
 return compile('server/ai-assistant-next.ts',{
  '@/lib/ai-assistant':core,'@/lib/football':{isFootballLeague:l=>l==='eng.1'},
  './ai-assistant-data':{listAiMatches:async(l,d)=>[match(l,d)]},
  '@/app/api/analysis/source':{loadSource:async()=>({games:[{date:shift(today,5)+'T12:00:00Z'},{date:shift(today,1)+'T23:00:00Z'},{date:'invalid'}]})},
  '@/lib/nba-source':{nextNbaDay:async()=>({day:later})},
  '@/lib/wnba-source':{nextWnbaDay:async()=>({day:later})},
  '@/lib/football-source':{nextFootballDay:async(l,d)=>{assert.equal(l,'eng.1');assert.equal(d,today);return {day:later};}},
  ...overrides
 }).nextAiMatches;
}
test('NBA, WNBA and football reuse board discovery and return selectable fixtures beyond 14 days',async()=>{
 for(const league of ['NBA','WNBA','eng.1'])assert.deepEqual(await nextModule()(league,today,signal()),{day:later,matches:[match(league,later)]});
 assert.equal(core.validAiDay(shift(today,60)),true);assert.equal(core.validAiDay(shift(today,61)),false);
 assert.equal(core.validAiDay(shift(today,-14)),true);assert.equal(core.validAiDay(shift(today,-15)),false);
});
test('MLB chooses the earliest available Taiwan day, not source ordering or UTC day',async()=>{
 const expected=shift(today,2);assert.deepEqual(await nextModule()('MLB',today,signal()),{day:expected,matches:[match('MLB',expected)]});
});
test('missing calendar dates never fabricate fixtures; stale or mismatched results cannot be selected',async()=>{
 for(const day of [null,today,shift(today,-1),shift(today,61),'invalid'])assert.deepEqual(await nextModule({'@/lib/nba-source':{nextNbaDay:async()=>({day})}})('NBA',today,signal()),{day:null,matches:[]});
 for(const matches of [[],[match('WNBA',later)],[match('NBA',today)]])await assert.rejects(nextModule({'./ai-assistant-data':{listAiMatches:async()=>matches}})('NBA',today,signal()),/changed/);
 await assert.rejects(nextModule({'@/lib/nba-source':{nextNbaDay:async()=>{throw Error('offline');}}})('NBA',today,signal()),/offline/);
});
test('NPB skips only verified off days and loads analysis data only on the found day',async()=>{
 const days=[],list=[];
 const next=nextModule({'@/lib/international-feed':{getInternationalLive:async(l,d)=>{days.push(d);return {status:'ok',noGames:days.length<3,games:days.length<3?[]:[{startTime:d+'T09:00:00Z',status:'pregame'}]};}},'./ai-assistant-data':{listAiMatches:async(l,d)=>{list.push(d);return [match(l,d)];}}});
 assert.equal((await next('NPB',today,signal())).day,shift(today,3));assert.deepEqual(days,[1,2,3].map(n=>shift(today,n)));assert.deepEqual(list,[shift(today,3)]);
 for(const feed of [{status:'unavailable',games:[]},{status:'ok',stale:true,games:[]},{status:'ok',games:[]}])await assert.rejects(nextModule({'@/lib/international-feed':{getInternationalLive:async()=>feed}})('NPB',today,signal()));
});
test('cancellation stops NPB scanning and the off-season search is bounded',async()=>{
 const controller=new AbortController();let calls=0;
 await assert.rejects(nextModule({'@/lib/international-feed':{getInternationalLive:async()=>{calls++;controller.abort();return {status:'ok',noGames:true,games:[]};}}})('NPB',today,controller.signal),{name:'AbortError'});assert.equal(calls,1);
 calls=0;assert.deepEqual(await nextModule({'@/lib/international-feed':{getInternationalLive:async()=>{calls++;return {status:'ok',noGames:true,games:[]};}}})('NPB',today,signal()),{day:null,matches:[]});assert.equal(calls,14);
});

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function elements(tree,predicate){if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(x=>elements(x,predicate));return [...(predicate(tree)?[tree]:[]),...elements(tree.props?.children,predicate)];}
const text=tree=>typeof tree==='string'?tree:Array.isArray(tree)?tree.map(text).join(''):tree?.props?text(tree.props.children):'';
function mountAssistant(){
 const slots=[],effects=[];let cursor=0;
 const hooks={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>slots[i]=typeof next==='function'?next(slots[i]):next];},
  useRef(initial){return slots[cursor++]??={current:initial};},
  useEffect(run,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){slots[i]={deps,cleanup:old?.cleanup};effects.push(()=>{slots[i].cleanup?.();slots[i].cleanup=run();});}}
 };
 const dependencies={react:hooks,'lucide-react':{},'../session-account':{default:()=>null},'@/lib/ai-assistant':core,'@/lib/baseball-model-settings':{},'@/lib/nba-model-weights':{},'@/lib/football-model-weights':{},'@/lib/team-model-settings':{}};
 const {default:Component}=compile('app/ai-assistant/assistant.tsx',dependencies);
 return {render(){cursor=0;const tree=Component();effects.splice(0).forEach(run=>run());return tree;},dispose(){for(const slot of slots)slot?.cleanup?.();}};
}
test('assistant next button works without an AI key, selects the fixture and blocks duplicate/stale requests',async t=>{
 const oldLocation=globalThis.location;globalThis.location={search:'?league=WNBA',assign(){}};
 const calls=[];
 t.mock.method(globalThis,'fetch',(url,options)=>{const task=deferred();calls.push({...task,url,signal:options.signal});return task.promise;});
 const board=mountAssistant(),button=tree=>elements(tree,e=>e.type==='button'&&/下一個比賽日|正在查詢/.test(text(e)))[0],date=tree=>elements(tree,e=>e.type==='input'&&e.props.type==='date')[0];
 try{
  board.render();calls[0].resolve(Response.json({aiEnabled:false,leagues:[{code:'WNBA',name:'WNBA'},{code:'NBA',name:'NBA'}]}));await flush();board.render();
  calls[1].resolve(Response.json({matches:[]}));await flush();let tree=board.render();assert.equal(button(tree).props.disabled,false);
  button(tree).props.onClick();button(tree).props.onClick();assert.equal(calls.length,3);assert.match(calls[2].url,/kind=next&league=WNBA/);assert.equal(button(board.render()).props.disabled,true);
  calls[2].resolve(Response.json({day:later,matches:[match('WNBA',later)]}));await flush();board.render();tree=board.render();
  assert.equal(date(tree).props.value,later);assert.equal(calls.length,3,'found fixtures should not need another fetch');assert.equal(elements(tree,e=>e.props?.['aria-pressed']===true).length,1);
  button(tree).props.onClick();const pending=calls[3];elements(board.render(),e=>e.type==='select')[0].props.onChange({target:{value:'NBA'}});assert.equal(pending.signal.aborted,true);
  board.render();calls[4].resolve(Response.json({matches:[]}));pending.resolve(Response.json({day:shift(later,1),matches:[match('WNBA',shift(later,1))]}));await flush();tree=board.render();assert.equal(date(tree).props.value,later);assert.equal(elements(tree,e=>e.props?.['aria-pressed']===true).length,0);
  button(tree).props.onClick();calls[5].resolve(Response.json({day:null,matches:[]}));await flush();tree=board.render();assert.match(text(tree),/來源尚未提供近期的下一個比賽日/);assert.equal(date(tree).props.value,later);
  button(tree).props.onClick();calls[6].resolve(Response.json({error:'offline'},{status:503}));await flush();tree=board.render();assert.match(text(tree),/下一個比賽日暫時無法取得/);assert.equal(button(tree).props.disabled,false);
  button(tree).props.onClick();date(board.render()).props.onChange({target:{value:today}});assert.equal(calls[7].signal.aborted,true);board.render();calls[8].resolve(Response.json({matches:[]}));calls[7].resolve(Response.json({day:shift(later,1),matches:[match('NBA',shift(later,1))]}));await flush();tree=board.render();assert.equal(date(tree).props.value,today);
  button(tree).props.onClick();board.dispose();assert.equal(calls[9].signal.aborted,true);
 }finally{board.dispose();globalThis.location=oldLocation;}
});
