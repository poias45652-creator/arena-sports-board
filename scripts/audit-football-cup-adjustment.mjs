import {readFileSync,writeFileSync} from 'node:fs';
import {moduleUrl} from '../tests/profile-loader.mjs';
const {cupAdjustedEstimate}=await import(moduleUrl('lib/football-cup-adjustment.ts'));
const {FootballOpponentXgHistory}=await import(moduleUrl('lib/football-opponent-xg.ts'));
const {FootballElo,externalFootballFeatures,externalDayCutoff}=await import(moduleUrl('lib/football-xg-features.ts'));
const {footballDistribution}=await import(moduleUrl('lib/football.ts'));
const {externalFootballRates}=await import(moduleUrl('lib/football-external-model.ts'));
const {mergeExternalFootballHistory}=await import(moduleUrl('lib/football-external-source.ts'));
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const capture=read('tests/fixtures/football-cup-context-20261020.json');
const archive=read('data/football/external-history-20260927.json').games.filter(r=>r[1]==='uefa.champions').map(r=>({id:String(r[0]),league:r[1],start:r[2],homeId:r[3],awayId:r[4],homeGoals:r[5],awayGoals:r[6],homeXg:null,awayXg:null,neutral:!!r[9]}));
const all=mergeExternalFootballHistory(archive,capture.historyOverrides).games.filter(g=>g.start<capture.fetchedAt);
const p=read('data/football/external-calibration-runtime.json').leagues['uefa.champions'].parameters;
const candidates=[1,3,5].flatMap(priorGames=>[0,.5,1].flatMap(opponentWeight=>[.25,.5,1].map(blend=>({priorGames,opponentWeight,blend}))));
const key=c=>`prior${c.priorGames}-opponent${c.opponentWeight}-blend${c.blend}`;
const stats={},sparseStats={},elo=new FootballElo(),past=[],opponents=new FootballOpponentXgHistory({decayDays:90,lookbackDays:365,priorGames:5});
function accumulate(table,split,name,prob,g){const y=g.homeGoals>g.awayGoals?'home':g.homeGoals===g.awayGoals?'draw':'away';const s=(table[split]??={})[name]??={n:0,logLoss:0,brier:0};s.n++;s.logLoss-=Math.log(prob[y]);s.brier+=['home','draw','away'].reduce((v,k)=>v+(prob[k]-Number(k===y))**2,0);}
for(const day of [...new Set(all.map(g=>g.start.slice(0,10)))].sort()){
 const games=all.filter(g=>g.start.startsWith(day)),before=externalDayCutoff(games[0].start);
 for(const g of games){
  const split=day>='2017-01-01'&&day<'2019-01-01'?'selection':day>='2019-01-01'&&day<'2025-01-01'?'holdout':day>='2025-01-01'&&day<'2026-01-01'?'audit2025':day>='2026-01-01'?'audit2026':null;if(!split)continue;
  const diff=elo.difference(g),f=externalFootballFeatures(g,past,diff,p,before),base=externalFootballFeatures(g,past,diff,{decayDays:90,venueWeight:.6},before);
  const o=opponents.features(g.homeId,g.awayId,before);
  const first=cupAdjustedEstimate(g,past,diff,p,before,candidates[0],o);if(!first)continue;
  const old=externalFootballRates(f.values,f.enough?base.values:f.values,p),legacy=footballDistribution(old.home,old.away,old.rho).probabilities;
  accumulate(stats,split,'legacy',legacy,g);if(!f.enough)accumulate(sparseStats,split,'legacy',legacy,g);
  for(const c of candidates){const r=cupAdjustedEstimate(g,past,diff,p,before,c,o),prob=footballDistribution(r.rates.home,r.rates.away,r.rates.rho).probabilities;accumulate(stats,split,key(c),prob,g);if(!f.enough)accumulate(sparseStats,split,key(c),prob,g);}
 }
 opponents.addDay(games);for(const g of games){past.push(g);elo.update(g);}
}
for(const table of [stats,sparseStats])for(const group of Object.values(table))for(const s of Object.values(group))for(const field of ['logLoss','brier'])s[field]/=s.n;
const selected=candidates.toSorted((a,b)=>stats.selection[key(a)].logLoss-stats.selection[key(b)].logLoss)[0];
const selectedKey=key(selected),comparison=Object.fromEntries(Object.entries(stats).map(([k,v])=>[k,{legacy:v.legacy,candidate:v[selectedKey]}]));
const sparseComparison=Object.fromEntries(Object.entries(sparseStats).map(([k,v])=>[k,{legacy:v.legacy,candidate:v[selectedKey]}]));
const accepted=['holdout','audit2025','audit2026'].every(k=>comparison[k].candidate.logLoss<=comparison[k].legacy.logLoss&&comparison[k].candidate.brier<=comparison[k].legacy.brier);
const result={createdAt:new Date().toISOString(),dataCapturedAt:capture.fetchedAt,selection:'2017–2018 log loss only; frozen existing UEFA coefficients; 2019–2024 holdout, 2025/2026 audits never select candidates',candidates,selected,accepted,comparison,sparseComparison,stats};
writeFileSync(process.env.CUP_ADJUSTMENT_OUTPUT||'/tmp/football-cup-adjustment-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify({selected,accepted,comparison,sparseComparison},null,2));
