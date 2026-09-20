import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {mergePregameFixtures,displayPitcherStat,summarizePregameImport}=await import(moduleUrl('lib/international-pregame.ts'));
const read=league=>JSON.parse(readFileSync(`data/${league}-pregame-20260920.json`,'utf8'));
const npb=read('npb'),cpbl=read('cpbl'),kbo=read('kbo');
const fixture=g=>({id:'current',start:g.start,home:g.home.team,away:g.away.team,live:false,displayMarkets:[]});

test('all imports retain dated provenance and aligned pitching, batting and matchup tables',()=>{
 for(const data of [npb,cpbl,kbo])for(const g of data.games){
  assert.equal(g.date,data.date);assert.equal(g.league,data.league);assert.equal(g.liveVerified,false);
  assert.equal(new URL(g.source.url).hostname,'www.playsport.cc');
  assert.equal(g.source.observedAt,data.observedAt);
  assert.ok(Date.parse(g.source.observedAt)<Date.parse(g.start.replace(' ','T')+'+08:00'));
  const tables=[g.comparison,...[g.away,g.home].flatMap(t=>[t.batting,t.starter.splits,t.starter.recent])].filter(Boolean);
  for(const t of tables)for(const row of t.rows)assert.equal(row.length,t.headers.length);
 }
 assert.deepEqual([npb.games.length,kbo.games.length,cpbl.games.length],[6,5,3]);
});
test('NPB imports twelve named starters and 206 dated appearances with source decimals',()=>{
 const s=summarizePregameImport(npb);
 assert.equal(s.pitchers,12);assert.equal(s.usablePitchers,12);assert.equal(s.appearances,206);assert.equal(s.bullpens,12);
 assert.equal(npb.games[0].away.starter.name,'高橋奎二');assert.equal(displayPitcherStat(npb.games[0].away,'era'),'4.10');
 assert.equal(npb.games[0].home.starter.name,'小笠原慎之介');assert.equal(displayPitcherStat(npb.games[0].home,'whip'),'1.00');
 assert.equal(npb.games[3].start,'2026-09-20 17:00:00');
 assert.equal(npb.games[0].away.starter.recent.rows[1][3],'');assert.equal(npb.games[0].away.starter.recent.rows[1][4],'83');
 assert.equal(s.reviewBatting.length,12);
});
test('CPBL missing pitchers and bullpen are preserved as unavailable rather than zero',()=>{
 const s=summarizePregameImport(cpbl);assert.equal(s.pitchers,0);assert.equal(s.bullpens,0);assert.equal(s.batting,6);
 for(const g of cpbl.games)for(const side of [g.away,g.home]){
  assert.equal(side.starter.quality,'unavailable');assert.equal(side.starter.name,'');assert.equal(side.bullpen,null);
  assert.equal(displayPitcherStat(side,'era'),'—');assert.equal(displayPitcherStat(side,'whip'),'—');
 }
 assert.equal(cpbl.games[0].away.batting.rows[0][1],'.241(5)');assert.equal(cpbl.games[0].home.record,'49-58-2 46%');
});
test('dated imports are idempotent and cannot cross leagues, schedules or newer imports',()=>{
 const single={...npb,games:[npb.games[0]]},game=fixture(single.games[0]);
 const merged=mergePregameFixtures([game],single,'NPB',[game]);assert.equal(merged[0].id,'current');
 assert.equal(mergePregameFixtures(merged,single,'NPB',[game]).length,1);
 assert.equal(mergePregameFixtures([],single,'KBO').length,0);
 const newer={...merged[0],pregame:{...merged[0].pregame,source:{...merged[0].pregame.source,observedAt:'2026-09-20T04:00:00Z'}}};
 assert.equal(mergePregameFixtures([newer],single,'NPB',[game])[0].pregame.source.observedAt,'2026-09-20T04:00:00Z');
 const changed={...game,start:'2026-09-20 18:00:00'};
 assert.equal(mergePregameFixtures([changed],single,'NPB',[changed])[0].pregame,undefined);
 assert.deepEqual(mergePregameFixtures([],single,'NPB',[game]),[]);
 const postgame=structuredClone(single);postgame.games[0].source.observedAt='2026-09-20T06:00:00Z';
 assert.deepEqual(mergePregameFixtures([],postgame,'NPB'),[]);
});
test('empty CPBL pitcher imports preserve a current announced pitcher',()=>{
 const data={...cpbl,games:[cpbl.games[0]]};const game={...fixture(data.games[0]),starters:{home:'已公告投手'}};
 const result=mergePregameFixtures([game],data,'CPBL',[game]);
 assert.equal(result[0].starters.home,'已公告投手');assert.equal(result[0].pregame.id,data.games[0].id);
});
