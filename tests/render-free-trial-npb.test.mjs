import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';

const day='2026-10-05';
const game={key:'NPB:seibu-lotte',id:'seibu-lotte',sport:'baseball',league:'NPB',leagueName:'NPB 日本職棒',start:'2026-10-05T09:00:00Z',home:'千葉羅德海洋',away:'西武獅'};
const candidate={...game,raw:{},eligible:true,progress:{state:'scheduled',home:null,away:null,observedAt:'2026-10-05T08:00:00Z',settleable:true}};
const pregame={league:'NPB',date:day,games:[{league:'NPB',date:day,start:'2026-10-05 17:00:00',home:{team:'千葉羅德海洋',starter:{name:'主隊投手'}},away:{team:'埼玉西武獅',starter:{name:'客隊投手'}}}]};
const ready={status:'ready',win:{home:.55,away:.4,draw:.05},expected:{home:4.2,away:3.1}};
const helpers=fs.readFileSync('lib/free-trial.ts','utf8');
const aliases=fs.readFileSync('lib/international-teams.ts','utf8');
const startParser=fs.readFileSync('lib/baseball-run-analysis.ts','utf8').match(/^export const analysisStartTime=.*;$/m)?.[0];
assert.ok(startParser,'Load the actual unchanged start-time parser');
const route=fs.readFileSync('app/api/free-trial/route.ts','utf8').replace(/^import .*;\n/gm,'');
let serial=0;
async function loadRoute(options){
 const stubs=`
  let fixtureDb,fixtureFeed,fixtureSnapshot,fixtureModel,afterAnalysis;
  const modelCalls=[];
  const getRawDb=()=>fixtureDb;
  const getInternationalLive=async()=>fixtureFeed;
  const getInternationalPregame=async()=>({pregame:fixtureSnapshot});
  const buildRunAnalysis=(g,...args)=>{modelCalls.push({g,args});afterAnalysis?.();return fixtureModel;};
  const baseballSource=async()=>{throw Error('Unexpected MLB request');};
  const nbaSchedule=async()=>{throw Error('Unexpected basketball request');};
  const wnbaSchedule=nbaSchedule;
  const FOOTBALL_LEAGUES=[];
  export function configure(o){fixtureDb=o.db;fixtureFeed=o.feed;fixtureSnapshot=o.snapshot;fixtureModel=o.model;afterAnalysis=o.afterAnalysis;}
  export {modelCalls};
 `;
 const source=helpers+'\n'+aliases+'\n'+startParser+'\n'+stubs+'\n'+route+'\nexport {analyze};\n// isolated instance '+serial++;
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
 mod.configure(options);
 return mod;
}

test('NPB free analysis accepts canonical aliases but rejects wrong or ambiguous fixtures',async()=>{
 const mod=await loadRoute({snapshot:pregame,model:ready});
 const first=await mod.analyze(candidate,day);
 assert.deepEqual(first.probabilities,ready.win);
 assert.deepEqual(first.expected,ready.expected);
 assert.equal(first.game.away,'西武獅');
 assert.equal(first.game.raw,undefined);
 assert.equal(mod.modelCalls.length,1);
 assert.equal(mod.modelCalls[0].g.away.team,'埼玉西武獅');
 assert.equal(mod.modelCalls[0].args[1],'NPB');
 const japanese={...candidate,home:'千葉ロッテマリーンズ',away:'埼玉西武ライオンズ'};
 assert.deepEqual((await mod.analyze(japanese,day)).probabilities,ready.win);
 for(const change of [
  p=>{p.league='KBO';},
  p=>{p.date='2026-10-04';},
  p=>{p.games[0].league='KBO';},
  p=>{p.games[0].date='2026-10-04';},
  p=>{p.games[0].start='2026-10-05 17:01:00';},
  p=>{p.games[0].start='invalid';},
  p=>{p.games[0].away.team='阪神虎';},
  p=>{[p.games[0].away,p.games[0].home]=[p.games[0].home,p.games[0].away];},
  p=>{p.games.push(structuredClone(p.games[0]));}
 ]){
  const snapshot=structuredClone(pregame);change(snapshot);
  const before=mod.modelCalls.length;
  mod.configure({snapshot,model:ready});
  assert.equal((await mod.analyze(candidate,day)).probabilities,undefined);
  assert.equal(mod.modelCalls.length,before,'Rejected fixtures must not invoke the model');
 }
 mod.configure({snapshot:pregame,model:{...ready,mode:'simulation'}});
 assert.equal((await mod.analyze(candidate,day)).probabilities,undefined);
 mod.configure({snapshot:pregame,model:{...ready,status:'waiting_data'}});
 assert.equal((await mod.analyze(candidate,day)).probabilities,undefined);
 mod.configure({snapshot:pregame,model:{...ready,win:{home:.9,away:.9,draw:.1}}});
 assert.equal((await mod.analyze(candidate,day)).probabilities,undefined);
});

