import {createPublicKey,verify} from 'node:crypto';
export const SYNC_AUDIENCE='https://arena-sports-board.onrender.com/api/international-sync';
const issuer='https://token.actions.githubusercontent.com';
const repository='poias45652-creator/arena-sports-board';
let cached=null,until=0;
async function keys(){
 if(cached&&until>Date.now())return cached;
 const r=await fetch(issuer+'/.well-known/jwks',{signal:AbortSignal.timeout(10000),redirect:'error'});
 if(!r.ok)throw Error('OIDC key service unavailable');
 const data=await r.json();if(!Array.isArray(data.keys))throw Error('Invalid keys');
 cached=data.keys;until=Date.now()+300000;return cached;
}
// The scheduled job has permission only to refresh public international data.
// No session, administrator, user data or MLB access is granted by this token.
export async function authorizeGithubSync(header,{getKeys=keys,now=Date.now}={}){
 try{
  if(typeof header!=='string'||header.length>16000||!header.startsWith('Bearer '))return false;
  const parts=header.slice(7).split('.');if(parts.length!==3)return false;
  const h=JSON.parse(Buffer.from(parts[0],'base64url')),p=JSON.parse(Buffer.from(parts[1],'base64url'));
  const t=now()/1000;
  if(h.alg!=='RS256'||typeof h.kid!=='string'||h.crit||p.iss!==issuer||p.aud!==SYNC_AUDIENCE||
   p.repository!==repository||p.repository_id!=='1365619402'||p.repository_owner_id!=='326707968'||
   p.ref!=='refs/heads/main'||p.workflow_ref!==repository+'/.github/workflows/international-daily.yml@refs/heads/main'||
   !['schedule','workflow_dispatch','push'].includes(p.event_name)||
   ![p.exp,p.iat,p.nbf].every(Number.isFinite)||p.exp<=t||p.nbf>t+30||p.iat>t+30||t-p.iat>600||p.exp-p.iat>900)return false;
  const key=(await getKeys()).find(k=>k.kid===h.kid&&k.kty==='RSA'&&k.use==='sig'&&(!k.alg||k.alg==='RS256'));
  return !!key&&verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key,format:'jwk'}),Buffer.from(parts[2],'base64url'));
 }catch{return false;}
}
