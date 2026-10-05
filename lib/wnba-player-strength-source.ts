import {officialWnbaAnalysisRosters} from './wnba-official';
import {applyPlayerStrength,type NbaPlayerContext} from './wnba-player-strength';
import type {NbaGame} from './nba';
import type {EfficiencyAnalysis} from './basketball-efficiency';

export async function enrichWnbaPlayerStrength(game:NbaGame,base:EfficiencyAnalysis){
 if(base.status!=='ready')return base;
 try{
  const evidence=await officialWnbaAnalysisRosters(game.home.id,game.away.id,game.season);
  return applyPlayerStrength(game,base,evidence.home,evidence.away,Date.now());
 }catch(error){
  console.error('wnba-player-context-unavailable',{message:error instanceof Error?error.message:'source failure'});
  const playerContext:NbaPlayerContext={status:'unavailable',reason:'official_roster_or_availability_unavailable',calibrated:false,preseason:game.phase===1,minutesConfirmed:false,recommendationEligible:false,sourceFetchedAt:new Date().toISOString(),statsCapturedAt:'',home:[],away:[],sources:[]};
  return {...base,status:'waiting' as const,expected:undefined,probabilities:undefined,simulation:undefined,playerContext};
 }
}
