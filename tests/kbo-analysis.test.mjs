import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {buildRunAnalysis,matchingRunAnalysis,analysisFixtureKey,marketOutcomes,suggestedPicks,scoreDistribution}=await import(moduleUrl('lib/baseball-run-analysis.ts'));
const {supplementKboTeamRuns}=await import(moduleUrl('lib/kbo-team-runs.ts'));
const {currentPregame}=await import(moduleUrl('lib/international-current-pregame.ts'));
const {scoreGrid}=await import(moduleUrl('lib/markets.ts'));
const {BOARD_MARKETS}=await import(moduleUrl('lib/board-markets.ts'));
const {parseHrGameDetail}=await import(moduleUrl('lib/hr9988.ts'));
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const snapshot=json('data/kbo-pregame-20260920.json'),history=json('data/international-profile-2026.json').games.KBO;
const now=Date.parse('2026-09-20T04:00:00Z');
const fresh=()=>structuredClone(snapshot);
const withoutSummary=()=>{const d=fresh();for(const g of d.games){delete g.comparison;delete g.comparisonSource;delete g.rules;}return d;};
const card=g=>({id:g.id,home:g.home.team,away:g.away.team,start:g.start,live:false,starters:{home:g.home.starter.name,away:g.away.starter.name}});
const quotes=()=>parseHrGameDetail(json('tests/fixtures/hr9988-game-detail.json'),new Date(now).toISOString()).games[0].displayMarkets;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('KBO completed history produces exact team rates without duplicates or same-day leakage',()=>{
 const input=withoutSummary(),before=JSON.stringify(input),result=supplementKboTeamRuns(input,history,now),g=result.games[0];
 assert.equal(JSON.stringify(input),before);
 assert.equal(g.comparisonSource.observedAt,history.fetchedAt);
 assert.equal(g.comparisonSource.games,648);
 const away=g.comparison.rows[0],hi=g.comparison.headers;
 near(Number(away[hi.indexOf('得/失分')].split('/')[0]),Number((751/129).toFixed(6)));
 assert.equal(away[hi.indexOf('勝敗')].split('-').reduce((a,b)=>a+Number(b),0),129);
 const amended=structuredClone(history);
 amended.games.push(structuredClone(history.games[0]));
 const template=amended.games.find(x=>x.completed);
 amended.games.push({...template,id:90000001,date:'2026-09-20',start:'2026-09-20T00:00:00Z',homeScore:99,awayScore:0});
 amended.games.push({...template,id:90000002,date:'2026-09-21',homeScore:99,awayScore:0});
 assert.deepEqual(supplementKboTeamRuns(input,amended,now).games[0].comparison,g.comparison);
 const conflict=structuredClone(history);conflict.games.push({...history.games[0],homeScore:99});
 assert.deepEqual(supplementKboTeamRuns(input,conflict,now),input);
});

test('partial, future, stale, wrong-season history and doubleheaders cannot authorize a KBO estimate',()=>{
 for(const mutate of [h=>h.fetchedAt='2026-09-20T04:01:00Z',h=>h.fetchedAt='2026-09-17T00:00:00Z',h=>h.warnings.push('missing month')]){
  const h=structuredClone(history);mutate(h);const d=withoutSummary();assert.deepEqual(supplementKboTeamRuns(d,h,now),d);
 }
 const h=structuredClone(history),g=withoutSummary().games[0],fixture=h.games.find(x=>x.date===g.date&&x.awayId===8&&x.homeId===2);
 h.games.push({...fixture,id:99999998,start:'2026-09-20T10:00:00Z'});
 const out=supplementKboTeamRuns(withoutSummary(),h,now);
 assert.equal(out.games[0].rules,undefined);
 assert.equal(buildRunAnalysis(out.games[0],now,'KBO').status,'waiting_data');
 const wrong=fresh();wrong.season=2027;assert.deepEqual(supplementKboTeamRuns(wrong,history,now),wrong);
});

test('three verified snapshots compute; the two flagged starters remain blocked',()=>{
 const states=snapshot.games.map(g=>buildRunAnalysis(g,now,'KBO'));
 assert.deepEqual(states.map(r=>r.status),['ready','waiting_data','ready','waiting_data','ready']);
 for(const r of states.filter(r=>r.status==='ready')){
  near(r.win.away+r.win.home+r.win.draw,1);assert.ok(r.win.draw>0&&r.win.draw<.15);
  for(const grid of Object.values(r.grids)){near(grid.reduce((n,o)=>n+o.p,0),1);assert.ok(grid.every(o=>Number.isFinite(o.p)&&o.p>=0));}
  assert.ok(Object.values(r.inputs).every(i=>i.bullpenMode==='reported'));
 }
 const g=fresh().games[0],before=buildRunAnalysis(g,now,'KBO');g.home.starter.season.era='9.00';
 assert.ok(buildRunAnalysis(g,now,'KBO').win.away>before.win.away,'updated measured starter stats change the prediction');
});

