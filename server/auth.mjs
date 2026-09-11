import crypto from 'node:crypto';
import {promisify} from 'node:util';
import {getPool} from './database.mjs';
const scrypt=promisify(crypto.scrypt);
export const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
export const passwordHash=async(password,salt)=>(await scrypt(password,salt,64)).toString('hex');
export const publicUser=user=>({id:user.id,username:user.username,role:user.role});
export function trustedOrigin(request){const configured=process.env.APP_ORIGIN||process.env.RENDER_EXTERNAL_URL;return configured?new URL(configured).origin:new URL(request.url).origin;}
export function validOrigin(request){return request.headers.get('origin')===trustedOrigin(request)&&request.headers.get('sec-fetch-site')!=='cross-site';}
export function sessionCookie(token,request,maxAge=1209600){return `arena_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${trustedOrigin(request).startsWith('https:')?'; Secure':''}`;}
export function sessionToken(request){
 const cookie=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('arena_session='));
 if(!cookie)return null;
 try{const value=decodeURIComponent(cookie.slice(14));return /^[A-Za-z0-9_-]{43}$/.test(value)?value:null;}catch{return null;}
}
export async function readUser(request,pool=getPool()){
 const token=sessionToken(request);if(!token)return null;
 const {rows}=await pool.query('SELECT u.id,u.username,u.role FROM arena_sessions s JOIN arena_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[sha256(token)]);
 return rows[0]?publicUser(rows[0]):null;
}
export const adminExists=async(pool=getPool())=>(await pool.query("SELECT EXISTS(SELECT 1 FROM arena_users WHERE role='admin') AS exists")).rows[0].exists;
const reply=(data,status=200,cookie)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie',...(cookie?{'Set-Cookie':cookie}:{})}});
async function readBody(request){
 const reader=request.body?.getReader();if(!reader)throw new Error('invalid_input');let size=0,text='';const decoder=new TextDecoder();
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw new Error('invalid_input');}text+=decoder.decode(value,{stream:true});}
 return JSON.parse(text+decoder.decode());
}
export async function authAction(request,action,pool=getPool()){
 if(!validOrigin(request))return reply({error:'請從 Arena 網站重新操作。'},403);
 if(action==='logout'){
  const token=sessionToken(request);if(token)await pool.query('DELETE FROM arena_sessions WHERE token_hash=$1',[sha256(token)]);
  return reply({ok:true},200,sessionCookie('',request,0));
 }
 if(action==='register')return reply({error:'已關閉自行註冊，請由管理員建立帳號。'},403);
 let data;try{data=await readBody(request);}catch{return reply({error:'輸入格式不正確。'},400);}
 const username=typeof data?.username==='string'?data.username.trim().toLowerCase():'';
 const password=typeof data?.password==='string'?data.password:'';
 if(!/^[a-z0-9_.-]{3,32}$/.test(username)||password.length<10||password.length>1024)return reply({error:'帳號需 3–32 個英文、數字或 _.-；密碼需 10–1024 字元。'},400);
 const now=Date.now(),rateKey=sha256(action+':'+username);
 const rate=await pool.query('INSERT INTO arena_auth_attempts(key,attempts,window_end) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN arena_auth_attempts.window_end<=$3 THEN 1 ELSE arena_auth_attempts.attempts+1 END,window_end=CASE WHEN arena_auth_attempts.window_end<=$3 THEN excluded.window_end ELSE arena_auth_attempts.window_end END RETURNING attempts',[rateKey,now+900000,now]);
 if(rate.rows[0].attempts>20)return reply({error:'嘗試次數過多，請 15 分鐘後重試。'},429);
 if(action==='setup'){
  const configured=process.env.ARENA_SETUP_TOKEN||'',submitted=typeof data.setupToken==='string'?data.setupToken:'';
  if(configured.length<32)return reply({error:'管理員設定碼尚未完成設定。'},503);
  if(!crypto.timingSafeEqual(Buffer.from(sha256(configured),'hex'),Buffer.from(sha256(submitted),'hex')))return reply({error:'管理員設定碼不正確。'},403);
 }
 let user;
 if(action==='login'){
  const {rows}=await pool.query('SELECT * FROM arena_users WHERE username=$1',[username]);const saved=rows[0];
  const hash=await passwordHash(password,saved?.password_salt||'arena-invalid-user');
  if(!saved||!crypto.timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(saved.password_hash,'hex')))return reply({error:'帳號或密碼錯誤。'},401);
  user=publicUser(saved);
 }else if(action!=='setup')return reply({error:'找不到此操作。'},404);
 const salt=crypto.randomBytes(16).toString('hex'),hash=user?null:await passwordHash(password,salt),token=crypto.randomBytes(32).toString('base64url');
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  if(action==='setup'){
   await client.query("SET LOCAL lock_timeout='5s'");await client.query('SELECT pg_advisory_xact_lock($1::int,$2::int)',[1095910734,1]);
   if(await adminExists(client)){await client.query('ROLLBACK');return reply({error:'管理員已建立，請登入。'},409);}
  }
  if(!user){user={id:crypto.randomUUID(),username,role:action==='setup'?'admin':'member'};await client.query('INSERT INTO arena_users(id,username,password_salt,password_hash,role) VALUES($1,$2,$3,$4,$5)',[user.id,username,salt,hash,user.role]);}
  await client.query("INSERT INTO arena_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '14 days')",[sha256(token),user.id]);
  await client.query('COMMIT');return reply({ok:true,user},action==='login'?200:201,sessionCookie(token,request));
 }catch(e){await client.query('ROLLBACK');if(e.code==='23505')return reply({error:'此帳號已存在，請登入或選擇其他帳號。'},409);throw e;}finally{client.release();}
}
