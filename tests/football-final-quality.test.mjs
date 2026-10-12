import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';

const fixture=JSON.parse(readFileSync('tests/fixtures/football-final-quality-20261012.json','utf8'));
const now=Date.parse(fixture.capturedAt);
const {analyzeFootball,parseFootballEvents,parseFootballTeamHistory}=await import(moduleUrl('lib/football.ts'));
const {reconcileFootballHistory}=await import(moduleUrl('lib/football-history.ts'));
const {footballGameAnalysis}=await import(moduleUrl('lib/football-source.ts'));

test('recorded Inter–Club Brugge quality describes the final same-cup model without changing its probabilities',async()=>{
  const payload=path=>fixture.sources.find(s=>s.url===fixture.source+path)?.data;
  const game=parseFootballEvents(payload('uefa.champions/scoreboard?dates=20261013&limit=100'),'uefa.champions').find(g=>g.id==='401915413');
  const history=reconcileFootballHistory(fixture.sources.filter(s=>s.data.team).flatMap(s=>parseFootballTeamHistory(s.data,s.data.team.id)),[]).games;
  const candidate=analyzeFootball(game,history,now,history);
  assert.equal(candidate.historyMode,'recent-form');
  assert.equal(candidate.homeForm.games,20);
  assert.equal(candidate.awayForm.games,20);
  assert.equal(candidate.homeForm.supplementGames,19);
  assert.equal(candidate.awayForm.supplementGames,19);

  const RealDate=globalThis.Date,originalFetch=globalThis.fetch;
  globalThis.Date=class extends RealDate{
    constructor(...args){super(...(args.length?args:[now]));}
    static now(){return now;}
  };
  globalThis.fetch=async url=>{
    const data=fixture.sources.find(s=>s.url===String(url))?.data;
    assert.ok(data,`unexpected source ${url}`);
    return Response.json(data);
  };
  try{
    const {analysis,archiveAsOf}=await footballGameAnalysis('uefa.champions','2026-10-14',game.id);
    assert.equal(analysis.status,'ready');
    assert.equal(analysis.version,fixture.expected.version);
    assert.equal(analysis.external.modelApplied,true);
    assert.equal(analysis.historyMode,'competition');
    assert.equal(analysis.homeForm.games,9);
    assert.equal(analysis.awayForm.games,9);
    assert.equal(analysis.homeForm.supplementGames,0);
    assert.equal(analysis.awayForm.supplementGames,0);
    assert.ok(!analysis.quality.warnings.some(w=>w.includes('跨賽事')));
    assert.deepEqual(analysis.quality.warnings,['至少一隊少於10場樣本，估計較不穩定。']);
    assert.equal(analysis.quality.historyConflicts,analysis.external.conflicts);
    assert.equal(analysis.quality.archiveSupplementGames,0);
    assert.equal(archiveAsOf,null);
    for(const [key,value] of Object.entries(fixture.expected.probabilities))assert.ok(Math.abs(analysis.probabilities[key]-value)<1e-12,key);
  }finally{globalThis.Date=RealDate;globalThis.fetch=originalFetch;}
});
