// Inputs are completed games from one competition pool. A tie counts as half a win.
export type FinalResult = {id:string; at:number; home:string; away:string; homeScore:number; awayScore:number};
export type RecentForm = {games:number; wins:number; ties:number; ratedOpponents:number; rating:number; latest:string};
export type Absence = {name:string; weight:number};
export type MatchEvidence = {
  home:RecentForm|null; away:RecentForm|null; asOf?:string;
  absences:{home:Absence[]|null; away:Absence[]|null; source:string; checkedAt:string}|null;
};

export function recentOpponents(rows:FinalResult[], home:string, away:string, cutoff:number, maxAgeDays:number){
  const day=86400000;
  const unique=new Map<string,FinalResult>(), conflicts=new Set<string>();
  for(const g of rows){
    if(!g.id||!g.home||!g.away||g.home===g.away||!Number.isFinite(g.at)||g.at>=cutoff||
      g.at<cutoff-365*day||![g.homeScore,g.awayScore].every(n=>Number.isInteger(n)&&n>=0))continue;
    const old=unique.get(g.id);
    if(old&&(old.at!==g.at||old.home!==g.home||old.away!==g.away||old.homeScore!==g.homeScore||old.awayScore!==g.awayScore))conflicts.add(g.id);
    else unique.set(g.id,g);
  }
  const games=[...unique.values()].filter(g=>!conflicts.has(g.id)).sort((a,b)=>b.at-a.at||a.id.localeCompare(b.id));
  const byTeam=new Map<string,FinalResult[]>();
  for(const g of games)for(const id of [g.home,g.away]){
    const bucket=byTeam.get(id);
    if(bucket)bucket.push(g);else byTeam.set(id,[g]);
  }
  const points=(g:FinalResult,id:string)=>g.homeScore===g.awayScore?.5:Number((g.homeScore>g.awayScore)===(g.home===id));
  function form(id:string):RecentForm|null{
    const recent=(byTeam.get(id)||[]).filter(g=>g.at>=cutoff-maxAgeDays*day).slice(0,8);
    if(recent.length<3)return null;
    let weighted=0,weights=0,ratedOpponents=0,wins=0,ties=0;
    for(const [i,g] of recent.entries()){
      const rival=g.home===id?g.away:g.home;
      const prior=(byTeam.get(rival)||[]).filter(p=>p.at<g.at&&p.at>=g.at-180*day).slice(0,20);
      const point=points(g,id),weight=.85**i;
      const strength=prior.length>=3?(2+prior.reduce((sum,p)=>sum+points(p,rival),0))/(4+prior.length):.5;
      ratedOpponents+=Number(prior.length>=3);wins+=Number(point===1);ties+=Number(point===.5);
      weighted+=weight*(point+.5*(strength-.5));weights+=weight;
    }
    // Shrink toward an even record when few recent results are available.
    return {games:recent.length,wins,ties,ratedOpponents,rating:Math.max(0,Math.min(1,(weighted+1.5)/(weights+3))),latest:new Date(recent[0].at).toISOString()};
  }
  return {home:form(home),away:form(away),asOf:new Date(cutoff).toISOString()};
}

export function pregameEvidence(e:MatchEvidence|undefined,now:number,start:number):MatchEvidence|undefined{
  if(!e||!(now<start))return undefined;
  const valid=(time:string|undefined,ttl:number)=>{const at=Date.parse(time||'');return at<=now&&at<start&&now-at<=ttl;};
  const form=valid(e.asOf,36*3600000),absences=e.absences&&valid(e.absences.checkedAt,3600000)?e.absences:null;
  if(!form&&!absences)return undefined;
  return {...e,home:form?e.home:null,away:form?e.away:null,absences};
}
export function formAdvantage(e?:MatchEvidence){
  return e?.home&&e.away?e.home.rating-e.away.rating:0;
}
export function absenceLoad(rows:Absence[]|null|undefined){
  return rows?.length?Math.min(1,rows.reduce((total,p)=>total+p.weight,0)/4):0;
}
export function availabilityAdvantage(e?:MatchEvidence){
  return absenceLoad(e?.absences?.away)-absenceLoad(e?.absences?.home);
}

// Use the existing season and injury budgets. Personal settings can turn either factor off.
export function baseballSeasonSignal(season:number,e?:MatchEvidence){
  return e?.home&&e.away? .65*season+.35*formAdvantage(e):season;
}
export function baseballRunMultiplier(e:MatchEvidence|undefined,home:boolean){
  const shift=.14*formAdvantage(e)+.08*availabilityAdvantage(e);
  return Math.exp(home?shift:-shift);
}
export function evidenceDescription(e:MatchEvidence,side:'home'|'away'){
  const f=e[side], injuries=e.absences?.[side];
  const record=f?`近 ${f.games} 場 ${f.wins} 勝 ${f.games-f.wins-f.ties} 敗${f.ties?' '+f.ties+' 和':''}，其中 ${f.ratedOpponents} 場有對手強度資料`:'近期完賽樣本不足';
  const injured=injuries?.length?'傷情報告列出 '+injuries.map(p=>p.name).join('、'):injuries?'來源未列符合條件的傷員':'傷情未確認';
  return record+'。'+injured+'。';
}
