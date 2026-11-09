import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot} from '../server/regional-basketball/archive.mjs';
import {analyzeGame, fixtureKey, verifiedGameBox} from '../public/regional-basketball/model.mjs';
import {nblPhase} from '../public/regional-basketball/nbl-phase.mjs';
import {analysis} from '../public/regional-basketball/analysis-ui.js';

test('Blitz is preseason in both official calendar and match detail, while the Ignite Cup remains competitive',()=>{
  assert.equal(nblPhase('in_season','Blitz'),1);
  assert.equal(nblPhase('in_season','Ignite Cup'),4);
  assert.equal(nblPhase('regular','Ignite Cup'),4);
  assert.equal(nblPhase('regular','8'),2);
  assert.equal(nblPhase('regular',null),2);
  assert.equal(nblPhase('finals','Playoffs'),3);
});

test('11 November Hawks at Phoenix renders genuine pre-tip numbers from complete competitive games',async t=>{
  const [catalog,fallback,teams,detail,boxes]=await Promise.all(
    ['leagues','nbl-fallback','nbl-team-games','nbl-detail-index','nbl-boxes'].map(n=>snapshot('/data/'+n+'.json')));
  const league='NBL',info=catalog[league],date='2026-11-11';
  const games=new Map();
  for(const row of [...info.games,...Object.values(fallback.feeds).flatMap(f=>f.games),
    ...teams.filter(g=>g.season===2027),...Object.values(detail)]){
    const k=fixtureKey(row);
    if(games.get(k)?.status==='final'&&row.status!=='final')continue;
    games.set(k,{...games.get(k),...row});
  }
  const all=[...games.values()],game=all.find(g=>g.date===date&&g.home==='SEM'&&g.away==='ILL');
  const blitz=all.filter(g=>g.round==='Blitz'&&[g.home,g.away].some(t=>['ILL','SEM'].includes(t)));
  assert.equal(blitz.length,4);
  assert.ok(blitz.every(g=>g.phase===1));
  const final=all.find(g=>g.date==='2026-11-08'&&g.home==='SYD'&&g.away==='SEM');
  const box=boxes.find(b=>fixtureKey(b)===fixtureKey(final));
  assert.deepEqual([final.homeScore,final.awayScore],[110,99]);
  assert.ok(verifiedGameBox(final,box));
  assert.equal(verifiedGameBox(final,{...box,time:'12:01'}),null);
  const incomplete={...box,homeStats:{...box.homeStats,turnovers:null}};
  assert.equal(verifiedGameBox(final,incomplete),null);
  const asOf=Date.parse('2026-11-09T11:00:00Z');
  t.mock.method(Date,'now',()=>asOf);
  const args={game:{...game,league},games:all,boxes,asOf};
  assert.equal(analyzeGame({...args,boxes:boxes.map(b=>b===box?incomplete:b)}).ready,false);
  const report=analyzeGame(args);
  assert.ok(report.ready,report.reason);
  assert.deepEqual([report.awayMetrics.games,report.homeMetrics.games],[13,11]);
  const prev=globalThis.document;
  globalThis.document={body:{dataset:{viewer:'true'}}};
  t.after(()=>{if(prev)globalThis.document=prev;else delete globalThis.document;});
  const html=analysis({league,info,all,boxes,teamGames:teams,context:{injuries:[]},visible:[game],
    games:[game],saved:{},projections:new Map(),version:1,date,isLive:true});
  assert.match(html,/預估比分<small>客：主<\/small><\/span><b>95<i>:<\/i>104/);
  assert.doesNotMatch(html,/延長賽資料尚未齊全/);
});
