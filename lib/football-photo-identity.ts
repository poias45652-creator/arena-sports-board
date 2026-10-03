export type FootballPhotoIdentity = {name:string;birthDate:string;providerId?:string;sourceUrl?:string};
export function normalizeFootballPhotoName(value:string){return value.toLowerCase().replace(/[øłđðıþæß]/g,c=>({ø:'o',ł:'l',đ:'d',ð:'d',ı:'i',þ:'th',æ:'ae',ß:'ss'}[c]!)).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
export function sameFootballPhotoIdentity(expected:FootballPhotoIdentity,actual:{name:string;birthDate:string}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(expected.birthDate)||expected.birthDate!==actual.birthDate)return false;
 // Runtime discoveries require the complete name and date of birth. Verified
 // spelling variants belong in the reviewed snapshot, never a fuzzy live guess.
 return normalizeFootballPhotoName(expected.name)===normalizeFootballPhotoName(actual.name);
}
export function safeFootballPhotoUrl(value:string){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&((u.hostname==='images.fotmob.com'&&/^\/image_resources\/playerimages\/\d+\.png$/.test(u.pathname))||(u.hostname==='a.espncdn.com'&&/^\/i\/headshots\/soccer\/players\/full\/\d+\.png$/.test(u.pathname)));}catch{return false;}
}
export function validFootballPhotoBytes(bytes:Uint8Array){
 // PNG signature and bounded dimensions; HTML/JSON error pages must never be cached as portraits.
 if(bytes.byteLength<100||bytes.byteLength>1000000||![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return false;
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),w=view.getUint32(16),h=view.getUint32(20);
 return w>=64&&h>=64&&w<=2048&&h<=2048;
}
