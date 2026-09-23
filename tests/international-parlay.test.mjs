import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {buildRunAnalysis,analysisFixtureKey,marketOutcomes,suggestedPicks}=await import(moduleUrl('lib/baseball-run-analysis.ts'));
const {pregameImportsByLeague}=await import(moduleUrl('lib/pregame-imports.ts'));
const {parseHrGameDetail}=await import(moduleUrl('lib/hr9988.ts'));
const {BOARD_MARKETS}=await import(moduleUrl('lib/board-markets.ts'));
const now=Date.parse('2026-09-20T06:00:00Z');
test('international parlay follows MLB profit-event probability, separates winner mode and deduplicates teams',()=>{
 const g=pregameImportsByLeague.CPBL.games[2],report=buildRunAnalysis(g,now,'CPBL');
 const displayMarkets=parseHrGameDetail(JSON.parse(readFileSync('tests/fixtures/hr9988-game-detail.json')),new Date(now).toISOString()).games[0].displayMarkets;
 // Very low prices distinguish probability ranking from the former positive-EV gate.
 for(const m of displayMarkets)for(const q of m.quotes)Object.assign(q,{homePrice:'0.01',awayPrice:'0.01',over:'0.01',under:'0.01'});
 const game={id:1,...report.fixture,displayMarkets};
 const reports=new Map([[analysisFixtureKey(report.fixture,'CPBL'),report]]);
 const candidates=BOARD_MARKETS.filter(x=>x.key!=='moneyline').flatMap(x=>marketOutcomes(game,x.key,report,true,'CPBL')).filter(x=>x.result.win+x.result.partialWin>x.result.loss+x.result.partialLoss+.000001).sort((a,b)=>(b.result.win+b.result.partialWin)-(a.result.win+a.result.partialWin));
 assert.ok(candidates.length);assert.ok(candidates.every(c=>c.expectedProfit<0));
 const picks=suggestedPicks([game,{...game,id:2}],reports,now,true,false,'CPBL');
 assert.equal(picks.length,1);assert.equal(picks[0].key,candidates[0].pick.key);assert.notEqual(picks[0].type,'111');
 assert.ok(suggestedPicks([game],reports,now,true,true,'CPBL').every(p=>p.type==='111'));
 assert.deepEqual(suggestedPicks([game],reports,now,false,false,'CPBL'),[]);
 assert.deepEqual(suggestedPicks([{...game,live:true}],reports,now,true,false,'CPBL'),[]);
});
