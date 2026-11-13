import {randomBytes} from 'node:crypto';
import type {Database} from '../db';
import {hash,readSession,OFA_MEMBER_USERNAMES} from './arena-session';

const NATIVE='https://xingzhun-original-test.onrender.com';
const PORTAL_COOKIE='__Host-xz_portal';
export const portalCookie=(v:string,seconds:number)=>`${PORTAL_COOKIE}=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
function portalToken(cookie:string|null){
  const parts=(cookie||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(PORTAL_COOKIE+'='));
  const v=parts.length===1?parts[0].slice(PORTAL_COOKIE.length+1):'';
  return /^[a-f0-9]{64}$/.test(v)?v:null;
}
const ofaTableMembers = new Set(['dvp038', 'dvp03068', 'tzt05', ...OFA_MEMBER_USERNAMES]);
function supportsTableLogin(memberId:string, username:string) {
  const ofaAccount = ofaTableMembers.has(username.toLowerCase());
  return ofaAccount ? memberId.startsWith('ofa:') : memberId.startsWith('tz:');
}

export async function tableAccess(username:string, platform?:'DG'|'MT', quickCheck=false) {
  const key=process.env.XZ_PLATFORM_BRIDGE_KEY;
  if(!key||key.length<40)throw Error('百家樂權限暫時無法確認');
  // A check can be repeated while the service starts. Issuing a ticket is a write.
  const timeouts = quickCheck ? [3500] : platform ? [15000] : [8000, 50000];
  for (const timeout of timeouts) {
    let response:Response;
    try {
      response=await fetch(NATIVE+'/internal/member-access',{
        method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(timeout),
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
        body:JSON.stringify({username,platform,operation:platform?'ticket':'check'})
      });
    } catch (error) {
      if (timeout===timeouts.at(-1)) throw error;
      continue;
    }
    if ([502,503,504].includes(response.status)) {
      await response.body?.cancel();
      continue;
    }
    const data=await response.json();
    if(response.status===403&&data.allowed===false)return {allowed:false,ticket:''};
    if(!response.ok||data.allowed!==true||(platform&&!/^[0-9a-f]{64}$/.test(data.ticket)))break;
    return {allowed:true,ticket:platform?String(data.ticket):''};
  }
  throw Error('百家樂權限暫時無法確認');
}
export async function issueTableOnlySession(db:Database,member:string,username:string,expiry:number) {
  if(!supportsTableLogin(member,username)||!(await tableAccess(username)).allowed)return null;
  const v=randomBytes(32).toString('hex'), expires=Math.min(expiry,Date.now()+4*3600000);
  await db.batch([db.prepare('DELETE FROM xz_portal_sessions WHERE expires_at<=? OR member_id=?').bind(Date.now(),member),
    db.prepare('INSERT INTO xz_portal_sessions(token_hash,member_id,expires_at) VALUES(?,?,?)').bind(await hash(v),member,expires)]);
  return portalCookie(v,Math.max(0,Math.floor((expires-Date.now())/1000)));
}
export async function forgetPortal(db:Database,cookie:string|null){
  const v=portalToken(cookie);
  if(v)await db.prepare('DELETE FROM xz_portal_sessions WHERE token_hash=?').bind(await hash(v)).run();
}
export async function platformIdentity(db:Database,cookie:string|null){
  const sport=await readSession(db,cookie);
  if(sport)return {memberId:sport.memberId,username:String(sport.username),sports:true,canCheckTable:sport.accessMode!=='view_only'&&supportsTableLogin(sport.memberId,String(sport.username))};
  const v=portalToken(cookie);if(!v)return null;
  const now=Date.now();
  const row=await db.prepare('SELECT b.member_id,b.username FROM xz_portal_sessions s JOIN tz_bindings b ON b.member_id=s.member_id WHERE s.token_hash=? AND s.expires_at>? AND b.expires_at>?').bind(await hash(v),now,now).first();
  return row&&supportsTableLogin(String(row.member_id),String(row.username))?{memberId:String(row.member_id),username:String(row.username),sports:false,canCheckTable:true}:null;
}
