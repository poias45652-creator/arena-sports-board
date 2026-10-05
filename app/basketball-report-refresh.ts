import {nbaFixtureKey,type NbaGame} from '@/lib/nba';
import {nbaSourceStale,type NbaReport} from '@/lib/nba-analysis';
export function basketballReportNeedsRefresh(game:NbaGame,report:NbaReport|undefined,now:number,force=false){
 if(force||!report?.analysis||!report.game||nbaFixtureKey(report.game)!==nbaFixtureKey(game))return true;
 const a=report.analysis;
 if(a.status!=='ready'||('playerContext' in a&&a.playerContext?.status==='unavailable'))return true;
 return nbaSourceStale(report.sourceFetchedAt,now,5*60000);
}
export function basketballPendingLabel(report:NbaReport|undefined,unavailable=false){
 if(unavailable)return '賽程更新中，稍後重試分析';
 if(report?.error)return '分析更新失敗，將自動重試';
 return report?.analysis?'分析資料更新中，將自動重試':'正在計算…';
}
