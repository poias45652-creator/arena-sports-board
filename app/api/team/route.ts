import {coversTeams} from '@/lib/covers';
import {attachLogs,normalizeSchedule,historyFromLogs,leagueStats} from '@/lib/team-profile';
export const dynamic='force-dynamic';
const cache=new Map<string,{expires:number;data:any}>(),pending=new Map<string,Promise<any>>();
async function json(url:string,ttl:number){const hit=cache.get(url);if(hit&&hit.expires>Date.now())return hit.data;if(pending.has(url))return pending.get(url);const task=(async()=>{const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error('MLB 資料暫時無法取得');const data=await r.json();if(cache.size>=90)cache.delete(cache.keys().next().value!);cache.set(url,{expires:Date.now()+ttl,data});return data;})();pending.set(url,task);try{return await task;}finally{pending.delete(url);}}
const root='https://statsapi.mlb.com/api/v1';
async function log(id:number,year:number,type:string){return json(`${root}/teams/${id}/stats?stats=gameLog&group=hitting,pitching&season=${year}&gameType=${type}`,year===new Date().getUTCFullYear()?5*60000:86400000);}
async function bounded<T>(items:number[],fn:(i:number)=>Promise<T>){const result:T[]=[];for(let i=0;i<items.length;i+=2)result.push(...await Promise.all(items.slice(i,i+2).map(fn)));return result;}
export async function GET(request:Request){
 const q=new URL(request.url).searchParams,id=Number(q.get('id')),yearText=q.get('season')||String(new Date().getUTCFullYear()),current=new Date().getUTCFullYear(),year=yearText==='all'?current:Number(yearText),type=q.get('type')||'R',action=q.get('action')||'profile';
 if(!coversTeams[id]||!Number.isInteger(year)||year<2021||year>current||!['R','S','F','D','L','W'].includes(type)||!['profile','history','roster','league-month'].includes(action))return Response.json({error:'無效球隊或篩選条件'},{status:400});
 try{
  if(action==='roster'){const mode=q.get('roster')==='fullSeason'||year<current?'fullSeason':'active';const r=await json(`${root}/teams/${id}/roster?rosterType=${mode}&season=${year}`,15*60000);return Response.json({season:year,mode,players:(r.roster||[]).map((p:any)=>({id:p.person.id,name:p.person.fullName,number:p.jerseyNumber||null,position:p.position?.abbreviation||'',status:p.status?.description||''})),fetchedAt:new Date().toISOString()});}
  if(action==='history'){const years=[year-2,year-1].filter(y=>y>=2019);const data=await bounded(years,async y=>({season:y,games:historyFromLogs(await log(id,y,type),id,y)}));return Response.json({seasons:data,fetchedAt:new Date().toISOString()});}
  if(action==='league-month'){const month=Number(q.get('month'));if(!Number.isInteger(month)||month<1||month>12)return Response.json({error:'月份不符'},{status:400});const start=`${year}-${String(month).padStart(2,'0')}-01`,end=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);const r=await json(`${root}/teams/stats?stats=byDateRange&group=hitting&startDate=${start}&endDate=${end}&sportIds=1&gameType=${type}&limit=1000`,3600000);return Response.json({month,...leagueStats(r,'hitting')});}
  const years=yearText==='all'?Array.from({length:current-2021+1},(_,i)=>2021+i):[year];
  const packs=await bounded(years,async y=>{const ttl=y===current?5*60000:86400000;const [logs,schedule,league]=await Promise.all([log(id,y,type),json(`${root}/schedule?sportId=1&season=${y}&gameType=${type}`,ttl),json(`${root}/teams/stats?stats=season&group=hitting,pitching&season=${y}&sportIds=1&gameType=${type}&limit=1000`,ttl).catch(()=>null)]);const games=normalizeSchedule(schedule,y,type);return {season:y,teamGames:attachLogs(games,logs,id,y),leagueGames:games.filter(g=>g.completed),league};});
  // Raw count stats remain available for correctly weighted cross-season aggregates.
  const combined={stats:['hitting','pitching'].map(group=>({group:{displayName:group},splits:packs.flatMap(p=>p.league?.stats?.find((s:any)=>s.group?.displayName===group)?.splits||[])}))};
  const totals=(kind:'hitting'|'pitching')=>{if(packs.length===1)return leagueStats(combined,kind);const splits=combined.stats.find(s=>s.group.displayName===kind)!.splits.map((s:any,i:number)=>({...s,team:{id:i}}));return leagueStats({stats:[{group:{displayName:kind},splits}]},kind);};
  return Response.json({teamId:id,season:yearText,type,games:packs.flatMap(p=>p.teamGames),leagueGames:packs.flatMap(p=>p.leagueGames),leagueHitting:totals('hitting'),leaguePitching:totals('pitching'),fetchedAt:new Date().toISOString(),source:root},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'球隊資料更新失敗，請稍後重試。'},{status:502});}
}
