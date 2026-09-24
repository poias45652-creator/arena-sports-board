import {requestOrigin} from './request-origin';
import {credentialKey,encryptToken,loginExpiry} from './tz-credentials';

type Statement={bind(...values:unknown[]):Statement;first<T=Record<string,unknown>>():Promise<T|null>;run():Promise<unknown>};
type Database={prepare(sql:string):Statement;batch(statements:Statement[]):Promise<unknown>};
type Binding={username:string;expires_at:number;verified_at:number;game_url?:string|null};
const noStore={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:noStore});
const fail=(error:string,message:string,status:number)=>reply({error,message},status);
function summary(row:Binding|null){return row?{status:row.expires_at<=Date.now()?'expired':'bound',username:row.username,expiresAt:new Date(row.expires_at).toISOString(),verifiedAt:new Date(row.verified_at).toISOString(),gameUrl:row.game_url??null,gameConnectionStatus:row.game_url?'url_saved':'not_configured'}:{status:'unbound'};}

export async function handleTzBinding(request:Request, memberId:string|null, getDatabase:()=>Database, secret:string|undefined, fetcher:typeof fetch=fetch):Promise<Response>{
 if(!memberId)return fail('signin_required','請先登入 Arena，再綁定自己的帳號。',401);
 if(!['GET','POST','PATCH','DELETE'].includes(request.method))return fail('method_not_allowed','不支援此操作。',405);
 if(request.method!=='GET'){
  const origin=request.headers.get('origin');
  if(!origin||origin!==requestOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return fail('invalid_origin','請從 Arena 網站重新操作。',403);
 }
 try{
  const db=getDatabase();
  if(request.method==='GET'){
   const row=await db.prepare('SELECT username, expires_at, verified_at, game_url FROM tz_bindings WHERE member_id = ?').bind(memberId).first<Binding>();
   return reply({...summary(row),configured:!!secret});
  }
  if(request.method==='DELETE'){
   // Invalidate any outstanding login before removing the owner's credential.
   await db.batch([
    db.prepare('INSERT INTO tz_binding_attempts (member_id, allowed_at, operation_id) VALUES (?, ?, ?) ON CONFLICT(member_id) DO UPDATE SET operation_id = excluded.operation_id').bind(memberId,Date.now(),crypto.randomUUID()),
    db.prepare('DELETE FROM tz_bindings WHERE member_id = ?').bind(memberId)
   ]);
   return reply({status:'unbound',message:'已解除 Arena 綁定。'});
  }
  if(!secret)return fail('service_unavailable','綁定服務尚未就緒，請稍後再試。',503);
  const key=await credentialKey(secret);
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return fail('invalid_request','請使用網站內的綁定表單。',415);
  if(Number(request.headers.get('content-length'))>4096)return fail('invalid_request','輸入內容過長。',413);
  // Bound body reading so chunked requests cannot bypass the size limit.
  const reader=request.body?.getReader();
  if(!reader)return fail('invalid_request','請輸入帳號與密碼。',400);
  let raw='',size=0;const decoder=new TextDecoder();
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return fail('invalid_request','輸入內容過長。',413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();
  let input:any;try{input=JSON.parse(raw);}catch{return fail('invalid_request','輸入格式有誤，請重新操作。',400);}raw='';
  if(request.method==='PATCH'){
   let url:URL;
   try{
    if(typeof input?.gameUrl!=='string'||input.gameUrl.length>512)throw new Error('Invalid URL');
    url=new URL(input.gameUrl.trim());
    if(url.protocol!=='https:'||!['hr9988.net','www.hr9988.net'].includes(url.hostname)||url.port||url.username||url.password||url.pathname!=='/'||url.hash!=='#/Games'||url.search)throw new Error('Invalid URL');
   }catch{return fail('invalid_game_url','請貼上 https://hr9988.net/#/Games 的賽事頁面網址。',400);}
   // Save only the page address, never treat a URL as verified source authorization.
   const saved=await db.prepare('UPDATE tz_bindings SET game_url = ? WHERE member_id = ? AND expires_at > ? RETURNING username, expires_at, verified_at, game_url').bind(url.href,memberId,Date.now()).first<Binding>();
   if(!saved)return fail('binding_required','請先完成有效的帳號綁定，再設定 SUPER 網址。',409);
   return reply({...summary(saved),configured:true,message:'SUPER 網址已儲存。資料連線尚未驗證。'});
  }
  if(!input||typeof input.username!=='string'||typeof input.password!=='string'||!input.username.trim()||input.username.length>128||!input.password||input.password.length>256)return fail('invalid_request','請輸入有效的帳號與密碼。',400);
  const username=input.username.trim();
  const now=Date.now(),operationId=crypto.randomUUID();
  const attempt=await db.prepare('INSERT INTO tz_binding_attempts (member_id, allowed_at, operation_id) VALUES (?, ?, ?) ON CONFLICT(member_id) DO UPDATE SET allowed_at = excluded.allowed_at, operation_id = excluded.operation_id WHERE tz_binding_attempts.allowed_at <= ? RETURNING operation_id').bind(memberId,now+30000,operationId,now).first();
  if(!attempt)return fail('rate_limited','操作太頻繁，請等 30 秒後重試。',429);
  const existing=await db.prepare('SELECT device_id FROM tz_bindings WHERE member_id = ?').bind(memberId).first<{device_id:string}>();
  // A distinct connector device per Arena member; never reuse the owner's browser ID.
  const deviceId=existing?.device_id??crypto.randomUUID().replaceAll('-','');
  const loginHost=memberId.startsWith('ofa-login-candidate:')?'https://www.ofa1188.net':'https://www.tz6868.com';
  let upstream:Response;
  try{
   upstream=await fetcher(`${loginHost}/api/v1/login`,{
    method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({username,password:input.password,device_id:deviceId}),
    signal:AbortSignal.timeout(15000),redirect:'manual',cache:'no-store'
   });
  }catch{return fail('source_unreachable','暫時無法連線登入服務，尚未完成綁定，請稍後重試。',502);}
  finally{input.password='';}
  if(upstream.status===401)return fail('login_rejected','未接受登入，請檢查帳密或帳號狀態。',422);
  if(upstream.status===403||upstream.status>=300&&upstream.status<400)return fail('source_access_denied','拒絕這次連線，可能需要在官方網站完成驗證；目前未完成綁定。',502);
  if(upstream.status===429)return fail('source_rate_limited','暫時限制登入次數，請稍後重試。',429);
  if(!upstream.ok)return fail('source_unavailable','登入服務暫時無法使用，請稍後重試。',502);
  let result:any;try{result=await upstream.json();}catch{return fail('source_format_changed','未回傳可辨識的登入結果，尚未完成綁定。',502);}
  if(String(result?.code)!=='200')return fail('login_rejected','未接受登入，請檢查帳密，或到官方網站確認是否需要驗證。',422);
  const data=result.data;
  if(typeof data?.token!=='string'||!['number','string'].includes(typeof data?.user_id)||typeof data?.username!=='string'||data.username.toLowerCase()!==username.toLowerCase())return fail('source_format_changed','登入回應不完整，尚未完成綁定。',502);
  let expiresAt:number;try{expiresAt=loginExpiry(data.token,now);}catch{return fail('source_invalid_token','未提供有效期限內的授權，請重新登入。',502);}
  const encrypted=await encryptToken(data.token,memberId,key);data.token='';
  const saved=await db.prepare('INSERT INTO tz_bindings (member_id, source_user_id, username, device_id, encrypted_token, expires_at, verified_at) SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM tz_binding_attempts WHERE member_id = ? AND operation_id = ?) ON CONFLICT(member_id) DO UPDATE SET source_user_id=excluded.source_user_id, username=excluded.username, device_id=excluded.device_id, encrypted_token=excluded.encrypted_token, expires_at=excluded.expires_at, verified_at=excluded.verified_at, game_url=CASE WHEN tz_bindings.source_user_id=excluded.source_user_id THEN tz_bindings.game_url ELSE NULL END RETURNING username, expires_at, verified_at, game_url').bind(memberId,String(data.user_id),data.username,deviceId,encrypted,expiresAt,now,memberId,operationId).first<Binding>();
  if(!saved)return fail('operation_cancelled','這次綁定已取消，請重新操作。',409);
  return reply({...summary(saved),configured:true,message:'登入驗證成功，已保存個人授權。'});
 }catch{
  // Never log request bodies, source replies, passwords or tokens.
  return fail('service_unavailable','綁定服務暫時無法完成操作，請稍後重試。',503);
 }
}
