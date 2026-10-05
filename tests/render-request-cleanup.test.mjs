import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('YJ removes unused Statcast and off-sport MLB polling',()=>{
 const page=read('app/page.tsx');
 assert.doesNotMatch(page,/baseballsavant|setPlayers|const CSV|\\bREFRESH_MS\\b/);
 assert.ok(page.includes("if(!selectionReady||league!=='MLB')return"));
 assert.ok(page.includes("<Standings active={view==='overview'||view==='standings'}/>"));
 assert.ok(page.includes("<Pregame active={view==='overview'||view==='analysis'}/>"));
});
test('hidden views pause public polling and analysis',()=>{
 const source=read('app/use-source.ts'),standings=read('app/standings.tsx'),pregame=read('app/pregame.tsx'),context=read('app/game-context.tsx');
 assert.ok(source.includes('enabled=true'));assert.ok(source.includes('document.hidden'));assert.ok(source.includes('visibilitychange'));
 assert.ok(standings.includes("5*60000,active"));
 assert.doesNotMatch(pregame,/useSource<Snapshot>/);assert.doesNotMatch(pregame,/batter-team|pitcher-team/);
 assert.ok(pregame.includes("useSource<Schedule>('schedule',30000,active)"));
 assert.ok(context.includes('arena-analysis-refresh'));assert.ok(context.includes('if(!active)return'));
});
test('authoritative analysis still loads its own inputs',()=>{
 const route=read('app/api/analysis/route.ts');
 assert.ok(route.includes("loadSource('schedule')"));assert.ok(route.includes('assembleAnalysis(g,input)'));assert.ok(route.includes("loadSource('statcast-pitcher"));
});
