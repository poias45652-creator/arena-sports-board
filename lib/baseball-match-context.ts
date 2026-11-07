import {cachedMatchSource,matchSourceText} from './match-source-cache';
import {recentOpponents,type Absence,type FinalResult,type MatchEvidence} from './recent-opponents';
import {isMlbAnalysisGame,isPregame,shiftDay,teamIds,type Match} from './baseball';
import {profileCode,profileTeamId,type ProfileLeague} from './international-profile';
import {internationalTeam} from './international-teams';
import type {KboRunHistory} from './kbo-team-runs';
import type {PregameData} from './international-pregame';

const dayMs=86400000;
const mlbHistory=cachedMatchSource(async day=>{
  const url='https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate='+shiftDay(day,-85)+'&endDate='+day;
  const data=JSON.parse(await matchSourceText(url,15_000_000)),games:FinalResult[]=[];
  for(const d of data.dates||[])for(const g of d.games||[]){
    if(!isMlbAnalysisGame(g.gameType)||g.status?.abstractGameState!=='Final'||!['Final','Game Over','Completed Early'].includes(g.status?.detailedState))continue;
    if(!g.teams?.home?.team?.id||!g.teams?.away?.team?.id||!g.gamePk)continue;
    games.push({id:String(g.gamePk),at:Date.parse(g.gameDate),home:String(g.teams.home.team.id),away:String(g.teams.away.team.id),homeScore:g.teams.home.score,awayScore:g.teams.away.score});
  }
  return games;
},300000);

const mlbInjuryUrl='https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/injuries?limit=1000';
const mlbInjuries=cachedMatchSource(async()=>JSON.parse(await matchSourceText(mlbInjuryUrl,4_000_000)),600000);

export function mlbReportedAbsences(raw:any,game:Match,now:number):MatchEvidence['absences']{
  const stamp=Date.parse(raw?.timestamp),age=now-stamp;
  if(raw?.status!=='success'||raw.season?.year!==game.season||!Array.isArray(raw.injuries)||
    !Number.isFinite(age)||age<0||age>3600000||Date.parse(game.date)-now>3*dayMs)return null;
  const side=(key:'home'|'away')=>{
    const team=game[key];
    const groups=raw.injuries.filter((g:any)=>g.displayName===team.name);
    if(groups.length!==1||!Array.isArray(groups[0].injuries))return null;
    const latest=new Map<string,any>();
    for(const r of groups[0].injuries){
      const athlete=r.athlete,t=athlete?.team,at=Date.parse(r.date);
      if(!t||t.id!==groups[0].id||teamIds[t.abbreviation]!==team.id||!athlete.displayName||
        !Number.isFinite(at)||at>now||now-at>14*dayMs)continue;
      if(!latest.has(athlete.displayName)||at>Date.parse(latest.get(athlete.displayName).date))latest.set(athlete.displayName,r);
    }
    return [...latest.values()].flatMap(r=>{
      if(!r.details?.type||r.athlete.position?.abbreviation==='SP'||r.athlete.displayName===team.pitcherName||
        (r.details.returnDate&&Date.parse(r.details.returnDate)<now-dayMs))return [];
      const weight=({Out:1,'Day-To-Day':.35,Doubtful:.65,Questionable:.35} as Record<string,number>)[r.status];
      return weight?[{name:String(r.athlete.displayName),weight}]:[];
    });
  };
  return {home:side('home'),away:side('away'),source:mlbInjuryUrl,checkedAt:new Date(stamp).toISOString()};
}
export async function attachMlbEvidence(games:Match[]){
  const day=new Date().toISOString().slice(0,10);
  const [history,report]=await Promise.all([mlbHistory(day).catch(()=>[]),mlbInjuries('MLB').catch(()=>null)]);
  const now=Date.now();
  return games.map(g=>{
    if(!isPregame(g,now))return g;
    return {...g,matchEvidence:{...recentOpponents(history,String(g.home.id),String(g.away.id),now,45),absences:mlbReportedAbsences(report,g,now)}};
  });
}

