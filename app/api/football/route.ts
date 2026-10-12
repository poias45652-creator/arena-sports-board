import {footballDay,isFootballLeague,validFootballDay} from '@/lib/football';
import {footballGameAnalysis,footballSchedule,nextFootballDay} from '@/lib/football-source';
import {getRawDb} from '@/db';
import {loadFootballForecast,saveFootballForecast,saveFootballResults} from '@/lib/football-ledger';
import {saveDailyForecast,saveDailyResults} from '@/lib/daily-win-rate';
import {createFootballRouteTrace} from '@/lib/football-route-observability';
export const dynamic='force-dynamic';
const savedResults=new Map<string,number>();
export async function GET(request:Request){
  const p=new URL(request.url).searchParams,league=p.get('league')||'eng.1',day=p.get('date')||footballDay(),kind=p.get('kind')||'schedule';
  const headers={'Cache-Control':'private, no-store'};
  if(!isFootballLeague(league)||!validFootballDay(day)||Math.abs(Date.parse(day)-Date.parse(footballDay()))>370*86400000||!['schedule','analysis','next'].includes(kind))return Response.json({error:'足球聯賽或日期參數錯誤'},{status:400,headers});
  const game=p.get('game')||'',trace=createFootballRouteTrace({league,date:day,kind,game:kind==='analysis'&&/^\d{1,12}$/.test(game)?game:null});
  try{
    if(kind==='next'){trace.stage('next');const data=await nextFootballDay(league,day);trace.stage('response');return Response.json(data,{headers});}
    if(kind==='analysis'){
      const id=game;if(!/^\d{1,12}$/.test(id))return Response.json({error:'無效賽事編號'},{status:400,headers});
      trace.stage('analysis');
      const result=await footballGameAnalysis(league,day,id);
      if(!result){trace.analysis(null);return Response.json({error:'本日找不到此賽事，請更新賽程'},{status:404,headers});}
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
