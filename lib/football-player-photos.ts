import catalog from '../data/football-player-photos.json';
import reviewedSources from '../data/football-reviewed-photo-sources.json';
import {createHash} from 'node:crypto';
import {isFootballLeague} from './football';
import {sameFootballPhotoIdentity,safeFootballPhotoUrl,validFootballPhotoBytes,type FootballPhotoIdentity} from './football-photo-identity';
const identities=catalog.players as Record<string,FootballPhotoIdentity>;
const reviewed=reviewedSources as Record<string,{url:string;sha256:string;type:string}>;
const reviewedHosts=new Set(['assets.bundesliga.com','assets.laliga.com','cagliaricalcio.com','images.fotmob.com','img.a.transfermarkt.technology','img.uefa.com','media-cdn.cortextech.io','media-sdp.legaseriea.it','res.cloudinary.com','statics-maker.llt-services.com']);
type Photo={bytes:Uint8Array;type:string;expires:number};
const cache=new Map<string,Photo>(),discovered=new Map<string,{identity:FootballPhotoIdentity|null;expires:number}>();
const unavailable=new Map<string,number>();
function miss(id:string){if(unavailable.size>=1000)unavailable.delete(unavailable.keys().next().value!);unavailable.set(id,Date.now()+3600000);return null;}
let cacheBytes=0,active=0;const queue:(()=>void)[]=[];
const LIMIT=16*1024*1024;
async function json(url:string){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(7000),redirect:'error'});if(!r.ok)throw Error('Photo source unavailable');const text=await r.text();if(text.length>2000000)throw Error('Photo source too large');return JSON.parse(text);}
async function discover(id:string,league:string):Promise<FootballPhotoIdentity|null>{
 const hit=discovered.get(id);if(hit&&hit.expires>Date.now())return hit.identity;
 let identity=identities[id];
 if(!identity){const d=await json(`https://site.web.api.espn.com/apis/common/v3/sports/soccer/${league}/athletes/${id}`),p=d.athlete;if(String(p?.id)!==id||!p.displayName||!p.dateOfBirth)return null;identity={name:String(p.displayName),birthDate:String(p.dateOfBirth).slice(0,10)};}
 const result=await json('https://www.fotmob.com/api/data/search/suggest?term='+encodeURIComponent(identity.name));
 if(!Array.isArray(result))throw Error('Invalid photo search');
 const candidates=new Map<string,any>();
 for(const group of result)for(const p of group.suggestions||[])if(p.type==='player'&&!p.isCoach&&/^\d{1,12}$/.test(String(p.id)))candidates.set(String(p.id),p);
 const matches:FootballPhotoIdentity[]=[];
 for(const [providerId]of [...candidates].slice(0,3)){
  const p=await json('https://www.fotmob.com/api/data/playerData?id='+providerId);
  if(String(p.id)===providerId&&!p.isCoach&&p.gender==='male'&&sameFootballPhotoIdentity(identity,{name:String(p.name||''),birthDate:String(p.birthDate?.utcTime||'').slice(0,10)}))matches.push({...identity,providerId});
 }
 const value=matches.length===1?matches[0]:null;
 if(discovered.size>=1000)discovered.delete(discovered.keys().next().value!);
 discovered.set(id,{identity:value,expires:Date.now()+(value?86400000:3600000)});return value;
}
async function readPhoto(identity:FootballPhotoIdentity,verified?:{url:string;sha256:string;type:string}){
 const url=verified?.url||identity.sourceUrl||(identity.providerId?`https://images.fotmob.com/image_resources/playerimages/${identity.providerId}.png`:'');
 if(verified){const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!reviewedHosts.has(u.hostname)||!/^[a-f0-9]{64}$/.test(verified.sha256)||!['image/png','image/webp'].includes(verified.type))return null;}
 else if(!safeFootballPhotoUrl(url))return null;
 const maxBytes=verified?2000000:1000000;
 const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000),redirect:'error'});
 if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))return null;
 if(Number(r.headers.get('content-length')||0)>maxBytes)return null;
 const chunks:Uint8Array[]=[];let length=0;const reader=r.body?.getReader();if(!reader)return null;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>maxBytes){await reader.cancel();return null;}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 // Reviewed source bytes were inspected for identity, transparency, format and
 // dimensions. A changed CDN response must be reviewed instead of served blindly.
 if(verified){if(createHash('sha256').update(bytes).digest('hex')!==verified.sha256)return null;}
 else if(!validFootballPhotoBytes(bytes))return null;
 return {bytes,type:verified?.type||'image/png',expires:Date.now()+86400000};
}
export async function footballPlayerPhoto(id:string,league:string):Promise<Photo|null>{
 if(!/^\d{1,12}$/.test(id)||!isFootballLeague(league))return null;
 const hit=cache.get(id);if(hit&&hit.expires>Date.now())return hit;
 if((unavailable.get(id)||0)>Date.now())return null;
 if(queue.length>=120)throw Error('Photo queue is busy');
 if(active>=8)await new Promise<void>(resolve=>queue.push(resolve));else active++;
 try{
  const cached=cache.get(id);if(cached&&cached.expires>Date.now())return cached;
  const known=identities[id],verified=reviewed[id],identity=verified&&known?known:known?.providerId||known?.sourceUrl?known:await discover(id,league);
  if(!identity)return miss(id);const photo=await readPhoto(identity,verified);if(!photo)return miss(id);
  if(cache.has(id)){cacheBytes-=cache.get(id)!.bytes.length;cache.delete(id);}
  while(cacheBytes+photo.bytes.length>LIMIT||cache.size>=1200){const first=cache.keys().next().value;if(!first)break;cacheBytes-=cache.get(first)!.bytes.length;cache.delete(first);}
  cache.set(id,photo);cacheBytes+=photo.bytes.length;return photo;
 }finally{const next=queue.shift();if(next)next();else active--;}
}
