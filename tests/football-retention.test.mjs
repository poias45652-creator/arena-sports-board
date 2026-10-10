import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {moduleUrl} from './profile-loader.mjs';
const {saveFootballForecast,loadFootballForecast}=await import(moduleUrl('lib/football-ledger.ts'));
const {footballRecommendations}=await import(moduleUrl('lib/football-recommendations.ts'));
const start='2026-10-10T02:00:00.000Z',capturedAt='2026-10-10T01:55:00.000Z';
const game={id:'123',league:'eng.1',season:2026,start,timeConfirmed:true,home:{id:'1',name:'主隊'},away:{id:'2',name:'客隊'},homeScore:null,awayScore:null,state:'scheduled',neutral:false};
const analysis={status:'ready',version:'retention-test',capturedAt,reason:'',notes:[],lean:'主隊',expected:{home:2,away:1},probabilities:{home:.6,draw:.25,away:.15,over25:.55,under25:.45,btts:.4},scores:[{home:2,away:1,probability:.12},{home:1,away:0,probability:.1},{home:1,away:1,probability:.09}]};
function adapter(db){return {prepare(sql){let values=[];const q=()=>{let i=0;return db.query(sql.replace(/\?/g,()=>'$'+(++i)),values);};const s={bind(...v){values=v;return s;},run:q,async all(){return {results:(await q()).rows};}};return s;}};}
test('persisted football predictions survive reload, remain frozen after kickoff and expire only in the UI',async()=>{
 const db=new PGlite();
 try{
  await db.exec('CREATE TABLE football_forecasts (id TEXT PRIMARY KEY, league TEXT, game_id TEXT, start_time TEXT, captured_at TEXT, version TEXT, payload TEXT)');
  assert.equal(await saveFootballForecast(adapter(db),game,analysis,Date.parse(capturedAt)),true);
  for(const state of ['live','final']){
   const current={...game,state,homeScore:0,awayScore:5},clock=Date.parse('2026-10-10T15:59:59.999Z');
   // A new request has no client memory; restore from the database alone.
   const restored=await loadFootballForecast(adapter(db),current,clock);
   assert.equal(restored.retained,true);assert.deepEqual(restored.analysis,analysis);
   assert.equal(footballRecommendations({games:[current],reports:{[game.id]:restored},league:game.league,day:'2026-10-10',now:clock})[0].result.label,'主勝');
   assert.equal(await saveFootballForecast(adapter(db),current,{...analysis,capturedAt:new Date(clock).toISOString()},clock),false);
   assert.equal(await loadFootballForecast(adapter(db),current,Date.parse('2026-10-10T16:00:00Z')),null);
  }
  const final={...game,state:'final'},clock=Date.parse('2026-10-10T06:00:00Z');
  assert.equal(await loadFootballForecast(adapter(db),{...final,start:'2026-10-10T03:00:00.000Z'},clock),null);
  assert.equal(await loadFootballForecast(adapter(db),{...final,home:game.away,away:game.home},clock),null);
  assert.equal(await loadFootballForecast(adapter(db),{...final,neutral:true},clock),null);
  assert.equal(await loadFootballForecast(adapter(db),{...final,id:'456'},clock),null);
  assert.equal(await loadFootballForecast(adapter(db),{...final,state:'other'},clock),null);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM football_forecasts')).rows[0].n,1);
  // Pre-upgrade rows can retain the saved probabilities without inventing scores.
  await db.query('UPDATE football_forecasts SET payload=$1',[JSON.stringify({home:game.home,away:game.away,probabilities:analysis.probabilities})]);
  const legacy=await loadFootballForecast(adapter(db),final,clock);
  assert.deepEqual(legacy.analysis.probabilities,analysis.probabilities);
  assert.equal(legacy.analysis.scores,undefined);assert.equal(legacy.analysis.expected,undefined);
  await db.query('UPDATE football_forecasts SET captured_at=$1',[start]);
  assert.equal(await loadFootballForecast(adapter(db),final,clock),null);
 }finally{await db.close();}
});
