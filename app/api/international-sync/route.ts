import {env} from 'cloudflare:workers';
import {authorizeBaseballSync,syncBaseball} from '@/server/baseball-sync.mjs';
import {getInternationalLive,getInternationalPregame} from '@/lib/international-feed';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 const configured=(env as unknown as Record<string,string|undefined>).BASEBALL_SYNC_TOKEN;
 const auth=authorizeBaseballSync(configured,request.headers.get('authorization'));
 if(auth!==200)return Response.json({error:auth===503?'背景排程尚未設定':'Unauthorized'},{status:auth,headers});
 const result=await syncBaseball({getLive:getInternationalLive,getPregame:getInternationalPregame});
 return Response.json(result,{status:result.status==='ok'?200:503,headers});
}
