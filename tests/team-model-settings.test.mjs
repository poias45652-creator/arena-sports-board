import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleUrl} from './profile-loader.mjs';
const team=await import(moduleUrl('lib/team-model-settings.ts'));
const {aiTeamSuggestion}=await import(moduleUrl('server/ai-team-suggestions.ts'));
const {defaultBaseballSettings,baseballSettingsForGame,parseBaseballSettings,baseballSettingsSignature}=await import(moduleUrl('lib/baseball-model-settings.ts'));
const {buildAiFacts}=await import(moduleUrl('lib/ai-assistant-facts.ts'));
const {quickAiAnswer,AI_INSUFFICIENT}=await import(moduleUrl('lib/ai-assistant.ts'));
const {footballWeightedParameters}=await import(moduleUrl('lib/football-model-weights.ts'));
const {projectEfficiency}=await import(moduleUrl('lib/basketball-efficiency.ts'));
const now=Date.parse('2026-10-23T00:00:00Z'),base={model:'auto',weights:{}};
const match={id:'1',league:'eng.1',day:'2026-10-23',start:'2026-10-23T12:00:00Z',homeId:'10',awayId:'20',home:'主隊',away:'客隊'};
const football={capturedAt:new Date(now).toISOString(),probabilities:{home:.6,draw:.2,away:.2},homeForm:{games:20,scored:2.3,conceded:.8},awayForm:{games:8,scored:.9,conceded:2.1}};
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};};
const profile=(id,value,league='eng.1')=>({teamId:id,teamName:id,league,value,updatedAt:now});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('team-specific football suggestions differ with evidence, total 100, and never use identity jitter',()=>{
 const s=aiTeamSuggestion(match,football,'football');assert.equal(s.teams.length,2);assert.notDeepEqual(s.teams[0].weights,s.teams[1].weights);
 for(const t of s.teams)close(t.weights.reduce((n,w)=>n+w.value,0),100);
 const same=aiTeamSuggestion(match,{...football,awayForm:football.homeForm},'football');assert.deepEqual(same.teams[0].weights,same.teams[1].weights);
 const renamed=aiTeamSuggestion({...match,homeId:'99',home:'另一名稱'},football,'football');assert.deepEqual(renamed.teams[0].weights,s.teams[0].weights);
 const snapshot=buildAiFacts(match,football,s,'football');assert.match(quickAiAnswer(snapshot,'weights').answer,/主隊建議權重/);assert.match(quickAiAnswer(snapshot,'weights').answer,/客隊建議權重/);
});
test('missing samples or stable IDs cannot produce a fabricated recommendation',()=>{
 for(const [g,a] of [[{...match,homeId:undefined},football],[match,{...football,awayForm:{...football.awayForm,games:2}}]])assert.equal(aiTeamSuggestion(g,a,'football'),null);
 const snapshot=buildAiFacts(match,football,null,'football');assert.deepEqual(quickAiAnswer(snapshot,'weights'),{answer:AI_INSUFFICIENT});
 assert.equal(team.adaptiveTeamWeights([50,50],[null,.8]),null);
});
test('storage merges teams and rejects stale, cross-league and malformed profiles',()=>{
 const storage=memory(),s=aiTeamSuggestion(match,football,'football');
 team.saveTeamWeightProfiles(storage,'eng.1',s.teams.map(t=>profile(t.teamId,t.value)),now);
 team.saveTeamWeightProfiles(storage,'eng.1',[profile('30',s.teams[0].value)],now+1000);
 const raw=storage.getItem(team.teamWeightStorageKey('eng.1')),book=team.readTeamWeightBook(raw,'eng.1',now+1000);assert.deepEqual(Object.keys(book).sort(),['10','20','30']);
 assert.deepEqual(team.readTeamWeightBook(raw,'esp.1',now+1000),{});assert.deepEqual(team.readTeamWeightBook(raw,'eng.1',now+8*86400000),{});assert.deepEqual(team.readTeamWeightBook('{bad','eng.1',now),{});
 assert.throws(()=>team.saveTeamWeightProfiles(storage,'eng.1',[profile('__proto__',base)],now));
});
test('a match combines only its teams and the resolved football weights affect actual parameters',()=>{
 const s=aiTeamSuggestion(match,football,'football'),book=Object.fromEntries(s.teams.map(t=>[t.teamId,profile(t.teamId,t.value)]));
 const resolved=team.footballTeamSettings(base,book,'10','20'),family=Object.keys(resolved.weights)[0];
 resolved.weights[family].forEach((v,i)=>close(v,(s.teams[0].value.weights[family][i]+s.teams[1].value.weights[family][i])/2));
 assert.deepEqual(team.footballTeamSettings(base,book,'30','40'),base);
 assert.notDeepEqual(footballWeightedParameters({attack:1,defense:1,xga:1,xgd:1,elo:1},resolved,family,['attack','defense','xga','xgd','elo']),{attack:1,defense:1,xga:1,xgd:1,elo:1});
});
test('post-kickoff profile changes retain the settings actually used before kickoff',()=>{
 const storage=memory(),fixture={id:match.id,start:match.start,homeId:'10',awayId:'20'},s=aiTeamSuggestion(match,football,'football'),book={10:profile('10',s.teams[0].value)};
 const pregame=team.footballFixtureSettings(storage,'eng.1',fixture,base,book,now);
 const later=team.footballFixtureSettings(storage,'eng.1',fixture,base,{20:profile('20',s.teams[1].value)},Date.parse(match.start)+1);assert.deepEqual(later,pregame);
 assert.deepEqual(team.footballFixtureSettings(memory(),'eng.1',fixture,base,book,Date.parse(match.start)+1),base);
 const other={...fixture,id:'2',start:'2026-10-24T12:00:00Z'};assert.notDeepEqual(team.footballFixtureSettings(storage,'eng.1',other,base,{20:profile('20',s.teams[1].value)},Date.parse(match.start)+1),pregame);
});
test('baseball profiles survive parsing, isolate IDs, combine ratios, and invalidate cached signatures',()=>{
 const b=defaultBaseballSettings(),home=structuredClone(b),away=structuredClone(b);home.weights.innings={starter:100,offense:0,defense:0,bullpen:0};away.weights.innings={starter:0,offense:100,defense:0,bullpen:0};
 const full=team.baseballTeamSettings(b,{10:profile('10',home,'MLB'),20:profile('20',away,'MLB')});assert.ok(parseBaseballSettings(full));
 assert.deepEqual(baseballSettingsForGame(full,'10','20').weights.innings,{starter:50,offense:50,defense:0,bullpen:0});assert.deepEqual(baseballSettingsForGame(full,'30','40'),b);assert.notEqual(baseballSettingsSignature(full),baseballSettingsSignature(b));
 assert.equal(parseBaseballSettings({...b,teams:{10:{...home,teams:{}}}}),null);
});
test('basketball suggestions use measured sample counts and applied weights change projection',()=>{
 const metrics={weightSignals:[.8,.2,.5,.1,.4],games:20,ortg:112,drtg:109,pace:100,threePct:.35,threeRate:.4,ftRate:.25,observations:[],samples:{possessions:2000,threeAttempts:650,fieldGoalAttempts:1700,minutes:960}};
 const other={...metrics,weightSignals:[.25,.85,.1,.55,.3],ortg:108,drtg:113,samples:{possessions:850,threeAttempts:170,fieldGoalAttempts:650,minutes:400}};
 const s=aiTeamSuggestion({...match,league:'NBA'},{inputs:{home:metrics,away:other}},'basketball');assert.ok(s);assert.notDeepEqual(s.teams[0].weights,s.teams[1].weights);
 const book=Object.fromEntries(s.teams.map(t=>[t.teamId,profile(t.teamId,t.value,'NBA')])),weights=team.basketballTeamWeights([20,20,20,20,20],book,'10','20');close(weights.reduce((a,b)=>a+b),100);
 assert.notEqual(projectEfficiency(metrics,other,'NBA',false,weights).home,projectEfficiency(metrics,other,'NBA',false).home);
 assert.equal(aiTeamSuggestion({...match,league:'NBA'},{inputs:{home:{...metrics,samples:undefined},away:other}},'basketball'),null);
});
test('equal game counts still produce meaningful profiles from each team performance pattern',()=>{
 const m={games:20,samples:{possessions:2000,threeAttempts:850,fieldGoalAttempts:1800,minutes:960},weightSignals:[.9,.12,.65,.08,.2]};
 const n={...m,weightSignals:[.15,.85,.05,.7,.4]},g={...match,league:'NBA'};
 const suggestion=aiTeamSuggestion(g,{inputs:{home:m,away:n}},'basketball');
 const [home,away]=suggestion.teams.map(t=>t.value.weights);assert.ok(Math.max(...home.map((v,i)=>Math.abs(v-away[i])))>5);close(home.reduce((a,b)=>a+b),100);close(away.reduce((a,b)=>a+b),100);
 assert.notEqual(home.indexOf(Math.max(...home)),away.indexOf(Math.max(...away)));
 const swapped=aiTeamSuggestion({...g,homeId:g.awayId,awayId:g.homeId,home:g.away,away:g.home},{inputs:{home:n,away:m}},'basketball');assert.deepEqual(swapped.teams[1].value.weights,home);
 const identical=aiTeamSuggestion(g,{inputs:{home:m,away:m}},'basketball');assert.deepEqual(identical.teams[0].value,identical.teams[1].value);
});
test('baseball uses named measured season factors when recent starts are unavailable',()=>{
 const g={...match,league:'NPB'},a={weightEvidence:{home:{games:143,starterOuts:450,recentStarts:0},away:{games:143,starterOuts:330,recentStarts:0}},factors:[{name:'本季戰績',home:.6,away:.5},{name:'先發投手本季防禦率 ERA',home:2,away:4},{name:'先發投手本季每局被上壘率 WHIP',home:1,away:1.4}]};
 const s=aiTeamSuggestion(g,a,'baseball');assert.ok(s);assert.notDeepEqual(s.teams[0].weights,s.teams[1].weights);
 for(const t of s.teams){close(t.weights.reduce((n,w)=>n+w.value,0),100);assert.equal(t.value.weights.multifactor.starterRecentEra,15);assert.doesNotMatch(t.reason,/先發 0 場|近期投球/);}
 assert.deepEqual(aiTeamSuggestion(g,{...a,factors:[...a.factors].reverse()},'baseball'),s);
 assert.equal(aiTeamSuggestion(g,{...a,factors:[a.factors[0]]},'baseball'),null);
 assert.equal(aiTeamSuggestion(g,{...a,weightEvidence:{home:{games:143,starterOuts:null},away:{games:143,starterOuts:null}}},'baseball'),null);
});
test('innings weight recommendations stay in the selected family and leave unknown bullpen neutral',()=>{
 const g={...match,league:'MLB'},a={modelFamily:'innings',weightEvidence:{home:{games:160,starterOuts:450},away:{games:160,starterOuts:330}},inputs:{home:{offense:5,defense:3,starterEra:2},away:{offense:3,defense:5,starterEra:5}}};
 const s=aiTeamSuggestion(g,a,'baseball');assert.ok(s);assert.notDeepEqual(s.teams[0].weights,s.teams[1].weights);
 for(const t of s.teams){assert.equal(t.value.moneyline,'innings');assert.equal(t.value.weights.innings.bullpen,10);close(t.weights.reduce((n,w)=>n+w.value,0),100);assert.equal(t.weights.length,4);}
});
