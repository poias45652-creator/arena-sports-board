import {getRawDb} from '@/db';
import {isSiteAdmin} from '@/app/admin-access';
import {requestOrigin} from '@/lib/request-origin';
import {AI_MODEL,readAiBody,selectAiEvidence,type AiSnapshot} from '@/lib/ai-assistant';
import {readAiSettings,saveAiSettings} from '@/lib/ai-assistant-settings';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){
 if(!await isSiteAdmin())return reply({error:'僅限管理員'},403);
 try{const config=await readAiSettings(getRawDb());return reply({enabled:config.enabled,configured:!!config.key,model:AI_MODEL});}catch{return reply({error:'設定讀取失敗'},503);}
}
export async function POST(request:Request){
 if(!await isSiteAdmin())return reply({error:'僅限管理員'},403);
 if(request.headers.get('origin')!==requestOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return reply({error:'請從管理後台操作'},403);
 try{
  const input=await readAiBody(request,4096),db=getRawDb();
  if(input.enabled===false){await db.prepare("INSERT INTO ai_assistant_settings (id,encrypted_key,enabled,updated_at) VALUES ('main','',0,?) ON CONFLICT(id) DO UPDATE SET enabled=0,updated_at=excluded.updated_at").bind(Date.now()).run();return reply({enabled:false,configured:false,model:AI_MODEL});}
  const key=typeof input.key==='string'?input.key.trim():'';
  if(!/^sk-[A-Za-z0-9_-]{20,1000}$/.test(key))return reply({error:'請輸入有效的 OpenAI API 金鑰'},400);
  // Validate the exact endpoint/model/schema before changing a working key.
  const test={match:{id:'connection-test',league:'MLB',day:'2026-01-01',home:'主隊',away:'客隊',start:'2026-01-01T12:00:00Z'},model:'connection-test',capturedAt:new Date().toISOString(),evidence:[{id:'test',topic:'analysis',text:'連線測試：主隊模型勝率 60%，客隊 40%。'}],suggestion:{}} as AiSnapshot;
  const selected=await selectAiEvidence(test,'主隊勝率多少？',[],key);
  if(selected.scope!=='match'||!Array.isArray(selected.factIds)||!selected.factIds.includes('test'))return reply({error:'AI 測試未通過，原設定未變更。'},400);
  await saveAiSettings(db,key);return reply({enabled:true,configured:true,model:AI_MODEL});
 }catch{return reply({error:'金鑰未儲存，請確認 API 金鑰、模型權限與可用額度後再試。'},400);}
}