const injuryCodes:Record<ProfileLeague,Record<string,string>>={
  NPB:{yg:'g',han:'t',db:'db',chu:'d',hir:'c',ys:'s',sbh:'h',nhf:'f',orx:'b',rak:'e',sei:'l',clm:'m'},
  KBO:{kt:'KT',lg:'LG',nc:'NC',ssg:'SK',ss:'SS',kia:'HT',ds:'OB',hh:'HH',lt:'LT',kw:'WO'},
  CPBL:{ctb:'ACN',ul:'ADD',wcd:'AAA',wd:'AAA'},
};
const injuryUrl=(league:string)=>'https://dailyil.com/en/league/'+league.toLowerCase()+'/';
export function parseBaseballAbsences(html:string,league:ProfileLeague,now:number){
  const latest=new Map<string,{code:string;name:string;status:string;at:number}>();
  for(const row of html.matchAll(/<tr\b[^>]*\bdata-status="[^"]+"[^>]*>/gi)){
    const attr=(name:string)=>row[0].match(new RegExp(' '+name+'="([^"]*)"','i'))?.[1];
    const team=attr('data-team')?.match(/^\/en\/team\/([a-z]+)-([a-z0-9]+)\/$/),date=attr('data-k-checked'),name=attr('data-k-player'),status=attr('data-status');
    if(!team||team[1]!==league.toLowerCase()||!status||!date||!name||!/^\d{4}-\d{2}-\d{2}$/.test(date)||attr('data-pos')==='SP')continue;
    const at=Date.parse(date+'T00:00:00+08:00'),age=now-at,code=injuryCodes[league][team[2]];
    if(!code||!Number.isFinite(age)||age<0||age>7*dayMs)continue;
    const key=code+'|'+name,old=latest.get(key);
    if(!old||at>old.at)latest.set(key,{code,name,status,at});
    else if(at===old.at&&status!==old.status)old.status='unconfirmed';
  }
  const players=new Map<string,Map<string,Absence>>();
  for(const {code,name,status} of latest.values()){
    const weight=({OUT:1,IL:1,DOUBTFUL:.65,QUESTIONABLE:.35} as Record<string,number>)[status];
    if(!weight)continue;
    const group=players.get(code)||new Map<string,Absence>();
    group.set(name,{name,weight});players.set(code,group);
  }
  return players;
}
const injuryPages=cachedMatchSource(async league=>({html:await matchSourceText(injuryUrl(league),1_000_000),checkedAt:new Date().toISOString()}),600000);

export async function attachInternationalEvidence(data:PregameData,historyPromise:Promise<KboRunHistory|null>){
  const league=data.league as ProfileLeague;
  const [history,page]=await Promise.all([historyPromise.catch(()=>null),injuryPages(league).catch(()=>null)]);
  const now=Date.now(),fresh=history&&!history.warnings.length&&now-Date.parse(history.fetchedAt)>=0&&now-Date.parse(history.fetchedAt)<36*3600000;
  const injuries=page?parseBaseballAbsences(page.html,league,now):null;
  const rows:FinalResult[]=fresh?history.games.filter(g=>g.season===data.season&&g.completed&&g.state==='Final'&&g.homeScore!==null&&g.awayScore!==null&&g.date<data.date)
    .map(g=>({id:String(g.id),at:Date.parse(g.start),home:String(g.homeId),away:String(g.awayId),homeScore:g.homeScore!,awayScore:g.awayScore!})):[];
  return {...data,games:data.games.map(g=>{
    const start=Date.parse(g.start.replace(' ','T')+'+08:00');
    if(!(start>now))return g;
    const code=(side:'home'|'away')=>profileCode(league,internationalTeam(g[side].team,league))||'';
    const names=(c:string)=>injuries?.has(c)?[...injuries.get(c)!.values()]:null;
    const home=code('home'),away=code('away');
    const absences=page&&start-now<=3*dayMs?{home:names(home),away:names(away),source:injuryUrl(league),checkedAt:page.checkedAt}:null;
    const matchEvidence:MatchEvidence={...recentOpponents(rows,String(profileTeamId(league,home)),String(profileTeamId(league,away)),now,45),asOf:fresh?history.fetchedAt:undefined,absences};
    return {...g,matchEvidence};
  })};
}
