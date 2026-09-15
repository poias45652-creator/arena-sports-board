import {getArenaUser} from '@/lib/arena-user';
import {getPool} from '@/server/database.mjs';
import {collectLeague,dayInTaipei} from '@/server/baseball-current.mjs';
import {readLiveSnapshot,writeLiveSnapshot} from '@/server/baseball-live-store.mjs';
import {createLiveFeed} from '@/server/baseball-live-feed.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store'};
const getFeed=createLiveFeed({collect:collectLeague,day:dayInTaipei,
 read:(league:string,date:string)=>readLiveSnapshot(getPool(),league,date),
 write:(snapshot:any)=>writeLiveSnapshot(getPool(),snapshot)});
export async function GET(request:Request){
 const user=await getArenaUser();
 if(!user)return Response.json({error:'請先登入。'},{status:401,headers});
 const league=(new URL(request.url).searchParams.get('league')||'').toUpperCase();
 if(!['NPB','KBO','CPBL'].includes(league))return Response.json({error:'請指定 NPB、KBO 或 CPBL。'},{status:400,headers});
 const value=await getFeed(league);
 return Response.json(value,{status:value.status==='unavailable'?503:200,headers});
}
