import {randomBytes, createHash} from 'node:crypto';
import {passwordDigest,passwordMatches} from './yj-viewer-account';
import {verifyTurnstile} from './turnstile';
import {requestOrigin} from './request-origin';

type Database = {query(sql:string, values?:any[]):Promise<{rows:any[]}>};
const cookieName='__Host-mt_trial';
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const tokenPattern=/^[a-f0-9]{64}$/;
export const trialReply=(data:object,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
export function sameTrialOrigin(request:Request){
  return request.headers.get('origin')===requestOrigin(request) && request.headers.get('sec-fetch-site')!=='cross-site';
}
export async function issueTrialAccount(db:Database){
  const username='mt-'+randomBytes(7).toString('hex');
  const password=randomBytes(18).toString('base64url');
  await db.query('INSERT INTO mt_trial_accounts(username,password_hash) VALUES ($1,$2)',[username,await passwordDigest(password)]);
  return {username,password};
}
function sessionHash(request:Request){
  const values=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(cookieName+'='));
  const token=values.length===1?values[0].slice(cookieName.length+1):'';
  return tokenPattern.test(token)?digest(token):null;
}
export async function trialIdentity(db:Database,request:Request){
  const session=sessionHash(request);
  if(!session)return null;
  const {rows}=await db.query('SELECT id,username FROM mt_trial_accounts WHERE session_hash=$1 AND enabled AND session_until>now()',[session]);
  return rows.length?{id:String(rows[0].id),username:String(rows[0].username),session}:null;
}
const cookie=(token:string,age:number)=>cookieName+'='+token+'; Path=/; Secure; HttpOnly; SameSite=None; Partitioned; Max-Age='+age;
export async function logoutTrial(db:Database,request:Request){
  const session=sessionHash(request);
  if(session)await db.query('UPDATE mt_trial_accounts SET session_hash=NULL,session_until=NULL WHERE session_hash=$1',[session]);
  const response=trialReply({ok:true});response.headers.set('Set-Cookie',cookie('',0));return response;
}
export async function trialLogin(db:Database,request:Request,config:{enabled:boolean;secret?:string}){
  if(!sameTrialOrigin(request))return trialReply({error:'請從星準試玩登入頁操作。'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return trialReply({error:'登入格式有誤。'},415);
  const reader=request.body?.getReader();if(!reader)return trialReply({error:'缺少帳號密碼。'},400);
  const chunks:Uint8Array[]=[];let size=0;
  for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>4096){await reader.cancel();return trialReply({error:'登入資料過長。'},413);}chunks.push(part.value);}
  let input;try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{return trialReply({error:'登入格式有誤。'},400);}
  const name=typeof input?.username==='string'?input.username.trim().toLowerCase():'';
  const denied=()=>trialReply({error:'帳號密碼有誤、帳號已停用或嘗試過於頻繁，請稍後再試。'},401);
  if(!/^mt-[a-f0-9]{14}$/.test(name)||typeof input.password!=='string'||input.password.length>128)return denied();
  if(config.enabled && !await verifyTurnstile(input.turnstileToken,config.secret))return trialReply({error:'請重新完成安全驗證。'},403);
  const {rows}=await db.query(`UPDATE mt_trial_accounts SET next_login_at=now()+interval '3 seconds'
    WHERE username=$1 AND enabled AND (next_login_at IS NULL OR next_login_at<=now()) RETURNING id,password_hash`,[name]);
  if(!rows.length||!await passwordMatches(input.password,rows[0].password_hash))return denied();
  const token=randomBytes(32).toString('hex');
  const saved=await db.query("UPDATE mt_trial_accounts SET session_hash=$2,session_until=now()+interval '12 hours' WHERE id=$1 AND enabled AND password_hash=$3 RETURNING id",[rows[0].id,digest(token),rows[0].password_hash]);
  if(!saved.rows.length)return denied();
  const response=trialReply({ok:true});response.headers.set('Set-Cookie',cookie(token,43200));return response;
}
