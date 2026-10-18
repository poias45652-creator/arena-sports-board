import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {moduleUrl} from './profile-loader.mjs';
const market=await import(moduleUrl('lib/sport-super-markets.ts'));
const {footballDistribution}=await import(moduleUrl('lib/football.ts'));
const {marketFootballDistribution}=await import(moduleUrl('lib/football-market-core.ts'));
const {xgStrengthDistribution,footballXgStrengthRuntime}=await import(moduleUrl('lib/football-xg-strength-model.ts'));
const {footballWeightedParameters}=await import(moduleUrl('lib/football-model-weights.ts'));
const {applyFootballMarketAnalysis}=await import(moduleUrl('lib/football-market-source.ts'));
const runtime=JSON.parse(readFileSync('data/football/market-calibration-runtime.json'));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const quote=(kind,line,parts)=>({kind,line,parts,boundary:0,display:kind==='spread'?'主讓 0.5/1':String(line),home:.832,away:1.090,signature:'regression'});
function checkDistribution(a){
 const grids=market.footballMarketGrids(JSON.parse(JSON.stringify(a)));
 assert.ok(grids,'the serialized model must supply its own complete distribution');
 assert.ok(a.scoreDistribution.scores.length>3);
 near(a.scoreDistribution.scores.reduce((n,r)=>n+r.probability,0),1);
 for(const [kind,grid,line,parts] of [['spread',grids.margin,-.75,[-.5,-1]],['total',grids.total,3,undefined]]){
  const q=quote(kind,line,parts),one=market.settleSportGrid(grid,q,kind==='spread'?'home':'over'),two=market.settleSportGrid(grid,q,kind==='spread'?'away':'under');
  assert.ok(one&&two);
  for(const r of [one,two])near(r.win+r.partialWin+r.push+r.partialLoss+r.loss,1);
  near(one.win,two.loss);near(one.partialWin,two.partialLoss);near(one.push,two.push);
  if(kind==='spread')near(one.partialWin,grid.filter(r=>r.value===1).reduce((n,r)=>n+r.p,0));
  else near(one.push,grid.filter(r=>r.value===3).reduce((n,r)=>n+r.p,0));
 }
 const over=market.settleSportGrid(grids.total,quote('total',2.5),'over');near(over.win,a.probabilities.over25);
 const winner=market.settleSportGrid(grids.margin,quote('spread',0),'home');near(winner.win,a.probabilities.home);near(winner.push,a.probabilities.draw);
}
test('every calibrated score model and custom weight path exports the full grid used by its probabilities',()=>{
 // Parity fixtures are independent SciPy references for the production equations.
 for(const row of JSON.parse(readFileSync('tests/fixtures/football-market-parity.json'))){
  const a=marketFootballDistribution(row.rates);checkDistribution(a);
  for(const k of Object.keys(row.probabilities))near(a.probabilities[k],row.probabilities[k]);
  for(const k of ['home','away'])near(a.expected[k],row.expected[k]);
 }
 for(const entry of Object.values(footballXgStrengthRuntime.leagues)){
  for(const settings of [undefined,{model:'auto',weights:{elo:[80,20,0,0,0]}}]){
   const p=footballWeightedParameters(entry.parameters,settings,'elo',['goalAttack','goalDefense','xgAttack','xgDefense','elo']);
   checkDistribution(xgStrengthDistribution([2,.7,.8,1.5,2,.7,.8,1.5,.4,0],[2,.7,.8,1.5],p));
  }
 }
 checkDistribution({expected:{home:1.5,away:1},...footballDistribution(1.5,1,-.1)});
});
test('DE/IT report assembly replaces an older model grid, including manual score weights',()=>{
 const now=Date.parse(runtime.createdAt)+86400000;
 for(const league of ['ger.1','ita.1']){
  const game={id:'99123',league,season:2026,start:new Date(now+86400000).toISOString(),home:{id:'132',name:'Home'},away:{id:'133',name:'Away'},state:'scheduled',statusName:'STATUS_SCHEDULED',timeConfirmed:true,neutral:false};
  const history=Array.from({length:220},(_,i)=>({...game,id:String(50000+i),start:new Date(now-(i+2)*86400000).toISOString(),home:i%11===0?game.home:{id:String(700+i%6)},away:i%11===0?game.away:{id:String(800+i%6)},homeScore:i%4,awayScore:i%3,state:'final',statusName:'STATUS_FULL_TIME'}));
  const context={history:[...history].reverse(),fetchedAt:new Date(now).toISOString(),fixtures:new Map([[game.id,game]]),conflicts:0};
  const old={status:'ready',reason:'',version:'old',capturedAt:new Date(now).toISOString(),expected:{home:4,away:.5},...footballDistribution(4,.5),notes:[]};
  for(const settings of [undefined,{model:'score',weights:{score:[80,20,0,0,0]}}]){
   const a=applyFootballMarketAnalysis(game,old,context,now,settings);assert.equal(a.external.modelFamily,'score-market');assert.notEqual(a.scoreDistribution,old.scoreDistribution);checkDistribution(a);
  }
 }
});
const capturedAt='2026-10-18T15:39:00Z',now=Date.parse(capturedAt);
const games=[
 {id:'test-milan',league:'ita.1',start:'2026-10-19T00:00:00+08:00',home:{name:'AC米蘭'},away:{name:'亞特蘭大'}},
 {id:'test-juventus',league:'ita.1',start:'2026-10-19T02:45:00+08:00',home:{name:'尤文圖斯'},away:{name:'拉齊奧'}}
].map(g=>({...g,state:'scheduled',timeConfirmed:true}));
// Screenshot matchup/times and Milan handicap. Source IDs and Lazio alias
// variants are synthetic fixtures, not a claimed authenticated source capture.
const source=(g,i,away=g.away.name)=>({id:100+i,league:'FOOTBALL',competition:g.league,start:i?'2026/10/19 02:45:00':'2026/10/19 00:00:00',live:false,home:i?'祖雲達斯(主)':g.home.name+'(主)',away,displayMarkets:[101,102].map(type=>({period:'full',type,quotes:[{primary:true,open:true,homeLine:'0.5/1',awayLine:'',homePrice:.832,awayPrice:1.090,total:'3',over:.9,under:.89}]}))});
const snapshot=()=>({fetchedAt:capturedAt,sportGames:games.map((g,i)=>source(g,i,i?'拉素':g.away.name))});
test('Lazio regional names match only the exact senior fixture and preserve all rejection guards',()=>{
 const g=games[1];
 for(const name of ['拉素','拉齐奥','拉齊奧','Lazio']){
  const s=snapshot();s.sportGames[1].away=name;assert.equal(market.sportMarketStatus(s,g,'FOOTBALL',now).code,'matched');
  for(const suffix of ['U21','(女)','預備隊']){s.sportGames[1].away=name+suffix;assert.equal(market.matchSportEvent(s,g,'FOOTBALL',now),null);}
 }
 for(const change of [{home:g.away,away:g.home},{league:'uefa.europa'},{start:'2026-10-20T02:45:00+08:00'},{away:{name:'羅馬'}}])assert.equal(market.matchSportEvent(snapshot(),{...g,...change},'FOOTBALL',now),null);
 assert.equal(market.matchSportEvent(snapshot(),g,'FOOTBALL',now+150000),null);
 const duplicate=snapshot();duplicate.sportGames.push({...duplicate.sportGames[1],id:900});assert.equal(market.sportMarketStatus(duplicate,g,'FOOTBALL',now).code,'fixture_ambiguous');
 for(const sport of ['NBA','WNBA'])assert.notEqual(market.sportTeamKey('拉素',sport),market.sportTeamKey('拉齊奧',sport));
});
test('both reported cards render all four outcome rows from the calibrated distribution',async()=>{
 const odds=await import(moduleUrl('lib/member-odds-client.ts'));
 const code=ts.transpileModule(readFileSync('app/sport-markets.tsx','utf8'),{fileName:'markets.tsx',compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const C=new Function('require','exports','React',code+';return exports.default;')(key=>{if(key==='@/lib/member-odds-client')return odds;if(key==='@/lib/sport-super-markets')return market;throw Error(key);},{},React);
 for(const game of games){
  const analysis={status:'ready',capturedAt,...marketFootballDistribution({home:1.5,away:1.1,rho:-.1,overTilt:.2,bttsTilt:.1,drawTilt:.1})};
  const html=renderToStaticMarkup(React.createElement(C,{game,analysis,snapshot:snapshot(),sport:'FOOTBALL',now}));
  for(const text of ['2 種玩法','全贏','中洞贏','中洞輸','全輸','退回'])assert.ok(html.includes(text),text);
  assert.equal((html.match(/class="sport-market-outcomes"/g)||[]).length,4);
  assert.ok(!/暫無可用分布|玩法配對待確認|NaN|undefined/.test(html));
 }
});
test('invalid or mixed grids remain ineligible instead of inventing settlement percentages',()=>{
 const a=marketFootballDistribution({home:1.5,away:1.1,rho:-.1,overTilt:.2,bttsTilt:.1,drawTilt:.1});
 for(const mutate of [r=>{delete r.scoreDistribution;},r=>{r.scoreDistribution.scores=r.scores;},r=>{r.expected.home+=.1;},r=>{r.expected.home=NaN;},r=>{r.probabilities.home=NaN;},r=>{delete r.probabilities.away;},r=>{r.probabilities.over25+=.1;},r=>{r.scoreDistribution.scores[0].home=-1;},r=>{r.scoreDistribution.scores[0]=null;},r=>{r.scoreDistribution.scores.push({...r.scoreDistribution.scores[0],probability:0});}]){
  const broken=structuredClone(a);mutate(broken);assert.equal(market.footballMarketGrids(broken),null);
 }
});
