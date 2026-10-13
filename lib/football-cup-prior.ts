import type {ExternalFootballParameters} from './football-external-model';
import {externalFootballRates} from './football-external-model';
import {externalFootballFeatures,type ExternalFootballGame} from './football-xg-features';

export const CUP_PRIOR_VERSION='football-cup-elo-sparse-v1';
// The predeclared 1/3/5-match candidate floors were selected using only
// 2017–2018 log loss: one match won. Historical 2019–2020 and 2025 checks are
// separate; no team-specific override or market quote enters the estimate.
export function cupPriorEstimate(target:Pick<ExternalFootballGame,'homeId'|'awayId'|'start'|'neutral'|'league'>,history:ExternalFootballGame[],eloDifference:number,p:ExternalFootballParameters,before:number,priorMatches=1){
  if(target.league!=='uefa.champions'||p.usesXg||!Number.isFinite(before)||!Number.isFinite(eloDifference)||![1,3,5].includes(priorMatches))return null;
  const rows=history.filter(g=>g.league===target.league&&Date.parse(g.start)<before&&Date.parse(g.start)>=before-365*86400000);
  if(rows.length<30)return null;
  const features=externalFootballFeatures(target,rows,eloDifference,p,before);
  if(features.enough||[features.home,features.away].some(f=>f.games<1||!f.latest||before-Date.parse(f.latest)>120*86400000))return null;
  let hg=0,ag=0,weight=0;
  for(const g of rows){
    const w=Math.exp(-(before-Date.parse(g.start))/(p.decayDays*86400000));
    // Neutral fixtures provide a symmetric contribution to the venue prior.
    hg+=w*(g.neutral?(g.homeGoals+g.awayGoals)/2:g.homeGoals);
    ag+=w*(g.neutral?(g.homeGoals+g.awayGoals)/2:g.awayGoals);weight+=w;
  }
  const homeMean=hg/weight,awayMean=ag/weight,mean=(homeMean+awayMean)/2;
  const prior=(venue:'home'|'away',against:boolean)=>target.neutral?mean:p.venueWeight*((venue==='home')!==against?homeMean:awayMean)+(1-p.venueWeight)*mean;
  const shrink=(f:typeof features.home,venue:'home'|'away')=>{
    const reliability=Math.min(f.games/priorMatches,1);
    return {...f,scored:reliability*f.scored+(1-reliability)*prior(venue,false),conceded:reliability*f.conceded+(1-reliability)*prior(venue,true)};
  };
  const home=shrink(features.home,'home'),away=shrink(features.away,'away');
  const values=[home.scored,home.conceded,away.scored,away.conceded,0,0,0,0,eloDifference/400,Number(target.neutral)];
  const rates=externalFootballRates(values,values,p);
  if(![rates.home,rates.away,rates.rho].every(Number.isFinite))return null;
  return {rates,home,away,poolGames:rows.length,prior:{home:homeMean,away:awayMean},eloDifference};
}
