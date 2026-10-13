import type {FootballGame} from '@/lib/football';
import {CUP_STRENGTH_REASON,uncalibratedCupAnalysis} from '@/lib/football';
import {footballFixtureKey,readyFootballAnalysis,retainFootballForecast,type FootballReport} from '@/lib/football-recommendations';

export type FootballAnalysisActivity='queued'|'loading';
export type FootballAnalysisState='loading'|'ready'|'waiting'|'error'|'stale'|'unavailable';

// Failed or incomplete reports must not inherit the ten-minute ready-report cache.
// Back off from the last completed attempt so repeated board polls stay bounded.
export function footballReportNeedsRefresh(game:FootballGame,report:FootballReport|undefined,now:number,lastAttempt=0,analysisAvailable=true){
  if(!Number.isFinite(now)||!game.timeConfirmed||!Number.isFinite(Date.parse(game.start)))return false;
  if(retainFootballForecast(game,now))return !readyFootballAnalysis(game,report,now)&&now-lastAttempt>=60000;
  if(!analysisAvailable||game.state!=='scheduled'||Date.parse(game.start)<=now)return false;
  const ready=readyFootballAnalysis(game,report,now);
  if(ready)return now-Date.parse(ready.capturedAt)>=10*60000&&(!lastAttempt||now-lastAttempt>=60000);
  return !lastAttempt||now-lastAttempt>=60000;
}

export function footballRequestError(error:unknown,kind:'schedule'|'analysis'|'next'='analysis'){
  const subject=kind==='schedule'?'賽程':kind==='next'?'下一個比賽日':'分析';
  const retry=kind==='next'?'請稍後再試。':'稍後會自動重試。';
  if(error instanceof Error){
    if(error.name==='AbortError'||error.name==='TimeoutError')return subject+'請求逾時，'+retry;
    if(error instanceof TypeError)return subject+'連線失敗，'+retry;
    if(error.message)return error.message;
  }
  return subject+'暫時無法取得，'+retry;
}

export function footballAnalysisPresentation(game:FootballGame,report:FootballReport|undefined,now:number,{unavailable=false,analysisAvailable=true,notice='',activity}:{unavailable?:boolean;analysisAvailable?:boolean;notice?:string;activity?:FootballAnalysisActivity}={}):{state:FootballAnalysisState;message:string}{
  if(readyFootballAnalysis(game,report,now,unavailable))return {state:'ready',message:''};
  if(unavailable)return {state:'unavailable',message:'賽程資料暫時無法確認，恢復後會自動重試分析。'};
  if(!analysisAvailable)return {state:'unavailable',message:notice||'目前的賽程來源尚未提供分析資料。'};
  if(report?.game&&footballFixtureKey(report.game)!==footballFixtureKey(game))return {state:'stale',message:'賽程已變更，將重新取得本場分析。'};
  if(report?.error)return {state:'error',message:report.error};
  if(uncalibratedCupAnalysis(game,report?.analysis))return {state:'waiting',message:CUP_STRENGTH_REASON};
  if(report?.analysis?.status==='waiting')return {state:'waiting',message:report.analysis.reason||'來源資料不足，暫時無法計算分析。'};
  if(report?.analysis?.status==='closed')return {state:'unavailable',message:report.analysis.reason||'本場賽前分析已停止更新。'};
  if(report?.analysis)return {state:'stale',message:'分析資料已失效，將自動重新取得。'};
  if(activity)return {state:'loading',message:activity==='queued'?'等待計算分析…':'正在計算分析…'};
  return {state:'unavailable',message:'尚未取得分析資料，稍後會自動重試。'};
}
