import runtime from '../data/football/cup-adjustment-runtime.json';
import {externalFootballFeatures,type ExternalFootballGame} from './football-xg-features';
import {FootballOpponentXgHistory} from './football-opponent-xg';
import {externalFootballRates,type ExternalFootballParameters} from './football-external-model';

export type CupAdjustment={priorGames:number;opponentWeight:number;blend:number};
export type CupOpponentFeatures=ReturnType<FootballOpponentXgHistory['features']>;
export const footballCupAdjustmentRuntime=runtime;
export function selectCupAdjustment(now=Date.now()):CupAdjustment|null{return runtime.enabled&&now>=Date.parse(runtime.createdAt)&&now<Date.parse(runtime.expiresAt)?runtime.parameters:null;}
const DAY=86400000;
const indexes=new Map<string,FootballOpponentXgHistory>();
// Cache by the full scored history, not its last date: source corrections must
// invalidate an index even when the number of matches has not changed.
export function cupOpponentFeatures(history:ExternalFootballGame[],homeId:string,awayId:string,before:number){
 const rows=history.filter(g=>g.league==='uefa.champions'&&Date.parse(g.start)<before&&Date.parse(g.start)>=before-730*DAY).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||a.id.localeCompare(b.id));
 const key=JSON.stringify(rows.map(g=>[g.id,g.start,g.homeId,g.awayId,g.homeGoals,g.awayGoals,g.neutral]));
 let index=indexes.get(key);
 if(!index){
  index=new FootballOpponentXgHistory({decayDays:90,lookbackDays:365,priorGames:5});
  const days=new Map<string,ExternalFootballGame[]>();for(const g of rows){const day=g.start.slice(0,10);if(!days.has(day))days.set(day,[]);days.get(day)!.push({...g,homeXg:null,awayXg:null});}
  for(const games of days.values())index.addDay(games);
  if(indexes.size>=2)indexes.delete(indexes.keys().next().value!);indexes.set(key,index);
 }
 return index.features(homeId,awayId,before);
}

export function cupAdjustedEstimate(target:Pick<ExternalFootballGame,'homeId'|'awayId'|'start'|'neutral'|'league'>,history:ExternalFootballGame[],eloDifference:number,p:ExternalFootballParameters,before:number,options:CupAdjustment,opponents?:CupOpponentFeatures){
 if(target.league!=='uefa.champions'||p.usesXg||!Number.isFinite(before)||!Number.isFinite(eloDifference)||!Number.isFinite(options.priorGames)||options.priorGames<=0||![options.opponentWeight,options.blend].every(n=>Number.isFinite(n)&&n>=0&&n<=1))return null;
 const rows=history.filter(g=>g.league===target.league&&Date.parse(g.start)<before&&Date.parse(g.start)>=before-365*DAY);
 if(rows.length<30)return null;
 const features=externalFootballFeatures(target,rows,eloDifference,p,before);
 if([features.home,features.away].some(f=>f.games<1||!f.latest||before-Date.parse(f.latest)>120*DAY))return null;
 const adjusted=opponents||cupOpponentFeatures(history,target.homeId,target.awayId,before);
 let hg=0,ag=0,total=0;
 for(const g of rows){const w=Math.exp(-(before-Date.parse(g.start))/(p.decayDays*DAY));hg+=w*(g.neutral?(g.homeGoals+g.awayGoals)/2:g.homeGoals);ag+=w*(g.neutral?(g.homeGoals+g.awayGoals)/2:g.awayGoals);total+=w;}
 const hMean=hg/total,aMean=ag/total,mean=(hMean+aMean)/2;
 const effective=(id:string)=>rows.filter(g=>g.homeId===id||g.awayId===id).sort((a,b)=>Date.parse(b.start)-Date.parse(a.start)).slice(0,20).reduce((s,g)=>s+Math.exp(-(before-Date.parse(g.start))/(p.decayDays*DAY)),0);
 const shrink=(form:typeof features.home,side:'home'|'away',id:string,opponent:typeof adjusted.home)=>{
  const n=effective(id),reliability=n/(n+options.priorGames);
  const priorFor=target.neutral?mean:p.venueWeight*(side==='home'?hMean:aMean)+(1-p.venueWeight)*mean;
  const priorAgainst=target.neutral?mean:p.venueWeight*(side==='home'?aMean:hMean)+(1-p.venueWeight)*mean;
  const ratio=(a:number,b:number)=>Math.max(.5,Math.min(2,(a+.1)/(b+.1)))**options.opponentWeight;
  return {...form,scored:reliability*form.scored*ratio(opponent.agf,opponent.gf)+(1-reliability)*priorFor,conceded:reliability*form.conceded*ratio(opponent.aga,opponent.ga)+(1-reliability)*priorAgainst,effectiveGames:n,reliability};
 };
 const home=shrink(features.home,'home',target.homeId,adjusted.home),away=shrink(features.away,'away',target.awayId,adjusted.away);
 const values=[home.scored,home.conceded,away.scored,away.conceded,0,0,0,0,eloDifference/400,Number(target.neutral)];
 const corrected=externalFootballRates(values,values,p);
 const baseline=externalFootballFeatures(target,rows,eloDifference,{decayDays:90,venueWeight:.6},before);
 // Match the legacy full/sparse branches exactly for the unchanged component.
 const legacy=externalFootballRates(features.values,features.enough?baseline.values:features.values,p);
 const mix=(a:number,b:number)=>options.blend*a+(1-options.blend)*b;
 return {home,away,rates:{home:mix(corrected.home,legacy.home),away:mix(corrected.away,legacy.away),rho:legacy.rho},poolGames:rows.length};
}
