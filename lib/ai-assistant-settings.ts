import {credentialKey,decryptToken,encryptToken} from './tz-credentials';
export async function readAiSettings(db:any){
 const row=await db.prepare("SELECT encrypted_key,enabled FROM ai_assistant_settings WHERE id='main'").first();
 if(row&&!row.enabled)return {enabled:false,key:''};
 if(row?.encrypted_key){
  const encryption=process.env.TZ_BINDING_KEY;if(!encryption)throw Error('Encryption unavailable');
  return {enabled:true,key:await decryptToken(row.encrypted_key,'ai-assistant:main',await credentialKey(encryption))};
 }
 const key=process.env.OPENAI_API_KEY||'';
 return {enabled:!!key,key};
}
export async function saveAiSettings(db:any,key:string){
 const encryption=process.env.TZ_BINDING_KEY;if(!encryption)throw Error('Encryption unavailable');
 const encrypted=await encryptToken(key,'ai-assistant:main',await credentialKey(encryption));
 await db.prepare("INSERT INTO ai_assistant_settings (id,encrypted_key,enabled,updated_at) VALUES ('main',?,1,?) ON CONFLICT(id) DO UPDATE SET encrypted_key=excluded.encrypted_key,enabled=1,updated_at=excluded.updated_at").bind(encrypted,Date.now()).run();
}
// Atomic persistent counters bound provider costs even across concurrent requests/restarts.
export async function consumeAiQuota(db:any,member:string,kind:'list'|'question',now=Date.now()){
 const limits=kind==='list'?[['minute',Math.floor(now/60000),20]]:[['minute',Math.floor(now/60000),10],['day',Math.floor((now+8*3600000)/86400000),100]];
 for(const [period,slot,limit] of limits){
  const row=await db.prepare('INSERT INTO ai_assistant_usage (id,count,updated_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=ai_assistant_usage.count+1,updated_at=excluded.updated_at WHERE ai_assistant_usage.count<? RETURNING count').bind(`${member}:${kind}:${period}:${slot}`,now,limit).first();
  if(!row)return false;
 }
 return true;
}
