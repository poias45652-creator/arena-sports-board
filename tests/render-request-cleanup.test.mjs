import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('YJ removes unused Statcast and off-sport MLB polling',()=>{
 const page=read('app/page.tsx');
 assert.doesNotMatch(page,/baseballsavant|setPlayers|const CSV|\\bREFRESH_MS\\b/);
 assert.match(page,/if\\(!selectionReady\\|\\|league!==['"]MLB['"]\\)return/);
 assert.match(page,/<Standings active=\\{view==='overview'\\|\\|view==='standings'\\}/);
 assert.match(page,/<Pregame active=\\{view==='overview'\\|\\|view==='analysis'\\}/);
});
test('hidden views pause public polling and analysis',()=>{
 const source=read('app/use-source.ts'),standings=read('app/standings.tsx'),pregame=read('app/pregame.tsx'),context=read('app/game-context.tsx');
 assert.match(source,/enabled=true/);assert.match(source,/document\\.hidden/);assert.match(source,/visibilitychange/);
 assert.match(standings,/5\\*60000,active/);
 assert.doesNotMatch(pregame,/useSource<Snapshot>/);assert.doesNotMatch(pregame,/batter-team|pitcher-team/);
 assert.match(pregame,/useSource<Schedule>\\('schedule',30000,active\\)/);
 assert.match(context,/arena-analysis-refresh/);assert.match(context,/if\\(!active\\)return/);
});
test('authoritative analysis still loads its own inputs',()=>{
 const route=read('app/api/analysis/route.ts');
 assert.ok(route.includes("loadSource('schedule')"));assert.ok(route.includes('assembleAnalysis(g,input)'));assert.ok(route.includes("loadSource('statcast-pitcher"));
});
