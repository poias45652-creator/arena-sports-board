import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {applyPitchingImports}=await import(moduleUrl('lib/pregame-pitching-import.ts'));
const {mergePregameFixtures,displayPitcherStat,summarizePregameImport}=await import(moduleUrl('lib/international-pregame.ts'));
const snapshot=JSON.parse(readFileSync('data/cpbl-pregame-20260920.json','utf8'));
const updates=JSON.parse(readFileSync('data/cpbl-pitching-20260920.json','utf8'));

test('uploaded pitching updates the exact matchup while retaining older batting provenance',()=>{
 const before=JSON.stringify(snapshot),result=applyPitchingImports(snapshot,updates),g=result.games[0];
 assert.equal(JSON.stringify(snapshot),before);
 assert.equal(g.away.starter.name,'曹祐齊');assert.equal(g.home.starter.name,'菲力士');
 assert.equal(g.away.pitchingSource.capturedAt,null);assert.equal(g.home.pitchingSource.receivedAt,'2026-09-20T04:50:52Z');
 assert.deepEqual(g.source,snapshot.games[0].source);assert.deepEqual(g.away.batting,snapshot.games[0].away.batting);
 assert.deepEqual(result.games.slice(1),snapshot.games.slice(1));
 assert.deepEqual(applyPitchingImports(result,updates),result);
 assert.deepEqual([summarizePregameImport(result).pitchers,summarizePregameImport(result).usablePitchers,summarizePregameImport(result).appearances],[2,1,10]);
});
test('conflicting walks and WHIP stay available for review and never become verified card statistics',()=>{
 const g=applyPitchingImports(snapshot,updates).games[0];
 assert.equal(g.away.starter.season.walks,'4');assert.equal(g.away.starter.recent.rows[0][9],'5');
 assert.equal(g.away.starter.quality,'needs_review');assert.equal(displayPitcherStat(g.away,'whip'),'—');
 assert.equal(displayPitcherStat(g.home,'era'),'4.14');assert.equal(displayPitcherStat(g.home,'whip'),'1.54');
 assert.equal(g.home.starter.recent.rows[0][3],'');assert.equal(g.home.starter.recent.rows[0][4],'100');
 assert.equal(g.away.bullpen.whip,'-');
});
test('wrong teams, dates, leagues, source game IDs and late imports cannot enrich a fixture',()=>{
 for(const change of [u=>u.away.team='台鋼雄鷹',u=>u.date='2026-09-21',u=>u.league='NPB',u=>u.source.url=u.source.url.replace('61001','61002'),u=>u.source.receivedAt='2026-09-20T08:00:00Z']){
  const altered=structuredClone(updates);change(altered[0]);assert.deepEqual(applyPitchingImports(snapshot,altered),snapshot);
 }
});
test('enriched starters reach the match cards without replacing an explicitly different announcement',()=>{
 const data=applyPitchingImports(snapshot,updates),g=data.games[0];
 const fixture={id:'current',start:g.start,home:g.home.team,away:g.away.team,live:false,displayMarkets:[]};
 const merged=mergePregameFixtures([fixture],data,'CPBL');assert.equal(merged[0].starters.away,'曹祐齊');assert.equal(merged[0].starters.home,'菲力士');
 const changed={...fixture,starters:{home:'另一位已確認投手'}};
 assert.equal(mergePregameFixtures([changed],data,'CPBL')[0].starters.home,'另一位已確認投手');
});
