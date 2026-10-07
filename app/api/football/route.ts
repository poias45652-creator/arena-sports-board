import {footballDay,isFootballLeague,validFootballDay} from '@/lib/football';
import {footballGameAnalysis,footballSchedule,nextFootballDay} from '@/lib/football-source';
import {getRawDb} from '@/db';
import {saveFootballForecast,saveFootballResults} from '@/lib/football-ledger';
import {saveDailyForecast,saveDailyResults} from '@/lib/daily-win-rate';
export const dynamic='force-dynamic';
const savedResults=new Map<string,number>();
export async function GET(request:Request){
  const p=new URL(request.url).searchParams,league=p.get('league')||'eng.1',day=p.get('date')||footballDay(),kind=p.get('kind')||'schedule';
  const headers={'Cache-Control':'private, no-store'};
  if(!isFootballLeague(league)||!validFootballDay(day)||Math.abs(Date.parse(day)-Date.parse(footballDay()))>370*86400000||!['schedule','analysis','next'].includes(kind))return Response.json({error:'足球聯賽或日期參數錯誤'},{status:400,headers});
  try{
    if(kind==='next')return Response.json(await nextFootballDay(league,day),{headers});
    if(kind==='analysis'){
      const id=p.get('game')||'';if(!/^\d{1,12}$/.test(id))return Response.json({error:'無效賽事編號'},{status:400,headers});
      const result=await footballGameAnalysis(league,day,id);
      if(!result)return Response.json({error:'本日找不到此賽事，請更新賽程'},{status:404,headers});
      let snapshotSaved=false,dailySaved=false;try{const db=getRawDb();snapshotSaved=await saveFootballForecast(db,result.game,result.analysis);if(result.analysis.probabilities)dailySaved=await saveDailyForecast(db,'FOOTBALL',result.game,result.analysis.probabilities,result.analysis.capturedAt,result.analysis.version);}catch{/* Analysis remains available, but snapshot failure is visible. */}
      return Response.json({...result,snapshotSaved,dailySaved},{headers});
    }
    const {calendar,...data}=await footballSchedule(league,day),key=league+':'+day;
    if(Date.now()-(savedResults.get(key)||0)>600000){try{const db=getRawDb();await saveFootballResults(db,data.games);await saveDailyResults(db,'FOOTBALL',data.games);if(savedResults.size>=100)savedResults.delete(savedResults.keys().next().value!);savedResults.set(key,Date.now());}catch{/* Retried on the next visit; no false settled count. */}}
    return Response.json(data,{headers});
  }catch{return Response.json({error:'足球資料暫時無法更新，請稍後重試。'},{status:502,headers});}
}
