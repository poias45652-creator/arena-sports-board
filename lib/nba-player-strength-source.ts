import {officialAnalysisTeam,officialAnalysisPlayer} from './nba-official';
import {applyPlayerStrength,availabilityFromNews,type PlayerEvidence,type NbaPlayerContext} from './nba-player-strength';
import type {NbaGame} from './nba';
import type {EfficiencyAnalysis} from './basketball-efficiency';
export type PreparedNbaEvidence={ok:true;home:PlayerEvidence[];away:PlayerEvidence[]}|{ok:false;error:unknown};
// Roster/availability reads are independent of historical efficiency. A settled
// result allows the caller to start both pipelines without unhandled rejection
// when the other pipeline fails. No missing player is assumed healthy.
export async function prepareNbaPlayerStrength(game:NbaGame):Promise<PreparedNbaEvidence>{
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
  return {ok:true,home:evidence[0],away:evidence[1]};
 }catch(error){return {ok:false,error};}
}
export async function enrichNbaPlayerStrength(game:NbaGame,base:EfficiencyAnalysis,prepared?:PreparedNbaEvidence){
 if(base.status!=='ready')return base;
 try{
  const evidence=prepared??await prepareNbaPlayerStrength(game);
  if(!evidence.ok)throw evidence.error;
  return applyPlayerStrength(game,base,evidence.home,evidence.away,Date.now());
 }catch(error){
  console.error('nba-player-context-unavailable',{message:error instanceof Error?error.message:'source failure'});
  const playerContext:NbaPlayerContext={status:'unavailable',reason:'official_roster_or_availability_unavailable',calibrated:false,preseason:game.phase===1,minutesConfirmed:false,recommendationEligible:false,sourceFetchedAt:new Date().toISOString(),statsCapturedAt:'',home:[],away:[],sources:[]};
  return {...base,status:'waiting' as const,expected:undefined,probabilities:undefined,simulation:undefined,playerContext};
 }
}
