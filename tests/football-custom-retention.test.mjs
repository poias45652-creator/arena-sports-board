import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {createDatabase} from '../server/database.mjs';
import {moduleUrl} from './profile-loader.mjs';
const {saveFootballForecast,loadFootballForecast}=await import(moduleUrl('lib/football-ledger.ts'));
const {cacheFootballReport,cachedFootballReport}=await import(moduleUrl('app/football-report-cache.ts'));
const {footballForecastSettingsKey}=await import(moduleUrl('lib/football-model-weights.ts'));
const capturedAt='2026-10-20T18:55:00.000Z',before=Date.parse(capturedAt),after=Date.parse('2026-10-20T20:52:00Z');
const game={id:'401915400',league:'uefa.champions',season:2026,start:'2026-10-20T19:00:00.000Z',timeConfirmed:true,state:'scheduled',home:{id:'160',name:'巴黎聖日耳曼'},away:{id:'83',name:'巴塞隆納'},neutral:false,homeScore:null,awayScore:null};
const analysis={status:'ready',version:'retention-test-custom-v1',capturedAt,reason:'',notes:[],lean:'客隊',expected:{home:1,away:2},probabilities:{home:.2,draw:.25,away:.55,over25:.55,under25:.45,btts:.4},scores:[{home:1,away:2,probability:.12}]};
const custom={model:'auto',weights:{recent:[80,20,0,0,0]}},other={model:'auto',weights:{recent:[20,80,0,0,0]}},defaults={model:'auto',weights:{}};
const live={...game,state:'live',homeScore:4,awayScore:2};

test('production schema keeps custom snapshots across new requests, isolated by weights and from public accuracy',async()=>{
 const db=new PGlite();
 try{
  await db.exec(readFileSync('db/render-schema.sql','utf8'));
  await db.exec('SET search_path TO yj_platform_v1,pg_catalog');
  const adapter=createDatabase(db),defaultAnalysis={...analysis,version:'default-test'};
  assert.equal(await saveFootballForecast(adapter,game,defaultAnalysis,before),true);
  assert.equal(await saveFootballForecast(adapter,game,analysis,before,custom),true);
  const second={...analysis,probabilities:{...analysis.probabilities,home:.55,away:.2}};
  assert.equal(await saveFootballForecast(adapter,game,second,before,other),true);
  for(const state of ['live','final']){
   const current={...live,state},restored=await loadFootballForecast(createDatabase(db),current,after,custom);
   assert.equal(restored.custom,true);assert.equal(restored.retained,true);assert.deepEqual(restored.analysis,analysis);
   assert.deepEqual((await loadFootballForecast(adapter,current,after,other)).analysis,second);
   assert.deepEqual((await loadFootballForecast(adapter,current,after)).analysis,defaultAnalysis);
   assert.equal(await loadFootballForecast(adapter,current,after,{model:'recent',weights:{}}),null);
   assert.equal(await saveFootballForecast(adapter,current,{...analysis,capturedAt:new Date(after).toISOString()},after,custom),false);
  }
  assert.equal((await db.query('SELECT count(*)::int AS n FROM football_forecasts')).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM football_custom_forecasts')).rows[0].n,2);
  assert.equal(await loadFootballForecast(adapter,{...live,start:'2026-10-20T20:00:00.000Z'},after,custom),null);
  assert.equal(await loadFootballForecast(adapter,{...live,home:game.away,away:game.home},after,custom),null);
  assert.equal(await loadFootballForecast(adapter,live,Date.parse('2026-10-21T16:00:00Z'),custom),null);
 }finally{await db.close();}
});

const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};
test('a received prediction survives browser reload and source failure with its exact settings until Taipei midnight',()=>{
 const disk=storage(),report={game,analysis,custom:true,snapshotSaved:false};
 cacheFootballReport(disk,game,report,custom,before);
 assert.deepEqual(cachedFootballReport(disk,live,custom,after),report);
 assert.equal(cachedFootballReport(disk,live,other,after),undefined);
 assert.equal(cachedFootballReport(disk,live,defaults,after),undefined);
 assert.equal(cachedFootballReport(disk,{...live,neutral:true},custom,after),undefined);
 assert.equal(cachedFootballReport(disk,live,custom,Date.parse('2026-10-21T16:00:00Z')),undefined);
 // A closed reply or a calculation made after kickoff must not replace the pregame report.
 cacheFootballReport(disk,live,{game:live,analysis:{...analysis,status:'closed'}},custom,after);
 cacheFootballReport(disk,live,{game,analysis:{...analysis,capturedAt:new Date(after).toISOString()}},custom,after);
 assert.deepEqual(cachedFootballReport(disk,live,custom,after),report);
});
test('cache corruption, disabled browser storage and property order do not break restoration',()=>{
 const a={model:'auto',weights:{recent:[80,20,0,0,0],elo:[50,30,10,10,0]}},b={weights:{elo:[50,30,10,10,0],recent:[80,20,0,0,0]},model:'auto'};
 assert.equal(footballForecastSettingsKey(a),footballForecastSettingsKey(b));
 const disabled={getItem(){throw Error('disabled');},setItem(){throw Error('disabled');}};
 assert.doesNotThrow(()=>cacheFootballReport(disabled,game,{game,analysis},custom,before));
 assert.equal(cachedFootballReport(disabled,live,custom,after),undefined);
 assert.equal(cachedFootballReport({getItem:()=>'{broken'},live,custom,after),undefined);
 const disk=storage();for(let i=0;i<100;i++){const g={...game,id:String(i)};cacheFootballReport(disk,g,{game:g,analysis},custom,before);}
 assert.equal(cachedFootballReport(disk,{...live,id:'0'},custom,after),undefined);
 assert.ok(cachedFootballReport(disk,{...live,id:'99'},custom,after));
});
