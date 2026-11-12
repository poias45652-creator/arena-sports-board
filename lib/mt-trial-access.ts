import {getPool} from '../server/database.mjs';
import {canonicalGuestIp,createTrialLedger} from './mt-trial-limit';
import {launchMtTrial,mtTrialConfigured} from './mt-trial';
import {requestOrigin} from './request-origin';

const headers = {'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const config = () => ({enabled:process.env.OFA_MT_TRIAL_ENABLED,password:process.env.OFA_MT_TRIAL_PASSWORD});
const ledger = createTrialLedger({query:(sql,args) => getPool().query(sql,args)});
const reply = (data:object, status=200) => Response.json(data,{status,headers});
const expired = '這個 IP 的 3 分鐘試玩已結束。';

export async function guestTrial(request:Request, start:boolean) {
  if (start && (request.method !== 'POST' || request.headers.get('origin') !== requestOrigin(request) ||
    request.headers.get('sec-fetch-site') === 'cross-site')) return reply({message:'請從星準試玩頁開啟。'},403);
  const ip = canonicalGuestIp(request.headers);
  if (!ip) return reply({message:'無法辨識試玩連線，請重新連線。'},503);
  try {
    const current = await ledger(ip,false);
    if (current.state === 'expired') return reply({...current,message:expired},410);
    if (!start) return reply(current);
    if (request.headers.get('x-mt-trial') !== 'ip-180') return reply({message:'試玩頁已更新，請重新整理後開始。'},426);
    if (!mtTrialConfigured(config())) return reply({message:'MT 試玩尚未啟用。'},503);
    // Do not consume an unused IP when the upstream grant fails. Recheck the
    // database after slow logins so a request cannot finish beyond its deadline.
    const response = await launchMtTrial(request,config());
    if (!response.ok) return response;
    const {gameUrl} = await response.json();
    const lease = await ledger(ip,true);
    if (lease.state !== 'active') return reply({...lease,message:expired},410);
    return reply({...lease,gameOrigin:new URL(gameUrl).origin});
  } catch {
    return reply({message:'暫時無法核對試玩時間，請稍後再試。'},503);
  }
}

// A table navigation, including reloading a table iframe, checks the database
// independently of the outer UI. Only the active guest can load the provider.
export async function activeGameGrant(request:Request) {
  const ip=canonicalGuestIp(request.headers);
  if(!ip) return reply({message:unavailable},503);
  try {
    const before=await ledger(ip,false);
    if(before.state!=='active')return reply({...before,message:before.state==='expired'?expired:'請先開始試玩。'},before.state==='expired'?410:403);
    const origin=requestOrigin(request);
    const internal=new Request(origin+'/mt-trial/launch',{method:'POST',headers:{origin}});
    const grant=await launchMtTrial(internal,config());
    if(!grant.ok)return grant;
    const {gameUrl}=await grant.json();
    const lease=await ledger(ip,false);
    if(lease.state!=='active')return reply({...lease,message:expired},410);
    return {url:new URL(gameUrl),lease,ip};
  }catch{return reply({message:unavailable},503);}
}
const unavailable='暫時無法核對試玩連線。';

export async function guestTable(request:Request) {
  if(request.headers.get('sec-fetch-dest')!=='iframe')return reply({message:'請在星準試玩牌桌內開啟。'},403);
  const room=new URL(request.url).searchParams.get('game');
  if(room && !/^BAV(?:0[1235](?:_LIVE)?|03A(?:_LIVE)?|0[6789]|10)$/.test(room))return reply({message:'桌號無效。'},400);
  const grant=await activeGameGrant(request);
  if(grant instanceof Response)return grant;
  if(room) grant.url.searchParams.set('game',room);
  return new Response(null,{status:302,headers:{...headers,Location:grant.url.href}});
}
