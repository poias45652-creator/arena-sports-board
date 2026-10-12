import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setImmediate as nextTurn} from 'node:timers/promises';
import ts from 'typescript';
import {moduleUrl} from './profile-loader.mjs';

const {footballReportNeedsRefresh,footballAnalysisPresentation,footballRequestError}=await import(moduleUrl('app/football-report-refresh.ts'));
const {createFootballReportQueue}=await import(moduleUrl('app/football-report-queue.ts'));
const {footballFixtureKey,readyFootballAnalysis,retainFootballForecast}=await import(moduleUrl('lib/football-recommendations.ts'));
const now=Date.parse('2026-10-12T11:30:00.000Z');
const game=(id='901')=>({id,league:'uefa.champions',season:2026,start:'2026-10-13T16:45:00.000Z',timeConfirmed:true,state:'scheduled',statusName:'STATUS_SCHEDULED',statusLabel:'未開賽',home:{id:'1001',name:'Test home',englishName:'Test home'},away:{id:'1002',name:'Test away',englishName:'Test away'},neutral:false,homeScore:null,awayScore:null,venue:'',sourceUrl:''});
const analysis=()=>({status:'ready',reason:'',version:'test',capturedAt:new Date(now-30000).toISOString(),expected:{home:1.5,away:1.1},probabilities:{home:.5,draw:.25,away:.25,over25:.55,under25:.45,btts:.6},scores:[{home:1,away:0,probability:.13},{home:1,away:1,probability:.12},{home:2,away:1,probability:.1}],notes:[]});
const report=(g=game(),patch={})=>({game:g,analysis:{...analysis(),...patch}});

test('incomplete, closed and failed reports retry after sixty seconds from completion, not ten minutes from capture',()=>{
 const g=game(),reports=[undefined,{game:g,error:'來源暫時無法連線'},report(g,{status:'waiting',reason:'歷史不足',capturedAt:new Date(now).toISOString()}),report(g,{status:'closed',reason:'資料需重新確認'})];
 for(const r of reports){
  assert.equal(footballReportNeedsRefresh(g,r,now),true);
  assert.equal(footballReportNeedsRefresh(g,r,now,now),false);
  assert.equal(footballReportNeedsRefresh(g,r,now+59999,now),false);
  assert.equal(footballReportNeedsRefresh(g,r,now+60000,now),true);
 }
});

test('valid ready reports retain the ten-minute refresh window; invalid timestamps and changed fixtures requery',()=>{
 const g=game(),r=report(g,{capturedAt:new Date(now).toISOString()});
 assert.equal(footballReportNeedsRefresh(g,r,now+599999),false);
 assert.equal(footballReportNeedsRefresh(g,r,now+600000),true);
 assert.equal(footballReportNeedsRefresh(g,r,now+600000,now+540001),false);
 assert.equal(footballReportNeedsRefresh(g,r,now+600000,now+540000),true);
 for(const invalid of [report(g,{capturedAt:'invalid'}),report(g,{capturedAt:new Date(now+61000).toISOString()}),{...r,game:{...g,start:'2026-10-13T18:00:00.000Z'}},{...r,game:{...g,home:g.away,away:g.home}},{...r,game:{...g,league:'eng.1'}},report(g,{probabilities:{...analysis().probabilities,home:.8}})]){
  assert.equal(footballReportNeedsRefresh(g,invalid,now),true);
  assert.equal(footballReportNeedsRefresh(g,invalid,now,now-59999),false);
  assert.equal(footballReportNeedsRefresh(g,invalid,now,now-60000),true);
 }
 assert.equal(footballReportNeedsRefresh(g,r,now+600000,0,false),false);
 for(const invalid of [{...g,timeConfirmed:false},{...g,start:'invalid'},{...g,state:'other'}])assert.equal(footballReportNeedsRefresh(invalid,undefined,now),false);
 assert.equal(footballReportNeedsRefresh(g,undefined,NaN),false);
});