test('existing NPB daily selection recovers before kickoff without redraw or post-kickoff forecast writes',async()=>{
 const pg=new PGlite();
 const realNow=Date.now;let clock=Date.parse('2026-10-05T08:00:00Z');Date.now=()=>clock;
 try{
  await pg.exec('BEGIN;'+fs.readFileSync('db/render-schema.sql','utf8')+'COMMIT;SET search_path TO yj_platform_v1,pg_catalog;');
  const db={prepare(sql){let n=0;sql=sql.replace(/\?/g,()=>'$'+ ++n);return {bind(...args){return {first:async()=>(await pg.query(sql,args)).rows[0]??null,run:async()=>{await pg.query(sql,args);return {success:true};}};}};}};
  await pg.query('INSERT INTO free_trial_selections (day,fixture_key,created_at) VALUES ($1,$2,$3)',[day,game.key,clock]);
  await pg.query('INSERT INTO free_trial_daily (day,fixture_key,fixture) VALUES ($1,$2,$3)',[day,game.key,JSON.stringify(game)]);
  const live={id:game.id,league:'NPB',date:day,startTime:game.start,status:'pregame',home:{name:game.home,score:null},away:{name:game.away,score:null},source:{fetchedAt:new Date(clock).toISOString()}};
  const request=async(model=ready,afterAnalysis)=>{
   live.source.fetchedAt=new Date(clock).toISOString();
   const mod=await loadRoute({db,feed:{status:'ready',games:[live]},snapshot:pregame,model,afterAnalysis});
   const data=await (await mod.GET()).json();return {data,calls:mod.modelCalls.length};
  };
  const missing=await request({...ready,mode:'simulation'});
  assert.equal(missing.data.game.key,game.key);
  assert.equal(missing.data.probabilities,undefined);
  assert.equal((await pg.query('SELECT forecast FROM free_trial_daily WHERE day=$1',[day])).rows[0].forecast,null);
  clock+=60000;
  const recovered=await request();
  assert.deepEqual(recovered.data.probabilities,ready.win);
  assert.equal(recovered.data.game.key,game.key);
  assert.equal(recovered.data.predictionAt,new Date(clock).toISOString());
  assert.equal(recovered.calls,1);
  assert.equal((await pg.query('SELECT * FROM free_trial_selections')).rows.length,1);
  assert.equal((await pg.query('SELECT * FROM free_trial_daily')).rows.length,1);
  const refreshed=await request({...ready,win:{home:.2,away:.75,draw:.05}});
  assert.deepEqual(refreshed.data.probabilities,ready.win);
  assert.equal(refreshed.calls,0);
  clock=Date.parse('2026-10-05T09:01:00Z');live.status='live';live.home.score=0;live.away.score=1;
  const inPlay=await request();
  assert.equal(inPlay.data.progress.state,'live');assert.equal(inPlay.data.progress.away,1);
  assert.deepEqual(inPlay.data.probabilities,ready.win);assert.equal(inPlay.calls,0);
  await pg.query('UPDATE free_trial_daily SET forecast=NULL WHERE day=$1',[day]);
  const noBackfill=await request();
  assert.equal(noBackfill.data.probabilities,undefined);assert.equal(noBackfill.calls,0);
  // A source response completing exactly at kickoff must not become a pregame pick.
  clock=Date.parse('2026-10-05T08:59:59Z');live.status='pregame';
  const crossed=await request(ready,()=>{clock=Date.parse(game.start);});
  assert.equal(crossed.calls,1);assert.equal(crossed.data.probabilities,undefined);
  assert.equal((await pg.query('SELECT forecast FROM free_trial_daily WHERE day=$1',[day])).rows[0].forecast,null);
 }finally{Date.now=realNow;await pg.close();}
});