test('11-inning draw probability has exactly two extra frames, not NPB three or CPBL automatic runners',()=>{
 const rate=.5,draw=grid=>grid.reduce((n,o)=>n+(o.away===o.home?o.p:0),0);
 const nine=scoreDistribution(Array(9).fill(rate),Array(9).fill(rate));
 const eleven=scoreDistribution(Array(11).fill(rate),Array(11).fill(rate));
 const twelve=scoreDistribution(Array(12).fill(rate),Array(12).fill(rate));
 near(draw(eleven),draw(nine)*draw(scoreGrid(rate,rate,false))**2);
 assert.ok(draw(eleven)>draw(twelve));near(eleven.reduce((n,o)=>n+o.p,0),1);
 assert.deepEqual(scoreDistribution(Array(11).fill(rate),Array(12).fill(rate)),[]);
});

test('all seven KBO markets conserve mass, refund ties, and use KBO quote identities',()=>{
 const g=fresh().games[0],r=buildRunAnalysis(g,now,'KBO'),game={...card(g),displayMarkets:quotes()};
 for(const {key} of BOARD_MARKETS){const rows=marketOutcomes(game,key,r,true,'KBO');assert.equal(rows.length,2,key);
  for(const {result:s,pick} of rows){near(s.win+s.partialWin+s.partialLoss+s.loss+s.push,1);assert.ok(pick.key.startsWith('KBO:'));}
  near(rows[0].result.win,rows[1].result.loss);near(rows[0].result.partialWin,rows[1].result.partialLoss);near(rows[0].result.push,rows[1].result.push);
 }
 near(marketOutcomes(game,'moneyline',r,true,'KBO')[0].result.push,r.win.draw);
 const q=game.displayMarkets.find(m=>m.period==='full'&&m.type===103).quotes[0];q.homeLine='1-35';q.awayLine='';
 const one=r.grids.full.filter(o=>o.home-o.away===1).reduce((n,o)=>n+o.p,0);
 near(marketOutcomes(game,'spread',r,true,'KBO')[0].result.partialLoss,one);
 q.homeLine='1/1.5';near(marketOutcomes(game,'spread',r,true,'KBO')[0].result.partialLoss,one);
 assert.deepEqual(marketOutcomes(game,'spread',r,true,'NPB'),[]);
 assert.deepEqual(marketOutcomes(game,'spread',r,false,'KBO'),[]);
 q.open=false;assert.deepEqual(marketOutcomes(game,'spread',r,true,'KBO'),[]);
});

test('stale fields, missing bullpen, changed starters, live games and ambiguous fixtures stop calculation',()=>{
 for(const mutate of [g=>g.home.bullpen=null,g=>g.comparison=null,g=>g.away.starter.season.era='NaN',g=>g.comparisonSource.observedAt='2026-09-17T00:00:00Z',g=>g.rules.maxInnings=12,g=>g.league='NPB']){
  const g=fresh().games[0];mutate(g);const r=buildRunAnalysis(g,now,'KBO');assert.equal(r.status,'waiting_data');assert.equal(r.grids,null);
 }
 const g=fresh().games[0],r=buildRunAnalysis(g,now,'KBO'),reports=new Map([[analysisFixtureKey(r.fixture,'KBO'),r]]),game=card(g);
 assert.equal(matchingRunAnalysis({...game,starters:{...game.starters,home:'其他投手'}},reports,now,'KBO').win,null);
 assert.equal(matchingRunAnalysis({...game,live:true},reports,now,'KBO').status,'started');
 assert.equal(matchingRunAnalysis({...game,start:'2026-09-21 13:00:00'},reports,now,'KBO'),null);
 assert.equal(buildRunAnalysis(g,Date.parse('2026-09-20T05:00:00Z'),'KBO').status,'started');
 assert.deepEqual(suggestedPicks([{...game,displayMarkets:quotes()}],reports,now,false,false,'KBO'),[]);
 const games=snapshot.games.map(g=>{const report=buildRunAnalysis(g,now,'KBO');reports.set(analysisFixtureKey(report.fixture,'KBO'),report);return {...card(g),displayMarkets:quotes()};});
 const picks=suggestedPicks(games,reports,now,true,false,'KBO');assert.ok(picks.length>0&&picks.length<=3);assert.equal(picks.length,new Set(picks.map(p=>p.event)).size);
});

test('fresh live refresh preserves older comparison provenance and does not relabel it as current',()=>{
 const g=snapshot.games[0],live={league:'KBO',date:g.date,id:'fresh',status:'pregame',startTime:'2026-09-20T05:00:00Z',source:{provider:'naver',url:'https://m.sports.naver.com/',fetchedAt:new Date(now).toISOString()},away:{id:'HH',name:g.away.team},home:{id:'LG',name:g.home.team},starters:{away:{name:g.away.starter.name},home:{name:g.home.starter.name}}};
 const refreshed=currentPregame('KBO',g.date,{games:[live]},[snapshot]).games.find(x=>x.id===g.id);
 assert.equal(refreshed.comparisonSource.observedAt,history.fetchedAt);
 assert.deepEqual(refreshed.rules,g.rules);assert.deepEqual(refreshed.comparison,g.comparison);
});
