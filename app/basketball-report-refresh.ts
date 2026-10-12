import {nbaFixtureKey,type NbaGame} from '@/lib/nba';
import {nbaSourceStale,type NbaReport} from '@/lib/nba-analysis';
export function basketballReportNeedsRefresh(game:NbaGame,report:NbaReport|undefined,now:number,force=false){
 if(force||!report?.analysis||!report.game||nbaFixtureKey(report.game)!==nbaFixtureKey(game))return true;
 const a=report.analysis;
 if(a.status!=='ready'||('playerContext' in a&&a.playerContext?.status==='unavailable'))return true;
 return nbaSourceStale(report.sourceFetchedAt,now,5*60000);
}
export function basketballPendingLabel(report:NbaReport|undefined,unavailable=false){
 if(unavailable)return '賽程資料暫時無法確認，恢復後會自動重試分析';
 if(report?.error)return '分析更新失敗，將自動重試';
 const analysis=report?.analysis;
 if(analysis?.status==='waiting'){
  const reason='playerContext' in analysis?analysis.playerContext?.reason:undefined;
  const labels:Record<string,string>={efficiency_baseline_unavailable:'近期比賽的分析資料尚未完整，稍後會自動重新檢查',player_snapshot_missing_or_stale:'球員資料尚未更新，暫時無法計算分析',outside_availability_window:'本場尚未進入開賽前 72 小時的球員分析範圍',insufficient_individual_minutes_coverage:'球員出賽資料不足，暫時無法計算分析'};
  return reason&&labels[reason]||'分析所需資料尚未完整，稍後會自動重新檢查';
 }
 return analysis?'分析資料需要重新計算，將自動重試':'正在計算…';
}
export function basketballPendingState(report:NbaReport|undefined,unavailable=false):'unavailable'|'error'|'waiting'|'stale'|'loading'{
 if(unavailable)return 'unavailable';
 if(report?.error)return 'error';
 if(report?.analysis?.status==='waiting')return 'waiting';
 return report?.analysis?'stale':'loading';
}
