import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {buildRunAnalysis,matchingRunAnalysis,analysisFixtureKey,marketOutcomes,scoreDistribution}=await import(moduleUrl('lib/baseball-run-analysis.ts'));
const {applyCpblPitcherReview}=await import(moduleUrl('lib/cpbl-reviewed-pitcher.ts'));
const {pregameImportsByLeague}=await import(moduleUrl('lib/pregame-imports.ts'));
const {applyPitchingImports}=await import(moduleUrl('lib/pregame-pitching-import.ts'));
const {BOARD_MARKETS}=await import(moduleUrl('lib/board-markets.ts'));
const {parseHrGameDetail}=await import(moduleUrl('lib/hr9988.ts'));
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const raw=()=>applyPitchingImports(json('data/cpbl-pregame-20260920.json'),json('data/cpbl-pitching-20260920.json'));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const now=Date.parse('2026-09-20T06:00:00Z');
const fixture=()=>structuredClone(pregameImportsByLeague.CPBL.games[2]);
const card=g=>({id:g.id,start:g.start,away:g.away.team,home:g.home.team,starters:{away:g.away.starter.name,home:g.home.starter.name},live:false});

test('Cao correction preserves 5 BB+HBP, verifies ERA and WHIP, and is scoped and idempotent',()=>{
 const source=raw(),before=JSON.stringify(source),out=applyCpblPitcherReview(source),p=out.games[0].away.starter;
 assert.equal(JSON.stringify(source),before);assert.equal(p.quality,'source_reported');assert.deepEqual(p.warnings,[]);
 assert.equal(p.recent.headers[9],'四死球');assert.equal(p.recent.rows[0][9],'5');assert.equal(p.season.walks,'4');
 assert.equal(Number(p.season.whip),(4+4)/4);assert.equal(Number(p.season.era),3*9/4);assert.equal(p.review.sources.length,3);
 assert.deepEqual(applyCpblPitcherReview(out),out);assert.deepEqual(out.games.slice(1),source.games.slice(1));
 for(const mutate of [d=>d.date='2026-09-21',d=>d.games[0].away.starter.name='其他投手',d=>d.games[0].away.starter.season.walks='5',d=>d.games[0].away.starter.warnings.push('另一個未解衝突')]){
  const d=raw();mutate(d);assert.deepEqual(applyCpblPitcherReview(d),d);
 }
 assert.equal(buildRunAnalysis(pregameImportsByLeague.CPBL.games[0],now,'CPBL').status,'waiting_data','later review cannot be used as an earlier prediction');
});
test('CPBL uses measured team-defense fallback without writing fabricated bullpen records',()=>{
 for(const g of pregameImportsByLeague.CPBL.games.slice(1)){
  const before=JSON.stringify(g),r=buildRunAnalysis(g,now,'CPBL');assert.equal(r.status,'ready',r.reason);
  assert.equal(JSON.stringify(g),before);assert.equal(r.inputs.home.bullpenMode,'team_defense');
  near(r.inputs.home.bullpenEra,r.inputs.home.defense);near(r.win.away+r.win.home+r.win.draw,1);
  assert.ok(r.win.draw>0);assert.ok(r.notes.some(n=>n.includes('60%')));
  for(const grid of Object.values(r.grids)){near(grid.reduce((a,b)=>a+b.p,0),1);assert.ok(grid.every(o=>Number.isFinite(o.p)&&o.p>=0));}
 }
});
test('all seven CPBL markets conserve probability and opposite-side settlements; ties refund moneyline',()=>{
 const g=fixture(),r=buildRunAnalysis(g,now,'CPBL'),game={...card(g),displayMarkets:parseHrGameDetail(json('tests/fixtures/hr9988-game-detail.json'),new Date(now).toISOString()).games[0].displayMarkets};
 for(const {key} of BOARD_MARKETS){const rows=marketOutcomes(game,key,r,true,'CPBL');assert.equal(rows.length,2,key);
  for(const {result:s,pick} of rows){near(s.win+s.partialWin+s.partialLoss+s.loss+s.push,1);assert.ok(pick.key.startsWith('CPBL:'));}
  near(rows[0].result.win,rows[1].result.loss);near(rows[0].result.partialWin,rows[1].result.partialLoss);
 }
 near(marketOutcomes(game,'moneyline',r,true,'CPBL')[0].result.push,r.win.draw);
 assert.deepEqual(marketOutcomes(game,'spread',r,false,'CPBL'),[]);
 assert.deepEqual(marketOutcomes(game,'spread',r,true,'NPB'),[]);
});
test('CPBL automatic runner changes full-game distribution and preserves total mass',()=>{
 const rates=Array(12).fill(.4),normal=scoreDistribution(rates,rates),automatic=scoreDistribution(rates,rates,.6);
 const expectation=g=>g.reduce((n,o)=>n+(o.away+o.home)*o.p,0);
 near(automatic.reduce((n,o)=>n+o.p,0),1);assert.ok(expectation(automatic)>expectation(normal));
 assert.deepEqual(scoreDistribution(rates,rates,1.1),[]);
});
test('missing team data, changed starters, stale archived fields and live fixtures stop estimation',()=>{
 for(const mutate of [g=>g.comparison=null,g=>g.away.starter.quality='needs_review',g=>g.away.starter.statSources.era.observedAt='2026-09-17T00:00:00Z',g=>g.home.starter.statSources.innings.observedAt='2026-09-20T08:00:00Z']){
  const g=fixture();mutate(g);const r=buildRunAnalysis(g,now,'CPBL');assert.equal(r.status,'waiting_data');assert.equal(r.grids,null);
 }
 const g=fixture(),r=buildRunAnalysis(g,now,'CPBL'),reports=new Map([[analysisFixtureKey(r.fixture,'CPBL'),r]]),game=card(g);
 assert.equal(matchingRunAnalysis(game,reports,now,'CPBL').status,'ready');assert.equal(matchingRunAnalysis(game,reports,now,'NPB'),null);
 assert.equal(matchingRunAnalysis({...game,live:true},reports,now,'CPBL').grids,null);
 assert.equal(matchingRunAnalysis({...game,starters:{...game.starters,away:'新先發'}},reports,now,'CPBL').grids,null);
 assert.equal(buildRunAnalysis(g,Date.parse('2026-09-20T09:05:00Z'),'CPBL').status,'started');
});
