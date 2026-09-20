import {requestOrigin} from '@/lib/request-origin';
import {env} from '@/server/runtime';
import {getRawDb} from '@/db';
import {isSiteAdmin} from '@/app/admin-access';
import {verifyTurnstile} from '@/lib/turnstile';
import {readTurnstileSettings,saveTurnstileSettings} from '@/lib/turnstile-settings';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){
 if(!await isSiteAdmin())return reply({error:'僅限管理員'},403);
 try{const config=await readTurnstileSettings(getRawDb(),env.TZ_BINDING_KEY);return reply({enabled:config.enabled,siteKey:config.siteKey,hostname:new URL(requestOrigin(request)).hostname});}catch{return reply({error:'設定讀取失敗，請稍後重試'},503);}
}
export async function POST(request:Request){
 if(!await isSiteAdmin())return reply({error:'僅限管理員'},403);
 if(request.headers.get('origin')!==requestOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return reply({error:'請從管理後台操作'},403);
 try{
  if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'格式錯誤'},415);
  const reader=request.body?.getReader();if(!reader)return reply({error:'格式錯誤'},400);
  const chunks:Uint8Array[]=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();return reply({error:'輸入過長'},413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  const input=JSON.parse(new TextDecoder().decode(bytes));
  if(input.enabled===false){await getRawDb().prepare("INSERT INTO turnstile_settings (id,encrypted_secret,enabled,updated_at) VALUES ('login','',0,?) ON CONFLICT(id) DO UPDATE SET enabled=0,updated_at=excluded.updated_at").bind(Date.now()).run();return reply({enabled:false});}
  const secret=typeof input.secret==='string'?input.secret.trim():'';
  const siteKey=typeof input.siteKey==='string'?input.siteKey.trim():'';
  if(!/^[A-Za-z0-9_-]{10,256}$/.test(siteKey))return reply({error:'請填入 Cloudflare 小工具的網站金鑰（Site Key）。原設定未變更。'},400);
  if(secret.length<10||secret.length>256||!await verifyTurnstile(input.token,secret))return reply({error:'驗證未通過：請確認私密金鑰與網站金鑰屬於同一小工具，並重新完成驗證。原設定未變更。'},400);
  const key=(env as unknown as Record<string,string>).TZ_BINDING_KEY;if(!key)return reply({error:'安全儲存服務尚未設定'},503);
  await saveTurnstileSettings(getRawDb(),key,secret,siteKey);return reply({enabled:true});
 }catch{return reply({error:'設定未儲存，請重新驗證後再試'},503);}
}
