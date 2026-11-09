import {authorizeGithubSync} from '@/server/github-sync-auth.mjs';
import {env} from '@/server/runtime';
import {authorizeBaseballSync,syncBaseball} from '@/server/baseball-sync.mjs';
import {getInternationalLive,getInternationalPregame} from '@/lib/international-feed';
import {getRawDb} from '@/db';
import {captureLeague} from '@/server/regional-basketball/capture.mjs';
import {saveForecast} from '@/server/regional-basketball/forecast-store.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 if(new URL(request.url).searchParams.get('job')==='regional-basketball'){
  if(!await authorizeGithubSync(request.headers.get('authorization')))return Response.json({error:'Unauthorized'},{status:401,headers});
  const db=getRawDb();
  const leagues=await Promise.all(['KBL','NBL'].map(async league=>{
   try{return await captureLeague(league,(l:string,g:any,r:any)=>saveForecast(db,l,g,r));}
   catch{return {league,error:'無法完成賽前收錄'};}
  }));
  const ok=leagues.every(row=>!('error' in row)&&row.missing.length===0);
  return Response.json({status:ok?'ok':'partial',leagues},{status:ok?200:503,headers});
 }
 const configured=(env as unknown as Record<string,string|undefined>).BASEBALL_SYNC_TOKEN;
 const auth=authorizeBaseballSync(configured,request.headers.get('authorization'));
 if(auth!==200&&!await authorizeGithubSync(request.headers.get('authorization')))return Response.json({error:auth===503?'背景排程尚未設定':'Unauthorized'},{status:auth,headers});
 const result=await syncBaseball({getLive:getInternationalLive,getPregame:getInternationalPregame});
 return Response.json(result,{status:result.status==='ok'?200:503,headers});
}
