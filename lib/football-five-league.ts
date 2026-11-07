import type {FootballAnalysis,FootballLeague,FootballProbabilities} from './football';
import type {ExternalFootballGame} from './football-xg-features';

export const domesticLeagues=['eng.1','esp.1','ita.1','ger.1','fra.1'] as const;
export type DomesticLeague=typeof domesticLeagues[number];
export const domesticLeague=(league:string):league is DomesticLeague=>domesticLeagues.some(code=>code===league);
export const featuredThreshold=.60;
export type DrawStudy={drawAlertEnabled:boolean;drawThreshold:number;drawPolicy?:string;annualThresholds?:Record<string,number>;annualWithoutShotsThresholds?:Record<string,number>};
export function drawRiskThreshold(study:DrawStudy,kickoff:string,shotApplied:boolean){
  if(!study.drawAlertEnabled)return;
  if(study.drawPolicy!=='annual')return study.drawThreshold;
  const bands=shotApplied?study.annualThresholds:study.annualWithoutShotsThresholds;
  return bands?.[kickoff.slice(0,4)];
}
// When a role is unknown its possible load spans zero to one regular player.
export function boundedInjuryShift(absences:import('./recent-opponents').MatchEvidence['absences']){
  if(absences?.method!=='minutes'||!Array.isArray(absences.home)||!Array.isArray(absences.away))return;
  function interval(players:NonNullable<typeof absences>['home']){
    let known=0,unknown=0;
    for(const p of players??[]){if(p.role)known+=p.weight;else unknown++;}
    return {low:Math.min(1,known/4),high:Math.min(1,(known+unknown)/4)};
  }
  const home=interval(absences.home),away=interval(absences.away);
  const low=away.low-home.high,high=away.high-home.low;
  return .075*(low>0?low:high<0?high:0);
}
type Grid=NonNullable<FootballAnalysis['scoreDistribution']>;
const day=86400000;

// Fitted on 3,133 German and Italian fixtures before 2021. Freeze this candidate
// before testing it against each league's own previous model.
const directionCoefficient=.18965954,drawCoefficient=-.01858389;
export type ShotEstimate={home:number;away:number;homeGames:number;awayGames:number};
export function recentShotEstimate(rows:ExternalFootballGame[],league:FootballLeague,home:string,away:string,before:number):ShotEstimate|null{
  const history=rows.filter(g=>{
    const age=before-Date.parse(g.start);
    return g.league===league&&age>0&&age<=365*day&&g.homeXg!==null&&g.awayXg!==null&&
      Number.isFinite(g.homeXg)&&Number.isFinite(g.awayXg)&&g.homeXg>=0&&g.awayXg>=0;
  }).sort((a,b)=>a.start.localeCompare(b.start));
  if(history.length<100)return null;
  const homeMean=history.reduce((s,g)=>s+g.homeXg!,0)/history.length;
  const awayMean=history.reduce((s,g)=>s+g.awayXg!,0)/history.length;
  function side(id:string){
    const games=history.filter(g=>g.homeId===id||g.awayId===id).slice(-20);
    if(games.length<5||before-Date.parse(games[games.length-1].start)>120*day)return null;
    let attack=0,conceded=0,weights=4;
    for(const g of games){
      const ageDays=(before-Date.parse(g.start.slice(0,10)+'T00:00:00Z'))/day;
      const w=.5**(ageDays/90),atHome=g.homeId===id;
      attack+=w*(atHome?g.homeXg!-homeMean:g.awayXg!-awayMean);
      conceded+=w*(atHome?g.awayXg!-awayMean:g.homeXg!-homeMean);
      weights+=w;
    }
    return {attack:attack/weights,conceded:conceded/weights,n:games.length};
  }
  const h=side(home),a=side(away);
  return h&&a?{home:homeMean+h.attack+a.conceded,away:awayMean+a.attack+h.conceded,homeGames:h.n,awayGames:a.n}:null;
}
export function shotTilts(expected:{home:number;away:number},estimate:ShotEstimate){
  return {direction:directionCoefficient*((estimate.home-estimate.away)-(expected.home-expected.away)),
    draw:drawCoefficient*((estimate.home+estimate.away)-(expected.home+expected.away))};
}


// Every market, including the top scores, uses the same normalized score grid.
export function tiltFootballGrid(grid:Grid,shift:number,shot?:{direction:number;draw:number}) {
  const scores=grid.scores.map(s=>({...s,probability:s.probability*Math.exp(shift*(s.home-s.away)+(shot?(s.home===s.away?shot.draw:Math.sign(s.home-s.away)*shot.direction):0))}));
  const mass=scores.reduce((sum,s)=>sum+s.probability,0);
  const probabilities:FootballProbabilities={home:0,draw:0,away:0,over25:0,under25:0,btts:0};
  const expected={home:0,away:0};
  for(const s of scores){
    s.probability/=mass;
    probabilities[s.home>s.away?'home':s.home===s.away?'draw':'away']+=s.probability;
    probabilities[s.home+s.away>2?'over25':'under25']+=s.probability;
    if(s.home&&s.away)probabilities.btts+=s.probability;
    expected.home+=s.home*s.probability;expected.away+=s.away*s.probability;
  }
  return {probabilities,expected,scoreDistribution:{...grid,...expected,scores},
    scores:[...scores].sort((a,b)=>b.probability-a.probability).slice(0,3)};
}
