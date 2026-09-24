import {requestOrigin} from './request-origin';
import {verifyTurnstile} from './turnstile';
import {hash,sessionToken,sessionCookie,readSession,PLATFORM_ADMIN_USERNAME} from './arena-session';
import {handleTzBinding} from './tz-binding-service';
import {credentialKey,decryptToken,encryptToken} from './tz-credentials';
const response=(d:any,status=200,cookie?:string)=>Response.json(d,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie',...(cookie?{'Set-Cookie':cookie}:{})}});
export async function tzLogin(request:Request,db:any,secret:string|undefined,fetcher:typeof fetch=fetch,turnstileSecret?:string,requireTurnstile=false){
 try{
 if(request.method==='GET'){const s=await readSession(db,request.headers.get('cookie'));return response(s?{signedIn:true,username:s.username,expiresAt:s.expiresAt}:{signedIn:false});}
 if(request.headers.get('origin')!==requestOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return response({error:'請從網站登入頁操作'},403);
 if(request.method==='DELETE'){const token=sessionToken(request.headers.get('cookie'));if(token)await db.prepare('DELETE FROM arena_sessions WHERE token_hash=?').bind(await hash(token)).run();return response({signedIn:false},200,sessionCookie('',0));}
 if(request.method!=='POST')return response({error:'不支援此操作'},405);
 if(!secret)return response({error:'登入服務尚未設定'},503);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return response({error:'輸入格式有誤'},415);
 const reader=request.body?.getReader();if(!reader)return response({error:'請輸入帳密'},400);let text='',size=0;const decoder=new TextDecoder();for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();return response({error:'輸入過長'},413);}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
 let input:any;try{input=JSON.parse(text);}catch{return response({error:'輸入格式有誤'},400);}text='';
 if(input.source!==undefined&&input.source!=='tz'&&input.source!=='ofa')return response({error:'登入來源無效'},400);
 const source=input.source==='ofa'?'ofa':'tz';
 if(typeof input.username!=='string'||typeof input.password!=='string'||!input.username.trim()||!input.password||input.username.length>128||input.password.length>256)return response({error:'請輸入有效帳號密碼'},400);
 if(requireTurnstile){
  if(!turnstileSecret)return response({error:'登入驗證服務尚未設定，請聯絡管理員'},503);
  if(!await verifyTurnstile(input.turnstileToken,turnstileSecret,fetcher))return response({error:'安全驗證失敗或已過期，請重新驗證'},403);
 }
 const username=input.username.trim();
 if(source==='ofa'&&!['dvp0322','dvp038'].includes(username.toLowerCase()))return response({error:'此帳號未開放 OFA 管理員登入'},403);
 const now=Date.now();const throttle='login-rate:'+await hash(source+':'+username.toLowerCase());
 const allowed=await db.prepare('INSERT INTO tz_binding_attempts (member_id,allowed_at,operation_id) VALUES (?,?,?) ON CONFLICT(member_id) DO UPDATE SET allowed_at=excluded.allowed_at WHERE tz_binding_attempts.allowed_at<=? RETURNING member_id').bind(throttle,now+30000,'login',now).first();
 if(!allowed)return response({error:'請等 30 秒後再試'},429);
 const candidate=(source==='ofa'?'ofa-login-candidate:':'login-candidate:')+crypto.randomUUID();
 try{
 const body=JSON.stringify({username,password:input.password});input.password='';
 const verified=await handleTzBinding(new Request(request.url,{method:'POST',headers:{'Origin':requestOrigin(request),'Content-Type':'application/json'},body}),candidate,()=>db,secret,fetcher);
 if(!verified.ok){const d=await verified.json();return response({error:d.message||'登入失敗'},verified.status);}
 const binding=await db.prepare('SELECT * FROM tz_bindings WHERE member_id=?').bind(candidate).first();if(!binding)throw new Error();
 // Identity comes only from tz's authenticated server response, never submitted username.
 if(source==='ofa'&&!['dvp0322','dvp038'].includes(binding.username.toLowerCase()))return response({error:'此帳號未開放 OFA 管理員登入'},403);
 const member=source+':'+String(binding.source_user_id),key=await credentialKey(secret);
 const token=await decryptToken(binding.encrypted_token,candidate,key),encrypted=await encryptToken(token,member,key);
 // Keep a verified account visible to administrators even before it is approved.
 // Upstream verification alone never grants a normal account access to the site.
 await db.prepare("INSERT INTO tz_bindings (member_id,source_user_id,username,device_id,encrypted_token,expires_at,verified_at,game_url) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET username=excluded.username,device_id=excluded.device_id,encrypted_token=excluded.encrypted_token,expires_at=excluded.expires_at,verified_at=excluded.verified_at,game_url=excluded.game_url").bind(member,binding.source_user_id,binding.username,binding.device_id,encrypted,binding.expires_at,binding.verified_at,source==='ofa'?null:'https://hr9988.net/#/Games').run();
 // Preserve the existing primary administrator, using only the verified identity.
 // Never overwrite an explicit grant, restriction or expiry.
 if((source==='tz'&&binding.username.toLowerCase()===PLATFORM_ADMIN_USERNAME)||(source==='ofa'&&['dvp0322','dvp038'].includes(binding.username.toLowerCase())))await db.prepare('INSERT INTO account_access (member_id,enabled,expires_at,updated_at) VALUES (?,1,NULL,?) ON CONFLICT(member_id) DO NOTHING').bind(member,Date.now()).run();
 const access=await db.prepare('SELECT enabled,expires_at FROM account_access WHERE member_id=?').bind(member).first();
 if(!access)return response({code:'approval_required',error:'帳號驗證成功，尚未取得網站授權。請聯繫作者，由管理員開通後再登入。'},403,sessionCookie('',0));
 if(access.enabled!==1)return response({code:'access_disabled',error:'網站授權已停用，請聯繫作者。'},403,sessionCookie('',0));
 if(access.expires_at!==null&&access.expires_at<=Date.now())return response({code:'access_expired',error:'網站授權已到期，請聯繫作者續期。'},403,sessionCookie('',0));
 const session=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
 const expires=Math.min(binding.expires_at,now+12*3600000),oldToken=sessionToken(request.headers.get('cookie'));
 await db.batch([
 db.prepare('DELETE FROM arena_sessions WHERE member_id=? OR token_hash=? OR expires_at<=?').bind(member,oldToken?await hash(oldToken):'',now),
 db.prepare('INSERT INTO arena_sessions (token_hash,member_id,expires_at) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM account_access WHERE member_id=? AND enabled=1 AND (expires_at IS NULL OR expires_at>?))').bind(await hash(session),member,expires,member,Date.now())
 ]);
 if(!await readSession(db,sessionCookie(session,1)))return response({error:'帳號使用權已變更，請聯絡管理員'},403,sessionCookie('',0));
 return response({signedIn:true,username:binding.username,source},200,sessionCookie(session,Math.floor((expires-now)/1000)));
 }finally{await db.batch([db.prepare('DELETE FROM tz_bindings WHERE member_id=?').bind(candidate),db.prepare('DELETE FROM tz_binding_attempts WHERE member_id=?').bind(candidate)]);}
 }catch{return response({error:'登入服務暫時無法完成，請稍後再試'},503);}
}
