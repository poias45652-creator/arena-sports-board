import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleUrl} from './profile-loader.mjs';
import {readFileSync} from 'node:fs';
const {buildRunAnalysis,matchingRunAnalysis,analysisFixtureKey}=await import(moduleUrl('lib/baseball-run-analysis.ts'));
const {pregameImportsByLeague}=await import(moduleUrl('lib/pregame-imports.ts'));
const {createForecastSnapshots}=await import(moduleUrl('lib/international-model-audit.ts'));
const now=Date.parse('2026-09-20T06:00:00Z');
test('missing starters produce labeled normalized simulations without altering actual stats or strict audit',()=>{
 const g=structuredClone(pregameImportsByLeague.CPBL.games[2]);
 g.away.starter.name='';g.away.starter.quality='missing';g.away.starter.season={};
 const before=JSON.stringify(g),r=buildRunAnalysis(g,now,'CPBL',true);
 assert.equal(r.status,'ready');assert.equal(r.mode,'simulation');assert.ok(r.version.endsWith('-simulation-v1'));
 assert.ok(r.assumptions.length);assert.equal(JSON.stringify(g),before);
 assert.ok(Math.abs(r.win.away+r.win.home+r.win.draw-1)<1e-9);
 assert.equal(buildRunAnalysis(g,now,'CPBL').status,'waiting_data');
 assert.deepEqual(createForecastSnapshots({league:'CPBL',date:g.date,games:[g]},now),[]);
 const game={...r.fixture,starters:{away:'',home:g.home.starter.name}};
 const map=new Map([[analysisFixtureKey(game,'CPBL'),r]]);
 assert.equal(matchingRunAnalysis(game,map,now,'CPBL').mode,'simulation');
 assert.equal(matchingRunAnalysis({...game,live:true},map,now,'CPBL').grids,null);
 assert.equal(matchingRunAnalysis({...game,starters:{away:'新先發'}},map,now,'CPBL').grids,null);
});
test('neutral scenarios are explicit; invalid fixtures, stale observations, and started games cannot be simulated',()=>{
 const base=structuredClone(pregameImportsByLeague.CPBL.games[2]);base.comparison=null;
 const r=buildRunAnalysis(base,now,'CPBL',true);assert.equal(r.mode,'simulation');assert.equal(r.inputs.home.offense,4.5);
 assert.ok(r.assumptions.some(s=>s.includes('中性假設')));
 for(const mutate of [g=>g.source.observedAt='2026-09-01T00:00:00Z',g=>g.source.observedAt='2026-09-21T00:00:00Z',g=>g.home.team=g.away.team,g=>g.league='MLB']){
  const g=structuredClone(base);mutate(g);assert.equal(buildRunAnalysis(g,now,'CPBL',true).grids,null);
 }
 assert.equal(buildRunAnalysis(base,Date.parse('2026-09-20T15:00:00Z'),'CPBL',true).status,'started');
});
test('complete verified inputs automatically take precedence over simulation',()=>{
 const g=structuredClone(pregameImportsByLeague.CPBL.games[2]);
 const a=buildRunAnalysis(g,now,'CPBL'),b=buildRunAnalysis(g,now,'CPBL',true);
 assert.equal(b.mode,undefined);assert.deepEqual(b,a);
});
for(const [league,index] of [['NPB',3],['KBO',0]])test(`${league} simulates missing pitching while preserving league rules`,()=>{
 const g=JSON.parse(readFileSync(`data/${league.toLowerCase()}-pregame-20260920.json`)).games[index];
 g.away.starter.name='';g.away.starter.quality='missing';g.away.starter.season={};
 const time=Date.parse('2026-09-20T04:00:00Z'),r=buildRunAnalysis(g,time,league,true);
 assert.equal(r.status,'ready',r.reason);assert.equal(r.mode,'simulation');
 assert.ok(Math.abs(r.win.away+r.win.home+r.win.draw-1)<1e-9);
 if(league==='KBO'){g.rules=null;assert.equal(buildRunAnalysis(g,time,league,true).grids,null);}
});
