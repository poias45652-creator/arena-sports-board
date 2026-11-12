import {timingSafeEqual,createHash} from 'node:crypto';
import {getPool} from '@/server/database.mjs';
export const dynamic='force-dynamic';
const hash=(v:string)=>createHash('sha256').update(v).digest();
export async function POST(request:Request){
  const key=process.env.MT_SCREEN_KEY;
  if(!key||key.length<32||!timingSafeEqual(hash(request.headers.get('authorization')||''),hash('Bearer '+key)))return new Response(null,{status:403});
  const {subject}=await request.json();
  if(typeof subject!=='string'||!/^[a-f0-9]{64}$/.test(subject))return new Response(null,{status:400});
  const {rows}=await getPool().query('SELECT 1 FROM mt_trial_accounts WHERE session_hash=$1 AND enabled AND session_until>now()',[subject]);
  return new Response(null,{status:rows.length?204:403,headers:{'Cache-Control':'no-store'}});
}
