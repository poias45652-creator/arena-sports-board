import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const helpers=fs.readFileSync('lib/free-trial.ts','utf8');
const load=s=>import('data:text/javascript;base64,'+Buffer.from(compile(s)).toString('base64'));
const {trialDay,onTrialDay,dailyTrialPick,trialProbabilities,trialResult,retainTrialProgress}=await load(helpers);
test('today changes at Taipei midnight and year rollover',()=>{
 assert.equal(trialDay(Date.parse('2026-10-01T15:59:59Z')),'2026-10-01');
 assert.equal(trialDay(Date.parse('2026-10-01T16:00:00Z')),'2026-10-02');
 assert.equal(trialDay(Date.parse('2026-12-31T16:00:00Z')),'2027-01-01');
 assert.equal(onTrialDay('2026-10-01T16:00:00Z','2026-10-02'),true);
 assert.equal(onTrialDay('2026-10-02T16:00:00Z','2026-10-02'),false);
});
test('one deterministic fixture and validated probabilities',()=>{
 const pool=[{key:'MLB:1'},{key:'NBA:2'},{key:'eng.1:3'}];
 assert.deepEqual(dailyTrialPick(pool,'2026-10-02'),dailyTrialPick([...pool].reverse(),'2026-10-02'));
 assert.equal(dailyTrialPick([],'2026-10-02'),undefined);
 assert.equal(trialProbabilities({home:NaN,away:.5}),undefined);
 assert.equal(trialProbabilities({home:.8,away:.8}),undefined);
 assert.deepEqual(trialProbabilities({home:.5,away:.3,draw:.2,private:'hidden'}),{home:.5,away:.3,draw:.2});
});
test('final-only grading handles draws, missing picks and extra-time uncertainty',()=>{
 const data={game:{sport:'football',start:'2026-10-02T05:00:00Z'},predictionAt:'2026-10-02T04:00:00Z',probabilities:{home:.6,away:.3,draw:.1},progress:{state:'live',home:2,away:1,settleable:true}};
 assert.equal(trialResult(data),undefined);
 data.progress.state='final';assert.equal(trialResult(data),'hit');
 data.progress.home=1;assert.equal(trialResult(data),'miss');
 data.game.sport='baseball';assert.equal(trialResult(data),'draw');
 data.game.sport='basketball';assert.equal(trialResult(data),'ungraded');
 data.game.sport='football';data.probabilities={home:.2,away:.3,draw:.5};assert.equal(trialResult(data),'hit');
 data.predictionAt=undefined;assert.equal(trialResult(data),'no_pick');
 data.progress.settleable=false;assert.equal(trialResult(data),'ungraded');
 const last={state:'final',observedAt:'2026-10-02T08:00:00Z',home:3,away:2};
 assert.equal(retainTrialProgress(last,{state:'live',observedAt:'2026-10-02T09:00:00Z'}).state,'final');
 assert.equal(retainTrialProgress(last,undefined).stale,true);
});
test('persistent daily lifecycle survives reloads, outages, final correction and midnight',async()=>{
 const pg=new PGlite();const realNow=Date.now;let clock=Date.parse('2026-10-02T04:00:00Z');Date.now=()=>clock;
 try{
  await pg.exec('BEGIN;'+fs.readFileSync('db/render-schema.sql','utf8')+'COMMIT;SET search_path TO yj_platform_v1,pg_catalog;');
  // Running the additive migration twice must preserve saved selections.
  await pg.exec('BEGIN;'+fs.readFileSync('db/render-schema.sql','utf8')+'COMMIT;');
  globalThis.__trialDb={prepare(sql){
   let i=0;sql=sql.replace(/\?/g,()=>'$'+ ++i);
   return {bind(...args){return {
    first:async()=>(await pg.query(sql,args)).rows[0]??null,
    run:async()=>{await pg.query(sql,args);return {success:true};}
   };}};
  }};
  globalThis.__trialFixture={id:'123',start:'2026-10-02T05:00:00Z',state:'scheduled',timeConfirmed:true,home:{name:'主隊',id:'1'},away:{name:'客隊',id:'2'},homeScore:null,awayScore:null,statusName:'STATUS_SCHEDULED',statusLabel:'未開賽',private:'hidden'};
  globalThis.__trialFail=false;globalThis.__trialAnalysis=0;
  const stubs=`
   const getRawDb=()=>globalThis.__trialDb;
   const baseballSource=async()=>Response.json({games:[]});const getInternationalLive=async()=>({games:[],status:'ok'});
   const nbaSchedule=async()=>({games:[]});const wnbaSchedule=nbaSchedule;
   const FOOTBALL_LEAGUES=[{code:'eng.1',fullName:'英超'}];
   const footballSchedule=async()=>{if(globalThis.__trialFail)throw Error('offline');return {games:[globalThis.__trialFixture],fetchedAt:new Date(Date.now()).toISOString()}};
   const footballGameAnalysis=async()=>{globalThis.__trialAnalysis++;return {analysis:{status:'ready',probabilities:{home:.6,away:.3,draw:.1},expected:{home:2,away:1}}}};
  `;
  const route=fs.readFileSync('app/api/free-trial/route.ts','utf8').replace(/^import .*;\n/gm,'');let serial=0;
  const request=async()=>{const mod=await load(helpers+stubs+route+`\n// instance ${serial++}`);return (await mod.GET(new Request('https://example.test/api/free-trial?game=secret&date=2000-01-01'))).json();};
  const [first,concurrent]=await Promise.all([request(),request()]);
  assert.equal(first.game.id,'123');assert.equal(concurrent.game.key,first.game.key);assert.equal(first.game.raw,undefined);assert.equal(first.game.eligible,undefined);assert.equal(first.game.private,undefined);
  assert.equal(first.predictionAt,'2026-10-02T04:00:00.000Z');assert.equal(first.result,undefined);
  const calls=globalThis.__trialAnalysis;
  clock=Date.parse('2026-10-02T05:10:00Z');Object.assign(globalThis.__trialFixture,{state:'live',homeScore:0,awayScore:2,statusLabel:'進行中'});
  const live=await request();assert.equal(live.progress.state,'live');assert.equal(live.progress.away,2);assert.equal(live.result,undefined);assert.deepEqual(live.probabilities,first.probabilities);assert.equal(globalThis.__trialAnalysis,calls);
  clock+=60000;globalThis.__trialFail=true;
  const stale=await request();assert.equal(stale.game.id,'123');assert.equal(stale.progress.stale,true);assert.equal(stale.progress.away,2);
  globalThis.__trialFail=false;clock=Date.parse('2026-10-02T07:00:00Z');Object.assign(globalThis.__trialFixture,{state:'final',homeScore:3,awayScore:2,statusName:'STATUS_FINAL',statusLabel:'已完賽'});
  const final=await request();assert.equal(final.result,'hit');assert.equal(final.progress.home,3);
  clock+=60000;globalThis.__trialFixture.homeScore=1;assert.equal((await request()).result,'miss');
  clock+=60000;globalThis.__trialFixture.state='live';const regressed=await request();assert.equal(regressed.progress.state,'final');assert.equal(regressed.result,'miss');
  // Existing selections from before this feature may already be in play: never backfill a pick.
  await pg.exec('DELETE FROM free_trial_daily;');clock+=60000;
  const missing=await request();assert.equal(missing.predictionAt,undefined);assert.equal(globalThis.__trialAnalysis,calls);
  globalThis.__trialFixture.state='final';clock+=60000;assert.equal((await request()).result,'no_pick');
  clock=Date.parse('2026-10-02T16:00:00Z');Object.assign(globalThis.__trialFixture,{id:'456',start:'2026-10-03T05:00:00Z',state:'scheduled',homeScore:null,awayScore:null});
  const next=await request();assert.equal(next.day,'2026-10-03');assert.equal(next.game.id,'456');assert.equal((await pg.query('SELECT * FROM free_trial_selections')).rows.length,2);
 }finally{Date.now=realNow;delete globalThis.__trialDb;await pg.close();}
});
