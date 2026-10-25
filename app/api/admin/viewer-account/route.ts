import {isSiteAdmin} from '@/app/admin-access';
import {getRawDb} from '@/db';
import {isYjViewerSite,VIEWER_MEMBER_ID,VIEWER_USERNAME} from '@/lib/arena-session';
import {passwordDigest} from '@/lib/yj-viewer-account';
import {requestOrigin} from '@/lib/request-origin';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){
 if(!isYjViewerSite()||!await isSiteAdmin())return reply({error:'僅限 YJ 管理員'},403);
 try{
  const account=await getRawDb().prepare('SELECT username,enabled,updated_at AS updatedAt,last_login_at AS lastLogin,CASE WHEN EXISTS (SELECT 1 FROM yj_viewer_sessions s WHERE s.member_id=yj_viewer_accounts.member_id AND s.version=yj_viewer_accounts.version AND s.expires_at>?) AND enabled=1 THEN 1 ELSE 0 END AS signedIn FROM yj_viewer_accounts WHERE member_id=?').bind(Date.now(),VIEWER_MEMBER_ID).first();
  return account?reply({account}):reply({error:'測試帳號尚未建立'},503);
 }catch{return reply({error:'測試帳號暫時無法讀取'},503);}
}
export async function PATCH(request:Request){
 if(!isYjViewerSite()||!await isSiteAdmin())return reply({error:'僅限 YJ 管理員'},403);
 if(request.headers.get('origin')!==requestOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return reply({error:'請從管理後台操作'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'輸入格式有誤'},415);
 try{
  const reader=request.body?.getReader();let raw='',size=0;const decoder=new TextDecoder();
  if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();return reply({error:'輸入過長'},413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();
  const body=JSON.parse(raw);raw='';
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['password','enabled'].includes(k)))return reply({error:'僅能變更密碼或啟用狀態'},400);
  const changePassword=body.password!==undefined,changeEnabled=body.enabled!==undefined;
  if(!changePassword&&!changeEnabled||changeEnabled&&typeof body.enabled!=='boolean'||changePassword&&(typeof body.password!=='string'||body.password.length<8||body.password.length>128))return reply({error:'新密碼須為 8 至 128 字元'},400);
  const digest=changePassword?await passwordDigest(body.password):null;body.password='';
  const db=getRawDb();
  const result=await db.batch([
   db.prepare('UPDATE yj_viewer_accounts SET password_hash=COALESCE(?,password_hash),enabled=COALESCE(?,enabled),version=version+1,updated_at=? WHERE member_id=?').bind(digest,changeEnabled?(body.enabled?1:0):null,Date.now(),VIEWER_MEMBER_ID),
   db.prepare('DELETE FROM yj_viewer_sessions WHERE member_id=?').bind(VIEWER_MEMBER_ID)
  ]);
  if(!result[0].meta.changes)return reply({error:'測試帳號尚未建立'},503);
  return reply({ok:true,username:VIEWER_USERNAME,message:changePassword?'密碼已更新，舊登入已登出。':'狀態已更新，舊登入已登出。'});
 }catch{return reply({error:'設定未儲存，請稍後重試'},400);}
}
