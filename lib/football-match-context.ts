import {footballTeamName,type FootballAnalysis,type FootballGame,type FootballLeague} from './football';
import {reviewedFotmobTeamId} from './football-cup-xg-source';
import {cachedMatchSource,matchSourceText} from './match-source-cache';
import {absenceLoad,formAdvantage,recentOpponents,type Absence,type MatchEvidence} from './recent-opponents';

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
    function side(key:'home'|'away'):Absence[]|null{
      const team=lineup[key+'Team'];
      if(team?.id!==match[key].id||g[key+'Team']?.id!==team.id||!Array.isArray(team.unavailable))return null;
      const players=new Map<number,Absence>();
      for(const p of team.unavailable){
        if(!Number.isSafeInteger(p.id)||!p.name||p.unavailability?.type!=='injury')continue;
        const uncertain=/doubtful|questionable|fitness test/i.test(p.unavailability.expectedReturn||'');
        players.set(p.id,{name:p.name,weight:uncertain?.35:1});
      }
      return [...players.values()];
    }
    return {home:side('home'),away:side('away'),source:'https://www.fotmob.com/match/'+match.id,checkedAt};
  }catch{return null;}
}

// Tilt the original score grid so model-specific draw and total corrections survive.
export function withFootballMatchContext(game:FootballGame,base:FootballAnalysis,history:FootballGame<string>[],absences:MatchEvidence['absences'],now=Date.now()):FootballAnalysis{
  if(base.status!=='ready'||game.state!=='scheduled'||!base.scoreDistribution||!(Date.parse(game.start)>now))return base;
  const rows=history.filter(g=>g.id!==game.id&&g.state==='final'&&g.statusName==='STATUS_FULL_TIME'&&g.homeScore!==null&&g.awayScore!==null)
    .map(g=>({id:g.id,at:Date.parse(g.start),home:g.home.id,away:g.away.id,homeScore:g.homeScore!,awayScore:g.awayScore!}));
  const evidence={...recentOpponents(rows,game.home.id,game.away.id,now,game.league==='uefa.nations'?180:100),absences};
  const existingOpponentForm=!!base.cupAdjustment||game.league==='uefa.nations';
  const shift=(existingOpponentForm?0:.16*formAdvantage(evidence))+.075*(absenceLoad(absences?.away)-absenceLoad(absences?.home));
  if(!shift)return {...base,matchEvidence:evidence};
  const scores=base.scoreDistribution.scores.map(s=>({...s,probability:s.probability*Math.exp(shift*(s.home-s.away))}));
  const mass=scores.reduce((sum,s)=>sum+s.probability,0);
  const p={home:0,draw:0,away:0,over25:0,under25:0,btts:0},expected={home:0,away:0};
  for(const s of scores){
    s.probability/=mass;
    p[s.home>s.away?'home':s.home===s.away?'draw':'away']+=s.probability;
    p[s.home+s.away>2?'over25':'under25']+=s.probability;
    if(s.home&&s.away)p.btts+=s.probability;
    expected.home+=s.home*s.probability;expected.away+=s.away*s.probability;
  }
  const ranked=[{name:'主勝',p:p.home},{name:'和局',p:p.draw},{name:'客勝',p:p.away}].sort((a,b)=>b.p-a.p);
  const version=base.version+'-recent-availability-v1';
  return {...base,version,matchEvidence:evidence,expected,probabilities:p,scoreDistribution:{...base.scoreDistribution,...expected,scores},
    scores:[...scores].sort((a,b)=>b.probability-a.probability).slice(0,3),lean:ranked[0].p-ranked[1].p>=.08?'模型傾向'+ranked[0].name:'勝負接近，保留觀望',
    calibration:{status:'baseline',label:'近況與傷停調整',version,reasons:['調整後的勝率需另行驗證'],holdoutGames:0,recentGames:0,uncertainty:'調整幅度尚待獨立回測。'},
    notes:[...base.notes.map(n=>'基礎模型：'+n),'調整後的勝和負與比分使用同一份分布。']};
}
