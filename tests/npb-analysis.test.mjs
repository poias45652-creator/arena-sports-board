import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {buildNpbAnalysis,matchingNpbAnalysis,npbFixtureKey,npbMarketOutcomes,npbSuggestedPicks}=await import(moduleUrl('lib/npb-analysis.ts'));
const {BOARD_MARKETS}=await import(moduleUrl('lib/board-markets.ts'));
const {parseHrGameDetail}=await import(moduleUrl('lib/hr9988.ts'));
const snapshot=JSON.parse(readFileSync('data/npb-pregame-20260920.json','utf8'));
const now=Date.parse('2026-09-20T04:00:00Z');
const fixture=()=>structuredClone(snapshot.games[3]);
const card=g=>({id:g.id,home:g.home.team,away:g.away.team,start:g.start,live:false,starters:{home:g.home.starter.name,away:g.away.starter.name}});
const quotes=()=>parseHrGameDetail(JSON.parse(readFileSync('tests/fixtures/hr9988-game-detail.json','utf8')),new Date(now).toISOString()).games[0].displayMarkets;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('dated inputs generate finite full-game/first-five distributions including NPB draws',()=>{
 for(const g of snapshot.games){const r=buildNpbAnalysis(g,now);assert.equal(r.status,'ready',r.reason);
  near(r.win.away+r.win.home+r.win.draw,1);assert.ok(r.win.draw>0&&r.win.draw<.2);
  for(const grid of Object.values(r.grids)){near(grid.reduce((a,b)=>a+b.p,0),1);assert.ok(grid.every(o=>Number.isFinite(o.p)&&o.p>=0));}
  assert.ok(r.grids.firstHalf.some(o=>o.away===o.home&&o.p>0));
  assert.ok(r.expected.away>0&&r.expected.home>0);
 }
});
test('all seven markets settle opposite sides and include pushes in the 100% total',()=>{
 const g=fixture(),r=buildNpbAnalysis(g,now),game={...card(g),displayMarkets:quotes()};
 for(const {key} of BOARD_MARKETS){const rows=npbMarketOutcomes(game,key,r,true);assert.equal(rows.length,2,key);
  for(const {result:s} of rows)near(s.win+s.partialWin+s.partialLoss+s.loss+s.push,1);
  near(rows[0].result.win,rows[1].result.loss);near(rows[0].result.partialWin,rows[1].result.partialLoss);near(rows[0].result.push,rows[1].result.push);
 }
 const money=npbMarketOutcomes(game,'moneyline',r,true);near(money[0].result.push,r.win.draw);near(money[0].result.win,r.win.home);
});
test('percentage boundaries, quarter lines, full/half periods and parity are not interchanged',()=>{
 const g=fixture(),r=buildNpbAnalysis(g,now),game={...card(g),displayMarkets:quotes()};
 const spread=game.displayMarkets.find(m=>m.period==='full'&&m.type===103).quotes[0];
 spread.homeLine='1-35';spread.awayLine='';
 let rows=npbMarketOutcomes(game,'spread',r,true);
 const exactlyOne=r.grids.full.filter(o=>o.home-o.away===1).reduce((n,o)=>n+o.p,0);
 near(rows[0].result.partialLoss,exactlyOne);near(rows[1].result.partialWin,exactlyOne);
 spread.homeLine='1/1.5';rows=npbMarketOutcomes(game,'spread',r,true);near(rows[0].result.partialLoss,exactlyOne);
 const half=npbMarketOutcomes(game,'firstHalfSpread',r,true);assert.notEqual(rows[0].result.win,half[0].result.win);
 const parity=npbMarketOutcomes(game,'firstHalfOddEven',r,true);near(parity[0].result.win,r.grids.firstHalf.reduce((n,o)=>n+((o.away+o.home)%2?o.p:0),0));
});
test('bad, future, stale, wrong-league and in-play inputs do not fabricate estimates',()=>{
 for(const mutate of [g=>g.league='CPBL',g=>g.away.starter.quality='needs_review',g=>g.home.bullpen=null,g=>g.comparison=null,g=>g.away.starter.season.era='NaN',g=>g.source.observedAt='2026-09-20T10:00:00Z',g=>g.source.observedAt='2026-09-18T00:00:00Z',g=>g.away.retainedSource={...g.source,observedAt:'2026-09-17T00:00:00Z'}]){
  const g=fixture();mutate(g);const r=buildNpbAnalysis(g,now);assert.equal(r.status,'waiting_data');assert.equal(r.win,null);assert.equal(r.grids,null);
 }
 assert.equal(buildNpbAnalysis(fixture(),Date.parse('2026-09-20T09:00:00Z')).status,'started');
});
test('fixture identity, a changed pitcher and live status invalidate a previously ready report',()=>{
 const g=fixture(),r=buildNpbAnalysis(g,now),reports=new Map([[npbFixtureKey(r.fixture),r]]),game=card(g);
 assert.equal(matchingNpbAnalysis(game,reports,now).status,'ready');
 assert.equal(matchingNpbAnalysis({...game,start:'2026-09-21 17:00:00'},reports,now),null);
 assert.equal(matchingNpbAnalysis({...game,away:game.home,home:game.away},reports,now),null);
 assert.equal(matchingNpbAnalysis({...game,starters:{...game.starters,home:'不同投手'}},reports,now).win,null);
 assert.equal(matchingNpbAnalysis({...game,live:true},reports,now).status,'started');
});
test('missing/closed/ambiguous and expired quotes block results and recommendations',()=>{
 const g=fixture(),r=buildNpbAnalysis(g,now),game={...card(g),displayMarkets:quotes()},reports=new Map([[npbFixtureKey(r.fixture),r]]);
 assert.deepEqual(npbMarketOutcomes(game,'spread',r,false),[]);
 assert.deepEqual(npbSuggestedPicks([game],reports,now,false),[]);
 const market=game.displayMarkets.find(m=>m.period==='full'&&m.type===103);market.quotes[0].open=false;
 assert.deepEqual(npbMarketOutcomes(game,'spread',r,true),[]);market.quotes[0].open=true;
 game.displayMarkets.push(structuredClone(market));assert.deepEqual(npbMarketOutcomes(game,'spread',r,true),[]);
});
test('source updates change the estimate; suspicious batting rows and future outings have no effect',()=>{
 const g=fixture(),before=buildNpbAnalysis(g,now),updated=fixture();updated.home.starter.season.era='7.50';
 assert.ok(buildNpbAnalysis(updated,now).win.away>before.win.away);
 const irrelevant=fixture();irrelevant.away.batting.rows[0][4]='99';irrelevant.home.starter.recent.rows.unshift(['2026-09-21','','','','','9.0']);
 assert.deepEqual(buildNpbAnalysis(irrelevant,now).win,before.win);
});
test('parlay suggestions take at most one current market from each fixture',()=>{
 const reports=new Map(),games=snapshot.games.map(g=>{const r=buildNpbAnalysis(g,now);reports.set(npbFixtureKey(r.fixture),r);return {...card(g),displayMarkets:quotes()};});
 const picks=npbSuggestedPicks(games,reports,now,true);assert.ok(picks.length>0);assert.equal(new Set(picks.map(p=>p.event)).size,picks.length);
 assert.ok(npbSuggestedPicks(games,reports,now,true,true).every(p=>p.type==='111'));
});
