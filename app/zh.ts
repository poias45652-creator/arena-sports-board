// Display names only: source identifiers and numeric values stay unchanged.
import {MLB_TEAM_NAMES as teams} from '@/lib/mlb-team-names';
export function teamZh(team: {id?:number;name?:string}|undefined){return teams[team?.id??0] || team?.name || '球隊待確認';}
export function gameDetailZh(game:any){
  const state=game.status?.detailedState || '', line=game.linescore;
  const special:Record<string,string>={Postponed:'延期',Cancelled:'取消',Suspended:'暫停',Delayed:'延遲開賽','Delayed Start':'延遲開賽','Warmup':'賽前熱身','Game Over':'比賽結束',Final:'比賽結束',Completed:'比賽結束'};
  if(/rain/i.test(state))return '因雨延遲';
  if(special[state])return special[state];
  if(game.status?.abstractGameState==='Final')return '比賽結束';
  if(game.status?.abstractGameState==='Live'){
    const half:Record<string,string>={Top:'上',Bottom:'下',Middle:'上半局結束',End:'下半局結束'};
    return line?.currentInning ? `${line.currentInning} 局${half[line.inningState]||'進行中'}` : '比賽進行中';
  }
  return new Date(game.gameDate).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Taipei'})+' 開賽';
}
