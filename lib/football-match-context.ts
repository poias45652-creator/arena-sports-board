import {loadFootballPlayerRole} from './football-player-role';
import {tiltFootballGrid,shotTilts,featuredThreshold,type ShotEstimate,domesticLeague} from './football-five-league';
import {footballTeamName,type FootballAnalysis,type FootballGame,type FootballLeague,type FootballContextForecast} from './football';
import {reviewedFotmobTeamId} from './football-cup-xg-source';
import {cachedMatchSource,matchSourceText} from './match-source-cache';
import contextAudit from '../data/football/context-calibration-20261107.json';
import {availabilityAdvantage,formAdvantage,recentOpponents,pregameEvidence,type Absence,type MatchEvidence,type FinalResult} from './recent-opponents';

const leagues:Record<FootballLeague,number>={'eng.1':47,'esp.1':87,'ita.1':55,'ger.1':54,'fra.1':53,'uefa.champions':42,'uefa.europa':73,'uefa.nations':9806};
const daily=cachedMatchSource(async day=>JSON.parse(await matchSourceText('https://www.fotmob.com/api/data/matches?date='+day,4_000_000)),300000);
const detail=cachedMatchSource(async id=>({data:JSON.parse(await matchSourceText('https://www.fotmob.com/api/data/matchDetails?matchId='+id,3_000_000)),checkedAt:new Date().toISOString()}),300000);
const normalize=(s:string)=>footballTeamName(s).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
function sameTeam(team:FootballGame['home'],provider:{id:number;name:string}|undefined){
  if(!provider)return false;
  const reviewed=reviewedFotmobTeamId(provider.id);
  if(reviewed)return reviewed===team.id;
  const name=provider.name;
  return typeof name==='string'&&[team.englishName,team.name].some(n=>normalize(n)===normalize(name));
}
export async function footballAbsences(game:FootballGame):Promise<MatchEvidence['absences']>{
  const kickoff=Date.parse(game.start), leagueIds=game.league==='uefa.nations'?[9806,9807,9808,9809,10718,10719]:[leagues[game.league]];
  if(!(kickoff>Date.now())||kickoff-Date.now()>7*86400000)return null;
  try{
    const schedule=await daily(new Date(kickoff).toISOString().slice(0,10).replaceAll('-',''));
    const matches=(schedule.leagues||[]).filter((l:any)=>leagueIds.includes(l.primaryId)||leagueIds.includes(l.id))
      .flatMap((l:any)=>l.matches||[]).filter((m:any)=>m.status?.started===false&&!m.status.cancelled&&Date.parse(m.status.utcTime)===kickoff&&
        sameTeam(game.home,m.home)&&sameTeam(game.away,m.away));
    if(matches.length!==1||!Number.isSafeInteger(matches[0].id))return null;
    const match=matches[0],{data,checkedAt}=await detail(String(match.id)),g=data.general,lineup=data.content?.lineup;
    if(!g||g.started!==false||String(g.matchId)!==String(match.id)||Date.parse(g.matchTimeUTCDate)!==kickoff||
      (!leagueIds.includes(g.leagueId)&&!leagueIds.includes(g.parentLeagueId))||lineup?.matchId!==match.id||Date.now()>=kickoff)return null;
    const useMinutes=domesticLeague(game.league);
    async function side(key:'home'|'away'):Promise<Absence[]|null>{
      const team=lineup[key+'Team'];
      if(team?.id!==match[key].id||g[key+'Team']?.id!==team.id||!Array.isArray(team.unavailable))return null;
      const players=new Map<number,Absence>();
      for(const p of team.unavailable){
        const status=p.unavailability?.type;
        if(!Number.isSafeInteger(p.id)||!p.name||(status!=='injury'&&!(useMinutes&&status==='suspension')))continue;
        const uncertain=/doubtful|questionable|fitness test/i.test(p.unavailability.expectedReturn||'');
        players.set(p.id,{name:p.name,weight:uncertain?.35:1,...(useMinutes?{playerId:p.id,status}:{})});
      }
      if(!useMinutes)return [...players.values()];
      return Promise.all([...players].map(async ([id,player])=>{
        const role=await loadFootballPlayerRole(id,team.id,g.leagueId,Date.parse(checkedAt));
        return {...player,role,weight:role?player.weight*role.minutes/(90*role.games):0};
      }));
    }
    const [home,away]=await Promise.all([side('home'),side('away')]);
    if(Date.now()>=kickoff)return null;
    return {home,away,...(useMinutes?{method:'minutes' as const}:{}),source:'https://www.fotmob.com/match/'+match.id,checkedAt};
  }catch{return null;}
}

type DomesticContext={study:{featuredEnabled:boolean;drawAlertEnabled:boolean;drawThreshold:number;applyShots:boolean};
  shots:ShotEstimate|null;scoreFallback?:boolean;form?:{rows:FinalResult[];home:string;away:string}};
