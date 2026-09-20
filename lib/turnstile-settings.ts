import {credentialKey,decryptToken,encryptToken} from './tz-credentials';
export async function readTurnstileSettings(db:any,encryptionKey:string|undefined){
 const row=await db.prepare("SELECT encrypted_secret,enabled FROM turnstile_settings WHERE id='login'").first();
 if(!row){const secret=process.env.TURNSTILE_SECRET||process.env.TURNSTILE_SECRET_KEY;if(secret&&!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)throw new Error('Turnstile site key is not configured');return {enabled:!!secret,secret:secret||undefined};}
 if(!row.enabled)return {enabled:false,secret:undefined};
 if(!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)throw new Error('Turnstile site key is not configured');
 if(!encryptionKey)throw new Error('Verification configuration unavailable');
 return {enabled:true,secret:await decryptToken(row.encrypted_secret,'turnstile:login',await credentialKey(encryptionKey))};
}
export async function saveTurnstileSettings(db:any,encryptionKey:string,secret:string){
 const encrypted=await encryptToken(secret,'turnstile:login',await credentialKey(encryptionKey));
 await db.prepare("INSERT INTO turnstile_settings (id,encrypted_secret,enabled,updated_at) VALUES ('login',?,1,?) ON CONFLICT(id) DO UPDATE SET encrypted_secret=excluded.encrypted_secret,enabled=1,updated_at=excluded.updated_at").bind(encrypted,Date.now()).run();
}