test('kickoff keeps the exact saved pregame forecast through Taipei midnight and missing retained reports remain retryable',()=>{
 const g=game(),r=report(g),start=Date.parse(g.start),lastInstant=Date.parse('2026-10-14T15:59:59.999Z'),midnight=lastInstant+1;
 for(const state of ['scheduled','live','final']){
  const current={...g,state};
  for(const clock of [start,lastInstant]){
   assert.equal(readyFootballAnalysis(current,r,clock,true),r.analysis);
   assert.equal(footballReportNeedsRefresh(current,r,clock,0,false),false);
   assert.equal(footballAnalysisPresentation(current,r,clock,{unavailable:true,analysisAvailable:false,activity:'loading'}).state,'ready');
   assert.equal(footballReportNeedsRefresh(current,undefined,clock,clock-59999,false),false);
   assert.equal(footballReportNeedsRefresh(current,undefined,clock,clock-60000,false),true);
  }
  assert.equal(readyFootballAnalysis(current,r,midnight),null);
  assert.equal(footballReportNeedsRefresh(current,undefined,midnight),false);
 }
 for(const capturedAt of [g.start,new Date(start+1).toISOString()])assert.equal(readyFootballAnalysis({...g,state:'live'},report(g,{capturedAt}),start+1000),null);
});

test('presentation distinguishes completed waiting/error states from real queued/loading work without losing their reason',()=>{
 const g=game(),reason='歷史不足：主隊1場、客隊7場；各需至少5場。';
 assert.deepEqual(footballAnalysisPresentation(g,report(g,{status:'waiting',reason}),now),{state:'waiting',message:reason});
 assert.deepEqual(footballAnalysisPresentation(g,{game:g,error:'分析來源連線失敗'},now),{state:'error',message:'分析來源連線失敗'});
 assert.equal(footballAnalysisPresentation(g,undefined,now).state,'unavailable');
 assert.deepEqual(footballAnalysisPresentation(g,undefined,now,{activity:'queued'}),{state:'loading',message:'等待計算分析…'});
 assert.deepEqual(footballAnalysisPresentation(g,undefined,now,{activity:'loading'}),{state:'loading',message:'正在計算分析…'});
 for(const activity of ['queued','loading']){
  assert.equal(footballAnalysisPresentation(g,report(g),now,{activity}).state,'ready');
  assert.equal(footballAnalysisPresentation(g,report(g,{status:'waiting',reason}),now,{activity}).message,reason);
  assert.equal(footballAnalysisPresentation(g,{game:g,error:'分析來源連線失敗'},now,{activity}).state,'error');
 }
 assert.equal(footballAnalysisPresentation(g,report(g,{capturedAt:'invalid'}),now).state,'stale');
 assert.equal(footballAnalysisPresentation(g,{...report(g),game:{...g,start:'2026-10-13T18:00:00.000Z'}},now,{activity:'queued'}).state,'stale');
 assert.deepEqual(footballAnalysisPresentation(g,undefined,now,{analysisAvailable:false,notice:'來源僅提供賽程',activity:'loading'}),{state:'unavailable',message:'來源僅提供賽程'});
 assert.equal(footballAnalysisPresentation(g,report(g),now,{unavailable:true}).state,'unavailable');
});

test('aborted/time-limited analysis requests have actionable errors rather than raw browser exception text',()=>{
 for(const name of ['AbortError','TimeoutError']){
  const error=new DOMException('The operation was aborted',name);
  assert.equal(footballRequestError(error),'分析請求逾時，稍後會自動重試。');
  assert.equal(footballRequestError(error,'schedule'),'賽程請求逾時，稍後會自動重試。');
 }
 assert.equal(footballRequestError(new TypeError('Failed to fetch')),'分析連線失敗，稍後會自動重試。');
 assert.equal(footballRequestError(new Error('來源尚未提供本季資料')),'來源尚未提供本季資料');
 assert.equal(footballRequestError(null,'next'),'下一個比賽日暫時無法取得，請稍後再試。');
});

