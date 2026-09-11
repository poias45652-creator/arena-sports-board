// Only used on the server. Tokens are bound cryptographically to their Arena owner.
const encoder = new TextEncoder();
function base64(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)); }
function bytes(value: string): Uint8Array { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
export async function credentialKey(secret: string): Promise<CryptoKey> {
 const raw = bytes(secret);
 if (raw.length !== 32) throw new Error('Invalid binding encryption key');
 return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt','decrypt']);
}
export async function encryptToken(token: string, memberId: string, key: CryptoKey): Promise<string> {
 const iv = crypto.getRandomValues(new Uint8Array(12));
 const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(memberId)},key,encoder.encode(token));
 return `v1.${base64(iv)}.${base64(new Uint8Array(ciphertext))}`;
}
export async function decryptToken(value: string, memberId: string, key: CryptoKey): Promise<string> {
 const [version,iv,ciphertext,...extra] = value.split('.');
 if(version!=='v1'||extra.length)throw new Error('Invalid encrypted credential');
 const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv) as BufferSource,additionalData:encoder.encode(memberId)},key,bytes(ciphertext) as BufferSource);
 return new TextDecoder().decode(plaintext);
}
// Expiry is read only from a token returned directly by tz over HTTPS.
// This parser does not authenticate arbitrary client-supplied JWTs.
export function loginExpiry(token: string, now: number): number {
 if(token.length>16384||token.split('.').length!==3)throw new Error('Invalid source token');
 const payload=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
 const claims=JSON.parse(new TextDecoder().decode(bytes(payload.padEnd(Math.ceil(payload.length/4)*4,'='))));
 if(!Number.isSafeInteger(claims.exp)||claims.exp*1000<=now+30000)throw new Error('Expired source token');
 return claims.exp*1000;
}
