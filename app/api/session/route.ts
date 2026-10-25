import {env} from '@/server/runtime';
import {getRawDb} from '@/db';
import {tzLogin} from '@/lib/tz-login';
import {hash,viewerToken,viewerCookie,VIEWER_USERNAME} from '@/lib/arena-session';
import {viewerLogin} from '@/lib/yj-viewer-account';
import {readTurnstileSettings} from '@/lib/turnstile-settings';
export const dynamic='force-dynamic';
async function handle(request:Request){
 const db=getRawDb(),key=(env as unknown as Record<string,string>).TZ_BINDING_KEY;
 try{
  if(request.method==='DELETE'){
   const result=await tzLogin(request,db,key);
   if(result.ok){const token=viewerToken(request.headers.get('cookie'));if(token)await db.prepare('DELETE FROM yj_viewer_sessions WHERE token_hash=?').bind(await hash(token)).run();result.headers.append('Set-Cookie',viewerCookie('',0));}
   return result;
  }
  const config=await readTurnstileSettings(db,key);
  if(request.method==='POST'&&request.headers.get('content-type')?.startsWith('application/json')){
   const reader=request.clone().body?.getReader();let raw='',size=0;const decoder=new TextDecoder();
   if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){void reader.cancel();return Response.json({error:'輸入過長'},{status:413});}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();
   let input:any;try{input=JSON.parse(raw);}catch{/* Existing login handler returns the validation error. */}raw='';
   if(typeof input?.username==='string'&&input.username.trim().toLowerCase()===VIEWER_USERNAME)return await viewerLogin(request,db,input,config);
  }
  const result=await tzLogin(request,db,key,fetch,config.secret,config.enabled);
  if(request.method==='POST'&&result.ok)result.headers.append('Set-Cookie',viewerCookie('',0));
  if(request.method==='GET')return Response.json({...await result.json(),turnstileRequired:config.enabled,turnstileSiteKey:config.enabled?config.siteKey:''},{status:result.status,headers:result.headers});
  return result;
 }catch{return Response.json({error:'登入驗證服務暫時無法使用，請稍後再試'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
export const GET=handle;export const POST=handle;export const DELETE=handle;
