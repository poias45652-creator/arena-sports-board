import {BasketballSourceUnavailable} from './wnba-fetch';
import {officialAnalysisTeam,officialAnalysisPlayer} from './nba-official';
import {applyPlayerStrength,availabilityFromNews,type PlayerEvidence,type NbaPlayerContext} from './nba-player-strength';
import type {NbaGame} from './nba';
import type {EfficiencyAnalysis} from './basketball-efficiency';
export async function enrichNbaPlayerStrength(game:NbaGame,base:EfficiencyAnalysis){
 if(base.status!=='ready')return base;
 const now=Date.now();
 try{
  const profiles=await Promise.all([officialAnalysisTeam(game.home.id),officialAnalysisTeam(game.away.id)]);
  const deadline=Date.now()+20000;
  const evidence=await Promise.all(profiles.map(async(t,side)=>{
   if(Number(t.rosterSeason)!==game.season-1)throw Error('NBA 現役名單球季不符');
   const opponent=profiles[1-side];const words=[...opponent.englishNames,opponent.sourceUrl.split('/').at(-1)!];
   return Promise.all(t.roster.map(async p=>{
    const player=await officialAnalysisPlayer(p.id,deadline).catch(error=>{if(error instanceof BasketballSourceUnavailable)return null;throw error;});
    if(!player)return availabilityFromNews(p.id,p.name,t.sourceUrl,t.news,now,words);
    if(player.team?.id!==t.team.id)throw Error('NBA 球員轉隊資料尚未同步');
    return availabilityFromNews(p.id,p.name,player.sourceUrl,[...player.news,...t.news],now,words);
   }));
  }));
  const enriched=applyPlayerStrength(game,base,evidence[0],evidence[1],Date.now());
  if(enriched.status==='waiting'&&['player_snapshot_missing_or_stale','outside_availability_window'].includes(enriched.playerContext?.reason||''))return {...base,playerContext:enriched.playerContext};
  return enriched;
 }catch(error){
  console.error('nba-player-context-unavailable',{message:error instanceof Error?error.message:'source failure'});
  const playerContext:NbaPlayerContext={status:'unavailable',reason:'official_roster_or_availability_unavailable',calibrated:false,preseason:game.phase===1,minutesConfirmed:false,recommendationEligible:false,sourceFetchedAt:new Date().toISOString(),statsCapturedAt:'',home:[],away:[],sources:[]};
  // Player evidence is supplemental to the independently validated team boxes.
  // Discard inconsistent evidence and disable picks; retain the team projection.
  return {...base,playerContext};
 }
}