export function withFootballMatchContext(game:FootballGame,base:FootballAnalysis,history:FootballGame<string>[],absences:MatchEvidence['absences'],now=Date.now(),domestic?:DomesticContext):FootballAnalysis{
  const kickoff=Date.parse(game.start);
  if(base.status!=='ready'||game.state!=='scheduled'||!base.scoreDistribution||!base.probabilities||!(kickoff>now))return base;
  const marketStudy=base.version===contextAudit.baseVersion && (game.league==='ger.1'||game.league==='ita.1')
    ?contextAudit.leagues[game.league]:null;
  const cutoff=marketStudy||domestic?Math.floor(now/86400000)*86400000:now;
  const rows=history.filter(g=>g.id!==game.id&&g.state==='final'&&g.statusName==='STATUS_FULL_TIME'&&g.homeScore!==null&&g.awayScore!==null&&Date.parse(g.start)<cutoff)
    .map(g=>({id:g.id,at:Date.parse(g.start),home:g.home.id,away:g.away.id,homeScore:g.homeScore!,awayScore:g.awayScore!}));
  const leagueForm=domestic?.form;
  const raw={...recentOpponents(leagueForm?leagueForm.rows.filter(g=>g.at<cutoff):rows,leagueForm?.home??game.home.id,leagueForm?.away??game.away.id,now,game.league==='uefa.nations'?180:100),absences};
  const evidence=pregameEvidence(raw,now,kickoff)!;
  const hasHome=Array.isArray(evidence.absences?.home),hasAway=Array.isArray(evidence.absences?.away);
  const useExtraForm=!base.cupAdjustment&&game.league!=='uefa.nations'&&(!marketStudy||marketStudy.selection==='v1');
  const formShift=useExtraForm ? 0.16*formAdvantage(evidence) : 0;
  const measured=!!domesticLeague(game.league)&&evidence.absences?.method==='minutes';
  const missingRole=measured&&[...(evidence.absences?.home??[]),...(evidence.absences?.away??[])].some(p=>!p.role);
  const injuryShift=missingRole?0:.075*availabilityAdvantage(evidence);
  const formGrid=formShift?tiltFootballGrid(base.scoreDistribution,formShift):null;
  const contextForecast:FootballContextForecast={baseline:base.probabilities,formOnly:formGrid?.probabilities??base.probabilities,
    formPolicy:useExtraForm?'recent':'base',injuryCoverage:hasHome&&hasAway?'both':hasHome||hasAway?'partial':'none',injuryShiftApplied:injuryShift!==0};
  const shots=domestic?.study.applyShots&&domestic.shots&&base.expected?shotTilts(base.expected,domestic.shots):undefined;
  const afterShots=shots?tiltFootballGrid(base.scoreDistribution,formShift,shots):formGrid;
  const afterInjuries=injuryShift?tiltFootballGrid(base.scoreDistribution,formShift+injuryShift,shots):afterShots;
  const published=afterInjuries?.probabilities??base.probabilities;
  const finalTop=Math.max(published.home,published.draw,published.away);
  const domesticForecast=domestic?{policy:'five-league-v1' as const,scoreFallback:!!domestic.scoreFallback,featured:domestic.study.featuredEnabled&&finalTop>=featuredThreshold,
    drawRisk:domestic.study.drawAlertEnabled&&published.draw>=domestic.study.drawThreshold,shotApplied:!!shots,
    beforeShots:formGrid?.probabilities??base.probabilities,afterShots:afterShots?.probabilities??base.probabilities,
    ...(shots&&domestic.shots?{shotGames:{home:domestic.shots.homeGames,away:domestic.shots.awayGames}}:{})}:undefined;
  const version=domestic?base.version+'-five-league-v1':(marketStudy||formShift||injuryShift) ? base.version+'-recent-availability-v2' : base.version;
  const result={...base,version,capturedAt:new Date(now).toISOString(),matchEvidence:evidence,contextForecast,...(domesticForecast?{domesticForecast}:{})};
  if(!afterInjuries)return result;
  const adjusted=afterInjuries;
  const p=adjusted.probabilities;
  const ranked=[{name:'主勝',p:p.home},{name:'和局',p:p.draw},{name:'客勝',p:p.away}].sort((a,b)=>b.p-a.p);
  return {...result,...adjusted,lean:ranked[0].p-ranked[1].p>=.08?`模型傾向${ranked[0].name}`:'勝負接近，保留觀望',
    calibration:{status:'baseline',label:injuryShift?'已套用雙方傷停':shots?'已套用近期射門品質':'已套用近期表現',version,reasons:['傷停幅度另以實際賽前紀錄核對'],holdoutGames:0,recentGames:0,uncertainty:'個別賽事的機率仍有不確定性。'},
    notes:[...base.notes.map(n=>'基礎模型：'+n),'調整後的勝和負與比分使用同一份分布。']};
}
