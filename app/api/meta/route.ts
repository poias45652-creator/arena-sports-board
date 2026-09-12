import crypto from 'node:crypto';
import {adminExists,passwordHash,readUser,validOrigin} from '../../../server/auth.mjs';
import {getPool} from '../../../server/database.mjs';
export const dynamic='force-dynamic';
export async function GET(){try{return Response.json({ok:true,setupRequired:!(await adminExists()),adminSetupVersion:3},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'帳號服務暫時無法使用。'},{status:503});}}
export async function POST(request:Request){
 try{
  if(!validOrigin(request))return Response.json({error:'請從管理後台重新操作。'},{status:403});
  const admin=await readUser(request);if(admin?.role!=='admin')return Response.json({error:'僅限管理員新增帳號。'},{status:403});
  const data=await request.json(),username=typeof data?.username==='string'?data.username.trim().toLowerCase():'',password=typeof data?.password==='string'?data.password:'';
  if(!/^[a-z0-9_.-]{3,32}$/.test(username)||password.length<10||password.length>1024)return Response.json({error:'帳號需 3–32 個英文、數字或 _.-；密碼需 10–1024 字元。'},{status:400});
  const salt=crypto.randomBytes(16).toString('hex'),hash=await passwordHash(password,salt);
  await getPool().query("INSERT INTO arena_users(id,username,password_salt,password_hash,role) VALUES($1,$2,$3,$4,'member')",[crypto.randomUUID(),username,salt,hash]);
  return Response.json({ok:true,username},{status:201,headers:{'Cache-Control':'private, no-store'}});
 }catch(e:any){if(e?.code==='23505')return Response.json({error:'此帳號已存在。'},{status:409});return Response.json({error:'新增帳號失敗，請稍後重試。'},{status:500});}
}
