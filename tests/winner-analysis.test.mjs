import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {winnerAnalysis}=await import(moduleUrl('lib/winner-analysis.ts'));
const {multifactorWin,WIN_FACTOR_WEIGHTS}=await import(moduleUrl('lib/multifactor-win.ts'));
const {doubleheaderLabel}=await import(moduleUrl('lib/baseball.ts'));
const now=Date.parse('2026-09-22T18:31:00Z');
const team=(id,era)=>({id,name:`Team ${id}`,wins:76,losses:70,pitcherId:id+100,pitcherName:`Pitcher ${id}`,pitcherEra:era,pitcherWhip:1.2});
const game=()=>({id:1,date:'2026-09-22T22:40:00Z',season:2026,gameType:'R',state:'Preview',status:'Scheduled',startTimeTBD:false,home:team(1,3),away:team(2,4)});
function report(g=game()){
 const features={};for(const side of ['home','away'])Object.assign(features,{[side+'_starter_recent_era']:4,[side+'_lineup_wrc_plus']:100,[side+'_bullpen_last3_pitches']:100,[side+'_bullpen_back_to_back']:2});
 return {game:structuredClone(g),capturedAt:new Date(now).toISOString(),features,issues:[],context:{sides:{home:{lineupStatus:'confirmed'},away:{lineupStatus:'confirmed'}}}};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('fresh basic inputs produce a preliminary estimate without pretending a report exists',()=>{
 const g=game(),m=winnerAnalysis(g,undefined,now,true);
 assert.equal(m.status,'preliminary');assert.equal(m.canEstimate,true);assert.equal(m.canRecommend,false);assert.equal(m.ready,false);assert.equal(m.favoredSide,'home');
 near(m.homeWin,multifactorWin(g,undefined,now).homeWin);near(m.coverage,45+40/3);assert.match(m.reason,/分項分析取得中/);
 assert.ok(m.missing.includes('九棒對左右投 wRC+'));
});
test('unconfirmed lineups show initial analysis even with 80% coverage, not automatic recommendations',()=>{
 const g=game(),r=report(g);r.context.sides.home.lineupStatus='expected';
 const m=winnerAnalysis(g,r,now,true);near(m.coverage,80);assert.equal(m.canEstimate,true);assert.equal(m.status,'preliminary');assert.equal(m.canRecommend,false);assert.match(m.reason,/九棒打線尚未確認/);
 assert.equal(m.factors.find(f=>f.name==='九棒對左右投 wRC+').score,null);
});
test('confirmed lineups with insufficient split coverage remain explicit preliminary estimates',()=>{
 const g=game(),r=report(g);r.features.home_lineup_wrc_plus=null;r.features.home_starter_recent_era=null;
 const m=winnerAnalysis(g,r,now,true);assert.equal(m.status,'preliminary');assert.equal(m.canEstimate,true);assert.equal(m.canRecommend,false);assert.match(m.reason,/80%/);
 assert.ok(m.missing.includes('先發近期 ERA'));assert.ok(m.missing.includes('九棒對左右投 wRC+'));
});
test('completed current inputs promote the same model to automatic recommendation eligibility',()=>{
 const g=game(),r=report(g),m=winnerAnalysis(g,r,now,true);
 assert.equal(m.status,'ready');assert.equal(m.canRecommend,true);assert.equal(m.favoredSide,'home');near(m.homeWin,multifactorWin(g,r,now).homeWin);
});
test('equal teams are estimable but do not get a fabricated favored side',()=>{
 const g=game();g.home.pitcherEra=4;const m=winnerAnalysis(g,report(g),now,true);
 assert.equal(m.status,'ready');assert.equal(m.homeWin,.5);assert.equal(m.canEstimate,true);assert.equal(m.canRecommend,false);assert.equal(m.favoredSide,null);
});
test('the 60% starter weight budget and missing-factor neutral treatment are unchanged',()=>{
 near(WIN_FACTOR_WEIGHTS.starterEra+WIN_FACTOR_WEIGHTS.starterWhip+WIN_FACTOR_WEIGHTS.starterRecentEra,60);
 const g=game(),r=report(g);r.context.sides.away.lineupStatus='unknown';
 const original=multifactorWin(g,r,now),m=winnerAnalysis(g,r,now,true);assert.deepEqual(m.factors,original.factors);near(m.homeWin,original.homeWin);
 for(const f of m.factors.filter(f=>f.score===null))assert.equal(f.contribution,0);
});
test('missing or invalid starter IDs, ERA, WHIP and records never generate usable probabilities',()=>{
 for(const change of [g=>g.home.pitcherId=null,g=>g.away.pitcherId=-1,g=>g.home.pitcherEra=null,g=>g.away.pitcherWhip=undefined,g=>g.away.pitcherWhip=NaN,g=>g.home.pitcherEra=Infinity,g=>g.home.pitcherWhip=-.1,g=>{g.home.wins=1;g.home.losses=1;}]){
  const g=game();change(g);const m=winnerAnalysis(g,undefined,now,true);assert.equal(m.status,'blocked');assert.equal(m.homeWin,null);assert.equal(m.canEstimate,false);assert.equal(m.canRecommend,false);assert.ok(m.reason);
 }
});
test('a genuine zero ERA or WHIP is not treated as missing',()=>{
 const g=game();g.home.pitcherEra=0;g.home.pitcherWhip=0;assert.equal(winnerAnalysis(g,undefined,now,true).canEstimate,true);
});
test('stale schedules and reports block header and card estimates, not just the recommendation badge',()=>{
 const g=game(),r=report(g);r.capturedAt=new Date(now-300001).toISOString();
 for(const m of [winnerAnalysis(g,report(g),now,false),winnerAnalysis(g,r,now,true)]){assert.equal(m.status,'blocked');assert.equal(m.homeWin,null);assert.equal(m.canEstimate,false);assert.equal(m.ready,false)}
});
test('reports from the future, other fixtures, dates, seasons, teams or starters cannot leak into this game',()=>{
 for(const change of [r=>r.capturedAt=new Date(now+60001).toISOString(),r=>r.game.id++,r=>r.game.date='2026-09-23T22:40:00Z',r=>r.game.season--,r=>r.game.home.id++,r=>r.game.away.pitcherId++]){
  const g=game(),r=report(g);change(r);const m=winnerAnalysis(g,r,now,true);assert.equal(m.status,'blocked');assert.equal(m.homeWin,null);assert.equal(m.canRecommend,false);
 }
});
test('player conflicts block all displayed estimates; a discarded secondary lineup does not impersonate official data',()=>{
 const g=game(),r=report(g);r.issues=['傷兵衝突'];assert.equal(winnerAnalysis(g,r,now,true).homeWin,null);
 r.issues=['先發投手來源不一致'];assert.equal(winnerAnalysis(g,r,now,true).status,'blocked');
 r.issues=['打線來源先發與 MLB 官方不同，該打線尚未採用'];r.context.lineupResolution={secondaryLineupExcluded:true};const m=winnerAnalysis(g,r,now,true);
 assert.equal(m.status,'preliminary');assert.equal(m.canRecommend,false);assert.equal(m.factors.find(f=>f.name==='九棒對左右投 wRC+').score,null);
});
test('live, final, cancelled, postponed, TBD and already-started fixtures do not retain pregame estimates',()=>{
 for(const change of [g=>g.state='Live',g=>g.state='Final',g=>g.status='Cancelled',g=>g.status='Postponed',g=>g.startTimeTBD=true,g=>g.date=new Date(now).toISOString()]){
  const g=game();change(g);const m=winnerAnalysis(g,undefined,now,true);assert.equal(m.status,'blocked');assert.equal(m.homeWin,null);
 }
});
test('G1/G2 keep independent identities and reject a report from the other game',()=>{
 const first={...game(),doubleHeader:'Y',gameNumber:1};const second={...game(),id:2,doubleHeader:'Y',gameNumber:2};
 assert.equal(doubleheaderLabel(first),'G1');assert.equal(doubleheaderLabel(second),'G2');
 assert.equal(winnerAnalysis(second,report(first),now,true).status,'blocked');assert.equal(winnerAnalysis(second,report(second),now,true).status,'ready');
});
test('the page separates estimate rendering, manual quotes, automatic eligibility and complete-data parlay calculation',()=>{
 const source=readFileSync('app/pregame.tsx','utf8');
 assert.match(source,/winnerAnalysis\(g,analysis\[g\.id\]\?\.report,now,scheduleOK\)/);
 assert.match(source,/eligible=selectedGames\.filter\(g=>!unavailable\(g\)&&model\(g\)\.canRecommend\)/);
 assert.match(source,/r=!reason&&state\.canEstimate&&probability!==null\?binaryOutcome\(probability\):null/);
 assert.match(source,/state\.canRecommend\?'分析推薦':'初步傾向'/);
 assert.match(source,/disabled=\{!!reason\}/);
 assert.match(source,/allValid=chosen\.length===count&&chosen\.every\(x=>x\.g&&!unavailable\(x\.g\)&&!analysisUnavailable\(x\.g\)&&x\.leg\.quote===moneyline\(x\.g\)\?\.signature\)/);
 assert.ok(source.includes('const gameLabel=doubleheaderLabel(g)'));
 assert.ok(source.includes('同一隊只可出現在一個關卡'));
 assert.ok(!source.includes('可手動選擇；分析資料未齊'));
});
