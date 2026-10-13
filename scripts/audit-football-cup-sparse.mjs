import {readFileSync,writeFileSync} from 'node:fs';
const {moduleUrl}=await import('file://'+process.cwd()+'/tests/profile-loader.mjs');
const {cupPriorEstimate}=await import(moduleUrl('lib/football-cup-prior.ts'));
const {FootballElo,externalFootballFeatures,externalDayCutoff}=await import(moduleUrl('lib/football-xg-features.ts'));
const {footballDistribution}=await import(moduleUrl('lib/football.ts'));
const {mergeExternalFootballHistory}=await import(moduleUrl('lib/football-external-source.ts'));
const captured=JSON.parse(readFileSync('tests/fixtures/football-cup-context-20261014.json'));
const archive=JSON.parse(readFileSync('data/football/external-history-20260927.json')).games.filter(r=>r[1]==='uefa.champions').map(r=>({id:String(r[0]),league:r[1],start:r[2],homeId:r[3],awayId:r[4],homeGoals:r[5],awayGoals:r[6],homeXg:r[7],awayXg:r[8],neutral:!!r[9]}));
const context={...captured,history:mergeExternalFootballHistory(archive,captured.historyOverrides,captured.excluded).games},parameters=JSON.parse(readFileSync('data/football/external-calibration-runtime.json')).leagues['uefa.champions'].parameters;
const all=context.history,elo=new FootballElo(),past=[],stats={},predictions=[];
function accumulate(split,variant,probabilities,g){const y=g.homeGoals>g.awayGoals?'home':g.homeGoals===g.awayGoals?'draw':'away';const s=(stats[split]??={})[variant]??={n:0,logLoss:0,brier:0,accuracy:0};s.n++;s.logLoss-=Math.log(probabilities[y]);s.brier+=['home','draw','away'].reduce((a,k)=>a+(probabilities[k]-Number(k===y))**2,0);s.accuracy+=Number(Object.entries(probabilities).filter(([k])=>['home','draw','away'].includes(k)).sort((a,b)=>b[1]-a[1])[0][0]===y);}
for(const day of [...new Set(all.map(g=>g.start.slice(0,10)))].sort()){
 const games=all.filter(g=>g.start.startsWith(day)),before=externalDayCutoff(games[0].start);
 for(const g of games){
  const split=day>='2017-01-01'&&day<'2019-01-01'?'selection':day>='2019-01-01'&&day<'2021-01-01'?'holdout':day>='2025-01-01'&&day<'2026-01-01'?'audit2025':day>='2026-01-01'?'audit2026':null;if(!split)continue;
  let row=null;
  for(const priorMatches of [1,3,5]){
   const r=cupPriorEstimate(g,past,elo.difference(g),parameters,before,priorMatches);if(!r)continue;
   const d=footballDistribution(r.rates.home,r.rates.away,r.rates.rho);accumulate(split,'prior'+priorMatches,d.probabilities,g);
   row??={id:g.id,start:g.start,split,homeGames:r.home.games,awayGames:r.away.games};
  }
  if(row){const f=externalFootballFeatures(g,past,0,{decayDays:90,venueWeight:.6},before);const d=footballDistribution(Math.max(.15,(f.home.scored+f.away.conceded)/2),Math.max(.15,(f.away.scored+f.home.conceded)/2));accumulate(split,'rawGoals',d.probabilities,g);predictions.push(row);}
 }
 for(const g of games){past.push(g);elo.update(g);}
}
for(const group of Object.values(stats))for(const s of Object.values(group))for(const key of ['logLoss','brier','accuracy'])s[key]/=s.n;
const selected=Object.entries(stats.selection).filter(([k])=>k.startsWith('prior')).sort((a,b)=>a[1].logLoss-b[1].logLoss)[0][0];
const result={createdAt:new Date().toISOString(),fixedCandidates:[1,3,5],selectionCriterion:'2017–2018 log loss; fixed existing UEFA coefficients, no target-day outcomes',selected,stats,predictions};
writeFileSync(process.env.CUP_AUDIT_OUTPUT||'/tmp/yj-cup-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify({selected,stats}));
