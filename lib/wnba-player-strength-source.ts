import {currentWnbaAnalysisRosters} from './wnba-current-rosters';
import {WnbaSourceUnavailable} from './wnba-fetch';
import {officialWnbaAnalysisRosters} from './wnba-official';
import {applyPlayerStrength,type NbaPlayerContext} from './wnba-player-strength';
import type {NbaGame} from './nba';
import type {EfficiencyAnalysis} from './basketball-efficiency';

export async function enrichWnbaPlayerStrength(game:NbaGame,base:EfficiencyAnalysis){
 if(base.status!=='ready')return base;
 try{
  let evidence;
  try{evidence=await officialWnbaAnalysisRosters(game.home.id,game.away.id,game.season);}
  catch(error){
   if(!(error instanceof WnbaSourceUnavailable))throw error;
   evidence=await currentWnbaAnalysisRosters(game.home.id,game.away.id,game.season);
  }
  const enriched=applyPlayerStrength(game,base,evidence.home,evidence.away,Date.now());
  // A valid current team projection remains available while individual stats
  // refresh, or before the 72-hour availability window begins.
  if(enriched.status==='waiting'&&['player_snapshot_missing_or_stale','outside_availability_window'].includes(enriched.playerContext?.reason||''))return {...base,playerContext:enriched.playerContext};
  return enriched;
 }catch(error){
  console.error('wnba-player-context-unavailable',{message:error instanceof Error?error.message:'source failure'});
  const playerContext:NbaPlayerContext={status:'unavailable',reason:'official_roster_or_availability_unavailable',calibrated:false,preseason:game.phase===1,minutesConfirmed:false,recommendationEligible:false,sourceFetchedAt:new Date().toISOString(),statsCapturedAt:'',home:[],away:[],sources:[]};
  if(error instanceof WnbaSourceUnavailable)return {...base,playerContext};
  return {...base,status:'waiting' as const,expected:undefined,probabilities:undefined,simulation:undefined,playerContext};
 }
}
