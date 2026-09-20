import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {applyKboPitcherReview}=await import(moduleUrl('lib/kbo-reviewed-pitcher.ts'));
const {buildRunAnalysis}=await import(moduleUrl('lib/baseball-run-analysis.ts'));
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const snapshot=json('data/kbo-pregame-20260920.json'),audit=json('data/kbo-pitcher-review-20260920.json');
const outs=v=>{const [ip,o=0]=v.split('.').map(Number);return ip*3+o;};

test('both reviewed imports reconcile to independent dated outings and original season ERA/WHIP',()=>{
 const input=structuredClone(snapshot),before=JSON.stringify(input),out=applyKboPitcherReview(input);
 assert.equal(JSON.stringify(input),before);
 for(const r of audit.reviews){
  const g=out.games.find(g=>g.id===r.fixtureId),p=g[r.side].starter;
  assert.equal(p.quality,'source_reported');assert.deepEqual(p.warnings,[]);
  assert.equal(p.review.reviewedAt,r.reviewedAt);assert.deepEqual(p.season,r.originalSeason);
  assert.equal(g.source.observedAt,snapshot.games.find(original=>original.id===r.fixtureId).source.observedAt);
  const rows=p.recent.rows,headers=p.recent.headers,value=(row,h)=>row[headers.indexOf(h)];
  const sum=h=>rows.reduce((n,row)=>n+Number(value(row,h)),0);
  const ip=rows.reduce((n,row)=>n+outs(value(row,'投球局')),0)/3;
  assert.equal(ip,outs(p.season.innings)/3);
  assert.equal((sum('責失')/ip*9).toFixed(2),p.season.era);
  assert.equal(((sum('安打')+sum('保送'))/ip).toFixed(2),p.season.whip);
  assert.equal(String(sum('保送')),p.season.walks);assert.equal(String(sum('三振')),p.season.strikeouts);
  assert.equal(rows.length,r.verifiedAppearances.length);
  for(const row of rows){
   const verified=r.verifiedAppearances.find(a=>a.date===value(row,'日期'));assert.ok(verified&&verified.date<g.date);
   for(const [column,key] of [['投球局','innings'],['安打','hits'],['保送','walks'],['失分','runs'],['責失','earnedRuns'],['三振','strikeouts']])assert.equal(value(row,column),String(verified[key]));
  }
 }
 assert.deepEqual(applyKboPitcherReview(out),out,'idempotent');
 assert.equal(out.games[0],input.games[0],'other starters untouched');
});

test('review cannot overwrite another date, player, season, table or extra warning',()=>{
 for(const change of [d=>d.date='2026-09-21',d=>d.league='NPB',d=>d.games[1].home.starter.name='new starter',d=>d.games[1].home.starter.season.era='19.64',d=>d.games[1].home.starter.recent.rows[0][5]='2.0',d=>d.games[1].home.starter.warnings.push('other conflict')]){
  const d=structuredClone(snapshot);change(d);assert.deepEqual(applyKboPitcherReview(d).games[1],d.games[1]);
 }
});

test('later review never becomes a pregame-known correction or a retrospective forecast',()=>{
 const out=applyKboPitcherReview(snapshot);
 for(const r of audit.reviews){
  const g=out.games.find(g=>g.id===r.fixtureId);
  const earlier=buildRunAnalysis(g,Date.parse('2026-09-20T04:00:00Z'),'KBO');
  assert.equal(earlier.status,'waiting_data');assert.match(earlier.reason,/尚未完成資料核對/);
  const after=buildRunAnalysis(g,Date.parse(r.reviewedAt)+1000,'KBO');assert.equal(after.status,'started');assert.equal(after.grids,null);
 }
});
