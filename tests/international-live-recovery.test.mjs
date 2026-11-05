import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';

const date='2026-10-29';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const game=(league='NPB',id='one')=>({key:league+':'+id,id,league,date,status:'live',startTime:date+'T10:00:00Z',
 home:{name:'主隊',score:2},away:{name:'客隊',score:1},source:{fetchedAt:new Date().toISOString()}});
const feed=(league='NPB',id='one',extra={})=>({league,date,status:'ok',stale:false,games:[game(league,id)],pollAfterMs:60000,...extra});
function load(file,dependencies){
 const code=ts.transpileModule(readFileSync(file,'utf8'),{fileName:file,compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports','React',code)(name=>{assert.ok(name in dependencies,name);return dependencies[name];},exports,React);return exports;
}
function elements(tree,predicate){
 if(!tree||typeof tree!=='object')return [];
 if(Array.isArray(tree))return tree.flatMap(child=>elements(child,predicate));
 return [...(predicate(tree)?[tree]:[]),...elements(tree.props?.children,predicate)];
}
function mount(){
 const slots=[],effects=[];let cursor=0;
 const hooks={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},
  useRef(initial){const i=cursor++;return slots[i]??={current:initial};},
  useEffect(run,deps){const i=cursor++,old=slots[i];if(!old||deps.some((value,j)=>value!==old.deps[j])){slots[i]={deps,cleanup:old?.cleanup};effects.push(()=>{slots[i].cleanup?.();slots[i].cleanup=run();});}}
 };
 const Empty=()=>null;
 const component=load('app/international-live-feed.tsx',{
  react:hooks,'lucide-react':{ChevronLeft:Empty,ChevronRight:Empty,RefreshCw:Empty},
  '@/components/ui/button':{Button:function Button(){}},'@/lib/baseball':{taipeiDay:()=>date,shiftDay:()=> '2026-10-30'},
  './live-scoreboard':{},'./international-team-logo':{default:Empty},
  '@/lib/international-teams':{internationalTeam:name=>name},'./international-live-records':{default:Empty}
 }).default;
 return {render(props={}){cursor=0;const tree=component({league:'NPB',revision:0,...props});effects.splice(0).forEach(run=>run());return tree;},dispose(){for(const slot of slots)slot?.cleanup?.();}};
}
function environment(t){
 const before=globalThis.document,document=new EventTarget();document.hidden=false;globalThis.document=document;
 const timers=new Map(),calls=[];let id=0;
 t.mock.method(globalThis,'setTimeout',(fn,ms)=>{timers.set(++id,{fn,ms});return id;});
 t.mock.method(globalThis,'clearTimeout',id=>timers.delete(id));
 t.mock.method(globalThis,'setInterval',()=>0);t.mock.method(globalThis,'clearInterval',()=>{});
 t.mock.method(globalThis,'fetch',(url,{signal})=>{const result=deferred();calls.push({...result,url,signal});return result.promise;});
 const board=mount();t.after(()=>{board.dispose();globalThis.document=before;});
 return {board,calls,document,timers,run(ms){const entry=[...timers].find(([,timer])=>timer.ms===ms);assert.ok(entry,'scheduled '+ms+'ms');timers.delete(entry[0]);entry[1].fn();}};
}
const selected=tree=>elements(tree,e=>e.type?.name==='SelectedGame')[0]?.props;

test('manual refresh and transport failure retain the visible score and original observation',async t=>{
 const h=environment(t),first=feed();h.board.render();h.calls[0].resolve(Response.json(first));await flush();
 const tree=h.board.render();assert.equal(selected(tree).game.key,'NPB:one');
 const update=elements(tree,e=>e.type?.name==='Button'&&e.props.children?.includes?.('更新比分'))[0];
 update.props.onClick();assert.equal(selected(h.board.render()).game.key,'NPB:one');assert.equal(h.calls.length,2);
 h.calls[1].reject(Error('connection lost'));await flush();
 const retained=selected(h.board.render());assert.equal(retained.game.source.fetchedAt,first.games[0].source.fetchedAt);assert.equal(retained.stale,true);
});

test('pending empty responses retain cards, poll after 5 seconds, then resume normal cadence',async t=>{
 const h=environment(t),first=feed();h.board.render();h.calls[0].resolve(Response.json(first));await flush();h.board.render();
 h.board.render({revision:1});h.calls[1].resolve(Response.json(feed('NPB','one',{games:[],status:'unavailable',stale:true,refreshing:true,pollAfterMs:5000})));
 await flush();const retained=selected(h.board.render({revision:1}));assert.equal(retained.game.key,'NPB:one');assert.equal(retained.stale,true);
 assert.equal(retained.game.source.fetchedAt,first.games[0].source.fetchedAt);h.run(5000);assert.equal(h.calls.length,3);
 h.calls[2].resolve(Response.json(feed('NPB','updated')));await flush();assert.equal(selected(h.board.render({revision:1})).game.key,'NPB:updated');
 assert.ok([...h.timers.values()].some(timer=>timer.ms===60000));assert.ok(![...h.timers.values()].some(timer=>timer.ms===5000));
});

test('changing league or date clears prior cards and late responses cannot overwrite the new selection',async t=>{
 const h=environment(t);h.board.render();h.calls[0].resolve(Response.json(feed()));await flush();h.board.render();
 h.board.render({revision:1});const old=h.calls[1];
 assert.equal(selected(h.board.render({league:'KBO',revision:1})),undefined);assert.equal(old.signal.aborted,true);
 h.calls[2].resolve(Response.json(feed('KBO','kbo')));await flush();old.resolve(Response.json(feed('NPB','late')));await flush();
 const current=h.board.render({league:'KBO',revision:1});assert.equal(selected(current).game.key,'KBO:kbo');
 elements(current,e=>e.type==='input'&&e.props.type==='date')[0].props.onChange({target:{value:'2026-10-30'}});
 assert.equal(selected(h.board.render({league:'KBO',revision:1})),undefined);assert.match(h.calls[3].url,/date=2026-10-30/);
 h.calls[3].resolve(Response.json({...feed('KBO','next'),date:'2026-10-30',games:[{...game('KBO','next'),date:'2026-10-30'}]}));await flush();
 assert.equal(selected(h.board.render({league:'KBO',revision:1})).game.date,'2026-10-30');
});

test('hidden tabs stop fast polling and a verified empty result can clear retained cards',async t=>{
 const h=environment(t);h.board.render();h.calls[0].resolve(Response.json(feed('NPB','one',{stale:true,refreshing:true,pollAfterMs:5000})));await flush();h.board.render();
 h.document.hidden=true;h.run(5000);assert.equal(h.calls.length,1);
 h.document.hidden=false;h.document.dispatchEvent(new Event('visibilitychange'));assert.equal(h.calls.length,2);
 h.calls[1].resolve(Response.json(feed('NPB','one',{games:[],noGames:true,pollAfterMs:300000})));await flush();
 assert.equal(selected(h.board.render()),undefined);assert.ok([...h.timers.values()].some(timer=>timer.ms===300000));
});

test('the live HTTP route opts into responsive reads without bypassing auth or league validation',async()=>{
 let authenticated=false,value=feed('NPB','one',{stale:true,refreshing:true}),calls=[];
 const {GET}=load('app/api/international-live/route.ts',{
  '@/db':{getRawDb:()=>({})},'@/app/admin-access':{isSiteAdmin:async()=>false},
  '@/lib/arena-session':{readSession:async()=>authenticated?{}:null},
  '@/server/baseball-current.mjs':{dayInTaipei:()=>date},
  '@/lib/international-feed':{getInternationalLive:async(...args)=>{calls.push(args);return value;}},
  '@/lib/international-player-photos':{withNpbLivePhotos:g=>g}
 });
 const request=()=>new Request('http://local/api/international-live?league=NPB&date='+date);
 assert.equal((await GET(request())).status,401);assert.equal(calls.length,0);authenticated=true;
 assert.equal((await GET(new Request('http://local/api/international-live?league=OTHER'))).status,400);assert.equal(calls.length,0);
 const response=await GET(request());assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 assert.deepEqual(calls,[['NPB',date,{preferCached:true}]]);assert.equal((await response.json()).refreshing,true);
 value={...value,games:[],status:'unavailable'};assert.equal((await GET(request())).status,503);
});
