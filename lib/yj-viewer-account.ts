import {randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {hash,isYjViewerSite,sessionCookie,sessionToken,viewerCookie,VIEWER_MEMBER_ID,VIEWER_USERNAME} from './arena-session';
import {requestOrigin} from './request-origin';
import {verifyTurnstile} from './turnstile';

const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
export async function passwordDigest(password:string,salt=randomBytes(16).toString('hex')){
 const key=await new Promise<Buffer>((resolve,reject)=>scryptCallback(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));
 return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function passwordMatches(password:string,digest:string){
 if(!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(digest))return false;
 const actual=await passwordDigest(password,digest.split(':')[1]);
 return timingSafeEqual(Buffer.from(actual),Buffer.from(digest));
}
export async function viewerLogin(request:Request,db:any,input:any,config:{enabled:boolean;secret?:string},fetcher:typeof fetch=fetch){
 if(!isYjViewerSite())return reply({error:'此測試帳號僅限登入 YJ'},403);
 if(request.headers.get('origin')!==requestOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return reply({error:'請從網站登入頁操作'},403);
 if(input.source!==undefined||typeof input.password!=='string'||!input.password||input.password.length>128)return reply({error:'請輸入有效帳號密碼'},400);
 if(config.enabled){
  if(!config.secret)return reply({error:'登入驗證服務尚未設定，請聯絡管理員'},503);
  if(!await verifyTurnstile(input.turnstileToken,config.secret,fetcher))return reply({error:'安全驗證失敗或已過期，請重新驗證'},403);
 }
 const now=Date.now(),throttle='login-rate:yj-viewer:'+VIEWER_USERNAME;
 const allowed=await db.prepare('INSERT INTO tz_binding_attempts (member_id,allowed_at,operation_id) VALUES (?,?,?) ON CONFLICT(member_id) DO UPDATE SET allowed_at=excluded.allowed_at WHERE tz_binding_attempts.allowed_at<=? RETURNING member_id').bind(throttle,now+30000,'login',now).first();
 if(!allowed)return reply({error:'請等 30 秒後再試'},429);
 const account=await db.prepare('SELECT password_hash,version,enabled FROM yj_viewer_accounts WHERE member_id=?').bind(VIEWER_MEMBER_ID).first();
 const verified=account?.password_hash&&await passwordMatches(input.password,account.password_hash);input.password='';
 if(!verified||account.enabled!==1)return reply({error:'帳號密碼錯誤或測試帳號已停用'},401);
 const token=randomBytes(32).toString('hex'),tokenHash=await hash(token),expires=now+12*3600000;
 const oldToken=sessionToken(request.headers.get('cookie'));
 await db.batch([
  db.prepare('DELETE FROM yj_viewer_sessions WHERE member_id=? OR expires_at<=?').bind(VIEWER_MEMBER_ID,now),
  db.prepare('INSERT INTO yj_viewer_sessions (token_hash,member_id,version,expires_at) SELECT ?,member_id,version,? FROM yj_viewer_accounts WHERE member_id=? AND enabled=1 AND version=? AND password_hash=?').bind(tokenHash,expires,VIEWER_MEMBER_ID,account.version,account.password_hash),
  db.prepare('UPDATE yj_viewer_accounts SET last_login_at=? WHERE member_id=? AND EXISTS (SELECT 1 FROM yj_viewer_sessions WHERE token_hash=?)').bind(now,VIEWER_MEMBER_ID,tokenHash),
  db.prepare('DELETE FROM arena_sessions WHERE token_hash=?').bind(oldToken?await hash(oldToken):'')
 ]);
 if(!await db.prepare('SELECT token_hash FROM yj_viewer_sessions WHERE token_hash=?').bind(tokenHash).first())return reply({error:'帳號設定已變更，請重新登入'},403);
 const response=reply({signedIn:true,username:VIEWER_USERNAME,accessMode:'view_only',source:'yj'});
 response.headers.append('Set-Cookie',viewerCookie(token,12*3600));response.headers.append('Set-Cookie',sessionCookie('',0));
 return response;
}
