import {footballDay,isFootballLeague,validFootballDay} from '@/lib/football';
import {footballGameAnalysis,footballSchedule,nextFootballDay} from '@/lib/football-source';
import {getRawDb} from '@/db';
import {loadFootballForecast,saveFootballForecast,saveFootballResults} from '@/lib/football-ledger';
import {saveDailyForecast,saveDailyResults} from '@/lib/daily-win-rate';
import {createFootballRouteTrace} from '@/lib/football-route-observability';
import {footballDetail,footballStandings} from '@/lib/football-live-source';
import {footballModelCatalog} from '@/lib/football-model-catalog';
import {customFootballSettings,parseFootballSettings,validateFootballSettings} from '@/lib/football-model-weights';
export const dynamic='force-dynamic';
const savedResults=new Map<string,number>();
export async function GET(request:Request){
  const p=new URL(request.url).searchParams,league=p.get('league')||'eng.1',day=p.get('date')||footballDay(),kind=p.get('kind')||'schedule';
  const headers={'Cache-Control':'private, no-store'};
  if(!isFootballLeague(league)||!validFootballDay(day)||Math.abs(Date.parse(day)-Date.parse(footballDay()))>370*86400000||!['schedule','analysis','next','detail','standings','models'].includes(kind))return Response.json({error:'足球聯賽或日期參數錯誤'},{status:400,headers});
  const rawSettings=p.get('settings'),settings=rawSettings&&rawSettings.length<=2000?parseFootballSettings(rawSettings):undefined;
  if(rawSettings&&(!settings||!validateFootballSettings(settings,footballModelCatalog(league))))return Response.json({error:'足球模型比例無效，請重新設定。'},{status:400,headers});
  const game=p.get('game')||'',trace=createFootballRouteTrace({league,date:day,kind,game:kind==='analysis'&&/^\d{1,12}$/.test(game)?game:null});
  try{
    if(kind==='models')return Response.json(footballModelCatalog(league),{headers});
    if(kind==='standings'){
      const season=Number(p.get('season')||new Date().getUTCFullYear());
      if(!Number.isInteger(season)||season<2021||season>new Date().getUTCFullYear())return Response.json({error:'球季參數錯誤'},{status:400,headers});
      return Response.json(await footballStandings(league,season),{headers});
    }
    if(kind==='detail'){
      if(!/^\d{1,12}$/.test(game))return Response.json({error:'無效賽事編號'},{status:400,headers});
      const schedule=await footballSchedule(league,day),match=schedule.games.find(g=>g.id===game);
      if(!match)return Response.json({error:'本日找不到此賽事，請更新賽程'},{status:404,headers});
      return Response.json(await footballDetail(match),{headers});
    }
    if(kind==='next'){trace.stage('next');const data=await nextFootballDay(league,day);trace.stage('response');return Response.json(data,{headers});}
    if(kind==='analysis'){
      const id=game;if(!/^\d{1,12}$/.test(id))return Response.json({error:'無效賽事編號'},{status:400,headers});
      trace.stage('analysis');
      const result=await footballGameAnalysis(league,day,id,settings||undefined);
      if(!result){trace.analysis(null);return Response.json({error:'本日找不到此賽事，請更新賽程'},{status:404,headers});}
      if(customFootballSettings(settings||undefined)){
        const analysis={...result.analysis,version:result.analysis.version+'-custom-v1',calibration:result.analysis.calibration?{...result.analysis.calibration,status:'baseline' as const,label:'自訂比例・尚未校準'}:undefined};
        trace.analysis(analysis);
        return Response.json({...result,analysis,custom:true,snapshotSaved:false,dailySaved:false},{headers});
      }
      if(Date.parse(result.game.start)<=Date.now()){
        trace.stage('load_forecast');
        const saved=await loadFootballForecast(getRawDb(),result.game);
        trace.analysis((saved||result).analysis);
        return Response.json(saved?{...saved,sourceFetchedAt:result.sourceFetchedAt}:result,{headers});
      }
      let snapshotSaved=false,dailySaved=false;
      try{
        trace.stage('save_forecast');
        const db=getRawDb();snapshotSaved=await saveFootballForecast(db,result.game,result.analysis);
        if(result.analysis.probabilities){trace.stage('save_daily_forecast');dailySaved=await saveDailyForecast(db,'FOOTBALL',result.game,result.analysis.probabilities,result.analysis.capturedAt,result.analysis.version);}
      }catch(error){trace.failure(error);/* Analysis remains available, but snapshot failure is visible. */}
      trace.analysis(result.analysis);
      return Response.json({...result,snapshotSaved,dailySaved},{headers});
    }
    trace.stage('schedule');
    const {calendar,...data}=await footballSchedule(league,day),key=league+':'+day;
    if(Date.now()-(savedResults.get(key)||0)>600000){try{trace.stage('save_results');const db=getRawDb();await saveFootballResults(db,data.games);trace.stage('save_daily_results');await saveDailyResults(db,'FOOTBALL',data.games);if(savedResults.size>=100)savedResults.delete(savedResults.keys().next().value!);savedResults.set(key,Date.now());}catch(error){trace.failure(error);/* Retried on the next visit; no false settled count. */}}
    trace.stage('response');return Response.json(data,{headers});
  }catch(error){trace.failure(error);return Response.json({error:'足球資料暫時無法更新，請稍後重試。'},{status:502,headers});}
}
