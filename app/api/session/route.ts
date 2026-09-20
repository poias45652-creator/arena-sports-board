import {env} from 'cloudflare:workers';
import {getRawDb} from '@/db';
import {tzLogin} from '@/lib/tz-login';
import {readTurnstileSettings} from '@/lib/turnstile-settings';
export const dynamic='force-dynamic';
async function handle(request:Request){
 const db=getRawDb(),key=(env as unknown as Record<string,string>).TZ_BINDING_KEY;
 try{
  if(request.method==='DELETE')return tzLogin(request,db,key);
  const config=await readTurnstileSettings(db,key);
  const result=await tzLogin(request,db,key,fetch,config.secret,config.enabled);
  if(request.method==='GET')return Response.json({...await result.json(),turnstileRequired:config.enabled},{status:result.status,headers:result.headers});
  return result;
 }catch{return Response.json({error:'登入驗證服務暫時無法使用，請稍後再試'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
export const GET=handle;export const POST=handle;export const DELETE=handle;
