import {requestOrigin} from '@/lib/request-origin';
import {isSiteAdmin} from '@/app/admin-access';
import {getRawDb} from '@/db';
import {PLATFORM_ADMIN_USERNAME} from '@/lib/arena-session';
export const dynamic='force-dynamic';
const reply=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){
 if(!await isSiteAdmin())return reply({error:'僅限管理員'},403);
 try{const result=await getRawDb().prepare("SELECT b.member_id AS memberId,b.username,b.verified_at AS lastLogin,COALESCE(a.enabled,0) AS enabled,a.expires_at AS expiresAt,CASE WHEN a.member_id IS NULL THEN 'pending' WHEN a.enabled<>1 THEN 'disabled' WHEN a.expires_at IS NOT NULL AND a.expires_at<=? THEN 'expired' ELSE 'active' END AS accessState,CASE WHEN lower(b.username)=? THEN 1 ELSE 0 END AS isAdmin FROM tz_bindings b LEFT JOIN account_access a ON a.member_id=b.member_id WHERE b.member_id LIKE 'tz:%' ORDER BY (a.member_id IS NULL) DESC,b.verified_at DESC").bind(Date.now(),PLATFORM_ADMIN_USERNAME).all();return reply({accounts:result.results});}catch{return reply({error:'帳號清單暫時無法讀取'},503);}
}
export async function PATCH(request:Request){
 if(!await isSiteAdmin())return reply({error:'僅限管理員'},403);
 if(request.headers.get('origin')!==requestOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return reply({error:'請從管理後台操作'},403);
 try{
  const raw=await request.text();if(raw.length>2048)return reply({error:'輸入過長'},400);const body=JSON.parse(raw);
  const {memberId,enabled,expiresAt}=body;
  if(typeof memberId!=='string'||!memberId.startsWith('tz:')||memberId.length>200||typeof enabled!=='boolean'||!(expiresAt===null||(Number.isSafeInteger(expiresAt)&&expiresAt>0&&expiresAt<4102444800000)))return reply({error:'帳號或到期日格式不正確'},400);
  const db=getRawDb(),account=await db.prepare('SELECT member_id,username FROM tz_bindings WHERE member_id=?').bind(memberId).first<{member_id:string;username:string}>();
  if(!account||!account.member_id.startsWith('tz:'))return reply({error:'找不到帳號'},404);
  if(account.username.toLowerCase()===PLATFORM_ADMIN_USERNAME&&(!enabled||expiresAt!==null))return reply({error:'主管理員須保留無期限使用權'},409);
  await db.batch([
   db.prepare('INSERT INTO account_access (member_id,enabled,expires_at,updated_at) VALUES (?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET enabled=excluded.enabled,expires_at=excluded.expires_at,updated_at=excluded.updated_at').bind(memberId,enabled?1:0,expiresAt,Date.now()),
   db.prepare('DELETE FROM arena_sessions WHERE member_id=? AND EXISTS (SELECT 1 FROM account_access WHERE member_id=? AND (enabled=0 OR expires_at<=?))').bind(memberId,memberId,Date.now())
  ]);return reply({ok:true});
 }catch{return reply({error:'儲存失敗，請重新確認後再試'},400);}
}
export async function DELETE(request:Request){
 if(!await isSiteAdmin())return reply({error:'僅限管理員'},403);
 if(request.headers.get('origin')!==requestOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return reply({error:'請從管理後台操作'},403);
 try{
  const raw=await request.text();if(raw.length>2048)return reply({error:'輸入過長'},400);
  const {memberId,confirmUsername}=JSON.parse(raw);
  if(typeof memberId!=='string'||!memberId.startsWith('tz:')||memberId.length>200||typeof confirmUsername!=='string'||!confirmUsername||confirmUsername.length>128)return reply({error:'請確認要刪除的帳號'},400);
  const db=getRawDb(),account=await db.prepare('SELECT username FROM tz_bindings WHERE member_id=?').bind(memberId).first<{username:string}>();
  if(!account)return reply({error:'帳號已不存在，請重新載入'},404);
  if(account.username.toLowerCase()===PLATFORM_ADMIN_USERNAME)return reply({error:'不能刪除主管理員帳號'},409);
  if(account.username!==confirmUsername)return reply({error:'帳號資料已變更，請重新載入後確認'},409);
  await db.batch([
   db.prepare('DELETE FROM arena_sessions WHERE member_id=?').bind(memberId),
   db.prepare('DELETE FROM hr_connections WHERE member_id=?').bind(memberId),
   db.prepare('DELETE FROM account_access WHERE member_id=?').bind(memberId),
   db.prepare('DELETE FROM tz_binding_attempts WHERE member_id=?').bind(memberId),
   db.prepare('DELETE FROM tz_bindings WHERE member_id=?').bind(memberId)
  ]);
  return reply({ok:true});
 }catch{return reply({error:'刪除未完成，請重新載入後再試'},400);}
}
