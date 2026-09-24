import {claimSuperSession,renewSuperSession,releaseSuperSession} from './super-session-lock';
import {credentialKey,decryptToken} from './tz-credentials';
import {requestOrigin} from './request-origin';
import type {HrDatabase} from './hr9988-connection';
const privacy={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:privacy});
import {superDeviceEntryUrl} from './super-entry-url';
export {superEntryUrl} from './super-entry-url';
/** Issue an unconsumed, owner-specific browser entry. Never exchange its MemID on the server. */
export async function superEntry(request:Request,memberId:string|null,db:HrDatabase,secret:string|undefined,fetcher:typeof fetch=fetch){
 if(!memberId)return reply({error:'請先登入網站。',code:'signin_required'},401);
 if(request.method!=='POST')return reply({error:'不支援此操作。'},405);
 if(request.headers.get('origin')!==requestOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return reply({error:'請從網站內開啟 SUPER。'},403);
 const session=request.headers.get('x-super-session');
 if(!session||!/^browser:[a-f0-9-]{36}$/i.test(session))return reply({error:'請重新整理頁面後開啟 SUPER。',code:'invalid_session'},400);
 const action=request.headers.get('x-super-action')||'open';
 if(!['open','heartbeat','release'].includes(action))return reply({error:'不支援此操作。'},400);
 let claimed=false,delivered=false;
 if(!secret)return reply({error:'SUPER 登入服務尚未設定。'},503);
 try{
  const binding=await db.prepare('SELECT member_id,encrypted_token,expires_at,verified_at FROM tz_bindings WHERE member_id=?').bind(memberId).first<{member_id:string;encrypted_token:string;expires_at:number;verified_at:number}>();
  if(!binding||binding.expires_at<=Date.now())return reply({error:'TZ 授權已到期，請重新登入網站。',code:'tz_auth_expired'},409);
  if(action==='release'){await releaseSuperSession(db,memberId,session);return reply({ok:true});}
  if(action==='heartbeat'){const ok=await renewSuperSession(db,memberId,session);return reply({ok},ok?200:409);}
  const now=Date.now(),operationId=crypto.randomUUID();
  const lease=await db.prepare('INSERT INTO tz_binding_attempts (member_id,allowed_at,operation_id) VALUES (?,?,?) ON CONFLICT(member_id) DO UPDATE SET allowed_at=excluded.allowed_at,operation_id=excluded.operation_id WHERE tz_binding_attempts.allowed_at<=? RETURNING operation_id').bind('super-entry:'+memberId,now+10000,operationId,now).first();
  if(!lease)return reply({error:'SUPER 入口正在更新，請等 10 秒後重試。',code:'rate_limited'},429);
  if(!await claimSuperSession(db,memberId,session,120000))return reply({error:'SUPER 正在其他視窗使用或更新資料，請先關閉其他 SUPER 視窗，或稍後再試。',code:'super_in_use'},409);
  claimed=true;
  const mobile=request.headers.get('x-super-device')==='mobile'||request.headers.get('sec-ch-ua-mobile')==='?1'||/Mobile|Android|iPhone|iPad/i.test(request.headers.get('user-agent')||'');
  const key=await credentialKey(secret),token=await decryptToken(binding.encrypted_token,memberId,key);
  const r=await fetcher('https://www.tz6868.com/api/v2/game/SUPER/login',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({game_return_url:'https://www.tz6868.cc',game_kind:'',game_type:'',game_device:mobile?'Mobile':'Desktop'}),redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(r.status===401)return reply({error:'TZ 授權失效，請重新登入網站。',code:'tz_auth_expired'},409);
  if(r.status===403||r.status>=300&&r.status<400)return reply({error:'TZ 拒絕這次連線，尚未取得 SUPER 入口。請在來源完成所需驗證後重試。',code:'source_access_denied'},502);
  if(!r.ok)return reply({error:'SUPER 登入服務暫時無法使用，請稍後重試。',code:'source_unavailable'},502);
  const reader=r.body?.getReader();if(!reader)throw Error();let size=0,raw='';const decoder=new TextDecoder();
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw Error();}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();
  const data=JSON.parse(raw),url=superDeviceEntryUrl(data?.data?.game_url,mobile);
  if(String(data?.code)!=='200'||data?.data?.game_method!=='GET'||!url)return reply({error:'來源未提供有效的 SUPER 登入入口，請確認體育館權限。',code:'invalid_entry'},502);
  const current=await db.prepare('SELECT encrypted_token,verified_at,expires_at FROM tz_bindings WHERE member_id=?').bind(memberId).first<{encrypted_token:string;verified_at:number;expires_at:number}>();
  if(!current||current.encrypted_token!==binding.encrypted_token||current.verified_at!==binding.verified_at||current.expires_at<=Date.now())return reply({error:'登入狀態已變更，請重新開啟 SUPER。',code:'binding_changed'},409);
  // This is a short local reuse window, not a claim about the upstream ticket expiry.
  delivered=true;
  return reply({url,reuseUntil:Math.min(Date.now()+45000,binding.expires_at)});
 }catch{return reply({error:'暫時無法取得 SUPER 登入入口，請稍後重試。',code:'source_unreachable'},502);}
 finally{if(claimed&&!delivered)await releaseSuperSession(db,memberId,session).catch(()=>{});}
}
