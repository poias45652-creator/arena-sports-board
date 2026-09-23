import {playerPhotoKey,withPlayerPhotos} from '@/lib/international-player-photos';
import {profileTeams,type ProfileLeague} from '@/lib/international-profile';
import {collectProfileGames,collectProfilePlayers,collectUpcoming} from '@/lib/international-profile-source';
import snapshot from '@/data/international-profile-2026.json';
import cpblDaily from '@/data/cpbl-daily-supplement-20260920.json';
import {supplementCpblHistory} from '@/lib/cpbl-history-supplement';
export const dynamic='force-dynamic';
const memory=new Map<string,{data:any;until:number}>(),pending=new Map<string,Promise<any>>();
const photoKey=playerPhotoKey;
export async function GET(request:Request){
 const p=new URL(request.url).searchParams,league=p.get('league') as ProfileLeague,code=p.get('team')||'',action=p.get('action')||'games',year=new Date().getUTCFullYear();
 if(!['CPBL','NPB','KBO'].includes(league)||!Object.hasOwn(profileTeams[league],code)||!['games','players','upcoming'].includes(action)||action==='upcoming'&&league!=='CPBL')return Response.json({error:'不支援的球隊或資料類型'},{status:400});
 const key=`${league}:${year}:${action}:${action==='games'?'all':code}`,old=memory.get(key);
 let baseline=year===snapshot.season?(action==='games'?(snapshot.games as Record<string,any>)[league]:action==='players'?(snapshot.players as Record<string,any>)[`${league}:${code}`]:null):null;
 if(league==='CPBL'&&action==='games'&&baseline&&cpblDaily.season===year)baseline={...baseline,games:supplementCpblHistory(baseline.games,cpblDaily.games,year),sources:[...baseline.sources,{label:'B-ASEBALL 已完賽資料補充',url:cpblDaily.games[0].url}],supplementObservedAt:cpblDaily.observedAt};
 if(old&&old.until>Date.now())return Response.json(action==='players'?withPlayerPhotos(old.data,league,code,year):old.data,{headers:{'Cache-Control':'no-store'}});
 if(!pending.has(key))pending.set(key,(async()=>{try{
  let data:any=action==='players'?await collectProfilePlayers(league,code,year):action==='upcoming'?await collectUpcoming(code,year):await collectProfileGames(league,year);
  if(action==='players'&&baseline){
   const merged={...data,bat:data.bat||baseline.bat,pit:data.pit||baseline.pit},photos={...(data.photos||{})},index=data.photoIndex||{};
   for(const table of [merged.bat,merged.pit])for(const row of table?.rows||[]){const src=index[photoKey(row[0])];if(src&&!photos[row[0]])photos[row[0]]=src;}
   data={...merged,photos,sources:[...(data.sources||[]),...(baseline.sources||[]).filter((s:any)=>!(data.sources||[]).some((x:any)=>x.url===s.url))]};
  }
  const value={...data,...(league==='CPBL'&&action==='games'&&'games' in data&&baseline?{games:supplementCpblHistory(data.games,baseline.games,year),sources:[...data.sources,...baseline.sources],archiveObservedAt:baseline.fetchedAt,supplementObservedAt:cpblDaily.observedAt}:{}),league,season:year,status:data.warnings.length?'partial':'ready'};if(memory.size>90)memory.delete(memory.keys().next().value!);memory.set(key,{data:value,until:Date.now()+300000});return value;}catch{
  const previous=old?.data||baseline;if(!previous)return {error:'來源暫時無法讀取，請稍後重試',status:'unavailable'};
  const value={...previous,league,season:year,status:'stale',checkedAt:new Date().toISOString(),warnings:[...new Set([...(previous.warnings||[]),'來源更新暫時受阻，顯示已核對的資料；原始擷取時間見頁尾'])]};
  if(memory.size>90)memory.delete(memory.keys().next().value!);memory.set(key,{data:value,until:Date.now()+60000});return value;
 }finally{pending.delete(key);}})());
 const raw=await pending.get(key),data=action==='players'?withPlayerPhotos(raw,league,code,year):raw;return Response.json(data,{status:data.status==='unavailable'?503:200,headers:{'Cache-Control':'no-store'}});
}
