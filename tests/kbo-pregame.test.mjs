import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {mergeKboPregameFixtures,displayKboPitcherStat}=await import(moduleUrl('lib/kbo-pregame.ts'));
const data=JSON.parse(readFileSync('data/kbo-pregame-20260920.json','utf8'));
const fixture=(game,start=game.start)=>({id:'current-'+game.id,start,home:game.home.team,away:game.away.team,live:false,displayMarkets:[]});

test('import preserves five dated matchups, ten starters, source times and 171 appearances',()=>{
 assert.equal(data.games.length,5);assert.equal(new Set(data.games.map(g=>g.id)).size,5);
 const sides=data.games.flatMap(g=>[g.away,g.home]);
 assert.equal(new Set(sides.map(s=>s.teamCode)).size,10);
 assert.equal(sides.reduce((sum,s)=>sum+s.starter.recent.rows.length,0),171);
 for(const g of data.games){
  assert.equal(g.date,'2026-09-20');assert.equal(g.start,'2026-09-20 13:00:00');assert.equal(g.liveVerified,false);
  assert.equal(g.source.observedAt,data.observedAt);assert.ok(Date.parse(g.source.observedAt)<Date.parse('2026-09-20T13:00:00+08:00'));
  assert.equal(new URL(g.source.url).hostname,'www.playsport.cc');
  for(const side of [g.away,g.home])for(const table of [side.batting,side.starter.splits,side.starter.recent]){
   for(const row of table.rows)assert.equal(row.length,table.headers.length);
  }
 }
 assert.equal(data.games[0].away.starter.name,'黃晙舒');assert.equal(data.games[0].home.starter.name,'Carlos Carrasco');
 assert.equal(displayKboPitcherStat(data.games[0].away,'era'),'5.48');assert.equal(displayKboPitcherStat(data.games[0].home,'whip'),'0.96');
});
test('inconsistent season totals retain source evidence but are excluded from headline stats',()=>{
 const flagged=data.games.flatMap(g=>[g.away,g.home]).filter(s=>s.starter.quality==='needs_review');
 assert.deepEqual(flagged.map(s=>s.starter.name),['김태균','朴信止']);
 for(const side of flagged){assert.equal(displayKboPitcherStat(side,'era'),'—');assert.equal(displayKboPitcherStat(side,'whip'),'—');assert.ok(side.starter.warnings.length);assert.ok(side.starter.season.era);}
});
test('source appearances keep empty pitcher decisions from shifting innings and pitch counts',()=>{
 const first=data.games[0].away.starter.recent.rows[0];
 assert.deepEqual(first.slice(0,6),['2026-09-11','恐龍','9-7','','89','4.0']);
});
test('matching fixtures are enriched once and keep the current schedule identity',()=>{
 const listed=data.games.map(g=>({...fixture(g),venue:'現在的球場'}));
 const output=mergeKboPregameFixtures(listed,data,listed);
 assert.equal(output.length,5);assert.equal(output[0].id,listed[0].id);assert.equal(output[0].venue,'現在的球場');
 assert.equal(output[0].pregame.id,data.games[0].id);assert.equal(output[0].starters.home,'Carlos Carrasco');
 assert.equal(mergeKboPregameFixtures(output,data,listed).length,5);
 assert.equal(mergeKboPregameFixtures([],data).length,5);
});
test('cancellations and time changes in the current schedule cannot be resurrected by a snapshot',()=>{
 const single={...data,games:[data.games[0]]},cancelled=fixture(single.games[0]);
 assert.deepEqual(mergeKboPregameFixtures([],single,[cancelled]),[]);
 const changed=fixture(single.games[0],'2026-09-20 17:00:00');
 const output=mergeKboPregameFixtures([changed],single,[changed]);
 assert.equal(output.length,1);assert.equal(output[0].pregame,undefined);
});
test('old pitcher data is never attached to another date, home-away pairing or new announced starter',()=>{
 const one={...data,games:[data.games[0]]},next=fixture(one.games[0],'2026-09-21 13:00:00');
 const output=mergeKboPregameFixtures([next],one,[next]);
 assert.equal(output.find(g=>g.id===next.id).pregame,undefined);
 const changed={...fixture(one.games[0]),starters:{away:'新公告先發'}};
 assert.equal(mergeKboPregameFixtures([changed],one,[changed])[0].pregame,undefined);
 assert.equal(mergeKboPregameFixtures([],{...one,season:2027}).length,0);
 assert.equal(mergeKboPregameFixtures([],{...one,league:'CPBL'}).length,0);
});
