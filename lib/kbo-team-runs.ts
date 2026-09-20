import type {PregameData} from './international-pregame';
import {profileCode,profileTeamId,type ProfileGame} from './international-profile';
import {internationalTeam} from './international-teams';

export type KboRunHistory={games:ProfileGame[];fetchedAt:string;warnings:string[];sources:{label:string;url:string}[]};
const RULE_URL='https://www.koreabaseball.com/Kbo/League/GameManage2025.aspx';
const startTime=(s:string)=>Date.parse(s.replaceAll('/','-').replace(' ','T')+'+08:00');

// Derive measured team rates from dated, completed regular-season games.
// Do not use today's results, relabel an old capture, or guess a doubleheader's rules.
export function supplementKboTeamRuns(data:PregameData,history:KboRunHistory,now=Date.now()):PregameData{
 if(data.league!=='KBO'||data.season!==2026||history.warnings.length)return data;
 const observed=Date.parse(history.fetchedAt);
 if(!Number.isFinite(observed)||observed>now||now-observed>36*3600000)return data;
 const unique=new Map<number,ProfileGame>();
 for(const g of history.games){
  if(g.season!==data.season)continue;
  const old=unique.get(g.id);
  if(old&&['date','start','homeId','awayId','homeScore','awayScore','completed'].some(k=>old[k as keyof ProfileGame]!==g[k as keyof ProfileGame]))return data;
  unique.set(g.id,g);
 }
 const games=[...unique.values()];
 return {...data,games:data.games.map(g=>{
  if(g.league!=='KBO'||g.date!==data.date||!g.start.startsWith(g.date+' ')||observed>=startTime(g.start))return g;
  if(g.comparisonSource&&Date.parse(g.comparisonSource.observedAt)>observed)return g;
  const codes={away:profileCode('KBO',internationalTeam(g.away.team,'KBO')),home:profileCode('KBO',internationalTeam(g.home.team,'KBO'))};
  if(!codes.away||!codes.home||codes.away===codes.home)return g;
  const ids={away:profileTeamId('KBO',codes.away),home:profileTeamId('KBO',codes.home)};
  const fixtures=games.filter(x=>x.date===g.date&&[x.homeId,x.awayId].includes(ids.home)&&[x.homeId,x.awayId].includes(ids.away));
  const fixture=fixtures[0];
  // Only a single, timed official regular-season fixture is supported in v1.
  if(fixtures.length!==1||!fixture.timeKnown||fixture.homeId!==ids.home||fixture.awayId!==ids.away||Date.parse(fixture.start)!==startTime(g.start))return {...g,rules:undefined};
  const prior=games.filter(x=>x.date<g.date&&x.completed&&x.state==='Final');
  if(prior.some(x=>![x.homeScore,x.awayScore].every(n=>typeof n==='number'&&Number.isInteger(n)&&n>=0&&n<=100)||x.homeId===x.awayId))return g;
  const rows=(['away','home'] as const).map(side=>{
   const id=ids[side],matches=prior.filter(x=>x.homeId===id||x.awayId===id);
   const summary=(selected:ProfileGame[])=>{
    let scored=0,allowed=0,wins=0,losses=0,ties=0;
    for(const x of selected){const a=(x.homeId===id?x.homeScore:x.awayScore)!,b=(x.homeId===id?x.awayScore:x.homeScore)!;scored+=a;allowed+=b;if(a>b)wins++;else if(a<b)losses++;else ties++;}
    return {record:`${wins}-${losses}-${ties}`,rates:selected.length?`${(scored/selected.length).toFixed(6)} / ${(allowed/selected.length).toFixed(6)}`:''};
   };
   const all=summary(matches),home=summary(matches.filter(x=>x.homeId===id)),away=summary(matches.filter(x=>x.awayId===id));
   return [g[side].team,'本季',all.record,all.rates,home.record,home.rates,away.record,away.rates];
  });
  return {...g,comparison:{title:'本站依賽前完賽紀錄計算',headers:['球隊','類別','勝敗','得/失分','主場勝率','主場得/失分','客場勝率','客場得/失分'],rows},
   comparisonSource:{name:'KBO 例行賽完賽紀錄彙算',url:history.sources[0]?.url||'',observedAt:history.fetchedAt,throughDate:prior.map(x=>x.date).sort().at(-1)||'',games:prior.length},
   rules:{league:'KBO',season:data.season,phase:'regular',maxInnings:11,sourceUrl:RULE_URL,fixtureObservedAt:history.fetchedAt}};
 })};
}
