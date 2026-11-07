// Run from the repository root. Replay the same default-model feature, score-grid,
// opponent and shot-quality functions used by the game-analysis request.
import {readFileSync,writeFileSync} from 'node:fs';
import {moduleUrl} from '../../tests/profile-loader.mjs';
const {FootballElo,externalAsGame,externalFootballFeatures}=await import(moduleUrl('lib/football-xg-features.ts'));
const {externalFootballRates}=await import(moduleUrl('lib/football-external-model.ts'));
const {xgStrengthDistribution}=await import(moduleUrl('lib/football-xg-strength-model.ts'));
const {marketFootballFeatures,marketFootballRates,marketFootballDistribution}=await import(moduleUrl('lib/football-market-core.ts'));
const {footballDistribution}=await import(moduleUrl('lib/football.ts'));
const {recentOpponents,formAdvantage}=await import(moduleUrl('lib/recent-opponents.ts'));
const {domesticLeagues,recentShotEstimate,shotTilts,tiltFootballGrid,featuredThreshold}=await import(moduleUrl('lib/football-five-league.ts'));
const read=name=>JSON.parse(readFileSync('data/football/'+name+'.json'));
const market=read('market-calibration-runtime'),strength=read('xg-strength-runtime'),external=read('external-calibration-runtime');
const scores=read('market-history-20260928'),understat=read('external-history-20260927'),ids=read('external-team-map').teams;
const historicalForm=read('context-calibration-20261107');
const toGame=r=>({id:r[0],league:r[1],start:r[2],homeId:r[3],awayId:r[4],homeGoals:r[5],awayGoals:r[6],homeXg:r[7],awayXg:r[8],neutral:!!r[9]});
const exactKey=g=>[g.start.slice(0,10),g.homeId,g.awayId].join('|');
const stats=(records,which)=>{let loss=0,brier=0,goals=0,btts=0,hits=0,draws=0;
  for(const r of records){const p=r[which],y=r.y;hits+=Number(p.indexOf(Math.max(...p.slice(0,3)))===y);draws+=Number(y===1);
    loss-=Math.log(p[y]);brier+=p.slice(0,3).reduce((s,v,i)=>s+(v-Number(i===y))**2,0);goals+=(p[3]-r.over)**2;btts+=(p[4]-r.btts)**2;}
  const n=records.length;return {n,hits,draws,logLoss:loss/n,brier:brier/n,goals:goals/n,btts:btts/n};
};
const asArray=p=>[p.home,p.draw,p.away,p.over25,p.btts];
const results={};
for(const league of domesticLeagues){
 const scoreLeague=!!market.leagues[league]?.enabled;
 const shotGames=understat.games.filter(r=>r[1]===league).map(toGame).sort((a,b)=>a.start.localeCompare(b.start));
 const games=scoreLeague?scores.games.filter(r=>r[1]===league).map(r=>toGame([...r.slice(0,7),null,null,r[7]])).sort((a,b)=>a.start.localeCompare(b.start)):shotGames;
 const name=id=>scoreLeague?ids[id]?.understat:id;
 const checked=new Set(games.map(g=>[exactKey({...g,homeId:name(g.homeId),awayId:name(g.awayId)}),g.homeGoals,g.awayGoals].join('|')));
 const shotHistory=scoreLeague?shotGames.filter(g=>checked.has([exactKey(g),g.homeGoals,g.awayGoals].join('|'))):shotGames;
 const elo=new FootballElo(),records=[];let prev=[],shot=[],i=0,j=0;
 for(const g of games){
  const now=Date.parse(g.start)-3600000,before=Math.floor(now/86400000)*86400000;
  while(i<games.length&&Date.parse(games[i].start)<before){elo.update(games[i]);prev.push(games[i++]);}
  while(j<shotHistory.length&&Date.parse(shotHistory[j].start)<before)shot.push(shotHistory[j++]);
  if(g.start<'2015')continue;
  prev=prev.filter(r=>Date.parse(r.start)>=before-365*86400000);shot=shot.filter(r=>Date.parse(r.start)>=before-365*86400000);
  const target={...g,start:new Date(now).toISOString()},diff=elo.difference(target);
  let distribution,expected;
  if(scoreLeague){
   const history=prev.map(externalAsGame),game=externalAsGame(target),p=market.leagues[league].parameters;
   const f=marketFootballFeatures(game,history,diff,p,before),b=marketFootballFeatures(game,history,diff,{decayDays:90,venueWeight:.6},before);
   if(!f.enough)continue;
   distribution=marketFootballDistribution(marketFootballRates(f.values,b.baseline,p));expected=distribution.expected;
  }else{
   const advanced=strength.leagues[league]?.enabled,p=advanced?strength.leagues[league].parameters:external.leagues[league].parameters;
   const f=externalFootballFeatures(target,prev,diff,p,before),b=externalFootballFeatures(target,prev,diff,{decayDays:90,venueWeight:advanced?0:.6},before);
   if(!f.enough||!f.xgEnough)continue;
   const r=externalFootballRates(f.values,b.values,p);
   distribution=advanced?xgStrengthDistribution(f.values,b.values,p):footballDistribution(r.home,r.away,r.rho);
   expected=distribution.expected??{home:r.home,away:r.away};
  }
  const form=scoreLeague&&historicalForm.leagues[league].selection!=='v1'?0:.16*formAdvantage(recentOpponents(prev.map(r=>({id:r.id,at:Date.parse(r.start),home:r.homeId,away:r.awayId,homeScore:r.homeGoals,awayScore:r.awayGoals})),g.homeId,g.awayId,now,100));
  const prior=form?tiltFootballGrid(distribution.scoreDistribution,form):distribution;
  const estimate=!g.neutral&&name(g.homeId)&&name(g.awayId)?recentShotEstimate(shot,league,name(g.homeId),name(g.awayId),before):null;
  const trial=estimate?tiltFootballGrid(distribution.scoreDistribution,form,shotTilts(expected,estimate)):prior;
  records.push({start:g.start,id:g.id,y:g.homeGoals>g.awayGoals?0:g.homeGoals===g.awayGoals?1:2,over:Number(g.homeGoals+g.awayGoals>2),btts:Number(g.homeGoals>0&&g.awayGoals>0),hasShots:!!estimate,prior:asArray(prior.probabilities),trial:asArray(trial.probabilities)});
 }
 // For ES/FR the pre-existing xG model selected parameters through 2022.
 const from=scoreLeague?'2021':'2023';
 const splits=[[from,'2025'],['2025','2027']].map(([lo,hi])=>{
   const rs=records.filter(r=>lo<=r.start&&r.start<hi);
   return {from:lo,toExclusive:hi,prior:stats(rs,'prior'),trial:stats(rs,'trial')};
 });
 const applyShots=splits.every(({prior:a,trial:b})=>b.n>=250&&b.hits>=a.hits&&b.logLoss<a.logLoss&&b.brier<=a.brier&&b.goals<=a.goals+.002&&b.btts<=a.btts+.002);
 const model=applyShots?'trial':'prior';
 const previous=records.filter(r=>r.start<from),ordered=previous.map(r=>r[model][1]).sort((a,b)=>a-b);
 const drawThreshold=ordered[Math.floor(.8*(ordered.length-1))];
 // A rolling alternative uses only the preceding completed calendar year.
 const years=[...new Set(records.map(r=>r.start.slice(0,4)))];
 function priorYearBands(which){
   return Object.fromEntries(years.flatMap(year=>{
     const preceding=records.filter(r=>Number(r.start.slice(0,4))===Number(year)-1).map(r=>r[which][1]).sort((a,b)=>a-b);
     return preceding.length>=200?[[year,preceding[Math.floor(.8*(preceding.length-1))]]]:[];
   }));
 }
 const bands=priorYearBands(model),noShotBands=priorYearBands('prior');
 function annualResults(which,thresholds){
   return splits.map(s=>{
     const matches=records.filter(r=>r.start>=s.from&&r.start<s.toExclusive);
     const alerts=matches.filter(r=>r[which][1]>=thresholds[r.start.slice(0,4)]);
     return {n:matches.length,draws:matches.filter(r=>r.y===1).length,alerts:alerts.length,alertDraws:alerts.filter(r=>r.y===1).length};
   });
 }
 const annual=annualResults(model,bands),annualWithoutShots=annualResults('prior',noShotBands);
 const passes=periods=>periods.every(p=>p.alerts>=50&&p.alertDraws/p.alerts>p.draws/p.n);
 const eligible=records.filter(r=>r.start>=from);
 function segment(rs,useAnnual=false){
  const picks=rs.filter(r=>Math.max(...r[model].slice(0,3))>=featuredThreshold);
  const alerts=rs.filter(r=>r[model][1]>=(useAnnual?bands[r.start.slice(0,4)]:drawThreshold));
  return {all:stats(rs,model),featured:stats(picks,model),alerts:stats(alerts,model),shotGames:rs.filter(r=>r.hasShots).length};
 }
 const perPeriod=splits.map(s=>segment(eligible.filter(r=>r.start>=s.from&&r.start<s.toExclusive)));
 const fixedPass=perPeriod.every(x=>x.alerts.n>=50&&x.alerts.draws/x.alerts.n>x.all.draws/x.all.n);
 const drawPolicy=fixedPass?'fixed':passes(annual)&&passes(annualWithoutShots)?'annual':'off';
 results[league]={from,baseVersion:scoreLeague?market.version:strength.leagues[league]?.enabled?strength.version:external.version,applyShots,drawThreshold,
  drawAlertEnabled:drawPolicy!=='off',drawPolicy,annual,annualWithoutShots,annualThresholds:bands,annualWithoutShotsThresholds:noShotBands,
  featuredEnabled:perPeriod.every(x=>x.featured.n>=50&&x.featured.hits/x.featured.n>x.all.hits/x.all.n),
  splits,perPeriod:drawPolicy==='annual'?splits.map(s=>segment(eligible.filter(r=>r.start>=s.from&&r.start<s.toExclusive),true)):perPeriod,combined:segment(eligible,drawPolicy==='annual')};
 console.log(league,applyShots,eligible.length,results[league].combined.featured.hits,results[league].combined.featured.n);
}
writeFileSync('data/football/five-league-verification.json',JSON.stringify(results,null,2)+'\n');
