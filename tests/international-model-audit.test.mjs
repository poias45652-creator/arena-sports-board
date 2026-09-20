import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {createForecastSnapshots,auditFinalFromLive,summarizeForecasts}=await import(moduleUrl('lib/international-model-audit.ts'));
const {buildRunAnalysis}=await import(moduleUrl('lib/baseball-run-analysis.ts'));
const {pregameImportsByLeague}=await import(moduleUrl('lib/pregame-imports.ts'));
const now=Date.parse('2026-09-20T04:00:00Z'),after=Date.parse('2026-09-20T16:00:00Z');
const source=JSON.parse(readFileSync('data/npb-pregame-20260920.json'));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9);
const saved=()=>createForecastSnapshots(source,now)[0];
function final(s=saved(),scores={away:3,home:2}){return auditFinalFromLive({key:'verified-result',league:s.league,date:s.date,startTime:s.startTime,status:'final',away:{name:s.payload.fixture.away,score:scores.away},home:{name:s.payload.fixture.home,score:scores.home},source:{fetchedAt:new Date(after).toISOString()}},after);}

test('server snapshots contain the exact live probabilities and freeze a 15-minute slot without full score grids',()=>{
 const before=JSON.stringify(source),snapshots=createForecastSnapshots(source,now);assert.equal(snapshots.length,6);assert.equal(JSON.stringify(source),before);
 for(let i=0;i<6;i++){const s=snapshots[i],r=buildRunAnalysis(source.games[i],now,'NPB');assert.deepEqual(s.payload.win,r.win);assert.deepEqual(s.payload.inputs,r.inputs);assert.equal(s.capturedAt,new Date(now).toISOString());assert.equal(s.payload.grids,undefined);near(s.payload.expectedFinal.home,r.grids.full.reduce((n,o)=>n+o.home*o.p,0));}
 assert.equal(saved().id,createForecastSnapshots(source,now+60000)[0].id);
 assert.notEqual(saved().id,createForecastSnapshots(source,now+900000)[0].id);
});
test('all three league models can be captured only when ready; no historical, future-observed or in-play backfill',()=>{
 assert.equal(createForecastSnapshots(source,after).length,0);
 const missing=structuredClone(source);missing.games.forEach(g=>g.home.starter.name='');assert.equal(createForecastSnapshots(missing,now).length,0);
 const future=structuredClone(source);future.games.forEach(g=>g.source.observedAt='2026-09-21T00:00:00Z');assert.equal(createForecastSnapshots(future,now).length,0);
 const close=structuredClone(source);close.games=close.games.slice(0,1);assert.equal(createForecastSnapshots(close,Date.parse(saved().startTime)-59000).length,0);
 assert.ok(createForecastSnapshots(pregameImportsByLeague.CPBL,Date.parse('2026-09-20T06:00:00Z')).length>0);
 const kbo=JSON.parse(readFileSync('data/kbo-pregame-20260920.json'));assert.ok(createForecastSnapshots(kbo,Date.parse('2026-09-20T03:00:00Z')).length>0);
});
test('latest eligible snapshot is graded once per model version, includes draws and uses final-score expectations',()=>{
 const s=saved(),later=createForecastSnapshots(source,now+900000)[0],g=final(s,{away:4,home:4});
 const out=summarizeForecasts([s.payload,later.payload], [g],after).groups[0];assert.equal(out.captured,1);assert.equal(out.evaluated,1);assert.equal(out.pending,0);
 const p=later.payload.win;near(out.brier,p.away**2+p.home**2+(p.draw-1)**2);near(out.logLoss,-Math.log(p.draw));
 near(out.finalScoreMAE,(Math.abs(later.payload.expectedFinal.away-4)+Math.abs(later.payload.expectedFinal.home-4))/2);
 const other=structuredClone(s.payload);other.version='different-model';assert.equal(summarizeForecasts([s.payload,other],[g],after).groups.length,2);
});
test('reversed teams, rescheduled start, missing finals and conflicting scores cannot create a successful result join',()=>{
 const s=saved(),g=final(s);
 for(const change of [r=>[r.home,r.away]=[r.away,r.home],r=>r.startTime='2026-09-20T10:00:00.000Z',r=>r.league='KBO']){const wrong=structuredClone(g);change(wrong);assert.equal(summarizeForecasts([s.payload],[wrong],after).groups[0].evaluated,0);}
 const conflict={...g,awayScore:g.awayScore+1};assert.equal(summarizeForecasts([s.payload],[g,conflict],after).groups[0].ambiguous,1);
 const correction={...g,homeScore:9,observedAt:new Date(after+1000).toISOString()};assert.equal(summarizeForecasts([s.payload],[g,conflict,correction],after+1000).groups[0].evaluated,1);
 assert.equal(summarizeForecasts([s.payload],[],after).groups[0].pending,1);
});
test('bad probability mass, forged fixture identity and information obtained after capture are rejected',()=>{
 const s=saved(),g=final(s);
 for(const change of [r=>r.win.home=2,r=>r.fixtureKey='forged',r=>r.inputs.home.starterObservedAt='2026-09-21T00:00:00Z',r=>r.capturedAt='2026-09-20T15:00:00Z']){const bad=structuredClone(s.payload);change(bad);const out=summarizeForecasts([bad],[g],after);assert.equal(out.groups.length,0);assert.equal(out.rejected,1);}
 for(const status of ['live','pregame','suspended'])assert.equal(auditFinalFromLive({status,league:'NPB'},after),null);
});
