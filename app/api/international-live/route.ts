import {getArenaUser} from '@/lib/arena-user';
import {getPool} from '@/server/database.mjs';
import {collectLeague,dayInTaipei} from '@/server/baseball-live-providers.mjs';
import {readLiveSnapshot,writeLiveSnapshot} from '@/server/baseball-live-store.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const cached=new Map<string,{expires:number;value:any}>();
const pending=new Map<string,Promise<any>>();
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){
 const user=await getArenaUser();
 if(!user)return Response.json({error:'請先登入。'},{status:401,headers});
 // Keep the new feed in administrator verification until live behavior is validated.
 if(user.role!=='admin')return Response.json({error:'此資料接入目前由管理員驗證。'},{status:403,headers});
 const url=new URL(request.url),league=(url.searchParams.get('league')||'').toUpperCase(),date=dayInTaipei();
 if(!['NPB','KBO','CPBL'].includes(league))return Response.json({error:'請指定 NPB、KBO 或 CPBL。'},{status:400,headers});
 const key=league+':'+date;
 if(cached.get(key)?.expires!>Date.now())return Response.json(cached.get(key)!.value,{headers});
 if(pending.has(key))return Response.json(await pending.get(key),{headers});
 const task=(async()=>{
  try{
   const value=await collectLeague(league,{date});
   if(!value.games.length&&value.errors.length)throw new Error(value.errors.join('; '));
   let persistence:any;
   try{persistence=await writeLiveSnapshot(getPool(),value);}catch{persistence={written:0,error:'資料已取得，但寫入資料庫失敗。'};}
   const result={...value,persistence,stale:false,visibility:'admin-verification',automaticBackgroundSync:false};
   const ttl=value.games.some((g:any)=>g.status==='live')?60000:300000;
   cached.set(key,{value:result,expires:Date.now()+ttl});
   for(const old of cached.keys())if(!old.endsWith(':'+date))cached.delete(old);
   return result;
  }catch(error){
   let games:any[]=[];
   try{games=await readLiveSnapshot(getPool(),league,date);}catch{}
   const result={schemaVersion:1,league,date,games,status:games.length?'stale':'unavailable',stale:true,error:'目前無法更新來源；已保留原擷取時間。',diagnostic:error instanceof Error?error.message:'source_error',automaticBackgroundSync:false};
   cached.set(key,{value:result,expires:Date.now()+60000});return result;
  }
 })().finally(()=>pending.delete(key));
 pending.set(key,task);
 const result=await task;
 return Response.json(result,{status:result.status==='unavailable'?503:200,headers});
}
