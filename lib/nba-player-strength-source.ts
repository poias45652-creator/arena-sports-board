import {officialAnalysisTeam,officialAnalysisPlayer} from './nba-official';
import {applyPlayerStrength,availabilityFromNews,type PlayerEvidence,type NbaPlayerContext} from './nba-player-strength';
import type {NbaGame} from './nba';
import type {EfficiencyAnalysis} from './basketball-efficiency';
export async function enrichNbaPlayerStrength(game:NbaGame,base:EfficiencyAnalysis){
 if(base.status!=='ready')return base;
 const now=Date.now();
 try{
  const profiles=await Promise.all([officialAnalysisTeam(game.home.id),officialAnalysisTeam(game.away.id)]);
  const evidence=await Promise.all(profiles.map(async(t,side)=>{
   if(Number(t.rosterSeason)!==game.season-1)throw Error('NBA 現役名單球季不符');
   const opponent=profiles[1-side];const words=[...opponent.englishNames,opponent.sourceUrl.split('/').at(-1)!];
   return Promise.all(t.roster.map(async p=>{
    const player=await officialAnalysisPlayer(p.id).catch(()=>null);
    if(!player)return availabilityFromNews(p.id,p.name,t.sourceUrl,t.news,now,words);
    if(player.team?.id!==t.team.id)throw Error('NBA 球員轉隊資料尚未同步');
    return availabilityFromNews(p.id,p.name,player.sourceUrl,[...player.news,...t.news],now,words);
   }));
  }));
  return applyPlayerStrength(game,base,evidence[0],evidence[1],Date.now());
 }catch(error){
  console.error('nba-player-context-unavailable',{message:error instanceof Error?error.message:'source failure'});
  const playerContext:NbaPlayerContext={status:'unavailable',reason:'official_roster_or_availability_unavailable',calibrated:false,preseason:game.phase===1,minutesConfirmed:false,recommendationEligible:false,sourceFetchedAt:new Date().toISOString(),statsCapturedAt:'',home:[],away:[],sources:[]};
  return {...base,status:'waiting' as const,expected:undefined,probabilities:undefined,simulation:undefined,playerContext};
 }
}
