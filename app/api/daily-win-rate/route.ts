import {getRawDb} from '@/db';
import {summarizeDailyWinRate,saveDailyResults,validDailyDay,dailySportDay} from '@/lib/daily-win-rate';
import {nbaSchedule} from '@/lib/nba-source';
import {wnbaSchedule} from '@/lib/wnba-source';
import {footballSchedule} from '@/lib/football-source';
import {FOOTBALL_LEAGUES} from '@/lib/football';

export const dynamic='force-dynamic';

async function mlbFinals(day:string){
 const source=`https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${day}&endDate=${day}&hydrate=linescore,team`;
 const r=await fetch(source,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('MLB result source unavailable');
 const data=await r.json(),games:any[]=[];
 for(const d of data.dates||[])for(const g of d.games||[]){
  if(g.status?.abstractGameState!=='Final')continue;
  const start=String(g.gameDate||'');if(!start||dailySportDay(start)!==day)continue;
  games.push({id:g.gamePk,start,state:'final',homeScore:g.teams?.home?.score,awayScore:g.teams?.away?.score});
 }
 return games;
}
async function refreshResults(day:string){
 const db=getRawDb(),errors:string[]=[];
 try{await saveDailyResults(db,'MLB',await mlbFinals(day));}catch{errors.push('MLB');}
 try{await saveDailyResults(db,'NBA',(await nbaSchedule(day)).games);}catch{errors.push('NBA');}
 try{await saveDailyResults(db,'WNBA',(await wnbaSchedule(day)).games);}catch{errors.push('WNBA');}
 for(const league of FOOTBALL_LEAGUES){try{const {calendar,...board}=await footballSchedule(league.code,day);await saveDailyResults(db,'FOOTBALL',board.games);}catch{errors.push('FOOTBALL:'+league.code);}}
 return errors;
}
export async function GET(request:Request){
 const p=new URL(request.url).searchParams,day=p.get('date')||dailySportDay();
 if(!validDailyDay(day)||Math.abs(Date.parse(day)-Date.parse(dailySportDay()))>370*86400000)return Response.json({error:'日期參數錯誤'},{status:400,headers:{'Cache-Control':'no-store'}});
 try{const errors=await refreshResults(day),summary=await summarizeDailyWinRate(getRawDb(),day);return Response.json({...summary,resultSources:{ok:errors.length===0,errors},fetchedAt:new Date().toISOString()},{headers:{'Cache-Control':'public, max-age=30'}});}
 catch{return Response.json({error:'每日勝率暫時無法更新'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
