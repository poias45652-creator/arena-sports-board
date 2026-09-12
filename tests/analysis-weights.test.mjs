import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../lib/analysis-weights.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
const {analyzeTeams, normalizeAnalysisWeights, readStoredAnalysisWeights, DEFAULT_ANALYSIS_WEIGHTS} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const runs = {year: 2026, rows: [
  {id: 1, scored: 600, allowed: 500, batGames: 100, pitchGames: 100},
  {id: 2, scored: 500, allowed: 400, batGames: 100, pitchGames: 100},
  {id: 3, scored: 400, allowed: 300, batGames: 100, pitchGames: 100},
]};
const standings = {season: 2026, rows: [
  {id: 1, name: 'A', wins: 40, losses: 60},
  {id: 2, name: 'B', wins: 50, losses: 50},
  {id: 3, name: 'C', wins: 60, losses: 40},
]};

test('relative weights normalize to 100 and invalid/all-zero settings are rejected', () => {
  assert.deepEqual(normalizeAnalysisWeights({scoring: 10, defense: 20, record: 20}), {scoring: 20, defense: 40, record: 40});
  for (const bad of [null, {}, {scoring: 0, defense: 0, record: 0}, {scoring: -1, defense: 20, record: 20}, {scoring: 101, defense: 20, record: 20}, {scoring: NaN, defense: 20, record: 20}, {scoring: '40', defense: 40, record: 20}, {scoring: Infinity, defense: 0, record: 0}]) {
    assert.equal(normalizeAnalysisWeights(bad), null);
    assert.deepEqual(analyzeTeams(runs, standings, bad), []);
  }
});

test('saved settings round-trip and corrupt/unsupported storage does not apply', () => {
  assert.deepEqual(readStoredAnalysisWeights(JSON.stringify({version: 1, weights: DEFAULT_ANALYSIS_WEIGHTS})), DEFAULT_ANALYSIS_WEIGHTS);
  for (const bad of [null, 'broken json', '{}', JSON.stringify({version: 2, weights: DEFAULT_ANALYSIS_WEIGHTS}), JSON.stringify({version: 1, weights: {scoring: 0, defense: 0, record: 0}})]) assert.equal(readStoredAnalysisWeights(bad), null);
});

test('higher offense, lower runs allowed and better records affect ranking in the correct direction', () => {
  assert.deepEqual(analyzeTeams(runs, standings, {scoring: 100, defense: 0, record: 0}).map(r => [r.id, r.score]), [[1, 100], [2, 50], [3, 0]]);
  for (const weights of [{scoring: 0, defense: 100, record: 0}, {scoring: 0, defense: 0, record: 100}]) {
    assert.deepEqual(analyzeTeams(runs, standings, weights).map(r => [r.id, r.score]), [[3, 100], [2, 50], [1, 0]]);
  }
  assert.deepEqual(analyzeTeams(runs, standings, DEFAULT_ANALYSIS_WEIGHTS).map(r => [r.id, r.score]), [[3, 60], [2, 50], [1, 40]]);
});

test('equal performances receive equal mid-rank scores', () => {
  const tied = {...runs, rows: runs.rows.map(r => ({...r, scored: 400}))};
  assert.deepEqual(analyzeTeams(tied, standings, {scoring: 100, defense: 0, record: 0}).map(r => r.score), [50, 50, 50]);
});

test('missing, duplicate and wrong-season records never become fabricated scores', () => {
  for (const records of [{...standings, season: 2025}, {...standings, rows: standings.rows.slice(1)}, {...standings, rows: [...standings.rows, standings.rows[0]]}]) {
    assert.equal(analyzeTeams(runs, records, DEFAULT_ANALYSIS_WEIGHTS).find(r => r.id === 1).score, null);
    assert.equal(analyzeTeams(runs, records, {scoring: 100, defense: 0, record: 0}).find(r => r.id === 1).score, 100);
  }
  const invalid = {...runs, rows: [{...runs.rows[0], batGames: 0}, ...runs.rows.slice(1)]};
  assert.equal(analyzeTeams(invalid, standings, DEFAULT_ANALYSIS_WEIGHTS).find(r => r.id === 1).score, null);
  assert.equal(analyzeTeams({...runs, rows: [runs.rows[0]]}, null, {scoring: 100, defense: 0, record: 0})[0].score, null);
  assert.deepEqual(analyzeTeams(null, null, DEFAULT_ANALYSIS_WEIGHTS), []);
});
