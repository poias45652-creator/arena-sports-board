import {requestOrigin} from '@/lib/request-origin';
import {isSiteAdmin} from '@/app/admin-access';
import {getRawDb} from '@/db';
import {PLATFORM_ADMIN_USERNAME} from '@/lib/arena-session';
export const dynamic='force-dynamic';
const reply=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const validExpiry=(value:unknown)=>value===null||(Number.isSafeInteger(value)&&Number(value)>0&&Number(value)<4102444800000);
const validUsername=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=128&&!/[\s\x00-\x1f\x7f]/.test(value.trim());
const validNote=(value:unknown):value is string=>typeof value==='string'&&value.length<=1000&&!value.includes('\0');
const isAdminName=(name:string)=>[PLATFORM_ADMIN_USERNAME,'vrvtest01'].filter(Boolean).includes(name.toLowerCase());
const sameOrigin=(request:Request)=>request.headers.get('origin')===requestOrigin(request)&&request.headers.get('sec-fetch-site')!=='cross-site';
async function readBody(request:Request){const raw=await request.text();if(raw.length>8192)throw Error();const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();return body;}
export async function GET(){
 if(!await isSiteAdmin())return reply({error:'僅限管理員'},403);
 try{
  const now=Date.now(),db=getRawDb();
  const result=await db.prepare("SELECT b.member_id AS memberId,b.username,COALESCE(n.note,'') AS note,l.last_login_at AS lastLogin,COALESCE(a.enabled,0) AS enabled,a.expires_at AS expiresAt,CASE WHEN a.member_id IS NULL THEN 'pending' WHEN a.enabled<>1 THEN 'disabled' WHEN a.expires_at IS NOT NULL AND a.expires_at<=? THEN 'expired' ELSE 'active' END AS accessState,CASE WHEN lower(b.username) IN (?,?) THEN 1 ELSE 0 END AS isAdmin,CASE WHEN b.expires_at>? AND a.enabled=1 AND (a.expires_at IS NULL OR a.expires_at>?) AND EXISTS (SELECT 1 FROM arena_sessions s WHERE s.member_id=b.member_id AND s.expires_at>?) THEN 1 ELSE 0 END AS signedIn FROM tz_bindings b LEFT JOIN account_access a ON a.member_id=b.member_id LEFT JOIN account_notes n ON n.member_id=b.member_id LEFT JOIN account_login_activity l ON l.member_id=b.member_id WHERE b.member_id LIKE 'tz:%' ORDER BY (a.member_id IS NULL) DESC,b.verified_at DESC").bind(now,PLATFORM_ADMIN_USERNAME,'vrvtest01',now,now,now).all();
  const preapproved=await db.prepare("SELECT username,note,enabled,expires_at AS expiresAt,CASE WHEN enabled<>1 THEN 'disabled' WHEN expires_at IS NOT NULL AND expires_at<=? THEN 'expired' ELSE 'active' END AS accessState FROM account_preapprovals WHERE claimed_member_id IS NULL AND NOT EXISTS (SELECT 1 FROM tz_bindings b WHERE b.member_id LIKE 'tz:%' AND lower(b.username)=account_preapprovals.username_key) ORDER BY updated_at DESC").bind(now).all();
  return reply({accounts:[...result.results,...preapproved.results.map((row:any)=>({...row,memberId:null,lastLogin:null,isAdmin:0,signedIn:0}))]});
 }catch{return reply({error:'帳號清單暫時無法讀取'},503);}
}
export async function POST(request:Request){
 if(!await isSiteAdmin())return reply({error:'僅限管理員'},403);
 if(!sameOrigin(request))return reply({error:'請從管理後台操作'},403);
 try{
  const body=await readBody(request),{username,expiresAt}=body,note=body.note??'';
  if(!validUsername(username)||!validExpiry(expiresAt)||!validNote(note))return reply({error:'請確認帳號、到期時間與備註（最多 1000 字）'},400);
  const name=username.trim(),key=name.toLowerCase(),now=Date.now();
  if(expiresAt!==null&&expiresAt<=now)return reply({error:'開通的到期時間必須晚於現在'},400);
  if(key==='aa3344')return reply({error:'aa3344 為唯讀測試帳號，請使用上方測試帳號設定'},409);
  if(['dvp0322','dvp038','dvp03068','tzt05','vrv01'].includes(key))return reply({error:'此帳號請使用既有管理員登入方式'},409);
  if(isAdminName(name)&&expiresAt!==null)return reply({error:'管理員須保留無期限使用權'},409);
  const db=getRawDb(),found=await db.prepare("SELECT b.member_id AS memberId,b.username,a.enabled,a.expires_at AS expiresAt FROM tz_bindings b LEFT JOIN account_access a ON a.member_id=b.member_id WHERE b.member_id LIKE 'tz:%' AND lower(b.username)=?").bind(key).all();
  if(found.results.length>1)return reply({error:'找到多筆同名帳號，請從名單選擇要開通的帳號'},409);
  const account=found.results[0] as {memberId:string;username:string;enabled:number|null;expiresAt:number|null}|undefined;
  if(account){
   if(account.enabled===1&&(account.expiresAt===null||account.expiresAt>now))return reply({error:'此帳號已開通，請從名單編輯期限或備註'},409);
   const statements=[
    db.prepare('INSERT INTO account_access (member_id,enabled,expires_at,updated_at) VALUES (?,1,?,?) ON CONFLICT(member_id) DO UPDATE SET enabled=excluded.enabled,expires_at=excluded.expires_at,updated_at=excluded.updated_at').bind(account.memberId,expiresAt,now),
    db.prepare('UPDATE account_preapprovals SET claimed_member_id=?,updated_at=? WHERE username_key=? AND claimed_member_id IS NULL').bind(account.memberId,now,key)
   ];
   // A blank optional note must not erase an existing account's saved note.
   if(note.trim())statements.push(db.prepare('INSERT INTO account_notes (member_id,note,updated_at) VALUES (?,?,?) ON CONFLICT(member_id) DO UPDATE SET note=excluded.note,updated_at=excluded.updated_at').bind(account.memberId,note.trim(),now));
   await db.batch(statements);
   return reply({ok:true,username:account.username,message:'帳號已開通'});
  }
  if(isAdminName(name))return reply({error:'管理員請先登入，再從名單編輯備註'},409);
  const created=await db.prepare('INSERT INTO account_preapprovals (username_key,username,enabled,expires_at,note,updated_at) VALUES (?,?,1,?,?,?) ON CONFLICT(username_key) DO NOTHING RETURNING username').bind(key,name,expiresAt,note.trim(),now).first();
  if(!created)return reply({error:'此帳號已有開通紀錄，請從名單編輯'},409);
  return reply({ok:true,username:name,message:'已預先開通，會員首次驗證帳密後即可登入'});
 }catch{return reply({error:'開通失敗，請重新確認後再試'},400);}
}
export async function PATCH(request:Request){
 if(!await isSiteAdmin())return reply({error:'僅限管理員'},403);
 if(!sameOrigin(request))return reply({error:'請從管理後台操作'},403);
 try{
  const body=await readBody(request),{memberId,pendingUsername,enabled,expiresAt,note}=body;
  const grant='enabled' in body||'expiresAt' in body,hasNote='note' in body;
  if((!grant&&!hasNote)||(grant&&(typeof enabled!=='boolean'||!validExpiry(expiresAt)))||(hasNote&&!validNote(note)))return reply({error:'請確認授權、到期時間與備註（最多 1000 字）'},400);
  const db=getRawDb(),now=Date.now();
  if(pendingUsername!==undefined){
   if(memberId!==undefined||!validUsername(pendingUsername))return reply({error:'帳號格式不正確'},400);
   const key=pendingUsername.trim().toLowerCase();
   if(isAdminName(key)&&grant&&(!enabled||expiresAt!==null))return reply({error:'管理員須保留無期限使用權'},409);
   const saved=grant?await db.prepare('UPDATE account_preapprovals SET enabled=?,expires_at=?,note=CASE WHEN ?=1 THEN ? ELSE note END,updated_at=? WHERE username_key=? AND claimed_member_id IS NULL RETURNING username').bind(enabled?1:0,expiresAt,hasNote?1:0,hasNote?note.trim():'',now,key).first():await db.prepare('UPDATE account_preapprovals SET note=?,updated_at=? WHERE username_key=? AND claimed_member_id IS NULL RETURNING username').bind(note.trim(),now,key).first();
   return saved?reply({ok:true}):reply({error:'帳號狀態已更新，請重新載入名單後操作'},409);
  }
  if(typeof memberId!=='string'||!memberId.startsWith('tz:')||memberId.length>200)return reply({error:'帳號格式不正確'},400);
  const account=await db.prepare('SELECT member_id,username FROM tz_bindings WHERE member_id=?').bind(memberId).first<{member_id:string;username:string}>();
  if(!account||!account.member_id.startsWith('tz:'))return reply({error:'找不到帳號'},404);
  if(isAdminName(account.username)&&grant&&(!enabled||expiresAt!==null))return reply({error:'管理員須保留無期限使用權'},409);
  const statements=[];
  if(grant)statements.push(
   db.prepare('INSERT INTO account_access (member_id,enabled,expires_at,updated_at) VALUES (?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET enabled=excluded.enabled,expires_at=excluded.expires_at,updated_at=excluded.updated_at').bind(memberId,enabled?1:0,expiresAt,now),
   db.prepare('DELETE FROM arena_sessions WHERE member_id=? AND EXISTS (SELECT 1 FROM account_access WHERE member_id=? AND (enabled=0 OR expires_at<=?))').bind(memberId,memberId,now),
   db.prepare('UPDATE account_preapprovals SET claimed_member_id=?,updated_at=? WHERE username_key=? AND claimed_member_id IS NULL').bind(memberId,now,account.username.toLowerCase())
  );
  if(hasNote)statements.push(db.prepare('INSERT INTO account_notes (member_id,note,updated_at) VALUES (?,?,?) ON CONFLICT(member_id) DO UPDATE SET note=excluded.note,updated_at=excluded.updated_at').bind(memberId,note.trim(),now));
  await db.batch(statements);return reply({ok:true});
 }catch{return reply({error:'儲存失敗，請重新確認後再試'},400);}
}
export async function DELETE(request:Request){
 if(!await isSiteAdmin())return reply({error:'僅限管理員'},403);
 if(!sameOrigin(request))return reply({error:'請從管理後台操作'},403);
 try{
  const {memberId,pendingUsername,confirmUsername}=await readBody(request);
  if(!validUsername(confirmUsername))return reply({error:'請確認要刪除的帳號'},400);
  const db=getRawDb();
  if(pendingUsername!==undefined){
   if(memberId!==undefined||!validUsername(pendingUsername)||pendingUsername!==confirmUsername)return reply({error:'請確認要刪除的帳號'},400);
   if(isAdminName(pendingUsername))return reply({error:'不能刪除管理員帳號'},409);
   const removed=await db.prepare('DELETE FROM account_preapprovals WHERE username_key=? AND username=? AND claimed_member_id IS NULL RETURNING username').bind(pendingUsername.trim().toLowerCase(),confirmUsername).first();
   return removed?reply({ok:true}):reply({error:'帳號狀態已更新，請重新載入後確認'},409);
  }
  if(typeof memberId!=='string'||!memberId.startsWith('tz:')||memberId.length>200)return reply({error:'請確認要刪除的帳號'},400);
  const account=await db.prepare('SELECT username FROM tz_bindings WHERE member_id=?').bind(memberId).first<{username:string}>();
  if(!account)return reply({error:'帳號已不存在，請重新載入'},404);
  if(isAdminName(account.username))return reply({error:'不能刪除管理員帳號'},409);
  if(account.username!==confirmUsername)return reply({error:'帳號資料已變更，請重新載入後確認'},409);
  await db.batch([
   db.prepare('DELETE FROM arena_sessions WHERE member_id=?').bind(memberId),
   db.prepare('DELETE FROM account_login_activity WHERE member_id=?').bind(memberId),
   db.prepare('DELETE FROM hr_connections WHERE member_id=?').bind(memberId),
   db.prepare('DELETE FROM account_notes WHERE member_id=?').bind(memberId),
   db.prepare('DELETE FROM account_preapprovals WHERE claimed_member_id=? OR (username_key=? AND claimed_member_id IS NULL)').bind(memberId,account.username.toLowerCase()),
   db.prepare('DELETE FROM account_access WHERE member_id=?').bind(memberId),
   db.prepare('DELETE FROM tz_binding_attempts WHERE member_id=?').bind(memberId),
   db.prepare('DELETE FROM tz_bindings WHERE member_id=?').bind(memberId)
  ]);
  return reply({ok:true});
 }catch{return reply({error:'刪除未完成，請重新載入後再試'},400);}
}