// Exercise the board's actual callbacks, rather than duplicating its retention
// or current-fixture policy in the queue tests. Requests stay fully local.
const board=ts.createSourceFile('football-board.tsx',readFileSync('app/football-board.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let queueOptions;
function findQueue(node){if(ts.isCallExpression(node)&&node.expression.getText(board)==='createFootballReportQueue')queueOptions=node.arguments[0].getText(board);ts.forEachChild(node,findQueue);}
findQueue(board);assert.ok(queueOptions,'FootballBoard must configure one report queue');
const optionsCode=ts.transpileModule('function options(){return '+queueOptions+';}',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function harness(games,{ignoreAbort=false}={}){
 const controller=new AbortController(),currentBoard={games,analysisAvailable:true},known={},attempted={},calls=[],activities=[],updates=[];
 let clock=now,inFlight=0,maxInFlight=0;
 const scope={controller,currentBoard,known,attempted,fixtureKey:footballFixtureKey,readyFootballAnalysis,retainFootballForecast,footballRequestError,Date:{now:()=>clock,parse:Date.parse},base:'/never-request',request:()=>{throw Error('Remote requests are not permitted in this test');},setReports:r=>updates.push(r),setAnalysisActivity:a=>activities.push(a)};
 const options=new Function(...Object.keys(scope),optionsCode+'\nreturn options();')(...Object.values(scope));
 const queue=createFootballReportQueue({...options,request(g,signal){
  let resolve,reject;const raw=new Promise((yes,no)=>{resolve=yes;reject=no;});
  const abort=()=>reject(new DOMException('Test cleanup','AbortError'));
  if(!ignoreAbort)signal.addEventListener('abort',abort,{once:true});
  inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);calls.push({game:g,signal,resolve,reject});
  return raw.finally(()=>{inFlight--;signal.removeEventListener('abort',abort);});
 }});
 return {queue,controller,currentBoard,known,attempted,calls,activities,updates,clock(value){clock=value;},get inFlight(){return inFlight;},get maxInFlight(){return maxInFlight;}};
}

test('one two-worker queue spans repeated polls, deduplicates fixtures and publishes actual queued/loading states',async()=>{
 const games=['901','902','903','904','905'].map(game),h=harness(games);
 try{
  h.queue.enqueue(games.slice(0,4));
  assert.equal(h.calls.length,2);assert.equal(h.inFlight,2);
  assert.deepEqual(Object.values(h.activities.at(-1)).sort(),['loading','loading','queued','queued']);
  for(let poll=0;poll<3;poll++)h.queue.enqueue(games);
  assert.equal(h.calls.length,2);assert.equal(Object.keys(h.activities.at(-1)).length,5);
  h.clock(now+45000);h.calls[0].resolve(report(games[0],{status:'waiting',reason:'樣本不足'}));await nextTurn();
  assert.equal(h.calls.length,3);assert.equal(h.attempted[footballFixtureKey(games[0])],now+45000);
  assert.equal(footballReportNeedsRefresh(games[0],h.known[games[0].id],now+60000,h.attempted[footballFixtureKey(games[0])]),false);
  assert.equal(footballReportNeedsRefresh(games[0],h.known[games[0].id],now+105000,h.attempted[footballFixtureKey(games[0])]),true);
  h.queue.enqueue(games.slice(1));assert.equal(h.calls.length,3);
  h.calls[1].reject(new DOMException('Timed out','TimeoutError'));await nextTurn();assert.equal(h.calls.length,4);
  assert.equal(h.known[games[1].id].error,'分析請求逾時，稍後會自動重試。');
  h.calls[2].resolve(report(games[2]));await nextTurn();assert.equal(h.calls.length,5);
  h.calls[3].resolve(report(games[3]));h.calls[4].resolve(report(games[4]));await nextTurn();
  assert.equal(h.maxInFlight,2);assert.equal(h.inFlight,0);assert.deepEqual(h.activities.at(-1),{});
  assert.equal(new Set(h.calls.map(c=>footballFixtureKey(c.game))).size,5);
 }finally{h.controller.abort();await nextTurn();}
});

test('a rescheduled fixture can replace an in-flight old request without its late response or error overwriting the new report',async()=>{
 for(const failOld of [false,true]){
  const old=game(),latest={...old,start:'2026-10-13T18:00:00.000Z'},h=harness([old]);
  try{
   h.queue.enqueue([old]);h.currentBoard.games=[latest];h.queue.enqueue([latest]);assert.equal(h.calls.length,2);
   const accepted=report(latest);h.calls[1].resolve(accepted);await nextTurn();assert.equal(h.known[latest.id],accepted);
   if(failOld)h.calls[0].reject(new Error('Old fixture failed'));else h.calls[0].resolve(report(old));
   await nextTurn();assert.equal(h.known[latest.id],accepted);assert.equal(h.updates.length,1);
  }finally{h.controller.abort();await nextTurn();}
 }
});

test('queued fixtures removed or rescheduled by the next poll never dispatch, while their replacement can proceed',async()=>{
 const [a,b,old]=['901','902','903'].map(game),latest={...old,start:'2026-10-13T18:00:00.000Z'},h=harness([a,b,old]);
 try{
  h.queue.enqueue([a,b,old]);h.currentBoard.games=[a,b,latest];h.queue.enqueue([latest]);
  h.calls[0].resolve(report(a));await nextTurn();
  assert.equal(h.calls.length,3);assert.equal(footballFixtureKey(h.calls[2].game),footballFixtureKey(latest));
  assert.equal(h.queue.has(old),false);assert.equal(h.queue.has(latest),true);
  assert.equal(h.calls.some(c=>footballFixtureKey(c.game)===footballFixtureKey(old)),false);
 }finally{h.controller.abort();await nextTurn();}
});

test('a queued scheduled game becomes ineligible when its current board row is canceled',async()=>{
 const [a,b,c]=['901','902','903'].map(game),h=harness([a,b,c]);
 try{
  h.queue.enqueue([a,b,c]);h.currentBoard.games=[a,b,{...c,state:'other',statusName:'STATUS_CANCELED'}];
  h.calls[0].resolve(report(a));await nextTurn();
  assert.equal(h.calls.length,2);assert.equal(h.queue.has(c),false);assert.equal(h.known[c.id],undefined);
 }finally{h.controller.abort();await nextTurn();}
});

test('responses crossing kickoff cannot replace the frozen pregame report with closed, failed or post-start analysis',async()=>{
 for(const outcome of ['closed','error','late-ready']){
  const g={...game(),start:new Date(now+1000).toISOString()},h=harness([g]),saved=report(g,{capturedAt:new Date(now-600000).toISOString()});
  try{
   h.known[g.id]=saved;h.queue.enqueue([g]);h.clock(now+2000);h.currentBoard.games=[{...g,state:'live'}];
   if(outcome==='error')h.calls[0].reject(new Error('Temporary failure after kickoff'));
   else h.calls[0].resolve(report(outcome==='closed'?{...g,state:'live'}:g,{status:outcome==='closed'?'closed':'ready',capturedAt:new Date(now+2000).toISOString()}));
   await nextTurn();assert.equal(h.known[g.id],saved);assert.equal(readyFootballAnalysis(h.currentBoard.games[0],h.known[g.id],now+2000),saved.analysis);
  }finally{h.controller.abort();await nextTurn();}
 }
});

test('cleanup aborts active work and prevents later reports, retries, activity updates or queued dispatch',async()=>{
 for(const ignoreAbort of [false,true]){
  const games=['901','902','903','904'].map(game),h=harness(games,{ignoreAbort});
  h.queue.enqueue(games);const published=h.activities.length;h.controller.abort();
  assert.ok(h.calls.every(c=>c.signal.aborted));
  if(ignoreAbort){h.calls[0].resolve(report(games[0]));h.calls[1].reject(new Error('Late ignored failure'));}
  await nextTurn();h.queue.enqueue([game('905')]);await nextTurn();
  assert.equal(h.calls.length,2);assert.equal(h.inFlight,0);assert.equal(h.updates.length,0);assert.equal(h.activities.length,published);
  assert.deepEqual(h.known,{});assert.deepEqual(h.attempted,{});
 }
});
