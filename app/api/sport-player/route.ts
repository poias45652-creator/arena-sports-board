import {isFootballLeague} from '@/lib/football';
import {footballPlayerProfile} from '@/lib/football-player-profile';
import {basketballPlayerProfile} from '@/lib/basketball-player-profile';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const p=new URL(request.url).searchParams,id=p.get('id')||'',league=p.get('league')||'',team=p.get('team')||'',provider=p.get('provider')||'official',phase=p.get('phase')||'2',rawSeason=p.get('season'),season=rawSeason?Number(rawSeason):undefined,headers={'Cache-Control':'private, no-store'};
 if(!/^\d{1,12}$/.test(id)||Number(id)<=0||(!['NBA','WNBA'].includes(league)&&!isFootballLeague(league))||team&&!/^\d{1,12}$/.test(team)||!['official','espn'].includes(provider)||league==='NBA'&&provider!=='official'||!['1','2','3'].includes(phase)||rawSeason!==null&&(!/^\d{4}$/.test(rawSeason)||season!<1947||season!>new Date().getUTCFullYear()+1))return Response.json({error:'球員查詢參數錯誤'},{status:400,headers});
 try{return Response.json(isFootballLeague(league)?await footballPlayerProfile(id,league,season,team):await basketballPlayerProfile(id,league as 'NBA'|'WNBA',season,phase,provider),{headers});}
 catch{return Response.json({error:'球員資料暫時無法讀取，請稍後重試。'},{status:503,headers});}
}
