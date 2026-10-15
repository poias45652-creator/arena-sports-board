import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {moduleUrl} from '../tests/profile-loader.mjs';
const {parseFootballEvents}=await import(moduleUrl('lib/football.ts'));
const {mergeExternalFootballHistory}=await import(moduleUrl('lib/football-external-source.ts'));
const {FootballElo,externalFootballFeatures,externalDayCutoff}=await import(moduleUrl('lib/football-xg-features.ts'));
const {cupPriorEstimate}=await import(moduleUrl('lib/football-cup-prior.ts'));
const dir=process.argv[2]||'.football-research/europa',read=p=>JSON.parse(readFileSync(p,'utf8'));
const manifest=read(dir+'/manifest.json'),cutoff=manifest.collectedAt;
const all=Array.from({length:16},(_,i)=>read(dir+`/annual-${2011+i}.json`)).flatMap(d=>parseFootballEvents(d,'uefa.europa')).filter(g=>g.state==='final'&&g.statusName==='STATUS_FULL_TIME'&&g.homeScore!==null&&g.awayScore!==null&&Date.parse(g.start)<Date.parse(cutoff)).map(g=>({id:'espn:'+g.id,league:g.league,start:g.start,homeId:'espn:'+g.home.id,awayId:'espn:'+g.away.id,homeGoals:g.homeScore,awayGoals:g.awayScore,homeXg:null,awayXg:null,neutral:g.neutral}));
const merged=mergeExternalFootballHistory([],all),games=merged.games;
const options=[90,180].flatMap(decayDays=>[0,.6].map(venueWeight=>({decayDays,venueWeight})));
const elo=new FootballElo(),past=[],rows=[],sparse=[],coverage={};
const dummy={blend:1,homeIntercept:0,awayIntercept:0,goalAttack:.6,goalDefense:.6,xgAttack:0,xgDefense:0,elo:.1,rho:0,usesXg:false};
for(let i=0;i<games.length;){
 const day=games[i].start.slice(0,10),daily=[];while(i<games.length&&games[i].start.slice(0,10)===day)daily.push(games[i++]);
 const before=externalDayCutoff(day),recent=past.filter(g=>Date.parse(g.start)>=before-365*86400000);
 for(const g of daily){
  const diff=elo.difference(g),variants=options.map(p=>externalFootballFeatures(g,recent,diff,p,before));
  const row={id:g.id,league:g.league,start:g.start,homeScore:g.homeGoals,awayScore:g.awayGoals,variants:variants.map(f=>f.values),deployed:null};
  const year=day.slice(0,4);coverage[year]??={total:0,full:0,sparse:0};coverage[year].total++;
  if(variants[1].enough){rows.push(row);coverage[year].full++;}
  else{
   const priors={};
   for(const n of [1,3,5]){
    const values=options.map(p=>{
     const r=cupPriorEstimate(g,recent,diff,{...dummy,...p},before,n);
     return r?[r.home.scored,r.home.conceded,r.away.scored,r.away.conceded,0,0,0,0,diff/400,Number(g.neutral)]:null;
    });
    if(values.every(Boolean))priors[n]=values;
   }
   if(Object.keys(priors).length===3){sparse.push({...row,priors,homeGames:variants[1].home.games,awayGames:variants[1].away.games});coverage[year].sparse++;}
  }
 }
 for(const g of daily){past.push(g);elo.update(g);}
}
const tuples=games.map(g=>[g.id,g.league,g.start,g.homeId,g.awayId,g.homeGoals,g.awayGoals,null,null,g.neutral]);
const sha256=createHash('sha256').update(JSON.stringify(tuples)).digest('hex');
writeFileSync('data/football/europa-history-20261015.json',JSON.stringify({source:'ESPN',cutoff,sha256,conflicts:merged.conflicts,games:tuples})+'\n');
writeFileSync('.football-research/europa-features.json',JSON.stringify({sourceSha256:sha256,options,rows,sparse,coverage}));
console.log(JSON.stringify({games:games.length,conflicts:merged.conflicts,coverage}));
