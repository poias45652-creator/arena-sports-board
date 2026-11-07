import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleUrl} from './profile-loader.mjs';
const {footballPlayerRole}=await import(moduleUrl('lib/football-player-role.ts'));
const {tiltFootballGrid,shotTilts,recentShotEstimate,domesticLeagues}=await import(moduleUrl('lib/football-five-league.ts'));
const {footballDistribution}=await import(moduleUrl('lib/football.ts'));
const {withFootballMatchContext}=await import(moduleUrl('lib/football-match-context.ts'));
const {domesticFootballRecord}=await import(moduleUrl('lib/football-ledger.ts'));
const now=Date.parse('2026-11-07T09:00:00Z'),start=new Date(now+7200000).toISOString();
const grid=footballDistribution(2,1);
const base={version:'score-model',status:'ready',expected:{home:2,away:1},notes:[],...grid};
const game={id:'fixture',home:{id:'A'},away:{id:'B'},league:'ita.1',state:'scheduled',start,timeConfirmed:true};
const study={featuredEnabled:true,drawAlertEnabled:true,drawThreshold:.32,applyShots:true};
test('五聯賽以同一個比分分布計算所有玩法，跨聯賽、當日或缺漏的 xG 不計',()=>{
 assert.equal(domesticLeagues.length,5);
 const result=tiltFootballGrid(grid.scoreDistribution,.01,shotTilts(base.expected,{home:2.8,away:.9}));
 assert.ok(result.probabilities.home>grid.probabilities.home);
 assert.ok(Math.abs(result.probabilities.home+result.probabilities.away+result.probabilities.draw-1)<1e-12);
 assert.ok(Math.abs(result.scoreDistribution.scores.filter(s=>s.home+s.away>=3).reduce((a,b)=>a+b.probability,0)-result.probabilities.over25)<1e-12);
 const dates=Array.from({length:120},(_,i)=>({...game,league:'eng.1',homeId:'A',awayId:'B',start:new Date(now-(i+1)*86400000).toISOString(),homeXg:2,awayXg:1}));
 assert.equal(recentShotEstimate(dates,'ita.1','A','B',now),null);
 assert.equal(recentShotEstimate(dates.map(g=>({...g,start:new Date(now).toISOString()})),'eng.1','A','B',now),null);
 assert.ok(recentShotEstimate(dates,'eng.1','A','B',now));
});
test('只計同人同隊同聯賽的歷史名單，以先發及分鐘辨識輪替',()=>{
 const matches=[90,75,8,0].map((minutes,i)=>({id:i,teamId:2,leagueId:55,matchDate:{utcTime:new Date(now-(i+1)*86400000).toISOString()},homeScore:1,awayScore:0,minutesPlayed:minutes,onBench:!minutes,playedInMatch:minutes>0,lineupPositionId:i<2?35:null}));
 const profile={id:1,primaryTeam:{teamId:2},recentMatches:[...matches,matches[0],{...matches[0],id:10,leagueId:42},{...matches[0],id:11,teamId:3},{...matches[0],id:12,matchDate:{utcTime:start}}]};
 assert.deepEqual(footballPlayerRole(profile,1,2,55,now),{games:4,starts:2,minutes:173,lastMatch:matches[0].matchDate.utcTime});
 assert.equal(footballPlayerRole(profile,1,3,55,now),undefined);
});
test('分鐘不足時保留傷員名單，賽後不能倒補精選',()=>{
 const absences={method:'minutes',checkedAt:new Date(now).toISOString(),source:'source',home:[{name:'A',weight:0}],away:[]};
 const a=withFootballMatchContext(game,base,[],absences,now,{study,shots:null});
 assert.equal(a.domesticForecast.featured,Math.max(grid.probabilities.home,grid.probabilities.draw,grid.probabilities.away)>=.6);
 assert.equal(a.contextForecast.injuryShiftApplied,false);assert.equal(a.domesticForecast.shotApplied,false);
 assert.equal(withFootballMatchContext({...game,state:'final'},base,[],absences,now,{study,shots:null}),base);
});
test('實績只採用實際保存的賽前分類，缺失比分與賽後快照不計',async()=>{
 const a=withFootballMatchContext(game,base,[],null,now,{study,shots:null});
 const r={payload:JSON.stringify({analysis:a}),captured_at:a.capturedAt,version:a.version,start_time:start,home_goals:1,away_goals:0};
 const db={prepare:()=>({bind:()=>({all:async()=>({results:[r,{...r,home_goals:null},{...r,captured_at:start}]})})})};
 const v=await domesticFootballRecord(db,'ita.1');assert.equal(v.all,1);assert.equal(v.hits,1);assert.equal(v.featured,Number(a.domesticForecast.featured));
});
test('年度和局門檻只用對應年份與射門來源；停用的備援無提示',async()=>{
 const {drawRiskThreshold}=await import(moduleUrl('lib/football-five-league.ts'));
 const study={drawPolicy:'annual',drawAlertEnabled:true,drawThreshold:.4,annualThresholds:{2026:.27},annualWithoutShotsThresholds:{2026:.30}};
 assert.equal(drawRiskThreshold(study,start,true),.27);assert.equal(drawRiskThreshold(study,start,false),.30);
 assert.equal(drawRiskThreshold(study,'2027-01-01',true),undefined);assert.equal(drawRiskThreshold({...study,drawAlertEnabled:false},start,true),undefined);
});
test('傷停對照使用含 xG 的同場快照，缺角色不列為完整樣本',async()=>{
 const baseAnalysis=withFootballMatchContext(game,base,[],null,now,{study,shots:null});
 const probs=baseAnalysis.probabilities,before={...probs,home:.2,draw:.25,away:.55};
 const absences={method:'minutes',home:[],away:[{role:{games:4,starts:4,minutes:340}}],checkedAt:new Date(now).toISOString()};
 const a={...baseAnalysis,contextForecast:{...baseAnalysis.contextForecast,injuryCoverage:'both',injuryShiftApplied:true},domesticForecast:{...baseAnalysis.domesticForecast,afterShots:before},matchEvidence:{absences}};
 function row(a){return {payload:JSON.stringify({analysis:a}),captured_at:a.capturedAt,version:a.version,start_time:start,home_goals:1,away_goals:0};}
 const db={prepare:()=>({bind:()=>({all:async()=>({results:[row(a),row({...a,matchEvidence:{absences:{...absences,away:[{}]}}})]})})})};
 const {injury}=await domesticFootballRecord(db,'ita.1');assert.equal(injury.corrected,1);assert.equal(injury.paired,1);assert.equal(injury.missingRole,1);
});
test('不確定球員的重要性足以改變方向時，候選不偏向任何一隊',async()=>{
 const {boundedInjuryShift}=await import(moduleUrl('lib/football-five-league.ts'));
 const player={weight:1,role:{games:8,starts:8,minutes:720}};
 assert.equal(boundedInjuryShift({method:'minutes',home:[{}],away:[player]}),0);
 assert.equal(boundedInjuryShift({method:'minutes',home:[{}],away:[player,player]}),.075/4);
 assert.equal(boundedInjuryShift({method:'minutes',home:null,away:[player]}),undefined);
});
test('德西法傷停對照有相同開球時間時仍必須符合球團身分',async()=>{
 const {sameInjuryTeam}=await import(moduleUrl('lib/football-match-context.ts'));
 const club={id:'3307',name:'帕德博恩',englishName:'SC Paderborn 07'};
 assert.equal(sameInjuryTeam('ger.1',club,{id:8460,name:'Paderborn'}),true);
 assert.equal(sameInjuryTeam('ger.1',{...club,id:'2950'},{id:8460,name:'Paderborn'}),false);
 assert.equal(sameInjuryTeam('fra.1',club,{id:8460,name:'Paderborn'}),false);
});
